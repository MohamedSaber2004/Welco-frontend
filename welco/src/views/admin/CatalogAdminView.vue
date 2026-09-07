<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AdminLayout from '../../components/layout/AdminLayout.vue'
import DataState from '../../components/ui/DataState.vue'
import AppPagination from '../../components/ui/AppPagination.vue'
import { services } from '../../di/container'
import { t, locale } from '../../i18n'
import { productMediaUrl, resolveFileUrl } from '../../utils/file-url'
import type {
  ProductDto,
  CategoryDto,
  CurrencyDto,
} from '../../domain/models/marketplace'

const route = useRoute()
const router = useRouter()

type TabKey = 'products' | 'categories'

const initialTab: TabKey =
  route.query.tab === 'categories'
    ? 'categories'
    : 'products'

const activeTab = ref<TabKey>(initialTab)

watch(
  () => route.query.tab,
  (tab) => {
    if (tab === 'categories' || tab === 'products') {
      activeTab.value = tab
    }
  },
)

const setTab = (tab: TabKey) => {
  activeTab.value = tab
  void router.replace({ query: { ...route.query, tab } })
}

const localized = (en?: string, ar?: string) => (locale.value === 'ar' ? ar || en || '' : en || ar || '')

// --- Common References ---
const categories = ref<CategoryDto[]>([])
const currencies = ref<CurrencyDto[]>([])

const uniqueCurrencies = computed(() => {
  const seenId = new Set<string>()
  const seenCode = new Set<string>()
  const result: CurrencyDto[] = []
  for (const c of currencies.value) {
    if (!c) continue
    const id = c.id
    const code = (c.code || '').trim().toUpperCase()
    if (id && seenId.has(id)) continue
    if (code && seenCode.has(code)) continue
    if (id) seenId.add(id)
    if (code) seenCode.add(code)
    result.push(c)
  }
  return result
})

// ----------------------------------------------------
// 1. PRODUCTS STATE (pageSize = 10)
// ----------------------------------------------------
const products = ref<ProductDto[]>([])
const loadingProducts = ref(false)
const fetchProductsError = ref('')
const productSearch = ref('')
const selectedCategoryFilter = ref<string>('all')
const productPage = ref(1)
const productPageSize = 10
const productTotalCount = ref(0)

const filteredProducts = computed(() => {
  const list = Array.isArray(products.value) ? products.value : []
  return list.filter((p) => {
    if (!p) return false
    const matchesCategory =
      selectedCategoryFilter.value === 'all' || p.categoryId === selectedCategoryFilter.value
    if (!matchesCategory) return false

    if (!productSearch.value.trim()) return true
    const q = productSearch.value.trim().toLowerCase()
    const matchEn = p.nameEn ? String(p.nameEn).toLowerCase().includes(q) : false
    const matchAr = p.nameAr ? String(p.nameAr).toLowerCase().includes(q) : false
    const matchSku = p.sku ? String(p.sku).toLowerCase().includes(q) : false
    const matchMfg = p.manufacturerEn ? String(p.manufacturerEn).toLowerCase().includes(q) : false
    const matchId = p.id ? String(p.id).toLowerCase().includes(q) : false
    return matchEn || matchAr || matchSku || matchMfg || matchId
  })
})

const totalProductPages = computed(() => Math.max(1, Math.ceil(filteredProducts.value.length / productPageSize)))

const paginatedProducts = computed(() => {
  const start = (productPage.value - 1) * productPageSize
  return filteredProducts.value.slice(start, start + productPageSize)
})

const loadProducts = async () => {
  loadingProducts.value = true
  fetchProductsError.value = ''
  try {
    const res = await services.marketplaceRepository.getProducts({
      page: 1,
      pageSize: 50,
    })
    const allProducts = Array.isArray(res?.data) ? [...res.data] : []
    const total = res?.totalCount ?? allProducts.length
    productTotalCount.value = total

    const totalPages = res?.totalPages ?? Math.ceil(total / 50)
    if (totalPages > 1) {
      const pagePromises: Promise<unknown>[] = []
      for (let p = 2; p <= totalPages; p++) {
        pagePromises.push(services.marketplaceRepository.getProducts({ page: p, pageSize: 50 }).catch(() => null))
      }
      const rest = await Promise.all(pagePromises)
      for (const r of rest) {
        if (r && typeof r === 'object' && Array.isArray((r as { data?: unknown[] }).data)) {
          allProducts.push(...((r as { data: typeof allProducts }).data))
        }
      }
    }
    products.value = allProducts
    productTotalCount.value = allProducts.length
  } catch (e) {
    fetchProductsError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    loadingProducts.value = false
  }
}

const goToProductPage = (p: number) => {
  if (p < 1 || p > totalProductPages.value) return
  productPage.value = p
}

watch([productSearch, selectedCategoryFilter], () => {
  productPage.value = 1
})

// ----------------------------------------------------
// 2. CATEGORIES STATE (pageSize = 10)
// ----------------------------------------------------
const loadingCategories = ref(false)
const fetchCategoriesError = ref('')
const categorySearch = ref('')
const categoryPage = ref(1)
const categoryPageSize = 10

const filteredCategories = computed(() => {
  const list = Array.isArray(categories.value) ? categories.value : []
  if (!categorySearch.value.trim()) return list
  const q = categorySearch.value.trim().toLowerCase()
  return list.filter((c) => {
    if (!c) return false
    const matchEn = c.nameEn ? String(c.nameEn).toLowerCase().includes(q) : false
    const matchAr = c.nameAr ? String(c.nameAr).toLowerCase().includes(q) : false
    const matchId = c.id ? String(c.id).toLowerCase().includes(q) : false
    return matchEn || matchAr || matchId
  })
})

const paginatedCategories = computed(() => {
  const start = (categoryPage.value - 1) * categoryPageSize
  return filteredCategories.value.slice(start, start + categoryPageSize)
})

const totalCategoryPages = computed(() => Math.max(1, Math.ceil(filteredCategories.value.length / categoryPageSize)))

const loadCategories = async () => {
  loadingCategories.value = true
  fetchCategoriesError.value = ''
  try {
    const res = await services.marketplaceRepository.getCategories()
    categories.value = res
  } catch (e) {
    fetchCategoriesError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    loadingCategories.value = false
  }
}

const loadCurrencies = async () => {
  try {
    const list = await services.marketplaceRepository.getCurrencies()
    const seenId = new Set<string>()
    const seenCode = new Set<string>()
    currencies.value = (list || []).filter((c) => {
      if (!c) return false
      const id = c.id
      const code = (c.code || '').trim().toUpperCase()
      if (id && seenId.has(id)) return false
      if (code && seenCode.has(code)) return false
      if (id) seenId.add(id)
      if (code) seenCode.add(code)
      return true
    })
      } catch {
    currencies.value = []
  }
}

onMounted(async () => {
  await Promise.all([loadProducts(), loadCategories(), loadCurrencies()])
})
</script>

<template>
  <AdminLayout>
    <div class="catalog-admin">
      <header class="catalog-admin__header">
        <div>
          <div class="eyebrow eyebrow--brass mono"><span class="eyebrow__notch" aria-hidden="true"></span>{{ t('admin.catalogSection') }} {{ t('admin.catalogEyebrowSuffix') }}</div>
          <h1 style="letter-spacing:-0.025em; line-height:0.96">{{ t('nav.catalog') }}</h1>
          <div class="caliper-rule" style="margin:0.75rem 0 0; max-width:520px"><span class="caliper-rule__tick caliper-rule__tick--major" style="background: var(--wl-brass)"></span><span class="caliper-rule__tick"></span><span class="caliper-rule__tick"></span><span class="caliper-rule__tick caliper-rule__tick--major" style="background: var(--wl-brass)"></span><span class="caliper-rule__label mono" style="color:var(--wl-muted-soft)">{{ t('admin.products') }} → {{ t('admin.categoriesTitle') }}</span></div>
        </div>
        </header>

      <!-- Tabs Bar -->
      <div class="tab-nav">
        <button
          type="button"
          class="tab-btn"
          :class="{ 'is-active': activeTab === 'products' }"
          @click="setTab('products')"
        >
          <span class="material-symbols-outlined text-[18px]">medical_services</span>
          {{ t('admin.productsTitle') }}
          <span class="tab-badge mono">{{ productTotalCount || products.length }}</span>
        </button>

        <button
          type="button"
          class="tab-btn"
          :class="{ 'is-active': activeTab === 'categories' }"
          @click="setTab('categories')"
        >
          <span class="material-symbols-outlined text-[18px]">category</span>
          {{ t('admin.categoriesTitle') }}
          <span class="tab-badge mono">{{ categories.length }}</span>
        </button>

      </div>

      <!-- TAB 1: PRODUCTS (pageSize: 10) -->
      <div v-if="activeTab === 'products'" class="tab-pane">
        <div class="filter-bar">
          <div class="search-input-wrapper">
            <span class="material-symbols-outlined search-icon">search</span>
            <input
              v-model="productSearch"
              type="text"
              class="search-input"
              :placeholder="t('common.searchPlaceholder')"
            />
          </div>
          <div class="category-filter">
            <select
              v-model="selectedCategoryFilter"
              class="filter-select"
            >
              <option value="all">{{ t('marketplace.allCategories') }}</option>
              <option v-for="c in categories" :key="c.id" :value="c.id">
                {{ localized(c.nameEn, c.nameAr) }}
              </option>
            </select>
          </div>
        </div>

        <DataState
          :loading="loadingProducts"
          :error="fetchProductsError"
          skeleton-type="table"
          :skeleton-count="5"
          :empty="!filteredProducts.length && !loadingProducts"
          :empty-title="t('admin.noProductsFound')"
          :empty-description="t('common.searchPlaceholder')"
          @retry="loadProducts"
        >
          <div class="table-container card">
            <table class="data-table">
              <thead>
                <tr>
                  <th>{{ t('admin.productsTitle') }}</th>
                  <th>{{ t('admin.sku') }}</th>
                  <th>{{ t('admin.category') }}</th>
                  <th>{{ t('admin.price') }}</th>
                  <th>{{ t('admin.stock') }}</th>
                  
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in paginatedProducts" :key="p.id">
                  <td>
                    <div class="product-cell">
                      <div
                        class="product-thumb"
                        :style="{ background: p.imageGradient || 'var(--wl-paper)' }"
                      >
                        <img
                          v-if="productMediaUrl(p.imageName, p.imageGradient).url"
                          :src="productMediaUrl(p.imageName, p.imageGradient).url"
                          :alt="p.nameEn"
                          class="product-thumb__img"
                          loading="lazy"
                        />
                        <span v-else class="mono text-[10px]">{{ p.sku }}</span>
                      </div>
                      <div class="product-info">
                        <div class="product-name">{{ localized(p.nameEn, p.nameAr) }}</div>
                        <div class="product-sub mono">{{ p.nameEn }} · {{ p.nameAr }}</div>
                      </div>
                    </div>
                  </td>
                  <td><span class="mono sku-tag">{{ p.sku }}</span></td>
                  <td>
                    <span class="category-chip">
                      {{ localized(p.categoryNameEn, p.categoryNameAr) }}</span>
                  </td>
                  <td>
                    <strong class="mono price-val">{{ p.price.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US') }} {{ p.currencySymbol || p.currencyCode || p.currency }}</strong>
                  </td>
                  <td>
                    <span
                      class="stock-badge"
                      :class="p.stock > 0 ? 'stock-badge--in' : 'stock-badge--out'"
                    >
                      {{ p.stock > 0 ? `${p.stock} ${t('admin.inStock')}` : t('admin.outOfStock') }}
                    </span>
                  </td>
                  
                </tr>
              </tbody>
            </table>

            <!-- Pagination Bar (10 per page) -->
            <AppPagination
              :page="productPage"
              :total-pages="totalProductPages"
              :total-items="filteredProducts.length"
              :page-size="10"
              variant="table"
              @change="goToProductPage"
            />
          </div>
        </DataState>
      </div>

      <!-- TAB 2: CATEGORIES (pageSize: 10) -->
      <div v-else class="tab-pane">
        <div class="filter-bar">
          <div class="search-input-wrapper">
            <span class="material-symbols-outlined search-icon">search</span>
            <input
              v-model="categorySearch"
              type="text"
              class="search-input"
              :placeholder="t('common.searchPlaceholder')"
            />
          </div>
        </div>

        <DataState
          :loading="loadingCategories"
          :error="fetchCategoriesError"
          skeleton-type="table"
          :skeleton-count="5"
          :empty="!filteredCategories.length && !loadingCategories"
          :empty-title="t('admin.noCategoriesFound')"
          :empty-description="t('common.searchPlaceholder')"
          @retry="loadCategories"
        >
          <div class="table-container card">
            <table class="data-table">
              <thead>
                <tr>
                  <th>{{ t('admin.category') }}</th>
                  <th>{{ t('admin.categoryNameEn') }}</th>
                  <th>{{ t('admin.categoryNameAr') }}</th>
                  <th>{{ t('admin.productsTitle') }}</th>
                  
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in paginatedCategories" :key="c.id">
                  <td>
                    <div class="category-cell">
                      <div class="category-icon-box">
                        <span class="material-symbols-outlined text-[20px]">folder</span>
                      </div>
                      <div class="category-info">
                        <strong>{{ localized(c.nameEn, c.nameAr) }}</strong>
                        <div v-if="c.descriptionEn" class="category-desc">
                          {{ localized(c.descriptionEn, c.descriptionAr) }}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td><span class="mono">{{ c.nameEn }}</span></td>
                  <td><span>{{ c.nameAr }}</span></td>
                  <td>
                    <span class="mono count-badge">{{ c.productCount ?? 0 }}</span>
                  </td>
                  
                </tr>
              </tbody>
            </table>

            <!-- Pagination Bar (10 per page) -->
            <AppPagination
              v-model:page="categoryPage"
              :total-pages="totalCategoryPages"
              :total-items="filteredCategories.length"
              :page-size="10"
              variant="table"
            />
          </div>
        </DataState>
      </div>
    </div>

    </AdminLayout>
</template>

<style scoped>
.catalog-admin {
  display: flex;
  flex-direction: column;
  gap: var(--wl-page-gap);
  width: 100%;
}

.catalog-admin__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.catalog-admin__header h1 {
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--wl-ink-strong);
  margin: 0.2rem 0 0 0;
}

/* Tab Navigation */
.tab-nav {
  display: flex;
  gap: 0.5rem;
  border-bottom: 1px solid var(--wl-line);
  margin-bottom: 1.5rem;
}

.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--wl-muted);
  font-weight: 600;
  font-size: 0.92rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tab-btn:hover {
  color: var(--wl-ink-strong);
}

.tab-btn.is-active {
  color: var(--wl-ink-strong);
  border-bottom-color: var(--wl-brass);
  border-bottom-width: 2.5px;
  font-weight: 700;
}

.tab-badge {
  background: var(--wl-paper);
  border: 1px solid var(--wl-line);
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  font-size: 0.75rem;
}

/* Filter Bar */
.filter-bar {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
}

.search-input-wrapper {
  position: relative;
  flex: 1;
  min-width: 240px;
}

.search-icon {
  position: absolute;
  inset-inline-start: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--wl-muted);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding-block: 0.6rem;
  padding-inline-start: 2.4rem;
  padding-inline-end: 0.75rem;
  background: var(--wl-surface);
  border: 1px solid var(--wl-line);
  border-radius: var(--wl-radius-md);
  color: var(--wl-ink-strong);
  font-size: 0.88rem;
  text-align: start;
}

.category-filter {
  min-width: 200px;
}

.filter-select {
  width: 100%;
  padding: 0.6rem 0.75rem;
  background: var(--wl-surface);
  border: 1px solid var(--wl-line);
  border-radius: var(--wl-radius-md);
  color: var(--wl-ink-strong);
  font-size: 0.88rem;
}

/* Data Table */
.table-container {
  background: var(--wl-surface);
  border: 1px solid var(--wl-line);
  border-radius: var(--wl-radius-md);
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
  text-align: start;
}

.data-table th {
  padding: 0.85rem 1rem;
  background: var(--wl-paper);
  color: var(--wl-muted);
  font-weight: 600;
  font-size: 0.76rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--wl-line);
}

.data-table td {
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--wl-line);
  color: var(--wl-ink-strong);
  vertical-align: middle;
}

.product-cell {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.product-thumb {
  width: 44px;
  height: 44px;
  border-radius: var(--wl-radius-sm);
  border: 1px solid var(--wl-line);
  display: grid;
  place-items: center;
  overflow: hidden;
  flex-shrink: 0;
}

.product-thumb__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.product-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.product-name {
  font-weight: 600;
  color: var(--wl-ink-strong);
}

.product-sub {
  font-size: 0.72rem;
  color: var(--wl-muted);
}

.sku-tag {
  background: var(--wl-paper);
  border: 1px solid var(--wl-line);
  padding: 0.2rem 0.45rem;
  border-radius: var(--wl-radius-technical);
  font-size: 0.76rem;
}

.category-chip {
  background: rgba(14, 113, 105, 0.08);
  color: var(--wl-teal);
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.76rem;
  font-weight: 500;
}

.price-val {
  font-size: 0.92rem;
  color: var(--wl-ink-strong);
}

.stock-badge {
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 600;
}

.stock-badge--in {
  background: rgba(16, 185, 129, 0.12);
  color: #059669;
}

.stock-badge--out {
  background: rgba(239, 68, 68, 0.12);
  color: #dc2626;
}

/* Category Table Cell */
.category-cell {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.category-icon-box {
  width: 38px;
  height: 38px;
  border-radius: var(--wl-radius-sm);
  background: rgba(14, 113, 105, 0.08);
  color: var(--wl-teal);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.category-desc {
  font-size: 0.75rem;
  color: var(--wl-muted);
  margin-top: 0.15rem;
}

.count-badge {
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  background: var(--wl-paper);
  border: 1px solid var(--wl-line);
  font-size: 0.78rem;
}

/* Currency Table Cell */
.currency-code-cell {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.currency-icon-box {
  width: 38px;
  height: 38px;
  border-radius: var(--wl-radius-sm);
  background: rgba(14, 113, 105, 0.08);
  color: var(--wl-teal);
  display: grid;
  place-items: center;
  font-size: 0.82rem;
  flex-shrink: 0;
}

.symbol-badge {
  background: var(--wl-paper);
  border: 1px solid var(--wl-line);
  padding: 0.2rem 0.5rem;
  border-radius: var(--wl-radius-technical);
  font-size: 0.82rem;
}

/* Actions */
.row-actions {
  display: flex;
  gap: 0.4rem;
  justify-content: flex-end;
}

.action-btn {
  width: 32px;
  height: 32px;
  border-radius: var(--wl-radius-sm);
  border: 1px solid var(--wl-line);
  background: var(--wl-surface);
  color: var(--wl-muted);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-btn--edit:hover {
  color: var(--wl-teal);
  border-color: var(--wl-teal);
}

.action-btn--delete:hover {
  color: #dc2626;
  border-color: #dc2626;
}

.text-right {
  text-align: end;
}

/* Table Pagination */
.table-pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--wl-line);
  background: var(--wl-paper);
}

.pagination-controls {
  display: flex;
  gap: 0.4rem;
}

.page-btn {
  width: 30px;
  height: 30px;
  border-radius: var(--wl-radius-sm);
  border: 1px solid var(--wl-line);
  background: var(--wl-surface);
  display: grid;
  place-items: center;
  color: var(--wl-ink-strong);
  cursor: pointer;
  transition: all 0.15s ease;
}

.page-btn:hover:not(:disabled) {
  background: var(--wl-teal);
  color: #fff;
  border-color: var(--wl-teal);
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Form Styles */
.admin-modal-form {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.form-row {
  display: flex;
  gap: 1rem;
}

.two-cols > .form-field {
  flex: 1;
}

.three-cols > .form-field {
  flex: 1;
}

.full-width {
  width: 100%;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--wl-ink-strong);
}

.field-input,
.field-select,
.field-textarea {
  width: 100%;
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--wl-line);
  border-radius: var(--wl-radius-sm);
  background: var(--wl-surface);
  color: var(--wl-ink-strong);
  font-size: 0.88rem;
}

.field-input:focus,
.field-select:focus,
.field-textarea:focus {
  outline: none;
  border-color: var(--wl-teal);
}

.price-input-group {
  display: flex;
  gap: 0.35rem;
}

.price-input {
  flex: 1;
}

.currency-select {
  width: 130px;
  padding: 0.55rem 0.4rem;
  border: 1px solid var(--wl-line);
  border-radius: var(--wl-radius-sm);
  background: var(--wl-surface);
  color: var(--wl-ink-strong);
  font-size: 0.82rem;
  cursor: pointer;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--wl-ink-strong);
  cursor: pointer;
}

.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--wl-line);
}

/* Product Image Upload - minimized size */
.product-image-upload {
  max-width: 200px;
}

/* Product Videos Panel & Synchronized Management */
.product-videos-panel {
  margin-top: 1.25rem;
  padding: 1rem;
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-line);
  border-radius: var(--wl-radius-md);
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.videos-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--wl-line);
}

.attached-videos-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.attached-video-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  background: var(--wl-surface);
  border: 1px solid var(--wl-line);
  border-radius: var(--wl-radius-sm);
  transition: border-color .15s;
}

.attached-video-item:hover {
  border-color: var(--wl-teal);
}

.attached-video-badge {
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.attached-video-info {
  flex: 1;
  min-width: 0;
}

.attached-video-title {
  font-size: 0.84rem;
  font-weight: 600;
  color: var(--wl-ink-strong);
}

.attached-video-meta {
  font-size: 0.7rem;
  color: var(--wl-muted);
  display: flex;
  align-items: center;
}

.attached-video-src {
  max-width: 320px;
}

.attached-video-actions {
  display: flex;
  gap: 0.35rem;
  align-items: center;
}

.attached-videos-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  text-align: center;
  font-size: 0.76rem;
  color: var(--wl-muted);
  border: 1px dashed var(--wl-line);
  border-radius: var(--wl-radius-sm);
}

.add-video-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-line);
  border-radius: var(--wl-radius-sm);
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.add-video-tabs {
  display: flex;
  gap: 0.35rem;
  border-bottom: 1px solid var(--wl-line);
  padding-bottom: 0.5rem;
}

.video-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.65rem;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: var(--wl-radius-sm);
  border: 1px solid transparent;
  background: transparent;
  color: var(--wl-muted);
  cursor: pointer;
  transition: all .15s;
}

.video-tab-btn:hover {
  color: var(--wl-ink-strong);
  background: var(--wl-surface-soft);
}

.video-tab-btn.is-active {
  color: var(--wl-teal);
  background: var(--wl-teal-soft);
  border-color: rgba(14, 113, 105, 0.2);
}

.add-video-body {
  display: flex;
  flex-direction: column;
}

.video-drop-area {
  border: 1.5px dashed var(--wl-line);
  border-radius: var(--wl-radius-sm);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  cursor: pointer;
  transition: all .15s;
  background: var(--wl-surface-soft);
}

.video-drop-area:hover {
  border-color: var(--wl-teal);
  background: var(--wl-teal-faint);
}

.video-uploading-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  background: var(--wl-surface-soft);
  border-radius: var(--wl-radius-sm);
}

.video-progress-track {
  width: 100%;
  max-width: 280px;
  height: 6px;
  background: var(--wl-line);
  border-radius: 999px;
  overflow: hidden;
}

.video-progress-fill {
  height: 100%;
  background: var(--wl-teal);
  transition: width 0.15s ease;
}

.selected-video-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--wl-teal-faint);
  border: 1px solid var(--wl-teal);
  border-radius: var(--wl-radius-sm);
}

.video-url-input-group {
  display: flex;
  gap: 0.5rem;
}

.admin-preview-modal-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.admin-preview-viewport {
  width: 100%;
  aspect-ratio: 16/9;
  background: #000;
  border-radius: var(--wl-radius-sm);
  overflow: hidden;
}

.admin-preview-frame,
.admin-preview-native {
  width: 100%;
  height: 100%;
  border: none;
  object-fit: contain;
}

.admin-preview-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
}
</style>
