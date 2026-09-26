<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ProviderLayout from '../../components/layout/ProviderLayout.vue'
import DataState from '../../components/ui/DataState.vue'
import AppPagination from '../../components/ui/AppPagination.vue'
import BaseModal from '../../components/ui/BaseModal.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import FileUpload from '../../components/ui/FileUpload.vue'
import AppImage from '../../components/ui/AppImage.vue'
import { ATTACHMENT_PLACE, MEDIA_TYPE } from '../../config/api.config'
import { services, companyService, authService } from '../../di/container'
import { confirmService } from '../../infrastructure/feedback/confirm.service'
import { toastService } from '../../infrastructure/feedback/toast.service'
import { t, locale } from '../../i18n'
import type {
  ProductDto,
  CategoryDto,
  CurrencyDto,
  CreateProductPayload,
  UpdateProductPayload,
  ProductMediaDto,
} from '../../domain/models/marketplace'

const localized = (en?: string, ar?: string) => (locale.value === 'ar' ? ar || en || '' : en || ar || '')
const myCompanyId = computed(() => companyService.myCompany.value?.id || authService.user.value?.companyId || null)

const products = ref<ProductDto[]>([])
const categories = ref<CategoryDto[]>([])
const currencies = ref<CurrencyDto[]>([])
const loading = ref(true)
const fetchError = ref('')
const search = ref('')
const categoryFilter = ref('all')
const stockFilter = ref<'all' | 'inStock' | 'outOfStock'>('all')
const viewMode = ref<'table' | 'grid'>('table')
const page = ref(1)
const pageSize = 10

// KPI counters
const inStockCount = computed(() => products.value.filter((p) => p && (p.stock ?? 0) > 0).length)
const outOfStockCount = computed(() => products.value.filter((p) => p && (!p.stock || p.stock <= 0)).length)
const categoriesCount = computed(() => new Set(products.value.map((p) => p.categoryId).filter(Boolean)).size)

const filtered = computed(() => {
  const list = Array.isArray(products.value) ? products.value : []
  const q = search.value.trim().toLowerCase()
  return list.filter((p) => {
    if (!p) return false
    if (categoryFilter.value !== 'all' && p.categoryId !== categoryFilter.value) return false
    if (stockFilter.value === 'inStock' && (!p.stock || p.stock <= 0)) return false
    if (stockFilter.value === 'outOfStock' && (p.stock ?? 0) > 0) return false
    if (!q) return true
    return [p.nameEn, p.nameAr, p.sku, p.id, p.material]
      .some((v) => (v ? String(v).toLowerCase().includes(q) : false))
  })
})
const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize)))
const paginated = computed(() => filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize))

const getCategoryName = (catId?: string | null): string => {
  if (!catId) return '—'
  const c = categories.value.find((x) => x.id === catId)
  return c ? localized(c.nameEn, c.nameAr) : '—'
}

const getCurrencyCode = (currId?: string | null): string => {
  if (!currId) return ''
  const c = currencies.value.find((x) => x.id === currId)
  return c ? c.code : ''
}

const loadAll = async () => {
  loading.value = true
  fetchError.value = ''
  try {
    await companyService.loadMyCompany().catch(() => null)
    const cid = myCompanyId.value || ''
    // Load products unconditionally — backend resolves caller company via JWT token if needed
    const [mine, cats, currs] = await Promise.all([
      services.marketplaceRepository.getMyProducts(cid, { page: 1, pageSize: 100 }),
      services.marketplaceRepository.getCategories().catch(() => [] as CategoryDto[]),
      services.marketplaceRepository.getCurrencies().catch(() => [] as CurrencyDto[]),
    ])
    products.value = Array.isArray(mine?.data) ? mine.data : []
    categories.value = Array.isArray(cats) ? cats : []
    currencies.value = Array.isArray(currs) ? currs : []
  } catch (e) {
    fetchError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    loading.value = false
  }
}

/* ── Product Details Modal ── */
const showDetailsModal = ref(false)
const selectedProduct = ref<ProductDto | null>(null)

const openDetails = (p: ProductDto) => {
  selectedProduct.value = p
  showDetailsModal.value = true
}

const closeDetails = () => {
  showDetailsModal.value = false
  selectedProduct.value = null
}

/* ── Product Form (Create & Update) ── */
const showModal = ref(false)
const editing = ref<ProductDto | null>(null)
const formLoading = ref(false)
const formError = ref('')
const slugTouched = ref(false)

const emptyForm = () => ({
  nameEn: '',
  nameAr: '',
  sku: '',
  slug: '',
  description: '',
  price: '' as unknown as number,
  stock: 0,
  specifications: '',
  imageName: '',
  videos: [] as { id?: string; url: string; title?: string; sortOrder: number }[],
  material: '',
  currencyId: currencies.value[0]?.id || ('' as string),
  categoryId: categories.value[0]?.id || ('' as string),
  isActive: true,
})
const form = ref(emptyForm())

const slugify = (v: string): string =>
  v.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')

const onNameEnInput = () => {
  if (!slugTouched.value) form.value.slug = slugify(form.value.nameEn)
}

const generateSku = () => {
  const prefix = form.value.nameEn ? form.value.nameEn.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'PRD') : 'PRD'
  form.value.sku = `${prefix}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`
}

/* ── Video Handling ── */
const handleVideoUpload = async (file: File, storedName: string) => {
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
  const isVideo = ['.mp4', '.avi', '.mkv', '.mov', '.wmv'].includes(ext)
  if (!isVideo) {
    toastService.error(t('attachment.unsupportedType') || 'Unsupported video format')
    return
  }
  form.value.videos.push({
    id: undefined,
    url: storedName,
    title: file.name.replace(/\.[^.]+$/, ''),
    sortOrder: form.value.videos.length,
  })
  toastService.success(t('admin.videoUploaded'))
}

const removeVideo = (index: number) => {
  form.value.videos.splice(index, 1)
  form.value.videos.forEach((v, i) => { v.sortOrder = i })
}

const openCreate = () => {
  if (!myCompanyId.value) {
    toastService.info(t('provider.noCompanyDesc'))
    return
  }
  editing.value = null
  form.value = emptyForm()
  formError.value = ''
  slugTouched.value = false
  showModal.value = true
}

const openEdit = (p: ProductDto) => {
  editing.value = p
  form.value = {
    nameEn: p.nameEn ?? '',
    nameAr: p.nameAr ?? '',
    sku: p.sku ?? '',
    slug: p.slug ?? '',
    description: p.descriptionEn || p.description || '',
    price: p.price ?? 0,
    stock: p.stock ?? 0,
    specifications: p.specifications ?? '',
    imageName: p.imageName ?? '',
    videos: p.videos ? [...p.videos] : [],
    material: p.material ?? '',
    currencyId: p.currencyId ?? '',
    categoryId: p.categoryId ?? '',
    isActive: p.isActive ?? true,
  }
  formError.value = ''
  slugTouched.value = true
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  formError.value = ''
}

const submit = async () => {
  const f = form.value
  if (!f.nameEn.trim() || !f.nameAr.trim()) { formError.value = t('admin.errBothNames'); return }
  if (!f.sku.trim()) { formError.value = t('admin.errSku'); return }
  if (!f.slug.trim()) { f.slug = slugify(f.nameEn) || `prd-${Date.now()}` }
  if (!f.categoryId) { formError.value = t('admin.errCategory'); return }
  const numPrice = Number(f.price)
  if (isNaN(numPrice) || numPrice <= 0) {
    formError.value = locale.value === 'ar' ? 'يجب أن يكون السعر رقماً أكبر من 0' : 'Price must be a number greater than 0'
    return
  }
  const numStock = Number(f.stock)
  if (isNaN(numStock) || numStock < 0) {
    formError.value = locale.value === 'ar' ? 'لا يمكن أن يكون المخزون سالباً' : 'Stock cannot be negative'
    return
  }
  formLoading.value = true
  formError.value = ''
  try {
    let savedProduct: ProductDto
    if (editing.value) {
      const payload: UpdateProductPayload = {
        nameEn: f.nameEn.trim(),
        nameAr: f.nameAr.trim(),
        sku: f.sku.trim(),
        slug: f.slug.trim().toLowerCase(),
        description: f.description.trim() || undefined,
        price: numPrice,
        stock: numStock,
        specifications: f.specifications.trim() || undefined,
        imageName: f.imageName.trim() || null,
        material: f.material.trim() || undefined,
        currencyId: f.currencyId || null,
        categoryId: f.categoryId,
        isActive: f.isActive,
      }
      savedProduct = await services.marketplaceRepository.updateProduct(editing.value.id, payload)
      toastService.success(t('admin.productUpdated'))
    } else {
      const payload: CreateProductPayload = {
        nameEn: f.nameEn.trim(),
        nameAr: f.nameAr.trim(),
        sku: f.sku.trim(),
        slug: f.slug.trim().toLowerCase(),
        description: f.description.trim() || undefined,
        price: numPrice,
        stock: numStock,
        specifications: f.specifications.trim() || undefined,
        imageName: f.imageName.trim() || null,
        material: f.material.trim() || undefined,
        currencyId: f.currencyId || null,
        categoryId: f.categoryId,
      }
      savedProduct = await services.marketplaceRepository.createProduct(payload)
      toastService.success(t('admin.productCreated'))
    }

    // Persist videos after product is created/updated
    if (f.videos.length > 0) {
      const videoPayload: ProductMediaDto[] = f.videos.map((v) => ({
        productId: savedProduct.id,
        type: 2, // Video
        url: v.url,
        title: v.title,
        duration: undefined,
        sortOrder: v.sortOrder,
      }))
      try {
        await services.marketplaceRepository.updateProductVideos(savedProduct.id, videoPayload)
      } catch (videoErr) {
        if (import.meta.env.DEV) console.warn('[catalog] video sync failed', videoErr)
        toastService.error(t('admin.videoSyncFailed'))
      }
    }

    closeModal()
    await loadAll()
  } catch (e) {
    formError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    formLoading.value = false
  }
}

/* ── Product Delete ── */
const actionPendingId = ref<string | null>(null)
const confirmDelete = async (p: ProductDto) => {
  const ok = await confirmService.confirmDelete(
    `${t('admin.deleteProductConfirm')}\n${localized(p.nameEn, p.nameAr)}`,
    t('common.delete'),
  )
  if (!ok) return
  actionPendingId.value = p.id
  try {
    await services.marketplaceRepository.deleteProduct(p.id)
    toastService.success(t('admin.productDeleted'))
    if (selectedProduct.value?.id === p.id) {
      closeDetails()
    }
    await loadAll()
  } catch (e) {
    toastService.error(e instanceof Error ? e.message : t('common.error'))
  } finally {
    actionPendingId.value = null
  }
}

onMounted(() => { void loadAll() })
</script>

<template>
  <ProviderLayout>
    <div class="page-head">
      <div class="page-head__info">
        <span class="mono eyebrow">{{ t('provider.dashboard') }} · {{ t('provider.myCatalog') }}</span>
        <h1 class="page-title">{{ t('provider.myCatalog') }}</h1>
        <p class="page-head__desc">{{ t('provider.myCatalogDesc') }}</p>
      </div>
      <div class="head-actions">
        <BaseButton variant="primary" @click="openCreate">
          <span class="material-symbols-outlined text-[18px]">add</span>
          <span>{{ t('provider.newProduct') }}</span>
        </BaseButton>
      </div>
    </div>

    <!-- KPI Summary Cards -->
    <section class="kpi-grid" aria-label="Catalog Key Metrics">
      <div
        class="kpi-card"
        :class="{ 'is-active': stockFilter === 'all' && categoryFilter === 'all' }"
        @click="stockFilter = 'all'; categoryFilter = 'all'"
      >
        <div class="kpi-icon-box bg-primary-soft">
          <span class="material-symbols-outlined text-primary">inventory_2</span>
        </div>
        <div class="kpi-info">
          <span class="kpi-label mono">{{ t('admin.productsTitle') }}</span>
          <strong class="kpi-value mono">{{ products.length }}</strong>
        </div>
      </div>

      <div
        class="kpi-card"
        :class="{ 'is-active': stockFilter === 'inStock' }"
        @click="stockFilter = stockFilter === 'inStock' ? 'all' : 'inStock'"
      >
        <div class="kpi-icon-box bg-emerald-soft">
          <span class="material-symbols-outlined text-emerald-600">check_circle</span>
        </div>
        <div class="kpi-info">
          <span class="kpi-label mono">{{ t('admin.inStock') }}</span>
          <strong class="kpi-value mono text-emerald-600">{{ inStockCount }}</strong>
        </div>
      </div>

      <div
        class="kpi-card"
        :class="{ 'is-active': stockFilter === 'outOfStock' }"
        @click="stockFilter = stockFilter === 'outOfStock' ? 'all' : 'outOfStock'"
      >
        <div class="kpi-icon-box bg-rose-soft">
          <span class="material-symbols-outlined text-rose-600">warning</span>
        </div>
        <div class="kpi-info">
          <span class="kpi-label mono">{{ t('admin.outOfStock') }}</span>
          <strong class="kpi-value mono text-rose-600">{{ outOfStockCount }}</strong>
        </div>
      </div>

      <div class="kpi-card kpi-card--stat">
        <div class="kpi-icon-box bg-indigo-soft">
          <span class="material-symbols-outlined text-indigo-600">category</span>
        </div>
        <div class="kpi-info">
          <span class="kpi-label mono">{{ t('provider.categories') }}</span>
          <strong class="kpi-value mono text-indigo-600">{{ categoriesCount }}</strong>
        </div>
      </div>
    </section>

    <!-- Non-blocking notification banner if company is not yet fully linked -->
    <div v-if="!myCompanyId && !loading && !products.length" class="card card--pad company-banner">
      <div class="company-banner__inner">
        <div class="company-banner__icon">
          <span class="material-symbols-outlined text-amber-600 text-[26px]">domain_disabled</span>
        </div>
        <div class="company-banner__text">
          <h3 class="company-banner__title">{{ t('provider.noCompanyTitle') }}</h3>
          <p class="muted company-banner__desc">{{ t('provider.noCompanyDesc') }}</p>
        </div>
        <router-link to="/profile" class="btn-link-company mono">
          <span class="material-symbols-outlined text-[16px]">account_box</span>
          <span>{{ t('provider.linkCompany') }}</span>
        </router-link>
      </div>
    </div>

    <!-- Search & Filter Controls -->
    <div class="search-filter-bar">
      <div class="search-wrap">
        <span class="material-symbols-outlined search-icon">search</span>
        <input
          v-model="search"
          type="search"
          class="search-input"
          :placeholder="t('common.searchPlaceholder')"
          @input="page = 1"
        />
        <button v-if="search" type="button" class="clear-search-btn" @click="search = ''; page = 1" :aria-label="t('common.clearInput')">
          <span class="material-symbols-outlined text-[16px]">close</span>
        </button>
      </div>
      <div class="filter-controls">
        <select v-model="categoryFilter" class="filter-select mono" @change="page = 1">
          <option value="all">{{ t('marketplace.allCategories') }}</option>
          <option v-for="c in categories" :key="c.id" :value="c.id">{{ localized(c.nameEn, c.nameAr) }}</option>
        </select>

        <select v-model="stockFilter" class="filter-select mono" @change="page = 1">
          <option value="all">{{ t('common.all') }} ({{ locale === 'ar' ? 'المخزون' : 'Stock' }})</option>
          <option value="inStock">{{ t('admin.inStock') }}</option>
          <option value="outOfStock">{{ t('admin.outOfStock') }}</option>
        </select>

        <div class="view-toggle-group" role="radiogroup" :aria-label="locale === 'ar' ? 'طريقة العرض' : 'View Mode'">
          <button
            type="button"
            class="view-toggle-btn"
            :class="{ 'is-active': viewMode === 'grid' }"
            :aria-pressed="viewMode === 'grid'"
            :title="locale === 'ar' ? 'عرض شبكي' : 'Grid View'"
            @click="viewMode = 'grid'"
          >
            <span class="material-symbols-outlined">grid_view</span>
          </button>
          <button
            type="button"
            class="view-toggle-btn"
            :class="{ 'is-active': viewMode === 'table' }"
            :aria-pressed="viewMode === 'table'"
            :title="locale === 'ar' ? 'عرض جدول' : 'Table View'"
            @click="viewMode = 'table'"
          >
            <span class="material-symbols-outlined">view_list</span>
          </button>
        </div>

        <span class="mono items-count-badge">
          {{ filtered.length }} {{ t('admin.productsTitle') || 'Products' }}
        </span>
      </div>
    </div>

    <!-- Products Data View -->
    <DataState
      :loading="loading"
      :error="fetchError"
      skeleton-type="table"
      :skeleton-count="5"
      use-spinner
      :spinner-label="t('common.loading')"
      :empty="!filtered.length && !loading"
      :empty-title="t('provider.noProducts')"
      :empty-description="t('provider.noProductsDesc')"
      @retry="loadAll"
    >
      <!-- GRID VIEW -->
      <div v-if="viewMode === 'grid'" class="products-grid-container">
        <div class="products-card-grid">
          <article
            v-for="p in paginated"
            :key="p.id"
            class="catalog-product-card"
            @click="openDetails(p)"
          >
            <div class="card-media-box">
              <AppImage
                :src="p.imageName"
                placeholder-type="product"
                :alt="p.nameEn"
                class="card-thumb-img"
              />
              <div class="card-badge-top">
                <span
                  class="stock-badge"
                  :class="(p.stock ?? 0) > 0 ? 'stock-badge--positive' : 'stock-badge--zero'"
                >
                  {{ (p.stock ?? 0) > 0 ? `${p.stock} ${t('admin.inStock')}` : t('admin.outOfStock') }}
                </span>
                <span v-if="p.sku" class="card-sku-chip mono">
                  {{ p.sku }}
                </span>
              </div>
            </div>

            <div class="card-body-box">
              <span class="card-category-lbl mono">{{ getCategoryName(p.categoryId) }}</span>
              <h3 class="card-product-title">{{ localized(p.nameEn, p.nameAr) }}</h3>
              <span v-if="p.material" class="card-material-lbl mono">{{ p.material }}</span>

              <div class="card-price-row">
                <strong class="card-price-val mono">{{ p.price }}</strong>
                <span class="card-currency-val mono text-xs">{{ getCurrencyCode(p.currencyId) }}</span>
              </div>

              <div class="card-footer-actions" @click.stop>
                <button
                  type="button"
                  class="card-btn-details"
                  :title="t('common.details')"
                  @click="openDetails(p)"
                >
                  <span class="material-symbols-outlined text-[16px]">visibility</span>
                  <span>{{ t('common.details') }}</span>
                </button>
                <div class="card-btn-subgroup">
                  <button
                    type="button"
                    class="tbl-btn"
                    :title="t('common.edit')"
                    @click="openEdit(p)"
                  >
                    <span class="material-symbols-outlined text-[16px]">edit</span>
                  </button>
                  <button
                    type="button"
                    class="tbl-btn tbl-btn--danger"
                    :title="t('common.delete')"
                    :disabled="actionPendingId === p.id"
                    @click="confirmDelete(p)"
                  >
                    <span class="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
              </div>
            </div>
          </article>
        </div>
        <AppPagination
          v-model:page="page"
          :total-pages="totalPages"
          :total-items="filtered.length"
          :page-size="pageSize"
          variant="table"
        />
      </div>

      <!-- TABLE VIEW -->
      <div v-else class="table-card">
        <div class="table-wrap" tabindex="0" role="region" :aria-label="t('admin.productsTitle')">
          <table class="table">
            <thead>
              <tr>
                <th class="col-product">{{ t('admin.productsTitle') }}</th>
                <th class="col-sku">{{ t('admin.sku') }}</th>
                <th class="col-category">{{ t('admin.category') }}</th>
                <th class="col-price num">{{ t('admin.price') }}</th>
                <th class="col-stock num">{{ t('admin.stock') }}</th>
                <th class="col-status">{{ t('admin.status') }}</th>
                <th class="col-actions text-end">{{ t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="p in paginated"
                :key="p.id"
                class="catalog-row table-row-clickable"
                @click="openDetails(p)"
              >
                <td class="col-product">
                  <div class="cell-media">
                    <AppImage :src="p.imageName" placeholder-type="product" :alt="p.nameEn" width="44" height="44" class="row-thumb" />
                    <div class="cell-titles">
                      <strong class="table__name" :title="localized(p.nameEn, p.nameAr)">{{ localized(p.nameEn, p.nameAr) }}</strong>
                      <span v-if="p.material" class="table__sub mono" :title="p.material">{{ p.material }}</span>
                      <span
                        v-else-if="locale === 'ar' ? p.nameEn : p.nameAr"
                        class="table__sub mono"
                        :dir="locale === 'ar' ? 'ltr' : 'rtl'"
                        :title="locale === 'ar' ? p.nameEn : p.nameAr"
                      >
                        {{ locale === 'ar' ? p.nameEn : p.nameAr }}
                      </span>
                    </div>
                  </div>
                </td>
                <td class="col-sku">
                  <span class="mono sku-tag" :title="p.sku">{{ p.sku }}</span>
                </td>
                <td class="col-category">
                  <span class="cat-pill mono">{{ getCategoryName(p.categoryId) }}</span>
                </td>
                <td class="col-price num mono-num">
                  <span class="price-val">{{ p.price }}</span>
                  <span class="currency-label mono text-xs">{{ getCurrencyCode(p.currencyId) }}</span>
                </td>
                <td class="col-stock num mono-num">
                  <span class="stock-badge" :class="p.stock > 0 ? 'stock-badge--positive' : 'stock-badge--zero'">
                    <span class="status-dot"></span>
                    <span>{{ p.stock > 0 ? `${p.stock} ${t('admin.inStock')}` : t('admin.outOfStock') }}</span>
                  </span>
                </td>
                <td class="col-status">
                  <span class="status-dot-badge" :class="(p.isActive ?? true) ? 'status-dot-badge--active' : 'status-dot-badge--inactive'">
                    <span class="dot"></span>
                    <span>{{ (p.isActive ?? true) ? t('admin.active') : t('admin.inactive') }}</span>
                  </span>
                </td>
                <td class="col-actions text-end" @click.stop>
                  <div class="row-actions">
                    <button
                      type="button"
                      class="row-action-btn"
                      :title="t('admin.viewDetails') || 'View Details'"
                      :aria-label="t('admin.viewDetails') || 'View Details'"
                      @click="openDetails(p)"
                    >
                      <span class="material-symbols-outlined text-[18px]">visibility</span>
                    </button>
                    <button
                      type="button"
                      class="row-action-btn"
                      :title="t('common.edit')"
                      :aria-label="t('common.edit')"
                      @click="openEdit(p)"
                    >
                      <span class="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button
                      type="button"
                      class="row-action-btn row-action-btn--danger"
                      :title="t('common.delete')"
                      :aria-label="t('common.delete')"
                      :disabled="actionPendingId === p.id"
                      @click="confirmDelete(p)"
                    >
                      <span class="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <AppPagination
          v-model:page="page"
          :total-pages="totalPages"
          :total-items="filtered.length"
          :page-size="pageSize"
          variant="table"
        />
      </div>
    </DataState>

    <!-- Product Details Modal -->
    <BaseModal
      v-model="showDetailsModal"
      :title="localized(selectedProduct?.nameEn, selectedProduct?.nameAr) || t('common.details')"
      max-width="720px"
      @close="closeDetails"
    >
      <div v-if="selectedProduct" class="product-details-modal">
        <div class="details-hero">
          <div class="details-media-box">
            <AppImage
              :src="selectedProduct.imageName"
              placeholder-type="product"
              :alt="selectedProduct.nameEn"
              class="details-img"
            />
          </div>
          <div class="details-meta-col">
            <div class="meta-tag-row">
              <span class="inst-type-badge mono">{{ getCategoryName(selectedProduct.categoryId) }}</span>
              <span
                class="status-dot-badge"
                :class="(selectedProduct.isActive ?? true) ? 'status-dot-badge--active' : 'status-dot-badge--inactive'"
              >
                <span class="dot"></span>
                <span>{{ (selectedProduct.isActive ?? true) ? t('admin.active') : t('admin.inactive') }}</span>
              </span>
            </div>
            <h2 class="details-name">{{ localized(selectedProduct.nameEn, selectedProduct.nameAr) }}</h2>
            <p v-if="selectedProduct.nameAr && locale !== 'ar'" class="secondary-title mono" dir="rtl">
              {{ selectedProduct.nameAr }}
            </p>
            <p v-if="selectedProduct.nameEn && locale === 'ar'" class="secondary-title mono" dir="ltr">
              {{ selectedProduct.nameEn }}
            </p>

            <div class="price-stock-bar">
              <div class="price-chunk">
                <span class="chunk-k mono">{{ t('admin.price') }}</span>
                <span class="chunk-v mono-num font-bold text-lg">
                  {{ selectedProduct.price }} {{ getCurrencyCode(selectedProduct.currencyId) }}
                </span>
              </div>
              <div class="stock-chunk">
                <span class="chunk-k mono">{{ t('admin.stock') }}</span>
                <span
                  class="stock-pill mono"
                  :class="selectedProduct.stock > 0 ? 'stock-pill--in' : 'stock-pill--out'"
                >
                  {{ selectedProduct.stock > 0 ? `${selectedProduct.stock} ${t('admin.inStock')}` : t('admin.outOfStock') }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="specs-quad-grid">
          <div class="spec-card">
            <span class="spec-k mono">{{ t('admin.sku') }}</span>
            <strong class="spec-v mono">{{ selectedProduct.sku }}</strong>
          </div>
          <div class="spec-card">
            <span class="spec-k mono">{{ t('admin.slug') }}</span>
            <strong class="spec-v mono">{{ selectedProduct.slug }}</strong>
          </div>
          <div v-if="selectedProduct.material" class="spec-card">
            <span class="spec-k mono">{{ t('admin.material') || 'Material' }}</span>
            <strong class="spec-v">{{ selectedProduct.material }}</strong>
          </div>
          <div class="spec-card">
            <span class="spec-k mono">{{ t('admin.submittedDate') || 'Created' }}</span>
            <span class="spec-v mono text-xs">
              {{ selectedProduct.createdAt ? new Date(selectedProduct.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US') : '—' }}
            </span>
          </div>
        </div>

        <div v-if="selectedProduct.descriptionEn || selectedProduct.description" class="spec-block">
          <span class="spec-k mono">{{ t('admin.description') }}</span>
          <p class="spec-desc-text">{{ selectedProduct.descriptionEn || selectedProduct.description }}</p>
        </div>

<div v-if="selectedProduct.specifications" class="spec-block">
           <span class="spec-k mono">{{ t('admin.specifications') || 'Specifications' }}</span>
           <pre class="spec-pre">{{ selectedProduct.specifications }}</pre>
         </div>

         <div v-if="selectedProduct.videos?.length" class="spec-block">
           <span class="spec-k mono">{{ t('admin.productVideos') || 'Videos' }}</span>
           <div class="details-videos">
             <video
               v-for="(video, idx) in selectedProduct.videos"
               :key="video.id || idx"
               :src="video.url"
               controls
               class="details-video-player"
               @click.stop
             />
           </div>
         </div>

         <div class="modal-foot-split">
          <BaseButton
            variant="danger"
            type="button"
            :disabled="actionPendingId === selectedProduct.id"
            @click="confirmDelete(selectedProduct)"
          >
            <span class="material-symbols-outlined text-[16px]">delete</span>
            <span>{{ t('common.delete') }}</span>
          </BaseButton>

          <div class="modal-foot-right">
            <BaseButton variant="secondary" type="button" @click="closeDetails">
              {{ t('common.close') }}
            </BaseButton>
            <BaseButton
              variant="primary"
              type="button"
              @click="closeDetails(); openEdit(selectedProduct)"
            >
              <span class="material-symbols-outlined text-[16px]">edit</span>
              <span>{{ t('common.edit') }}</span>
            </BaseButton>
          </div>
        </div>
      </div>
    </BaseModal>

    <!-- Create / Edit Product Modal -->
    <BaseModal
      v-model="showModal"
      :title="editing ? t('provider.editProduct') : t('provider.newProduct')"
      max-width="720px"
      @close="closeModal"
    >
      <form class="admin-modal-form" @submit.prevent="submit">
        <div class="form-row two-cols">
          <div class="form-field">
            <label class="field-label" for="pp-name-en">{{ t('admin.productNameEn') }} *</label>
            <input
              id="pp-name-en"
              v-model="form.nameEn"
              type="text"
              class="field-input"
              required
              @input="onNameEnInput"
            />
          </div>
          <div class="form-field">
            <label class="field-label" for="pp-name-ar">{{ t('admin.productNameAr') }} *</label>
            <input id="pp-name-ar" v-model="form.nameAr" type="text" class="field-input" required />
          </div>
        </div>

        <div class="form-row two-cols">
          <div class="form-field">
            <div class="field-label-row">
              <label class="field-label" for="pp-sku">{{ t('admin.sku') }} *</label>
              <button
                type="button"
                class="btn-text-action mono"
                :title="locale === 'ar' ? 'توليد رمز SKU تلقائي' : 'Auto-generate SKU'"
                @click="generateSku"
              >
                <span class="material-symbols-outlined text-[13px]">autorenew</span>
                <span>{{ locale === 'ar' ? 'توليد تلقائي' : 'Auto' }}</span>
              </button>
            </div>
            <input id="pp-sku" v-model="form.sku" type="text" class="field-input mono" placeholder="e.g. PRD-MED-001" required @input="slugTouched = true" />
          </div>
          <div class="form-field">
            <label class="field-label" for="pp-slug">{{ t('admin.slug') }} *</label>
            <input id="pp-slug" v-model="form.slug" type="text" class="field-input mono" placeholder="e.g. surgical-forceps-316l" required @input="slugTouched = true" />
          </div>
        </div>

        <div class="form-row two-cols">
          <div class="form-field">
            <label class="field-label" for="pp-price">{{ t('admin.price') }} *</label>
            <div class="input-with-affix">
              <input
                id="pp-price"
                v-model.number="form.price"
                type="number"
                min="0.01"
                step="any"
                class="field-input mono-num"
                placeholder="0.00"
                required
              />
              <span class="input-affix mono text-xs">{{ getCurrencyCode(form.currencyId) || 'USD' }}</span>
            </div>
          </div>
          <div class="form-field">
            <label class="field-label" for="pp-stock">{{ t('admin.stock') }} *</label>
            <input id="pp-stock" v-model.number="form.stock" type="number" min="0" step="1" class="field-input mono-num" placeholder="0" required />
          </div>
        </div>

        <div class="form-row two-cols">
          <div class="form-field">
            <label class="field-label" for="pp-category">{{ t('admin.category') }} *</label>
            <select id="pp-category" v-model="form.categoryId" class="field-select" required>
              <option value="">{{ t('marketplace.choose') ?? 'Select Category' }}</option>
              <option v-for="c in categories" :key="c.id" :value="c.id">{{ localized(c.nameEn, c.nameAr) }}</option>
            </select>
          </div>
          <div class="form-field">
            <label class="field-label" for="pp-currency">{{ t('admin.currency') }}</label>
            <select id="pp-currency" v-model="form.currencyId" class="field-select">
              <option value="">{{ t('marketplace.choose') ?? 'Select Currency' }}</option>
              <option v-for="c in currencies" :key="c.id" :value="c.id">{{ c.code }} ({{ localized(c.nameEn, c.nameAr) || c.symbol }})</option>
            </select>
          </div>
        </div>

        <div class="form-field">
          <label class="field-label" for="pp-material">{{ t('admin.material') || 'Material' }}</label>
          <input id="pp-material" v-model="form.material" type="text" class="field-input" placeholder="e.g. Surgical Titanium, Stainless Steel 316L" />
        </div>

        <div class="form-field">
          <label class="field-label" for="pp-desc">{{ t('admin.description') }}</label>
          <textarea id="pp-desc" v-model="form.description" class="field-textarea" rows="3" placeholder="Provide product overview, intended use, etc."></textarea>
        </div>

        <div class="form-field">
          <label class="field-label" for="pp-specs">{{ t('admin.specifications') || 'Technical Specifications' }}</label>
          <textarea id="pp-specs" v-model="form.specifications" class="field-textarea mono text-xs" rows="3" placeholder="Dimensions, sterilization tolerance, weight, certifications, etc."></textarea>
        </div>

        <!-- Videos Upload Section -->
        <div class="form-field form-field--media">
          <label class="field-label">{{ t('admin.productVideos') || 'Product Videos' }}</label>
          <div class="videos-upload-container">
            <FileUpload
              :model-value="null"
              :place="ATTACHMENT_PLACE.PROVIDERS"
              :file-type="MEDIA_TYPE.VIDEO"
              accept="video/*"
              multiple
              :hint="t('attachment.dropHint')"
              @file-uploaded="handleVideoUpload"
            />
            <div v-if="form.videos.length > 0" class="videos-preview">
              <div v-for="(video, index) in form.videos" :key="video.id || index" class="video-preview-item">
                <video :src="video.url" controls class="video-preview" @click.stop></video>
                <div class="video-item-actions">
                  <button
                    type="button"
                    class="btn-video-remove"
                    @click="removeVideo(index)"
                    :title="t('common.remove')"
                  >
                    <span class="material-symbols-outlined">delete</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="form-field form-field--media">
          <label class="field-label">{{ t('admin.productImage') }}</label>
          <FileUpload
            :model-value="form.imageName || null"
            :place="ATTACHMENT_PLACE.PROVIDERS"
            :file-type="MEDIA_TYPE.IMAGE"
            accept="image/*"
            :hint="t('attachment.dropHint')"
            @update:modelValue="form.imageName = $event ?? ''"
          />
        </div>

        <div class="form-field">
          <label class="toggle-label">
            <input v-model="form.isActive" type="checkbox" />
            <span>{{ t('admin.categoryActive') }}</span>
          </label>
        </div>

        <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>

        <div class="modal-foot">
          <BaseButton variant="secondary" type="button" @click="closeModal">{{ t('common.cancel') }}</BaseButton>
          <BaseButton variant="primary" type="submit" :loading="formLoading">{{ t('common.save') }}</BaseButton>
        </div>
      </form>
    </BaseModal>
  </ProviderLayout>
</template>

<style scoped>
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
  flex-wrap: wrap;
}

.eyebrow {
  font-size: var(--step--1);
  color: var(--wl-primary);
  font-weight: 700;
  letter-spacing: 0.05em;
  display: block;
}

.page-title {
  font-family: var(--wl-font-display);
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--wl-ink-strong);
  margin: var(--space-1) 0;
}

.page-head__desc {
  font-size: var(--step-0);
  color: var(--wl-muted);
  max-width: 600px;
  margin: 0;
}

.head-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

/* KPI Summary Grid */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}

.kpi-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--wl-surface);
  border: 1.5px solid var(--wl-border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.kpi-card:hover {
  transform: translateY(-2px);
  border-color: var(--wl-primary);
  box-shadow: var(--shadow-sm);
}

.kpi-card.is-active {
  border-color: var(--wl-primary);
  background: var(--wl-primary-soft, #eef2ff);
  box-shadow: 0 0 0 1px var(--wl-primary);
}

.kpi-card--stat {
  cursor: default;
}
.kpi-card--stat:hover {
  transform: none;
  border-color: var(--wl-border);
}

.kpi-icon-box {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.bg-primary-soft { background: var(--wl-primary-soft, #eef2ff); }
.bg-emerald-soft { background: #dcfce7; }
.bg-rose-soft { background: #fee2e2; }
.bg-indigo-soft { background: #e0e7ff; }

.kpi-info {
  display: flex;
  flex-direction: column;
}

.kpi-label {
  font-size: 11px;
  color: var(--wl-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 600;
}

.kpi-value {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--wl-ink-strong);
  line-height: 1.2;
}

/* View Toggle */
.view-toggle-group {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  background: var(--wl-surface);
  padding: 2px;
}

.view-toggle-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--wl-muted);
  border-radius: var(--radius-sm);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: all 0.15s ease;
}

.view-toggle-btn:hover {
  color: var(--wl-ink-strong);
}

.view-toggle-btn.is-active {
  background: var(--wl-primary-soft, #eef2ff);
  color: var(--wl-primary);
  font-weight: 700;
}

/* Products Grid View */
.products-grid-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.products-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--space-4);
}

.catalog-product-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.catalog-product-card:hover {
  transform: translateY(-3px);
  border-color: var(--wl-primary);
  box-shadow: var(--shadow-md);
}

.card-media-box {
  position: relative;
  aspect-ratio: 4 / 3;
  background: var(--wl-surface-soft);
  overflow: hidden;
}

.card-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.4s ease;
}

.catalog-product-card:hover .card-thumb-img {
  transform: scale(1.05);
}

.card-badge-top {
  position: absolute;
  top: var(--space-2);
  inset-inline: var(--space-2);
  display: flex;
  align-items: center;
  justify-content: space-between;
  pointer-events: none;
}

.card-sku-chip {
  font-size: 11px;
  background: rgba(15, 23, 42, 0.75);
  color: #ffffff;
  padding: 2px 7px;
  border-radius: var(--radius-xs);
  backdrop-filter: blur(8px);
}

.card-body-box {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: var(--space-1);
}

.card-category-lbl {
  font-size: 11px;
  color: var(--wl-primary);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.card-product-title {
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--wl-ink-strong);
  margin: 2px 0 0;
  line-height: 1.3;
}

.card-material-lbl {
  color: var(--wl-muted);
}

.card-price-row {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-top: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px dashed var(--wl-border);
}

.card-price-val {
  font-size: 1.25rem;
  color: var(--wl-ink-strong);
}

.card-currency-val {
  color: var(--wl-muted);
}

.card-footer-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
  padding-top: var(--space-3);
  border-top: 1px solid var(--wl-border);
}

.card-btn-details {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: none;
  font-size: 12px;
  font-weight: 700;
  color: var(--wl-muted);
  cursor: pointer;
  padding: 4px 6px;
  border-radius: var(--radius-sm);
  transition: all 0.15s ease;
}

.card-btn-details:hover {
  color: var(--wl-ink-strong);
  background: var(--wl-surface-soft);
}

.card-btn-subgroup {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.tbl-btn {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--wl-border);
  background: var(--wl-surface);
  color: var(--wl-muted);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tbl-btn:hover {
  color: var(--wl-ink-strong);
  border-color: var(--wl-border-strong);
}

.tbl-btn--danger:hover {
  color: var(--wl-danger, #ef4444);
  border-color: var(--wl-danger, #ef4444);
  background: #fef2f2;
}

/* Company linking banner */
.company-banner {
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-5);
}

.company-banner__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.company-banner__icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  background: #fef3c7;
}

.company-banner__text {
  flex: 1 1 280px;
}

.company-banner__title {
  font-size: 1rem;
  font-weight: 700;
  color: #92400e;
  margin: 0 0 2px;
}

.company-banner__desc {
  font-size: var(--step--1);
  color: #b45309;
  margin: 0;
}

.btn-link-company {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: #ffffff;
  color: #92400e;
  border: 1px solid #f59e0b;
  border-radius: var(--radius-md);
  font-size: 12px;
  font-weight: 700;
  text-decoration: none;
  transition: all 0.15s ease;
}

.btn-link-company:hover {
  background: #fef3c7;
}

/* Search and Filters */
.search-filter-bar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-bottom: var(--space-4);
}

.search-wrap {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1 1 240px;
  min-width: min(100%, 220px);
}

.search-icon {
  position: absolute;
  inset-inline-start: var(--space-3);
  font-size: 18px;
  color: var(--fg-placeholder);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  padding-inline-start: var(--space-10);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  background: var(--wl-surface);
  color: var(--wl-ink-strong);
  font-size: var(--step-0);
  outline: none;
}

.search-input:focus {
  border-color: var(--wl-primary);
  box-shadow: var(--wl-focus-ring);
}

.clear-search-btn {
  position: absolute;
  inset-inline-end: var(--space-2);
  display: grid;
  place-items: center;
  background: none;
  border: none;
  color: var(--wl-muted);
  cursor: pointer;
  padding: 4px;
}

.filter-controls {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.filter-select {
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  background: var(--wl-surface);
  color: var(--wl-ink-strong);
  font-size: var(--step--1);
  outline: none;
  min-width: 180px;
}

.filter-select:focus {
  border-color: var(--wl-primary);
  box-shadow: var(--wl-focus-ring);
}

.items-count-badge {
  font-size: var(--step--1);
  color: var(--wl-muted);
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-full);
  padding: 4px 10px;
  white-space: nowrap;
}

/* Table Card & Scrollable Layout */
.table-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-xs);
  width: 100%;
}

.table-wrap {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-x: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--wl-border-strong) var(--wl-surface-soft);
}

.table-wrap::-webkit-scrollbar {
  height: 6px;
}
.table-wrap::-webkit-scrollbar-track {
  background: var(--wl-surface-soft);
}
.table-wrap::-webkit-scrollbar-thumb {
  background: var(--wl-border-strong);
  border-radius: 999px;
}
.table-wrap::-webkit-scrollbar-thumb:hover {
  background: var(--wl-muted);
}

.table {
  width: 100%;
  min-width: 980px;
  border-collapse: separate;
  border-spacing: 0;
}

.table th {
  background: var(--wl-surface-soft);
  color: var(--wl-muted);
  font-family: var(--font-mono, monospace);
  font-size: var(--step--2);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 12px 16px;
  border-bottom: 1px solid var(--wl-border);
  position: sticky;
  top: 0;
  z-index: 2;
  white-space: nowrap;
}

.table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--wl-border);
  vertical-align: middle;
}

/* Explicit Field Column Sizes & Placement */
.col-product {
  min-width: 260px;
  max-width: 360px;
  width: 28%;
  padding-inline-end: 20px;
  overflow: hidden;
}

.col-sku {
  min-width: 140px;
  width: 14%;
  white-space: nowrap;
  padding-inline-start: 12px;
  padding-inline-end: 16px;
}

.col-category {
  min-width: 140px;
  width: 15%;
  white-space: nowrap;
}

.col-price {
  min-width: 120px;
  width: 12%;
  text-align: end;
  white-space: nowrap;
}

.col-stock {
  min-width: 110px;
  width: 11%;
  text-align: center;
  white-space: nowrap;
}

.col-status {
  min-width: 105px;
  width: 10%;
  white-space: nowrap;
}

.col-actions {
  min-width: 120px;
  width: 10%;
  text-align: end;
  white-space: nowrap;
}

.table-row-clickable {
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.table-row-clickable:hover {
  background-color: var(--wl-surface-soft);
}

.table-row-clickable:hover .table__name {
  color: var(--wl-primary);
}

.cell-media {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.row-thumb {
  border-radius: var(--radius-md);
  border: 1px solid var(--wl-border);
  flex-shrink: 0;
  background: var(--wl-surface-soft);
}

.cell-titles {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
  overflow: hidden;
}

.table__name {
  font-size: var(--step-0);
  color: var(--wl-ink-strong);
  line-height: 1.35;
  transition: color 0.15s ease;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-word;
}

.table__sub {
  font-size: var(--step--2);
  color: var(--wl-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  display: block;
}

.sku-tag {
  font-size: var(--step--1);
  background: var(--wl-surface-soft);
  padding: 3px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--wl-border);
  color: var(--wl-ink-strong);
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 0.03em;
  font-weight: 500;
}

.cat-pill {
  font-size: var(--step--2);
  background: #f1f5f9;
  color: #334155;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  border: 1px solid #e2e8f0;
  display: inline-block;
  font-weight: 600;
}

.price-val {
  font-size: var(--step-0);
  font-weight: 800;
  color: var(--wl-ink-strong);
}

.stock-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  font-size: var(--step--2);
  font-weight: 700;
}

.stock-badge .status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.stock-badge--positive {
  color: #065f46;
  background: #d1fae5;
}
.stock-badge--positive .status-dot {
  background: #059669;
}

.stock-badge--zero {
  color: #991b1b;
  background: #fee2e2;
}
.stock-badge--zero .status-dot {
  background: #dc2626;
}

/* Modal Form Enhancements */
.field-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.btn-text-action {
  background: none;
  border: none;
  color: var(--wl-primary);
  font-size: var(--step--2);
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 0;
  transition: opacity 0.15s ease;
}

.btn-text-action:hover {
  opacity: 0.8;
  text-decoration: underline;
}

.input-with-affix {
  position: relative;
  display: flex;
  align-items: center;
}

.input-with-affix .field-input {
  padding-inline-end: 60px;
  width: 100%;
}

.input-affix {
  position: absolute;
  inset-inline-end: 12px;
  font-weight: 700;
  color: var(--wl-muted);
  pointer-events: none;
}

.form-field--media {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.videos-upload-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px dashed var(--wl-border);
  border-radius: var(--radius-md);
  background: var(--wl-surface-soft);
}

.videos-preview {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.video-preview-item {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.video-preview {
  width: 120px;
  height: 70px;
  border-radius: var(--radius-sm);
  object-fit: cover;
}

.video-item-actions {
  display: flex;
  gap: var(--space-1);
}

.btn-video-remove {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
  color: var(--wl-muted);
}

.btn-video-remove:hover {
  color: #b91c1c;
}

/* Product Details Modal Styling */
.product-details-modal {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.details-hero {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
}

.details-media-box {
  width: 140px;
  height: 140px;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--wl-border);
  background: var(--wl-surface);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.details-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.details-meta-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-tag-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.details-name {
  font-family: var(--wl-font-display);
  font-size: 1.35rem;
  font-weight: 800;
  color: var(--wl-ink-strong);
  margin: 4px 0 2px;
}

.secondary-title {
  color: var(--wl-muted);
  margin: 0 0 6px;
}

.price-stock-bar {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--wl-border);
}

.price-chunk,
.stock-chunk {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.chunk-k {
  font-size: var(--step--2);
  color: var(--wl-muted);
}

.stock-pill {
  display: inline-block;
  font-size: var(--step--2);
  padding: 3px 8px;
  border-radius: var(--radius-full);
}

.stock-pill--in {
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
}

.stock-pill--out {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
}

.specs-quad-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--space-3);
}

.spec-card {
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}

.spec-k {
  font-size: var(--step--2);
  color: var(--wl-muted);
}

.spec-v {
  font-size: var(--step-0);
  color: var(--wl-ink-strong);
}

.spec-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}

.spec-desc-text {
  font-size: var(--step--1);
  color: var(--wl-ink-strong);
  line-height: 1.5;
  margin: 0;
}

.spec-pre {
  font-size: var(--step--2);
  font-family: monospace;
  background: var(--wl-surface-soft);
  border-radius: var(--radius-sm);
  padding: var(--space-2);
  white-space: pre-wrap;
  color: var(--wl-ink-strong);
  margin: 0;
}

.modal-foot-split {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--wl-border);
}

.modal-foot-right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.details-videos {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: var(--space-2);
}

.details-video-player {
  width: 100%;
  max-width: 500px;
  height: auto;
  border-radius: var(--radius-md);
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
}

@media (max-width: 640px) {
  .details-hero {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .meta-tag-row,
  .price-stock-bar {
    justify-content: center;
  }
}
</style>
