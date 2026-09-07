import { ref, computed, watch } from 'vue'
import { services } from '../di/container'
import type { MarketplaceQuery } from '../domain/ports/marketplace-repository'
import { locale } from '../i18n'

function useDebounced<T>(source: () => T, delay = 350) {
  const debounced = ref(source()) as import('vue').Ref<T>
  let timer: ReturnType<typeof setTimeout> | null = null
  watch(source, (v) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { debounced.value = v }, delay)
  })
  return debounced
}

/** Coerce range input to a valid bound: NaN/empty/negative -> null. */
function toCleanBound(v: number | string | null | undefined): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

/** Order a min/max pair so min <= max (swaps inverted ranges). */
function orderedPair(a: number | null, b: number | null): [number | null, number | null] {
  if (a != null && b != null && a > b) return [b, a]
  return [a, b]
}

export function useMarketplace() {
  const svc = services.marketplaceService
  const search = ref('')
  const sku = ref('')
  const categoryId = ref<string | null>(null)
  const sortBy = ref<MarketplaceQuery['sortBy']>(undefined)
  const inStockOnly = ref(false)
  const material = ref<string | null>(null)
  const lengthMin = ref<number | null>(null)
  const lengthMax = ref<number | null>(null)
  const priceMin = ref<number | null>(null)
  const priceMax = ref<number | null>(null)
  const ceOnly = ref(false)
  const availability = ref<'all' | 'in' | 'made'>('all')

  const debouncedSearch = useDebounced(() => search.value, 350)
  const debouncedSku = useDebounced(() => sku.value, 350)
  // Range fields update on every keystroke — debounce so typing a bound
  // doesn't fire one request per digit.
  const debouncedLengthMin = useDebounced(() => lengthMin.value, 500)
  const debouncedLengthMax = useDebounced(() => lengthMax.value, 500)
  const debouncedPriceMin = useDebounced(() => priceMin.value, 500)
  const debouncedPriceMax = useDebounced(() => priceMax.value, 500)

  const localized = (en: string, ar: string) => locale.value === 'ar' ? ar : en

  // Keep raw refs clean: a cleared/invalid number input must collapse back
  // to null instead of sticking at NaN/'' (which would poison the query and
  // permanently trip the "has filters" flag).
  watch([lengthMin, lengthMax, priceMin, priceMax], () => {
    const l0 = toCleanBound(lengthMin.value)
    const l1 = toCleanBound(lengthMax.value)
    const p0 = toCleanBound(priceMin.value)
    const p1 = toCleanBound(priceMax.value)
    if (l0 !== lengthMin.value) lengthMin.value = l0
    if (l1 !== lengthMax.value) lengthMax.value = l1
    if (p0 !== priceMin.value) priceMin.value = p0
    if (p1 !== priceMax.value) priceMax.value = p1
  })

  const load = () => {
    const [lMin, lMax] = orderedPair(toCleanBound(debouncedLengthMin.value), toCleanBound(debouncedLengthMax.value))
    const [pMin, pMax] = orderedPair(toCleanBound(debouncedPriceMin.value), toCleanBound(debouncedPriceMax.value))
    return svc.loadProducts({
      search: debouncedSearch.value || undefined,
      sku: debouncedSku.value.trim() || undefined,
      categoryId: categoryId.value || undefined,
      sortBy: sortBy.value,
      inStockOnly: (inStockOnly.value || availability.value === 'in') ? true : undefined,
      material: material.value || undefined,
      lengthMin: lMin ?? undefined,
      lengthMax: lMax ?? undefined,
      priceMin: pMin ?? undefined,
      priceMax: pMax ?? undefined,
      page: svc.page.value,
      pageSize: svc.pageSize.value,
    })
  }

  watch([debouncedSearch, debouncedSku, categoryId, sortBy, inStockOnly, material, debouncedLengthMin, debouncedLengthMax, debouncedPriceMin, debouncedPriceMax, availability], () => {
    svc.page.value = 1
    void load()
  })

  watch(() => svc.page.value, () => void load())

  if (!svc.categories.value.length) void svc.loadCategories()
  if (!svc.products.value.length && !svc.loading.value) void load()

  const clearFilters = () => {
    search.value = ''
    sku.value = ''
    categoryId.value = null
    sortBy.value = undefined
    inStockOnly.value = false
    material.value = null
    lengthMin.value = null
    lengthMax.value = null
    priceMin.value = null
    priceMax.value = null
    ceOnly.value = false
    availability.value = 'all'
    svc.page.value = 1
  }

  const goPage = (p: number) => { svc.page.value = p }

  return {
    products: computed(() => svc.products.value),
    categories: computed(() => svc.categories.value),
    loading: computed(() => svc.loading.value),
    error: computed(() => svc.error.value),
    totalCount: computed(() => svc.totalCount.value),
    totalPages: computed(() => svc.totalPages.value),
    page: computed(() => svc.page.value),
    search, sku, categoryId, sortBy, inStockOnly, material, lengthMin, lengthMax, priceMin, priceMax, ceOnly, availability,
    debouncedSearch, debouncedSku,
    localized,
    load, clearFilters, goPage
  }
}
