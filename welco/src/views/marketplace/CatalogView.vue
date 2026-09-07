<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { t, locale } from '../../i18n'
import { useMarketplace } from '../../composables/useMarketplace'
import { useCart } from '../../composables/useCart'
import { useWishlist } from '../../composables/useWishlist'
import { toastService } from '../../infrastructure/feedback/toast.service'
import DataState from '../../components/ui/DataState.vue'
import SkeletonLoader from '../../components/ui/SkeletonLoader.vue'
import { productMediaUrl, PLACEHOLDER } from '../../utils/file-url'
import BackButton from '../../components/ui/BackButton.vue'
import AppPagination from '../../components/ui/AppPagination.vue'

const route = useRoute()
const router = useRouter()
const {
  products,
  categories,
  loading,
  error,
  totalCount,
  totalPages,
  page,
  search,
  sku,
  categoryId,
  sortBy,
  inStockOnly,
  material,
  lengthMin,
  lengthMax,
  priceMin,
  priceMax,
  ceOnly,
  availability,
  localized,
  load,
  clearFilters,
  goPage,
} = useMarketplace()
const { add } = useCart()
const { isSaved, toggleSave, canEditWishlist } = useWishlist()

const handleWishlist = async (id: string) => {
  await toggleSave(id)
}

const showMobileFilters = ref(false)

onMounted(() => {
  const q = route.query
  if (q.search) search.value = String(q.search)
  if (q.categoryId) categoryId.value = String(q.categoryId)
  if (q.sortBy) sortBy.value = String(q.sortBy) as typeof sortBy.value
})

watch(
  () => route.query.search,
  (v) => {
    if (v !== undefined) search.value = v ? String(v) : ''
  },
)

const handleAdd = (id: string) => {
  const p = products.value.find((x) => x.id === id)
  if (!p) return
  add(p, 1)
  toastService.success(
    t('catalog.quoteSuccess', { product: localized(p.nameEn, p.nameAr) }),
  )
}

const localizedCat = (c: { nameEn: string; nameAr: string }) =>
  locale.value === 'ar' ? c.nameAr : c.nameEn

const hasFilters = computed(() =>
  Boolean(categoryId.value || search.value || sku.value || sortBy.value || inStockOnly.value || material.value || lengthMin.value != null || lengthMax.value != null || priceMin.value != null || priceMax.value != null || availability.value !== 'all'),
)

const activeCategoryName = computed(() => {
  if (!categoryId.value) return t('marketplace.allCategories')
  const found = categories.value.find((c) => c.id === categoryId.value)
  return found ? localizedCat(found) : t('marketplace.allCategories')
})

const availableMaterials = computed(() => {
  const set = new Set<string>()
  for (const p of products.value) if (p.material?.trim()) set.add(p.material.trim())
  if (material.value && !set.has(material.value)) set.add(material.value)
  return Array.from(set).sort()
})
const priceBounds = computed(() => {
  if (!products.value.length) return null
  const prices = products.value.map((p) => p.price).filter((v) => Number.isFinite(v))
  if (!prices.length) return null
  return { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) }
})
const lengthBounds = computed(() => {
  const lens = products.value.map((p) => p.lengthCm).filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  if (!lens.length) return null
  return { min: Math.min(...lens), max: Math.max(...lens) }
})
const hasInStock = computed(() => products.value.some((p) => p.stock > 0))
const hasMadeToOrder = computed(() => products.value.some((p) => p.stock === 0))
</script>

<template>
  <div class="page-shell catalog-page">
    <BackButton />
    <div class="catalog-head">
      <div class="catalog-head__info">
        <div class="mono" style="font-size:11px;color:var(--wl-primary);font-weight:700;letter-spacing:0.06em">{{ t('catalog.badge') }}</div>
        <h1>{{ t('marketplace.title') }}</h1>
        <p class="catalog-head__desc">{{ t('marketplace.subtitle') }}</p>
      </div>
      <div v-if="totalCount" class="mono" style="font-size:11px;color:var(--wl-muted)">{{ t('catalog.showing', { count: String(products.length), total: String(totalCount), page: String(page), totalPages: String(totalPages) } as never) }}</div>
    </div>

    <div v-if="categories.length" class="category-pills-bar">
      <button class="cat-pill" :class="{ 'is-active': !categoryId }" @click="categoryId = null">
        {{ t('marketplace.allCategories') }}
      </button>
      <button v-for="c in categories.slice(0, 8)" :key="c.id" class="cat-pill" :class="{ 'is-active': categoryId === c.id }" @click="categoryId = categoryId === c.id ? null : c.id">
        {{ localizedCat(c) }}<span class="pill-badge mono">{{ c.productCount ?? '' }}</span>
      </button>
    </div>
    <div v-else-if="loading" class="category-pills-bar">
      <SkeletonLoader type="pills" :count="7" />
    </div>

    <div class="catalog-toolbar">
      <div class="search-box">
        <span class="material-symbols-outlined search-icon">search</span>
        <input v-model="search" type="search" :placeholder="t('catalog.searchPlaceholder')" class="search-input" />
        <button v-if="search" class="clear-search-btn" type="button" @click="search = ''"><span class="material-symbols-outlined text-[16px]">close</span></button>
      </div>
      <div class="toolbar-controls">
        <div class="sort-select-wrapper">
          <span class="material-symbols-outlined sort-icon">sort</span>
          <select v-model="sortBy" class="sort-select mono">
            <option :value="undefined">{{ t('catalog.sortFeatured') }}</option>
            <option value="newest">{{ t('marketplace.sortNewest') }}</option>
            <option value="price-asc">{{ t('marketplace.sortPriceAsc') }}</option>
            <option value="price-desc">{{ t('marketplace.sortPriceDesc') }}</option>
          </select>
        </div>
        <button type="button" class="mobile-filter-toggle md:hidden" :class="{ 'has-active': hasFilters }" @click="showMobileFilters = !showMobileFilters">
          <span class="material-symbols-outlined text-[18px]">filter_list</span>
          <span>{{ t('catalog.filters') }}</span>
          <span v-if="hasFilters" class="filter-dot" aria-hidden="true"></span>
        </button>
      </div>
    </div>

    <div class="catalog-grid-layout">
      <aside class="filter-sidebar" :class="{ 'is-mobile-open': showMobileFilters }">
        <div class="filter-sidebar__header md:hidden">
          <span class="mono font-bold">{{ t('catalog.filterInstruments') }}</span>
          <button type="button" class="close-filters-btn" @click="showMobileFilters = false"><span class="material-symbols-outlined">close</span></button>
        </div>

        <div class="filter-section">
          <div class="filter-heading mono">SKU</div>
          <input v-model="sku" type="text" :placeholder="t('catalog.skuPlaceholder')" class="search-input mono" />
          <div class="mono" style="font-size:10px; color:var(--wl-muted); margin-top:6px">{{ t('catalog.skuHelp') }}</div>
        </div>

        <div class="filter-section">
          <div class="filter-heading mono">{{ t('catalog.material') }}</div>
          <label class="filter-item">
            <input type="radio" name="material" :checked="!material" class="filter-checkbox" @change="material = null" />
            <span class="filter-label">{{ t('catalog.allMaterials') }}</span>
          </label>
          <label v-for="m in availableMaterials" :key="m" class="filter-item">
            <input type="radio" name="material" :checked="material === m" class="filter-checkbox" @change="material = m" />
            <span class="filter-label">{{ m }}</span>
          </label>
        </div>

        <div class="filter-section">
          <div class="filter-heading mono">{{ t('catalog.length') }}</div>
          <div class="range-row">
            <input v-model.number="lengthMin" type="number" min="0" step="any" inputmode="decimal" :placeholder="t('catalog.lengthMin')" :aria-label="t('catalog.lengthMin')" class="search-input mono range-input" />
            <span class="range-sep" aria-hidden="true">–</span>
            <input v-model.number="lengthMax" type="number" min="0" step="any" inputmode="decimal" :placeholder="t('catalog.lengthMax')" :aria-label="t('catalog.lengthMax')" class="search-input mono range-input" />
          </div>
          <div v-if="lengthBounds && lengthBounds.min !== lengthBounds.max" class="mono" style="font-size:10px;color:var(--wl-muted);margin-top:4px">Range: {{ lengthBounds.min }}–{{ lengthBounds.max }} cm</div>
        </div>

        <div class="filter-section">
          <div class="filter-heading mono">{{ t('catalog.priceRange') }}</div>
          <div class="range-row">
            <input v-model.number="priceMin" type="number" min="0" step="any" inputmode="decimal" :placeholder="t('catalog.priceMin')" :aria-label="t('catalog.priceMin')" class="search-input mono range-input" />
            <span class="range-sep" aria-hidden="true">–</span>
            <input v-model.number="priceMax" type="number" min="0" step="any" inputmode="decimal" :placeholder="t('catalog.priceMax')" :aria-label="t('catalog.priceMax')" class="search-input mono range-input" />
          </div>
          <div v-if="priceBounds && priceBounds.min !== priceBounds.max" class="mono" style="font-size:10px;color:var(--wl-muted);margin-top:4px">Range: {{ priceBounds.min }}–{{ priceBounds.max }}</div>
        </div>

        <div class="filter-section">
          <div class="filter-heading mono">{{ t('catalog.availability') }}</div>
          <label class="filter-item">
            <input type="radio" name="avail" :checked="availability === 'all'" class="filter-checkbox" @change="availability = 'all'" />
            <span class="filter-label">{{ t('catalog.availAll') }}</span>
          </label>
          <label class="filter-item">
            <input type="radio" name="avail" :checked="availability === 'in'" class="filter-checkbox" @change="availability = 'in'" :disabled="!hasInStock" />
            <span class="filter-label">{{ t('catalog.inStock') }}</span>
          </label>

        </div>

        <button v-if="hasFilters" type="button" class="reset-filters-btn mono" @click="clearFilters">
          <span class="material-symbols-outlined text-[16px]">filter_alt_off</span> {{ t('marketplace.clearFilters') }}
        </button>
      </aside>

      <main class="catalog-results">
        <SkeletonLoader v-if="loading" type="catalog-grid" :count="6" />
        <div v-else-if="error" style="text-align:center;padding:2rem">
          <p style="color:var(--wl-danger)">{{ error }}</p>
          <button class="btn btn-ghost btn-sm" type="button" style="margin-top:0.75rem" @click="load()">{{ t('common.retry') }}</button>
        </div>
        <div v-else-if="!products.length" style="text-align:center;padding:3rem 1rem">
          <span class="material-symbols-outlined" style="font-size:40px;color:var(--wl-muted)">inventory_2</span>
          <p style="margin-top:0.75rem;color:var(--wl-muted)">{{ t('marketplace.noProducts') }}</p>
          <p style="font-size:13px;color:var(--wl-muted)">{{ t('marketplace.noProductsDesc') }}</p>
          <button v-if="hasFilters" type="button" class="btn btn-ghost btn-sm" style="margin-top:1rem" @click="clearFilters">{{ t('marketplace.clearFilters') }}</button>
        </div>
        <template v-else>
          <div class="results-meta-bar mono" style="font-size:11px;color:var(--wl-muted);margin-bottom:0.5rem">
            <span>{{ activeCategoryName }} · {{ totalCount }} {{ t('catalog.showing', { count: String(products.length), total: String(totalCount), page: String(page), totalPages: String(totalPages) } as never).split('·')[0] }}</span>
          </div>
          <div class="products-grid">
            <article v-for="p in products" :key="p.id" class="card catalog-card" @click="router.push({ name: 'marketplace-product', params: { id: p.id } })">
              <div class="catalog-card__media" :style="{ background: productMediaUrl(p.imageName, p.imageGradient).background }">
                <img
                  v-if="productMediaUrl(p.imageName, p.imageGradient).url && productMediaUrl(p.imageName, p.imageGradient).url !== PLACEHOLDER"
                  :src="productMediaUrl(p.imageName, p.imageGradient).url"
                  :alt="localized(p.nameEn, p.nameAr)"
                  class="catalog-card__img"
                  loading="lazy"
                />
                <div v-else class="catalog-card__sku-fallback mono"><span class="material-symbols-outlined">precision_manufacturing</span><span>{{ p.sku }}</span></div>
                <div class="catalog-card__badges">
                  <span v-if="p.sku" class="sku-chip mono">{{ p.sku }}</span>
                  <span v-if="p.stock > 0" class="stock-pill stock-pill--in mono">{{ t('catalog.inStock') }}</span>
                  <span v-else class="stock-pill stock-pill--out mono">{{ t('catalog.madeToOrder') }}</span>
                </div>
                <button class="catalog-wishlist-btn" :class="{ 'is-saved': isSaved(p.id) }" type="button" :disabled="!canEditWishlist" :aria-label="isSaved(p.id) ? t('marketplace.removeFromWishlist') : t('marketplace.wishlistTitle')" @click.stop="handleWishlist(p.id)">
                  <span class="material-symbols-outlined">{{ isSaved(p.id) ? 'favorite' : 'favorite_border' }}</span>
                </button>
              </div>
              <div class="catalog-card__body">
                <div class="catalog-card__category mono" dir="auto">{{ localized(p.categoryNameEn || '', p.categoryNameAr || '') }}</div>
                <h3 class="catalog-card__title" dir="auto">{{ localized(p.nameEn, p.nameAr) }}</h3>
                <div class="catalog-card__title-alt mono" dir="auto">{{ locale === 'ar' ? p.nameEn : p.nameAr }}</div>
                <div class="catalog-card__origin mono">{{ p.manufacturerEn || t('catalog.fallbackMfr') }} · {{ p.isActive ? t('catalog.ceMarked') : '' }}<span v-if="p.lengthCm" class="length-chip mono"><span class="length-dot" aria-hidden="true"></span>{{ p.lengthCm }} cm</span></div>
                <div class="catalog-card__foot">
                  <div class="price-col">
                    <strong class="catalog-card__price mono">{{ p.price.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US') }} <span class="currency-tag">{{ p.currencySymbol || p.currencyCode || p.currency || '$' }}</span></strong>
                    <span v-if="p.unit" class="unit-tag mono">/ {{ p.unit }}</span>
                  </div>
                  <span v-if="p.rating" class="rating-tag mono">★ {{ p.rating.toFixed(1) }}</span>
                </div>
                <div class="catalog-card__actions">
                  <button class="card-action-btn card-action-btn--view" type="button" @click.stop="router.push({ name: 'marketplace-product', params: { id: p.id } })">{{ t('marketplace.viewDetails') }}</button>
                  <button class="card-action-btn card-action-btn--quote" type="button" @click.stop="handleAdd(p.id)">{{ t('marketplace.addToQuote') }}</button>
                </div>
              </div>
            </article>
          </div>
          <AppPagination v-if="totalPages > 1" :page="page" :total-pages="totalPages" :total-items="totalCount" :page-size="12" class="catalog-pagination" @change="goPage" />
        </template>
      </main>
    </div>
  </div>
</template>

<style scoped>
.catalog-page {
  width: 100%;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--wl-muted);
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
}

.breadcrumb a {
  color: var(--wl-teal);
  text-decoration: none;
}

.breadcrumb a:hover {
  text-decoration: underline;
}

.breadcrumb .sep {
  color: var(--wl-line-strong);
}

.active-crumb {
  color: var(--wl-ink-strong);
  font-weight: 600;
}

.catalog-head {
  margin-bottom: 1.5rem;
}

.catalog-head__info h1 {
  font-family: var(--wl-font-display);
  font-size: clamp(1.9rem, 3.5vw, 2.6rem);
  font-weight: 800;
  color: var(--wl-ink-strong);
  margin: 0.5rem 0 0.35rem;
  line-height: 0.98;
  letter-spacing: -0.032em;
}
.catalog-head { position: relative; }
.catalog-head::after {
  content: '';
  position: absolute;
  bottom: -0.75rem;
  inset-inline: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--wl-line), transparent);
}

.catalog-head__desc {
  font-size: 0.94rem;
  color: var(--wl-ink-soft);
  max-width: 640px;
  line-height: 1.55;
  margin: 0;
}

.category-pills-bar {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding: 0.85rem 0 0.25rem;
  scrollbar-width: thin;
  -webkit-overflow-scrolling: touch;
}

.cat-pill {
  white-space: nowrap;
  padding: 0.4rem 0.85rem;
  border-radius: 999px;
  border: 1px solid var(--wl-line);
  background: var(--wl-surface);
  color: var(--wl-ink);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  transition: all 0.15s ease;
  box-shadow: var(--shadow-xs);
  flex-shrink: 0;
}

.cat-pill:hover {
  border-color: var(--wl-teal);
  color: var(--wl-teal);
}

.cat-pill.is-active {
  background: var(--wl-teal);
  color: #ffffff;
  border-color: var(--wl-teal);
  box-shadow: var(--wl-shadow-teal);
}

.pill-badge {
  background: var(--wl-paper);
  border: 1px solid var(--wl-line);
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  font-size: 0.68rem;
  color: var(--wl-muted);
}

.cat-pill.is-active .pill-badge {
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
  border-color: transparent;
}

.catalog-toolbar {
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.search-box {
  position: relative;
  flex: 1;
  min-width: 260px;
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
  padding-block: 0.65rem;
  padding-inline-start: 2.4rem;
  padding-inline-end: 2.2rem;
  background: var(--wl-surface);
  border: 1px solid var(--wl-line);
  border-radius: var(--wl-radius-md);
  color: var(--wl-ink-strong);
  font-size: 0.88rem;
  text-align: start;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.search-input:focus {
  outline: none;
  border-color: var(--wl-teal);
  box-shadow: var(--wl-primary-ring);
}

.clear-search-btn {
  position: absolute;
  inset-inline-end: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--wl-muted);
  cursor: pointer;
  display: grid;
  place-items: center;
}

.toolbar-controls {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.mobile-filter-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.65rem 1rem;
  background: var(--wl-surface);
  border: 1px solid var(--wl-line);
  border-radius: var(--wl-radius-md);
  color: var(--wl-ink-strong);
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
  position: relative;
}

.mobile-filter-toggle.has-active {
  border-color: var(--wl-teal);
  color: var(--wl-teal);
}

.filter-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--wl-teal);
}

.sort-select-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.sort-icon {
  position: absolute;
  inset-inline-start: 0.75rem;
  color: var(--wl-muted);
  pointer-events: none;
  font-size: 18px;
}

.sort-select {
  padding: 0.65rem 1rem 0.65rem 2.2rem;
  border: 1px solid var(--wl-line);
  border-radius: var(--wl-radius-md);
  background: var(--wl-surface);
  color: var(--wl-ink-strong);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
}

.sort-select:focus {
  outline: none;
  border-color: var(--wl-teal);
}

.catalog-grid-layout {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 2rem;
  align-items: start;
}

.filter-sidebar {
  position: sticky;
  top: calc(var(--wl-header-height) + 16px);
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 14px;
  padding: 1.35rem;
  box-shadow: var(--wl-shadow-card);
  display: flex;
  flex-direction: column;
  gap: 1.35rem;
  overflow: hidden;
}
.filter-sidebar::before {
  content: '';
  position: absolute;
  top: 0; inset-inline: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--wl-teal), #6366F1);
  opacity: 0.85;
}

.filter-heading {
  font-family: var(--wl-font-mono);
  font-size: 0.74rem;
  letter-spacing: 0.08em;
  color: var(--wl-muted);
  text-transform: uppercase;
  font-weight: 700;
  margin-bottom: 0.75rem;
}

.filter-options-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  max-height: 280px;
  overflow-y: auto;
}

.filter-item {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.4rem 0.6rem;
  border-radius: 8px;
  font-size: 0.86rem;
  color: var(--wl-ink-soft);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.filter-item:hover {
  background: var(--wl-surface-soft);
  color: var(--wl-ink-strong);
}

.filter-checkbox {
  accent-color: var(--wl-teal);
  width: 17px;
  height: 17px;
  border-radius: 4px;
  cursor: pointer;
  transition: transform 0.15s ease;
}
.filter-checkbox:hover {
  transform: scale(1.08);
}

.filter-label {
  flex: 1;
}

.range-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.range-row .range-input {
  flex: 1 1 0;
  min-width: 0;
  width: auto;
  height: 38px;
  min-height: 38px;
  padding: 0 0.65rem;
  font-size: 13px;
  text-align: center;
}

.range-sep {
  flex-shrink: 0;
  color: var(--wl-muted);
  font-size: 12px;
}

.filter-count {
  font-size: 0.7rem;
  background: var(--wl-paper);
  border: 1px solid var(--wl-line);
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  color: var(--wl-muted);
}

.reset-filters-btn {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.55rem;
  background: transparent;
  border: 1px dashed var(--wl-line);
  border-radius: var(--wl-radius-sm);
  color: var(--wl-muted);
  font-size: 0.76rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.reset-filters-btn:hover {
  color: var(--wl-danger);
  border-color: var(--wl-danger);
}

.catalog-results {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.results-meta-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
}

.catalog-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--wl-line);
  border-radius: var(--wl-radius-lg);
  background: var(--wl-surface);
  box-shadow: var(--wl-shadow-card);
  overflow: hidden;
  cursor: pointer;
  transition: all 0.22s var(--wl-ease-spring);
  position: relative;
}
.catalog-card::before {
  content: '';
  position: absolute;
  top: 0; inset-inline: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--wl-teal), var(--wl-brass));
  opacity: 0;
  transition: opacity 0.22s var(--wl-ease-spring);
  pointer-events: none;
  z-index: 1;
}
.catalog-card:hover::before { opacity: 1; }

.catalog-card:hover {
  border-color: var(--wl-line-strong);
  transform: translateY(-3px);
  box-shadow: var(--shadow-lg);
}

.catalog-card__media {
  height: 160px;
  position: relative;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-bottom: 1px solid var(--wl-line);
}

.catalog-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.35s var(--wl-ease-spring);
}

.catalog-card:hover .catalog-card__img {
  transform: scale(1.05);
}

.catalog-card__sku-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  color: var(--wl-muted);
  font-size: 0.8rem;
}

.catalog-card__badges {
  position: absolute;
  top: 0.6rem;
  inset-inline: 0.6rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  pointer-events: none;
}

.sku-chip {
  background: var(--wl-surface);
  border: 1px solid var(--wl-line);
  padding: 0.15rem 0.45rem;
  border-radius: var(--wl-radius-technical);
  font-size: 0.66rem;
  font-weight: 600;
  color: var(--wl-ink-strong);
  box-shadow: var(--shadow-xs);
}

.stock-pill {
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.65);
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.25);
}

.stock-pill--in {
  background: #059669;
}

.stock-pill--low {
  background: #D97706;
}

.stock-pill--out {
  background: #DC2626;
}

.catalog-card__body {
  padding: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  flex: 1;
}

.catalog-card__category {
  font-size: 0.68rem;
  color: var(--wl-teal);
  font-weight: 700;
  text-transform: uppercase;
}

.catalog-card__title {
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.35;
  color: var(--wl-ink-strong);
  min-height: 1.3em;
  margin: 0;
  text-align: start;
  overflow-wrap: anywhere;
}
.catalog-card__title-alt {
  font-size: 0.72rem;
  color: var(--wl-muted);
  font-weight: 500;
  line-height: 1.4;
  text-align: start;
  min-height: 1.2em;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
}

.catalog-card__origin {
  font-size: 0.7rem;
  color: var(--wl-muted);
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}
.length-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  padding: 0.1rem 0.4rem;
  border-radius: 9999px;
  font-size: 10px;
  font-weight: 700;
  color: var(--wl-ink-soft);
}
.length-dot {
  width: 6px;
  height: 2px;
  border-radius: 9999px;
  background: var(--wl-primary);
  display: inline-block;
}

.catalog-card__foot {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-top: auto;
  padding-top: 0.6rem;
}

.price-col {
  display: flex;
  flex-direction: column;
}

.catalog-card__price {
  font-size: 1.15rem;
  color: var(--wl-ink-strong);
}

.currency-tag {
  font-size: 0.85rem;
  color: var(--wl-teal);
}

.unit-tag {
  font-size: 0.68rem;
  color: var(--wl-muted);
}

.rating-tag {
  font-size: 0.72rem;
  color: var(--wl-amber-strong);
}

.catalog-card__actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--wl-line);
}

.card-action-btn {
  flex: 1;
  padding: 0.55rem 0.75rem;
  border-radius: 8px;
  font-size: 0.76rem;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  transition: all 0.2s var(--wl-ease-spring);
}

.card-action-btn--view {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  color: var(--wl-ink-strong);
}

.card-action-btn--view:hover {
  background: var(--wl-surface-soft);
  border-color: var(--wl-border-strong);
  transform: translateY(-0.5px);
}

.card-action-btn--quote {
  background: var(--wl-teal);
  border: 1px solid var(--wl-teal);
  color: #ffffff;
  box-shadow: 0 2px 6px rgba(13, 148, 136, 0.25);
}

.card-action-btn--quote:hover:not(:disabled) {
  background: var(--wl-teal-hover);
  transform: translateY(-0.5px);
  box-shadow: 0 4px 12px rgba(13, 148, 136, 0.35);
}

.card-action-btn--quote:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.catalog-wishlist-btn {
  position: absolute;
  bottom: 0.6rem;
  inset-inline-end: 0.6rem;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--wl-line);
  background: var(--wl-surface);
  color: var(--wl-muted);
  display: grid;
  place-items: center;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition: all .18s var(--wl-ease-spring);
  z-index: 2;
}
.catalog-wishlist-btn .material-symbols-outlined { font-size: 18px; font-variation-settings: 'FILL' 0; }
.catalog-wishlist-btn:hover { border-color: var(--wl-teal); color: var(--wl-teal); transform: scale(1.05); }
.catalog-wishlist-btn.is-saved { background: var(--wl-danger-soft); border-color: var(--wl-danger); color: var(--wl-danger); }
.catalog-wishlist-btn.is-saved .material-symbols-outlined { font-variation-settings: 'FILL' 1; }

.catalog-pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-top: 2rem;
  padding: 1rem;
}

.catalog-page-btn {
  padding: 0.55rem 1rem;
  border: 1px solid var(--wl-line);
  background: var(--wl-surface);
  border-radius: var(--wl-radius-sm);
  color: var(--wl-ink-strong);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.catalog-page-btn:hover:not(:disabled) {
  border-color: var(--wl-teal);
  color: var(--wl-teal);
}

.catalog-page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.catalog-page-info {
  font-size: 0.78rem;
  color: var(--wl-muted);
}

@media (max-width: 1120px) {
  .products-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 860px) {
  .catalog-grid-layout {
    grid-template-columns: 1fr;
  }

  .filter-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 100;
    border-radius: 0;
    display: none;
    overflow-y: auto;
  }

  .filter-sidebar.is-mobile-open {
    display: flex;
  }

  .filter-sidebar__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--wl-line);
  }

  .close-filters-btn {
    background: none;
    border: none;
    color: var(--wl-ink-strong);
    cursor: pointer;
  }
}

@media (max-width: 600px) {
  .catalog-page {
    padding: 1rem 0.75rem 3rem;
  }
  .products-grid {
    grid-template-columns: 1fr;
  }
  .catalog-card__title {
    min-height: auto;
  }
  .search-box {
    flex: 1 1 100%;
    min-width: 0;
  }
  .toolbar-controls {
    flex: 1 1 100%;
    flex-wrap: wrap;
  }
  .sort-select-wrapper {
    flex: 1 1 100%;
  }
  .sort-select {
    width: 100%;
  }
}
</style>
