<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BackButton from '../../components/ui/BackButton.vue'
import DataState from '../../components/ui/DataState.vue'
import AppPagination from '../../components/ui/AppPagination.vue'
import AppImage from '../../components/ui/AppImage.vue'
import { services } from '../../di/container'
import { t, locale } from '../../i18n'
import type { CompanyDto } from '../../domain/models/company'
import type { CategoryDto, ProductDto } from '../../domain/models/marketplace'
import { formatPrice } from '../../utils/format'

const route = useRoute()
const router = useRouter()
const categoryId = computed(() => String(route.params.id || ''))

const localized = (en?: string | null, ar?: string | null) =>
  locale.value === 'ar' ? ar || en || '' : en || ar || ''

const category = ref<CategoryDto | null>(null)
const categoryLoading = ref(true)

const providers = ref<CompanyDto[]>([])
const products = ref<ProductDto[]>([])
const productsTotalCount = ref(0)
const productsLoading = ref(true)
const productsError = ref('')
const totalCount = ref(0)
const loading = ref(true)
const fetchError = ref('')
const page = ref(1)
const pageSize = 9
const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / pageSize)))

type TabType = 'providers' | 'products' | 'all'
const activeTab = ref<TabType>(
  (route.query.tab as TabType) || 'providers',
)

const setTab = (tab: TabType) => {
  activeTab.value = tab
  void router.replace({
    query: {
      ...route.query,
      tab: tab === 'providers' ? undefined : tab,
    },
  })
}

const providerSearch = ref('')
const filteredProviders = computed(() => {
  const q = providerSearch.value.trim().toLowerCase()
  if (!q) return providers.value
  return providers.value.filter((p) => {
    const nameMatch = p.name?.toLowerCase().includes(q)
    const countryEnMatch = p.countryNameEn?.toLowerCase().includes(q)
    const countryArMatch = p.countryNameAr?.toLowerCase().includes(q)
    return Boolean(nameMatch || countryEnMatch || countryArMatch)
  })
})

const displayProductCount = computed(() => {
  if (productsTotalCount.value > 0) return productsTotalCount.value
  if (products.value.length > 0) return products.value.length
  return category.value?.productCount ?? 0
})

const loadCategory = async () => {
  categoryLoading.value = true
  try {
    category.value = await services.marketplaceRepository.getCategoryById(categoryId.value)
  } catch {
    category.value = null
  } finally {
    categoryLoading.value = false
  }
}

const loadProducts = async () => {
  productsLoading.value = true
  productsError.value = ''
  try {
    const res = await services.marketplaceRepository.getProducts({ categoryId: categoryId.value, page: 1, pageSize: 6 })
    products.value = Array.isArray(res?.data) ? res.data : []
    productsTotalCount.value = res?.totalCount ?? products.value.length
  } catch (e) {
    productsError.value = e instanceof Error ? e.message : t('common.error')
    products.value = []
    productsTotalCount.value = 0
  } finally {
    productsLoading.value = false
  }
}

const loadProviders = async () => {
  loading.value = true
  fetchError.value = ''
  try {
    const res = await services.marketplaceRepository.getCategoryProviders(categoryId.value, {
      page: page.value,
      pageSize,
    })
    providers.value = Array.isArray(res?.data) ? res.data : []
    totalCount.value = res?.totalCount ?? providers.value.length
  } catch (e) {
    fetchError.value = e instanceof Error ? e.message : t('common.error')
    providers.value = []
    totalCount.value = 0
  } finally {
    loading.value = false
  }
}

const onPageChange = (p: number) => {
  page.value = p
  void loadProviders()
}

const reloadAll = () => {
  page.value = 1
  providerSearch.value = ''
  void loadCategory()
  void loadProviders()
  void loadProducts()
}

onMounted(reloadAll)
watch(
  () => route.params.id,
  () => { reloadAll() },
)

const openStorefront = (id: string) => {
  void router.push({ name: 'provider-storefront', params: { id }, query: { category: categoryId.value } })
}
</script>

<template>
  <div class="page-shell cat-providers">
    <BackButton fallback="/categories" variant="minimal" class="mb-3" />

    <!-- Category Hero Card -->
    <DataState
      :loading="categoryLoading"
      :empty="!category && !categoryLoading"
      :empty-title="t('marketplace.categoriesTitle')"
      skeleton-type="store-hero"
    >
      <div v-if="category" class="cat-hero card">
        <AppImage
          :src="category.imageName"
          placeholder-type="category"
          :placeholder-text="localized(category.nameEn, category.nameAr)"
          :alt="localized(category.nameEn, category.nameAr)"
          fit="cover"
          class="cat-hero__img"
        />
        <div class="cat-hero__info">
          <div class="mono cat-hero__eyebrow">{{ t('provider.categoryProviders') }}</div>
          <h1 class="cat-hero__name" dir="auto">{{ localized(category.nameEn, category.nameAr) }}</h1>
          <p v-if="category.descriptionEn || category.descriptionAr" class="cat-hero__desc" dir="auto">
            {{ localized(category.descriptionEn, category.descriptionAr) }}
          </p>
          <div class="cat-hero__counts">
            <button
              type="button"
              class="count-chip mono"
              :class="{ 'count-chip--active': activeTab === 'providers' }"
              :title="locale === 'ar' ? 'عرض المورّدين' : 'View Providers'"
              @click="setTab('providers')"
            >
              <span class="material-symbols-outlined text-[15px]">apartment</span>
              <span>{{ totalCount }} · {{ t('provider.providersInCategory') }}</span>
            </button>
            <button
              v-if="displayProductCount > 0"
              type="button"
              class="count-chip mono"
              :class="{ 'count-chip--active': activeTab === 'products' }"
              :title="locale === 'ar' ? 'عرض المنتجات' : 'View Products'"
              @click="setTab('products')"
            >
              <span class="material-symbols-outlined text-[15px]">inventory_2</span>
              <span>{{ displayProductCount }} · {{ t('provider.providerProducts') }}</span>
            </button>
          </div>
        </div>
      </div>
    </DataState>

    <!-- Navigation Tabs / View Switcher -->
    <nav v-if="category" class="cat-tabs-bar" role="tablist" :aria-label="t('provider.categoryProviders')">
      <div class="cat-tabs-container">
        <button
          type="button"
          role="tab"
          class="cat-tab-btn"
          :class="{ 'cat-tab-btn--active': activeTab === 'providers' }"
          :aria-selected="activeTab === 'providers'"
          @click="setTab('providers')"
        >
          <span class="material-symbols-outlined cat-tab-btn__icon">apartment</span>
          <span>{{ t('provider.categoryProviders') }}</span>
          <span class="cat-tab-badge mono">{{ totalCount }}</span>
        </button>

        <button
          type="button"
          role="tab"
          class="cat-tab-btn"
          :class="{ 'cat-tab-btn--active': activeTab === 'products' }"
          :aria-selected="activeTab === 'products'"
          @click="setTab('products')"
        >
          <span class="material-symbols-outlined cat-tab-btn__icon">inventory_2</span>
          <span>{{ t('provider.providerProducts') }}</span>
          <span v-if="displayProductCount > 0" class="cat-tab-badge mono">{{ displayProductCount }}</span>
        </button>

        <button
          type="button"
          role="tab"
          class="cat-tab-btn"
          :class="{ 'cat-tab-btn--active': activeTab === 'all' }"
          :aria-selected="activeTab === 'all'"
          @click="setTab('all')"
        >
          <span class="material-symbols-outlined cat-tab-btn__icon">view_agenda</span>
          <span>{{ t('common.all') }}</span>
        </button>
      </div>
    </nav>

    <!-- 1. PROVIDERS SECTION (Primary Content: Shown first) -->
    <section
      v-if="category && (activeTab === 'providers' || activeTab === 'all')"
      class="cat-section cat-providers-section"
      aria-labelledby="category-providers-title"
    >
      <div class="section-heading-row">
        <div>
          <div class="mono section-kicker">{{ t('home.verifiedSupplier') }}</div>
          <h2 id="category-providers-title">{{ t('provider.providersInCategory') }}</h2>
        </div>

        <!-- Quick filter for providers -->
        <div v-if="providers.length > 0" class="prov-filter-search">
          <span class="material-symbols-outlined prov-filter-icon">search</span>
          <input
            v-model="providerSearch"
            type="search"
            class="prov-filter-input"
            :placeholder="locale === 'ar' ? 'بحث بالاسم أو الدولة...' : 'Filter by name or country...'"
            :aria-label="locale === 'ar' ? 'البحث في المورّدين' : 'Search providers'"
          />
          <button
            v-if="providerSearch"
            type="button"
            class="prov-filter-clear"
            :title="locale === 'ar' ? 'مسح البحث' : 'Clear search'"
            @click="providerSearch = ''"
          >
            <span class="material-symbols-outlined text-[15px]">close</span>
          </button>
        </div>
      </div>

      <DataState
        :loading="loading"
        :error="fetchError"
        skeleton-type="provider-cards"
        :skeleton-count="6"
        :empty="!providers.length && !loading"
        :empty-title="t('provider.noProvidersHere')"
        :empty-description="t('provider.noProvidersHereDesc')"
        :action-text="t('home.allProvidersLink')"
        @action="router.push('/providers')"
        @retry="loadProviders"
      >
        <!-- Filter Empty State -->
        <div v-if="providerSearch && !filteredProviders.length" class="empty-filter-state card">
          <span class="material-symbols-outlined empty-filter-icon">search_off</span>
          <h3 class="empty-filter-title">{{ locale === 'ar' ? 'لا توجد شركات مطابقة' : 'No matching providers found' }}</h3>
          <p class="empty-filter-desc">
            {{ locale === 'ar' ? `لم يتم العثور على أي مورد يطابق "${providerSearch}".` : `No provider matched "${providerSearch}".` }}
          </p>
          <button type="button" class="btn btn--secondary btn--sm mt-2" @click="providerSearch = ''">
            {{ locale === 'ar' ? 'إعادة ضبط البحث' : 'Clear search' }}
          </button>
        </div>

        <!-- Providers Grid -->
        <div v-else class="prov-grid">
          <article v-for="c in filteredProviders" :key="c.id" class="prov-card">
            <div class="prov-card__top">
              <AppImage
                :src="c.imageName"
                placeholder-type="company"
                :placeholder-text="c.name"
                :alt="c.name"
                fit="contain"
                class="prov-card__logo"
              />
              <span class="badge badge--green badge--pill">
                <span class="material-symbols-outlined text-[14px]">verified</span>
                <span>{{ t('home.verifiedSupplier') }}</span>
              </span>
            </div>
            <h3 class="prov-card__name" dir="auto">{{ c.name }}</h3>
            <div v-if="c.countryNameEn || c.countryNameAr" class="prov-card__country mono">
              <span class="material-symbols-outlined text-[14px]">public</span>
              <span>{{ localized(c.countryNameEn, c.countryNameAr) }}</span>
            </div>
            <button
              type="button"
              class="btn btn--secondary btn--sm btn--block prov-card__cta"
              @click="openStorefront(c.id)"
            >
              <span>{{ t('provider.viewCatalog') }}</span>
              <span class="icon--directional">→</span>
            </button>
          </article>
        </div>

        <AppPagination
          v-if="!providerSearch && totalPages > 1"
          :page="page"
          :total-pages="totalPages"
          :total-items="totalCount"
          :page-size="pageSize"
          @change="onPageChange"
        />
      </DataState>

      <!-- Teaser to Products when in Providers Tab -->
      <div v-if="activeTab === 'providers' && displayProductCount > 0" class="cat-teaser-card card">
        <div class="cat-teaser-card__icon">
          <span class="material-symbols-outlined">inventory_2</span>
        </div>
        <div class="cat-teaser-card__content">
          <h4>{{ locale === 'ar' ? 'هل تبحث عن المنتجات الجراحية في هذا التصنيف مباشرة؟' : 'Looking for products in this category directly?' }}</h4>
          <p>
            {{
              locale === 'ar'
                ? `يتوفر ${displayProductCount} منتج جراحي وطبي في هذا التصنيف جاهز للاستعراض أو طلب عرض السعر.`
                : `${displayProductCount} medical & surgical products available in this category for immediate quote or order.`
            }}
          </p>
        </div>
        <button type="button" class="btn btn--secondary btn--sm cat-teaser-card__btn" @click="setTab('products')">
          <span>{{ locale === 'ar' ? 'استعراض المنتجات' : 'Browse Products' }}</span>
          <span class="icon--directional">→</span>
        </button>
      </div>
    </section>

    <!-- 2. PRODUCTS SECTION (Secondary or Tabbed) -->
    <section
      v-if="category && (activeTab === 'products' || activeTab === 'all')"
      class="cat-section cat-products-section"
      aria-labelledby="category-products-title"
    >
      <div class="section-heading-row">
        <div>
          <div class="mono section-kicker">{{ t('marketplace.title') }}</div>
          <h2 id="category-products-title">{{ t('provider.providerProducts') }}</h2>
        </div>
        <button
          type="button"
          class="btn btn--secondary btn--sm"
          @click="router.push({ name: 'marketplace', query: { categoryId: categoryId } })"
        >
          <span>{{ locale === 'ar' ? 'عرض الكتالوج بالكامل في المتجر' : 'View Full Catalog' }}</span>
          <span class="icon--directional">→</span>
        </button>
      </div>

      <DataState
        :loading="productsLoading"
        :error="productsError"
        skeleton-type="catalog-grid"
        :skeleton-count="3"
        :empty="!products.length && !productsLoading"
        :empty-title="t('provider.noProducts')"
        @retry="loadProducts"
      >
        <div class="category-products-grid">
          <button
            v-for="product in products"
            :key="product.id"
            type="button"
            class="category-product-card"
            @click="router.push({ name: 'marketplace-product', params: { id: product.id } })"
          >
            <AppImage
              :src="product.imageName"
              placeholder-type="product"
              :alt="localized(product.nameEn, product.nameAr)"
              fit="contain"
              class="category-product-card__image"
            />
            <span class="category-product-card__body">
              <strong dir="auto">{{ localized(product.nameEn, product.nameAr) }}</strong>
              <span class="mono">{{ product.sku }}</span>
              <span class="category-product-card__price">
                {{ formatPrice(product.price, locale) }} {{ product.currencySymbol || product.currencyCode || '$' }}
              </span>
            </span>
          </button>
        </div>
      </DataState>

      <!-- Teaser to Providers when in Products Tab -->
      <div v-if="activeTab === 'products' && totalCount > 0" class="cat-teaser-card card">
        <div class="cat-teaser-card__icon">
          <span class="material-symbols-outlined">apartment</span>
        </div>
        <div class="cat-teaser-card__content">
          <h4>{{ locale === 'ar' ? 'هل تبحث عن المورّدين والمصانع المعتمدة؟' : 'Looking for certified suppliers & manufacturers?' }}</h4>
          <p>
            {{
              locale === 'ar'
                ? `يوجد ${totalCount} مورد ومصنع معتمد يوفر منتجات هذا التصنيف مع إمكانية تصنيع مخصص OEM.`
                : `${totalCount} verified suppliers offering products in this category with custom OEM options.`
            }}
          </p>
        </div>
        <button type="button" class="btn btn--secondary btn--sm cat-teaser-card__btn" @click="setTab('providers')">
          <span>{{ locale === 'ar' ? 'استعراض المورّدين' : 'Browse Providers' }}</span>
          <span class="icon--directional">→</span>
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.cat-providers {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.cat-hero {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: var(--space-6);
  padding: var(--space-6);
  align-items: center;
  overflow: hidden;
}
.cat-hero__img {
  width: 100%;
  height: 160px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
}
.cat-hero__info {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}
.cat-hero__eyebrow {
  font-size: var(--text-xs);
  letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
  color: var(--brand);
}
.cat-hero__name {
  margin: 0;
  font-size: var(--text-3xl);
  font-weight: var(--weight-bold);
  letter-spacing: var(--tracking-tight);
  color: var(--fg-heading);
  line-height: var(--leading-tight);
}
.cat-hero__desc {
  margin: 0;
  font-size: var(--text-base);
  color: var(--fg-muted);
  line-height: var(--leading-normal);
  max-width: 60ch;
}
.cat-hero__counts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-1);
}

.count-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--fg-muted);
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  padding: var(--space-1) var(--space-3);
  cursor: pointer;
  transition: all var(--duration-base) var(--ease-out);
}
.count-chip:hover {
  border-color: var(--brand);
  color: var(--brand);
  transform: translateY(-1px);
}
.count-chip--active {
  background: rgba(var(--brand-rgb, 46, 91, 255), 0.1);
  border-color: var(--brand);
  color: var(--brand);
  font-weight: var(--weight-semibold);
}

/* Tab Bar */
.cat-tabs-bar {
  display: flex;
  align-items: center;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-1);
  box-shadow: var(--shadow-sm);
}
.cat-tabs-container {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  width: 100%;
  overflow-x: auto;
  scrollbar-width: none;
}
.cat-tabs-container::-webkit-scrollbar {
  display: none;
}
.cat-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--fg-muted);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-base) var(--ease-out);
  white-space: nowrap;
}
.cat-tab-btn:hover {
  color: var(--fg-heading);
  background: var(--bg-subtle);
}
.cat-tab-btn--active {
  color: var(--brand);
  background: var(--bg-subtle);
  border-color: var(--border);
  font-weight: var(--weight-bold);
  box-shadow: var(--shadow-sm);
}
.cat-tab-btn__icon {
  font-size: 19px;
}
.cat-tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 var(--space-2);
  height: 20px;
  font-size: var(--text-xs);
  border-radius: var(--radius-pill);
  background: var(--bg-subtle);
  color: var(--fg-muted);
  border: 1px solid var(--border);
  transition: all var(--duration-base) var(--ease-out);
}
.cat-tab-btn--active .cat-tab-badge {
  background: var(--brand);
  color: #fff;
  border-color: var(--brand);
}

/* Sections */
.cat-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.section-heading-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: var(--space-4);
}
.section-heading-row h2 {
  margin: 0.25rem 0 0;
  color: var(--fg-heading);
  font-size: var(--text-2xl);
  letter-spacing: var(--tracking-tight);
}
.section-kicker {
  color: var(--brand);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
}

/* Quick Filter */
.prov-filter-search {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 250px;
}
.prov-filter-icon {
  position: absolute;
  inset-inline-start: var(--space-3);
  color: var(--fg-subtle);
  pointer-events: none;
  font-size: 18px;
}
.prov-filter-input {
  width: 100%;
  padding-block: var(--space-2);
  padding-inline-start: var(--space-8);
  padding-inline-end: var(--space-7);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  color: var(--fg-body);
  outline: none;
  transition: border-color var(--duration-base) var(--ease-out), box-shadow var(--duration-base) var(--ease-out);
}
.prov-filter-input:focus {
  border-color: var(--brand);
  box-shadow: 0 0 0 3px rgba(var(--brand-rgb, 46, 91, 255), 0.12);
}
.prov-filter-clear {
  position: absolute;
  inset-inline-end: var(--space-2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--fg-subtle);
  cursor: pointer;
  padding: var(--space-1);
}
.prov-filter-clear:hover {
  color: var(--fg-heading);
}

/* Empty filter state */
.empty-filter-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: var(--space-8);
  gap: var(--space-1);
}
.empty-filter-icon {
  font-size: 38px;
  color: var(--fg-subtle);
  margin-bottom: var(--space-2);
}
.empty-filter-title {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--fg-heading);
}
.empty-filter-desc {
  margin: 0;
  color: var(--fg-muted);
  font-size: var(--text-sm);
}

/* Provider Grid & Cards */
.prov-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4);
}
.prov-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-5);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  min-width: 0;
  transition: transform var(--duration-base) var(--ease-out), border-color var(--duration-base) var(--ease-out), box-shadow var(--duration-base) var(--ease-out);
}
.prov-card:hover {
  transform: translateY(-2px);
  border-color: var(--border-strong);
  box-shadow: var(--shadow-md);
}
.prov-card__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
}
.prov-card__logo {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--bg-subtle);
}
.prov-card__name {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--fg-heading);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.prov-card__country {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--fg-subtle);
}
.prov-card__cta {
  margin-top: auto;
}

/* Products Grid */
.category-products-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4);
}
.category-product-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
  text-align: start;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: transform var(--duration-base) var(--ease-out), border-color var(--duration-base) var(--ease-out), box-shadow var(--duration-base) var(--ease-out);
}
.category-product-card:hover {
  transform: translateY(-3px);
  border-color: var(--brand);
  box-shadow: var(--shadow-md);
}
.category-product-card__image {
  width: 100%;
  height: 155px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-subtle);
}
.category-product-card__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-4);
  min-width: 0;
}
.category-product-card__body strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--fg-heading);
}
.category-product-card__body .mono {
  color: var(--fg-subtle);
  font-size: var(--text-xs);
}
.category-product-card__price {
  margin-top: var(--space-2);
  color: var(--brand);
  font-weight: var(--weight-bold);
}

/* Teaser / Switcher Cards */
.cat-teaser-card {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  background: linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-subtle) 100%);
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-lg);
  margin-top: var(--space-2);
}
.cat-teaser-card__icon {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  background: rgba(var(--brand-rgb, 46, 91, 255), 0.1);
  color: var(--brand);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.cat-teaser-card__icon .material-symbols-outlined {
  font-size: 24px;
}
.cat-teaser-card__content {
  flex: 1;
  min-width: 0;
}
.cat-teaser-card__content h4 {
  margin: 0 0 var(--space-1);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--fg-heading);
}
.cat-teaser-card__content p {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--fg-muted);
}
.cat-teaser-card__btn {
  flex-shrink: 0;
}

/* Responsiveness */
@media (max-width: 1024px) {
  .prov-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 760px) {
  .category-products-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 640px) {
  .cat-hero {
    grid-template-columns: minmax(0, 1fr);
    padding: var(--space-5);
  }
  .cat-hero__img {
    height: 140px;
  }
  .cat-hero__name {
    font-size: var(--text-2xl);
  }
  .prov-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .cat-teaser-card {
    flex-direction: column;
    align-items: flex-start;
  }
  .cat-teaser-card__btn {
    width: 100%;
    justify-content: center;
  }
  .section-heading-row {
    flex-direction: column;
    align-items: stretch;
  }
  .prov-filter-search {
    width: 100%;
  }
}
@media (max-width: 520px) {
  .category-products-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
