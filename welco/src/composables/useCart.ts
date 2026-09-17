import { ref, computed, watch } from 'vue'
import type { CartItem, ProductDto } from '../domain/models/marketplace'
import type { CreateOrderItemPayload } from '../domain/models/commerce'
import type { CreateRfqItemPayload } from '../domain/models/sales'
import { services } from '../di/container'
import { buildCreateCartPayload } from '../application/commerce.service'
import { toastService } from '../infrastructure/feedback/toast.service'
import { t } from '../i18n'

const items = ref<CartItem[]>([])
const quoteNote = ref('')
const targetCurrency = ref<string>(localStorage.getItem('welco-target-currency') || 'USD')
// Product ids the backend could NOT price (missing DB rate). Totals for the
// cart are never computed here — only the backend cart-total quote is shown.
const unconvertedIds = ref<string[]>([])

function loadFromStorage() {
  try {
    const raw = localStorage.getItem('welco-cart')
    if (raw) items.value = JSON.parse(raw) as CartItem[]
    const note = localStorage.getItem('welco-quote-note')
    if (note) quoteNote.value = note
    const tc = localStorage.getItem('welco-target-currency')
    if (tc) targetCurrency.value = tc
  } catch {  }
}
function persist() {
  localStorage.setItem('welco-cart', JSON.stringify(items.value))
}
function persistTarget() {
  localStorage.setItem('welco-target-currency', targetCurrency.value)
}

// Server-synced cart (guest sessionId + auth merge). localStorage `welco-cart`
// stays the offline source of truth; server calls are best-effort and never throw.
const serverCartId = ref<string | null>(typeof window !== 'undefined' ? localStorage.getItem('welco-cart-id') : null)
let serverSyncScheduled = false

function getSessionId(): string {
  try {
    let sid = localStorage.getItem('welco-session-id')
    if (!sid) {
      sid = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`
      localStorage.setItem('welco-session-id', sid)
    }
    return sid
  } catch {
    return `sess-${Date.now()}`
  }
}

function resolveCurrencyId(): string | undefined {
  try {
    const code = targetCurrency.value.toUpperCase()
    return services.marketplaceService.currencies.value.find((c) => (c.code || '').toUpperCase() === code)?.id
  } catch {
    return undefined
  }
}

async function syncToServer(): Promise<void> {
  if (typeof window === 'undefined') return
  // Backend carts require bearer even for sessionId guests (401 otherwise).
  // Guests stay local-only to avoid console 401 spam; server sync runs after login.
  const preUserId = services.authService.user.value?.id ?? null
  if (!preUserId) return
  try {
    const sid = getSessionId()
    if (!items.value.length) {
      try {
        const existing = await services.commerceRepository.getBySession(sid)
        const id = (existing as unknown as { id?: string } | null)?.id
        if (id) {
          serverCartId.value = id
          try { localStorage.setItem('welco-cart-id', id) } catch { /* offline fallback */ }
        }
      } catch { /* stay local-only */ }
      return
    }
    const userId = services.authService.user.value?.id ?? null
    const payload = buildCreateCartPayload(userId, sid, resolveCurrencyId())
    let cartId = serverCartId.value
    if (!cartId) {
      if (!userId) {
        try {
          const existing = await services.commerceRepository.getBySession(sid)
          const id = (existing as unknown as { id?: string } | null)?.id
          if (id) cartId = id
        } catch { /* no reusable guest cart */ }
      }
      if (!cartId) {
        const created = await services.commerceRepository.createCart(payload)
        cartId = (created as unknown as { id?: string } | null)?.id ?? null
      }
      if (cartId) {
        serverCartId.value = cartId
        try { localStorage.setItem('welco-cart-id', cartId) } catch { /* offline fallback */ }
      }
    }
    if (!cartId) return
    for (const line of items.value) {
      try {
        await services.commerceRepository.addItem(cartId, {
          productId: line.product.id,
          quantity: line.quantity,
          unitPriceSnapshot: line.product.price,
        })
      } catch { /* per-line failure stays local-only */ }
    }
  } catch (err) {
    try { toastService.error(err instanceof Error ? err.message : t('common.error')) } catch { /* never block */ }
  }
}

async function clearServerCart(): Promise<void> {
  const id = serverCartId.value ?? (typeof window !== 'undefined' ? localStorage.getItem('welco-cart-id') : null)
  if (!id) return
  try {
    await services.commerceRepository.clearCart(id)
  } catch (err) {
    try { toastService.error(err instanceof Error ? err.message : t('common.error')) } catch { /* never block */ }
  } finally {
    serverCartId.value = null
    try { localStorage.removeItem('welco-cart-id') } catch { /* offline fallback */ }
  }
}

export interface ServerCartLineTotal {
  productId: string
  convertedUnit: number
  lineTotal: number
  rate: number
  ceiledUnit: number
}

export interface ServerCartTotal {
  total: number
  subtotal: number
  currency: string
  lines: Map<string, ServerCartLineTotal>
  source: string
}

/** Backend-calculated cart total (DB rates + ceiling). Null until quoted. */
const serverTotal = ref<ServerCartTotal | null>(null)
const serverTotalLoading = ref(false)
let serverTotalSeq = 0
let serverTotalTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Price each cart item in the target currency using the public /convert
 * endpoint (from / to / amount). Totals are computed here from the returned
 * converted amounts; no backend cart-total quote is used.
 */
async function refreshServerTotal(): Promise<void> {
  if (typeof window === 'undefined' || import.meta.env?.MODE === 'test') return
  if (!items.value.length) {
    serverTotal.value = null
    serverTotalLoading.value = false
    unconvertedIds.value = []
    return
  }
  const tCur = targetCurrency.value.toUpperCase()
  const seq = ++serverTotalSeq
  serverTotalLoading.value = true
  try {
    const results = await Promise.all(
      items.value.map(async (item) => {
        const fromCurrency = (item.product.currencyCode || item.product.currency || 'USD').toUpperCase()
        const nativePrice = Number(item.product.price)
        const converted = await services.exchangeRateService.convert(nativePrice, fromCurrency, tCur)
        return {
          productId: item.product.id,
          convertedUnit: converted.convertedAmount,
          lineTotal: converted.convertedAmount * item.quantity,
          rate: converted.rate,
          ceiledUnit: Math.ceil(nativePrice),
        }
      }),
    )
    if (seq !== serverTotalSeq) return
    const lines = new Map<string, ServerCartLineTotal>()
    for (const r of results) {
      lines.set(r.productId, r)
    }
    const subtotal = results.reduce((sum, r) => sum + r.lineTotal, 0)
    serverTotal.value = {
      total: subtotal,
      subtotal: subtotal,
      currency: tCur,
      lines,
      source: 'frontend',
    }
    unconvertedIds.value = items.value.filter((i) => !lines.has(i.product.id)).map((i) => i.product.id)
  } catch {
    if (seq !== serverTotalSeq) return
    serverTotal.value = null
    unconvertedIds.value = items.value.map((i) => i.product.id)
  } finally {
    if (seq === serverTotalSeq) serverTotalLoading.value = false
  }
}

function scheduleServerTotal(): void {
  if (typeof window === 'undefined' || import.meta.env?.MODE === 'test') return
  if (serverTotalTimer) clearTimeout(serverTotalTimer)
  serverTotalTimer = setTimeout(() => {
    serverTotalTimer = null
    void refreshServerTotal()
  }, 350)
}

if (typeof window !== 'undefined') loadFromStorage()

watch(targetCurrency, persistTarget)

watch([items, targetCurrency], () => { scheduleServerTotal() }, { deep: true, immediate: true })

export function useCart() {
  const count = computed(() => items.value.reduce((s, i) => s + i.quantity, 0))
  /** Backend ceiling total — null until the backend quotes the cart. */
  const displayTotal = computed(() => serverTotal.value?.total ?? null)
  const displaySubtotal = computed(() => serverTotal.value?.subtotal ?? null)
  const currency = computed(() => targetCurrency.value)
  const currencyCode = computed(() => targetCurrency.value)
  const displayCurrency = computed(() => targetCurrency.value)

  function currencyOf(p: ProductDto): string {
    return p.currencyCode || p.currency || 'USD'
  }

  function setTargetCurrency(code: string) {
    const upper = code.trim().toUpperCase()
    if (!upper) return
    targetCurrency.value = upper
    scheduleServerTotal()
  }

  /** Native database unit price — the only unit price used client-side. */
  function getNativePrice(product: ProductDto): number {
    return product.price
  }

  /** Backend-quoted converted unit for a line, if the server priced it. */
  function getServerLine(productId: string): ServerCartLineTotal | null {
    return serverTotal.value?.lines.get(productId) ?? null
  }

  function add(product: ProductDto, qty = 1) {
    // Multi-currency now supported via conversion to targetCurrency
    // Auto-set target to first product's currency if not yet chosen or still default USD with no addresses
    if (!items.value.length && !localStorage.getItem('welco-target-currency')) {
      // keep target as is; will be overridden by address logic in views
    }
    const qtyClamped = Math.max(product.minOrderQty, qty)
    const existing = items.value.find(i => i.product.id === product.id)
    if (existing) {
      existing.quantity = Math.min(product.stock, existing.quantity + qtyClamped)
    } else {
      items.value.push({ product, quantity: Math.min(qtyClamped, product.stock) })
    }
    persist()
  }

  function setQty(productId: string, qty: number) {
    const it = items.value.find(i => i.product.id === productId)
    if (!it) return
    if (qty <= 0) remove(productId)
    else { it.quantity = Math.min(it.product.stock, Math.max(it.product.minOrderQty, qty)); persist() }
  }

  function remove(productId: string) {
    items.value = items.value.filter(i => i.product.id !== productId)
    persist()
  }

  function clear() { items.value = []; quoteNote.value = ''; localStorage.removeItem('welco-cart'); localStorage.removeItem('welco-quote-note'); void clearServerCart().catch(() => {}) }

  function setNote(v: string) { quoteNote.value = v; localStorage.setItem('welco-quote-note', v) }

  function toOrderItems(): CreateOrderItemPayload[] {
    return items.value.map(i => ({
      productId: i.product.id,
      quantity: i.quantity,
      unitPrice: Math.ceil(getServerLine(i.product.id)?.convertedUnit ?? i.product.price),
    }))
  }

  function toRfqItems(): CreateRfqItemPayload[] {
    return items.value.map(i => ({ productId: i.product.id, quantity: i.quantity, unitPrice: Math.ceil(getServerLine(i.product.id)?.convertedUnit ?? i.product.price) }))
  }

  function toDisplayCurrency(): string {
    return targetCurrency.value
  }

  // For quote-approved order: build items from quote with repriced unitPrice
  function toOrderItemsFromQuote(quoteItems: { productId: string; quantity: number; unitPrice: number }[]): CreateOrderItemPayload[] {
    return quoteItems.map(q => ({ productId: q.productId, quantity: q.quantity, unitPrice: q.unitPrice }))
  }

  // Best-effort server sync when authenticated.
  // Fire-and-forget: localStorage remains the offline fallback, sync failures
  // never block checkout. Guests stay local-only (backend 401s anon carts).
  // Re-sync on login so guest items added before sign-in merge to server.
  if (typeof window !== 'undefined' && import.meta.env?.MODE !== 'test') {
    if (!serverSyncScheduled) {
      serverSyncScheduled = true
      void syncToServer()
      // Watch once (module-level guard via serverSyncScheduled) for login merge.
      watch(
        () => services.authService.user.value?.id,
        (id, prev) => {
          if (id && id !== prev) void syncToServer()
        },
      )
    }
  }

  return { items, count, displayTotal, displaySubtotal, serverTotal, serverTotalLoading, targetCurrency, unconvertedIds, currency, currencyCode, displayCurrency, quoteNote, serverCartId, add, setQty, remove, clear, setNote, toOrderItems, toRfqItems, toDisplayCurrency, toOrderItemsFromQuote, getNativePrice, getServerLine, setTargetCurrency, refreshServerTotal, currencyOf, getSessionId, syncToServer, clearServerCart }
}
