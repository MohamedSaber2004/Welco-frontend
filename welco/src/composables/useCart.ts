import { ref, computed, watch } from 'vue'
import type { CartItem, ProductDto } from '../domain/models/marketplace'
import type { CreateOrderItemPayload } from '../domain/models/commerce'
import type { CreateRfqItemPayload } from '../domain/models/sales'
import { services } from '../di/container'

const items = ref<CartItem[]>([])
const quoteNote = ref('')
const targetCurrency = ref<string>(localStorage.getItem('welco-target-currency') || 'USD')
const convertedMap = ref<Map<string, number>>(new Map())
// Product ids whose price could NOT be converted (missing live rate) and are
// therefore displayed/charged in their original currency.
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

// Ceiling to 2 decimals (round up to cents): 28.775 -> 28.78, 28.771 -> 28.78.
// The tiny epsilon absorbs binary floating-point noise (e.g. 28.78 stored as
// 28.780000000000001) so exact cent values are not pushed up by a phantom
// fraction.
function ceilToCents(n: number): number {
  if (!Number.isFinite(n)) return n
  return Math.ceil(n * 100 - 1e-9) / 100
}

if (typeof window !== 'undefined') loadFromStorage()

watch(targetCurrency, persistTarget)

async function refreshConversions() {
  if (!items.value.length) { convertedMap.value = new Map(); unconvertedIds.value = []; return }
  const tCur = targetCurrency.value.toUpperCase()
  const map = new Map<string, number>()
  const failed: string[] = []
  // Ensure latest rates loaded
  try { await services.exchangeRateService.loadLatest('USD') } catch { }
  for (const it of items.value) {
    const from = (it.product.currencyCode || it.product.currency || 'USD').toUpperCase()
    // All cart display prices (and order/RFQ payloads built from them) use
    // ceiling to cents so shoppers never see more than 2 decimals.
    if (from === tCur) map.set(it.product.id, ceilToCents(it.product.price))
    else {
      try {
        const conv = await services.exchangeRateService.convertLocal(it.product.price, from, tCur, 'USD')
        map.set(it.product.id, ceilToCents(conv))
      } catch {
        // Local rate table lacks this pair — ask the server for today's
        // conversion before giving up and flagging the item as unconverted.
        try {
          const res = await services.exchangeRateService.convert(it.product.price, from, tCur)
          map.set(it.product.id, ceilToCents(res.convertedAmount))
        } catch {
          map.set(it.product.id, ceilToCents(it.product.price))
          failed.push(it.product.id)
        }
      }
    }
  }
  convertedMap.value = map
  unconvertedIds.value = failed
}

watch([items, targetCurrency], () => { void refreshConversions() }, { deep: true, immediate: true })

export function useCart() {
  const count = computed(() => items.value.reduce((s, i) => s + i.quantity, 0))
  // Raw total (for reference)
  const total = computed(() => items.value.reduce((s, i) => s + i.product.price * i.quantity, 0))
  // Converted total in targetCurrency
  const convertedTotal = computed(() => {
    return items.value.reduce((s, i) => {
      const convPrice = convertedMap.value.get(i.product.id) ?? i.product.price
      return s + convPrice * i.quantity
    }, 0)
  })
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
    void refreshConversions()
  }

  function getConvertedPrice(product: ProductDto): number {
    return convertedMap.value.get(product.id) ?? product.price
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

  function clear() { items.value = []; quoteNote.value = ''; localStorage.removeItem('welco-cart'); localStorage.removeItem('welco-quote-note') }

  function setNote(v: string) { quoteNote.value = v; localStorage.setItem('welco-quote-note', v) }

  function toOrderItems(): CreateOrderItemPayload[] {
    return items.value.map(i => ({
      productId: i.product.id,
      quantity: i.quantity,
      unitPrice: getConvertedPrice(i.product),
    }))
  }

  function toRfqItems(): CreateRfqItemPayload[] {
    return items.value.map(i => ({ productId: i.product.id, quantity: i.quantity, unitPrice: getConvertedPrice(i.product) }))
  }

  function toDisplayCurrency(): string {
    return targetCurrency.value
  }

  // For quote-approved order: build items from quote with repriced unitPrice
  function toOrderItemsFromQuote(quoteItems: { productId: string; quantity: number; unitPrice: number }[]): CreateOrderItemPayload[] {
    return quoteItems.map(q => ({ productId: q.productId, quantity: q.quantity, unitPrice: q.unitPrice }))
  }

  return { items, count, total, convertedTotal, targetCurrency, convertedMap, unconvertedIds, currency, currencyCode, displayCurrency, quoteNote, add, setQty, remove, clear, setNote, toOrderItems, toRfqItems, toDisplayCurrency, toOrderItemsFromQuote, getConvertedPrice, setTargetCurrency, refreshConversions }
}
