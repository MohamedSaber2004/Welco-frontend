<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAnimation } from '../../composables/useAnimation'
import AdminLayout from '../../components/layout/AdminLayout.vue'
import DataState from '../../components/ui/DataState.vue'
import AppPagination from '../../components/ui/AppPagination.vue'
import BaseModal from '../../components/ui/BaseModal.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import FileUpload from '../../components/ui/FileUpload.vue'
import AppImage from '../../components/ui/AppImage.vue'
import { ATTACHMENT_PLACE, MEDIA_TYPE } from '../../config/api.config'
import { services, companyRepository } from '../../di/container'
import { confirmService } from '../../infrastructure/feedback/confirm.service'
import { toastService } from '../../infrastructure/feedback/toast.service'
import { t, locale } from '../../i18n'
import type {
  ProductDto,
  CategoryDto,
  CurrencyDto,
  CreateProductPayload,
  UpdateProductPayload,
} from '../../domain/models/marketplace'
import type { CompanyDto } from '../../domain/models/company'
import { formatPrice } from '../../utils/format'

useAnimation()

const route = useRoute()
const router = useRouter()

const localized = (en?: string | null, ar?: string | null) => (locale.value === 'ar' ? ar || en || '' : en || ar || '')

export interface ProductProviderInfo {
  id: string
  name: string
  isDirect?: boolean
}

export interface AdminProductItem extends ProductDto {
  provider: ProductProviderInfo
}

const rawProducts = ref<ProductDto[]>([])
const categories = ref<CategoryDto[]>([])
const currencies = ref<CurrencyDto[]>([])
const companies = ref<CompanyDto[]>([])
const loading = ref(true)
const fetchError = ref('')

const search = ref('')
const categoryFilter = ref('all')
const stockFilter = ref<'all' | 'inStock' | 'outOfStock'>('all')
const providerFilter = ref('all')
const statusFilter = ref<'all' | 'active' | 'inactive'>('all')
const page = ref(1)
const pageSize = 12

const companyMap = computed(() => {
  const map = new Map<string, CompanyDto>()
  for (const c of companies.value) {
    if (c?.id) map.set(c.id, c)
  }
  return map
})

const getCategoryName = (catId?: string | null): string => {
  if (!catId) return '—'
  const c = categories.value.find((x) => x.id === catId)
  return c ? localized(c.nameEn, c.nameAr) : '—'
}

const getCurrencyCode = (currId?: string | null): string => {
  if (!currId) return 'USD'
  const c = currencies.value.find((x) => x.id === currId)
  return c ? c.code : 'USD'
}

const loadMetadata = async () => {
  try {
    const [cats, currs, comps, dir] = await Promise.all([
      services.marketplaceRepository.getCategories().catch(() => [] as CategoryDto[]),
      services.marketplaceRepository.getCurrencies().catch(() => [] as CurrencyDto[]),
      companyRepository.getCompanies({ pageSize: 50 }).catch(() => null),
      companyRepository.getProvidersDirectory({ pageSize: 50 }).catch(() => null),
    ])
    categories.value = Array.isArray(cats) ? cats : []
    currencies.value = Array.isArray(currs) ? currs : []
    const allComps = [
      ...(Array.isArray(comps?.data) ? comps.data : []),
      ...(Array.isArray(dir?.data) ? dir.data : []),
    ]
    const dedupeMap = new Map<string, CompanyDto>()
    for (const c of allComps) {
      if (c && c.id) dedupeMap.set(c.id, c)
    }
    companies.value = Array.from(dedupeMap.values())
  } catch {
    // non-blocking
  }
}

const normalizeText = (s: string | null | undefined): string => {
  if (!s) return ''
  return s
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '') // remove arabic tashkeel / harakat
    .replace(/\s+/g, ' ')
}

const loadProducts = async () => {
  loading.value = true
  fetchError.value = ''
  try {
    // Fetch all catalog pages to enable complete, seamless global search across all 93+ products
    const firstPage = await services.marketplaceRepository.getProducts({
      page: 1,
      pageSize: 50,
    })
    const items: ProductDto[] = [...(firstPage?.data ?? [])]
    const totalItems = firstPage?.totalCount ?? items.length
    const backendPageSize = firstPage?.pageSize || (items.length > 0 ? items.length : 10)
    const totalPagesCount = Math.max(
      firstPage?.totalPages ?? 1,
      Math.ceil(totalItems / backendPageSize),
    )

    if (totalPagesCount > 1) {
      const pagePromises = []
      for (let p = 2; p <= Math.min(totalPagesCount, 20); p++) {
        pagePromises.push(
          services.marketplaceRepository.getProducts({ page: p, pageSize: 50 }).catch(() => null),
        )
      }
      const rest = await Promise.all(pagePromises)
      for (const res of rest) {
        if (Array.isArray(res?.data)) {
          items.push(...res.data)
        }
      }
    }
    rawProducts.value = items
  } catch (e) {
    fetchError.value = e instanceof Error ? e.message : t('common.error')
    rawProducts.value = []
  } finally {
    loading.value = false
  }
}

// Map every product entity with its resolved provider info (no artificial deduplication)
const adminProducts = computed<AdminProductItem[]>(() => {
  return rawProducts.value.map((p) => {
    const providerId = p.companyId || p.supplierId || ''
    let providerName = p.companyName || p.supplierNameEn || ''
    if (!providerName && providerId && companyMap.value.has(providerId)) {
      const comp = companyMap.value.get(providerId)!
      providerName = comp.name
    }

    const provider: ProductProviderInfo = providerName
      ? { id: providerId || providerName, name: providerName, isDirect: false }
      : { id: 'direct', name: t('admin.noProvidersAssigned'), isDirect: true }

    return {
      ...p,
      provider,
    }
  })
})

// Metrics across 100% of the catalog (all 94 entities)
const totalProductsCount = computed(() => rawProducts.value.length)
const activeCount = computed(() => rawProducts.value.filter((p) => (p.isActive ?? true)).length)
const inactiveCount = computed(() => rawProducts.value.filter((p) => !(p.isActive ?? true)).length)
const inStockCount = computed(() => rawProducts.value.filter((p) => (p.stock ?? 0) > 0).length)

// Reset pagination to page 1 whenever any filter or search term changes

watch([search, categoryFilter, stockFilter, providerFilter, statusFilter], () => {
  page.value = 1
})

// Full-catalog search and filters across 100% of products (not limited to current page)
// Full-catalog search and filters across 100% of products (not limited to current page)
const filteredProducts = computed(() => {
  let list = adminProducts.value

  // Status Filter: all | active | inactive
  if (statusFilter.value === 'active') {
    list = list.filter((p) => (p.isActive ?? true))
  } else if (statusFilter.value === 'inactive') {
    list = list.filter((p) => !(p.isActive ?? true))
  }

  // Category Filter
  if (categoryFilter.value !== 'all') {
    list = list.filter((p) => p.categoryId === categoryFilter.value)
  }

  // Stock Filter
  if (stockFilter.value === 'inStock') {
    list = list.filter((p) => (p.stock ?? 0) > 0)
  } else if (stockFilter.value === 'outOfStock') {
    list = list.filter((p) => !p.stock || p.stock <= 0)
  }

  // Provider Filter
  if (providerFilter.value !== 'all') {
    const pf = providerFilter.value.toLowerCase()
    list = list.filter((p) =>
      p.provider.id.toLowerCase() === pf || p.provider.name.toLowerCase().includes(pf),
    )
  }

  const rawSearch = search.value.trim()
  if (rawSearch) {
    const searchLower = rawSearch.toLowerCase()
    const searchTokens = rawSearch.split(/\s+/).filter(Boolean).map((tok) => normalizeText(tok))

    list = list.filter((p) => {
      const en = (p.nameEn || '').toLowerCase()
      const ar = normalizeText(p.nameAr)
      const sku = (p.sku || '').toLowerCase()
      const catEn = (categories.value.find((c) => c.id === p.categoryId)?.nameEn || '').toLowerCase()
      const catAr = normalizeText(categories.value.find((c) => c.id === p.categoryId)?.nameAr)
      const catCurrent = normalizeText(getCategoryName(p.categoryId))
      const mat = (p.material || '').toLowerCase()
      const slug = (p.slug || '').toLowerCase()

      // Exclude verbose descriptions and provider names to prevent loose false-positive matches (e.g. searching "Kelly" returning other instruments)
      const haystack = `${en} ${ar} ${sku} ${catEn} ${catAr} ${catCurrent} ${mat} ${slug}`

      return searchTokens.every((tok) => haystack.includes(tok))
    })

    // Rank matching products by relevance: StartsWith > Name Contains > Sku Contains
    list = [...list].sort((a, b) => {
      const aName = (a.nameEn || '').toLowerCase()
      const bName = (b.nameEn || '').toLowerCase()
      const aSku = (a.sku || '').toLowerCase()
      const bSku = (b.sku || '').toLowerCase()

      const aStarts = aName.startsWith(searchLower) || aSku.startsWith(searchLower) ? 1 : 0
      const bStarts = bName.startsWith(searchLower) || bSku.startsWith(searchLower) ? 1 : 0
      if (aStarts !== bStarts) return bStarts - aStarts

      const aContains = aName.includes(searchLower) ? 1 : 0
      const bContains = bName.includes(searchLower) ? 1 : 0
      if (aContains !== bContains) return bContains - aContains

      return 0
    })
  }

  return list
})

const totalCount = computed(() => filteredProducts.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / pageSize)))

const paginatedProducts = computed(() => {
  const start = (page.value - 1) * pageSize
  return filteredProducts.value.slice(start, start + pageSize)
})

// Unique providers options for toolbar filter dropdown
const providerOptions = computed(() => {
  const map = new Map<string, { id: string; name: string }>()
  for (const c of companies.value) {
    if (c?.id && c?.name) map.set(c.id, { id: c.id, name: c.name })
  }
  for (const p of adminProducts.value) {
    if (p.provider.id && !p.provider.isDirect && !map.has(p.provider.id)) {
      map.set(p.provider.id, { id: p.provider.id, name: p.provider.name })
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
})

// --- Product Modal State ---
const showModal = ref(false)
const editing = ref<AdminProductItem | ProductDto | null>(null)
const formLoading = ref(false)
const formError = ref('')
const slugTouched = ref(false)

const emptyForm = () => ({
  nameEn: '',
  nameAr: '',
  sku: '',
  slug: '',
  description: '',
  price: '' as unknown as number | undefined,
  stock: '' as unknown as number | undefined,
  imageName: '',
  images: ['', '', ''] as string[],
  videoUrl: '',
  material: '',
  currencyId: currencies.value[0]?.id || '',
  categoryId: categories.value[0]?.id || '',
  companyId: '',
  isActive: true,
})
const form = ref(emptyForm())

const addImageSlot = () => {
  form.value.images.push('')
}

const removeImageSlot = (idx: number) => {
  if (form.value.images.length > 3) {
    form.value.images.splice(idx, 1)
  } else {
    form.value.images[idx] = ''
  }
}

const uploadedImagesCount = computed(() =>
  form.value.images.filter((img) => Boolean(img && img.trim())).length,
)

const slugify = (v: string): string =>
  v.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')

const updateAutoSlug = () => {
  // If editing an existing product that already has a slug, do not overwrite it
  if (editing.value && editing.value.slug) return
  const fromName = slugify(form.value.nameEn)
  if (fromName) {
    form.value.slug = fromName
  } else if (form.value.sku) {
    form.value.slug = slugify(form.value.sku)
  }
}

const onNameEnInput = () => {
  updateAutoSlug()
}

const generateSku = () => {
  const prefix = form.value.nameEn ? form.value.nameEn.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'PRD') : 'PRD'
  form.value.sku = `WL-${prefix}-${Math.floor(1000 + Math.random() * 9000)}`
  if (!form.value.slug && (!editing.value || !editing.value.slug)) {
    updateAutoSlug()
  }
}

const openCreate = () => {
  editing.value = null
  form.value = emptyForm()
  formError.value = ''
  slugTouched.value = false
  showModal.value = true
}

const openEdit = (p: AdminProductItem | ProductDto) => {
  editing.value = p
  let imgs: string[] = []
  if (Array.isArray(p.images) && p.images.length > 0) {
    imgs = [...p.images]
  } else if (p.imageName) {
    imgs = [p.imageName]
  }
  while (imgs.length < 3) {
    imgs.push('')
  }
  form.value = {
    nameEn: p.nameEn ?? '',
    nameAr: p.nameAr ?? '',
    sku: p.sku ?? '',
    slug: p.slug || slugify(p.nameEn || '') || (p.sku ? slugify(p.sku) : ''),
    description: p.descriptionEn || p.description || '',
    price: (p.price !== undefined && p.price !== null) ? p.price : ('' as unknown as number),
    stock: (p.stock !== undefined && p.stock !== null) ? p.stock : ('' as unknown as number),
    imageName: p.imageName ?? '',
    images: imgs,
    videoUrl: p.videoUrl ?? '',
    material: p.material ?? '',
    currencyId: p.currencyId ?? '',
    categoryId: p.categoryId ?? '',
    companyId: p.companyId ?? '',
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
  if (!f.nameEn.trim()) {
    formError.value = t('admin.errNameEn')
    return
  }
  if (!f.sku.trim()) { formError.value = t('admin.errSku'); return }
  if (!f.slug.trim()) { f.slug = slugify(f.nameEn) || (f.sku ? slugify(f.sku) : '') || `prd-${Date.now()}` }
  if (!f.categoryId) { formError.value = t('admin.errCategory'); return }

  // Price is optional. If provided, must be a non-negative number.
  let numPrice: number | undefined = undefined
  if (f.price !== undefined && (f.price as unknown) !== '' && f.price !== null) {
    const parsed = Number(f.price)
    if (isNaN(parsed) || parsed < 0) {
      formError.value = t('admin.errPricePositive')
      return
    }
    numPrice = parsed
  }

  // Stock is optional. If provided, must be non-negative integer.
  let numStock: number | undefined = undefined
  if (f.stock !== undefined && (f.stock as unknown) !== '' && f.stock !== null) {
    const parsed = Number(f.stock)
    if (isNaN(parsed) || parsed < 0) {
      formError.value = t('admin.errStockPositive')
      return
    }
    numStock = parsed
  }

  // Strict validation: Minimum 3 images required
  const validImages = f.images.map((img) => (img || '').trim()).filter(Boolean)
  if (validImages.length < 3) {
    formError.value = t('admin.errMinThreeImages', { count: validImages.length })
    return
  }

  const primaryImage = validImages[0] || null
  const video = f.videoUrl.trim() || undefined
  const nameArVal = f.nameAr.trim() || undefined

  formLoading.value = true
  formError.value = ''
  try {
    if (editing.value) {
      const payload: UpdateProductPayload = {
        nameEn: f.nameEn.trim(),
        nameAr: nameArVal,
        sku: f.sku.trim(),
        slug: f.slug.trim().toLowerCase(),
        description: f.description.trim() || undefined,
        price: numPrice,
        stock: numStock,
        imageName: primaryImage,
        images: validImages,
        videoUrl: video,
        material: f.material.trim() || undefined,
        currencyId: f.currencyId || null,
        categoryId: f.categoryId,
        isActive: f.isActive,
      }
      await services.marketplaceRepository.updateProduct(editing.value.id, payload)
      toastService.success(t('admin.productUpdated'))
    } else {
      const payload: CreateProductPayload = {
        nameEn: f.nameEn.trim(),
        nameAr: nameArVal,
        sku: f.sku.trim(),
        slug: f.slug.trim().toLowerCase(),
        description: f.description.trim() || undefined,
        price: numPrice,
        stock: numStock,
        imageName: primaryImage,
        images: validImages,
        videoUrl: video,
        material: f.material.trim() || undefined,
        currencyId: f.currencyId || null,
        categoryId: f.categoryId,
      }
      await services.marketplaceRepository.createProduct(payload)
      toastService.success(t('admin.productCreated'))
    }
    closeModal()
    await loadProducts()
  } catch (e) {
    formError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    formLoading.value = false
  }
}

const confirmDelete = async (p: AdminProductItem | ProductDto) => {
  const confirmed = await confirmService.confirm({
    title: t('admin.deleteProductTitle'),
    message: `${t('common.delete')}: ${localized(p.nameEn, p.nameAr)}?`,
    variant: 'danger',
    confirmText: t('common.delete'),
    cancelText: t('common.cancel'),
  })
  if (!confirmed) return
  try {
    await services.marketplaceRepository.deleteProduct(p.id)
    toastService.success(t('admin.productDeleted'))
    await loadProducts()
  } catch (e) {
    toastService.error(e instanceof Error ? e.message : t('common.error'))
  }
}

const toggleActive = async (p: AdminProductItem) => {
  try {
    const next = !(p.isActive ?? true)
    await services.marketplaceRepository.updateProduct(p.id, {
      nameEn: p.nameEn,
      nameAr: p.nameAr,
      sku: p.sku,
      slug: p.slug || `sku-${p.sku}`,
      price: p.price,
      stock: p.stock,
      categoryId: p.categoryId,
      isActive: next,
    })
    p.isActive = next
    const target = rawProducts.value.find((x) => x.id === p.id)
    if (target) target.isActive = next
    toastService.success(next ? t('admin.productActivated') : t('admin.productDeactivated'))
  } catch (e) {
    toastService.error(e instanceof Error ? e.message : t('common.error'))
  }
}

onMounted(async () => {
  await Promise.all([loadMetadata(), loadProducts()])
  if (route.query.action === 'create') {
    openCreate()
    void router.replace({ query: { ...route.query, action: undefined } })
  }
})
</script>

<template>
  <AdminLayout>
    <div class="products-admin-view">
      <!-- Executive Header -->
      <header class="products-head">
        <div>
          <div class="head-chip mono">
            <span class="pulse-dot"></span>
            <span>{{ t('admin.catalogManagement') }}</span>
          </div>
          <h1 class="head-title">{{ t('admin.productsTitle') }}</h1>
          <p class="head-subtitle">{{ t('admin.productsDesc') }}</p>
        </div>

        <div class="head-actions">
          <BaseButton variant="primary" @click="openCreate">
            <span class="material-symbols-outlined text-[18px]">add_box</span>
            <span>{{ t('admin.newProduct') }}</span>
          </BaseButton>
        </div>
      </header>

      <!-- KPI Summary Cards -->
      <div class="kpi-ribbon" role="region" :aria-label="t('admin.productsTitle')">
        <div
          class="kpi-card mono clickable-kpi"
          :class="{ 'kpi-card--active': statusFilter === 'all' }"
          role="button"
          tabindex="0"
          @click="statusFilter = 'all'"
          @keydown.enter="statusFilter = 'all'"
        >
          <div class="kpi-icon-box" style="background: rgba(99,102,241,0.1); color: #6366F1;">
            <span class="material-symbols-outlined">inventory_2</span>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">{{ t('admin.productsTitle') }}</span>
            <div class="kpi-val-row">
              <span class="kpi-value">{{ totalProductsCount }}</span>
              <span class="kpi-badge mono">{{ activeCount }} {{ t('common.active') }} · {{ inactiveCount }} {{ t('common.inactive') }}</span>
            </div>
          </div>
        </div>

        <div
          class="kpi-card mono clickable-kpi"
          :class="{ 'kpi-card--active': statusFilter === 'active' }"
          role="button"
          tabindex="0"
          @click="statusFilter = 'active'"
          @keydown.enter="statusFilter = 'active'"
        >
          <div class="kpi-icon-box" style="background: rgba(16,185,129,0.1); color: #10B981;">
            <span class="material-symbols-outlined">check_circle</span>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">{{ t('admin.activeProducts') }}</span>
            <span class="kpi-value" style="color: #059669;">{{ activeCount }}</span>
          </div>
        </div>

        <div
          class="kpi-card mono clickable-kpi"
          :class="{ 'kpi-card--active': statusFilter === 'inactive' }"
          role="button"
          tabindex="0"
          @click="statusFilter = 'inactive'"
          @keydown.enter="statusFilter = 'inactive'"
        >
          <div class="kpi-icon-box" style="background: rgba(245,158,11,0.1); color: #F59E0B;">
            <span class="material-symbols-outlined">visibility_off</span>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">{{ t('admin.inactiveProducts') }}</span>
            <div class="kpi-val-row">
              <span class="kpi-value" style="color: #D97706;">{{ inactiveCount }}</span>
              <span v-if="inactiveCount > 0" class="kpi-badge kpi-badge--warn mono">{{ t('admin.hiddenFromCatalog') }}</span>
            </div>
          </div>
        </div>

        <div
          class="kpi-card mono clickable-kpi"
          :class="{ 'kpi-card--active': stockFilter === 'inStock' }"
          role="button"
          tabindex="0"
          @click="stockFilter = stockFilter === 'inStock' ? 'all' : 'inStock'"
          @keydown.enter="stockFilter = stockFilter === 'inStock' ? 'all' : 'inStock'"
        >
          <div class="kpi-icon-box" style="background: rgba(20,184,166,0.1); color: #14B8A6;">
            <span class="material-symbols-outlined">warehouse</span>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">{{ t('catalog.inStock') }}</span>
            <span class="kpi-value">{{ inStockCount }}</span>
          </div>
        </div>

        <div class="kpi-card mono">
          <div class="kpi-icon-box" style="background: rgba(139,92,246,0.1); color: #8B5CF6;">
            <span class="material-symbols-outlined">category</span>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">{{ t('admin.categoriesTitle') }}</span>
            <span class="kpi-value">{{ categories.length }}</span>
          </div>
        </div>
      </div>

      <!-- 44px Search & Filters Toolbar -->
      <div class="toolbar-card">
        <div class="search-wrap">
          <span class="material-symbols-outlined search-icon">search</span>
          <input
            v-model="search"
            type="search"
            class="toolbar-input"
            :placeholder="t('admin.searchProductsPlaceholder')"
          />
          <button
            v-if="search"
            type="button"
            class="clear-search-btn"
            @click="search = ''"
          >
            <span class="material-symbols-outlined text-[14px]">close</span>
          </button>
        </div>

        <div class="filter-group">
          <!-- Status Filter -->
          <select v-model="statusFilter" class="filter-select mono" :aria-label="t('commerce.status')">
            <option value="all">{{ t('admin.allStatuses') }} ({{ totalProductsCount }})</option>
            <option value="active">{{ t('admin.activeOnly') }} ({{ activeCount }})</option>
            <option value="inactive">{{ t('admin.inactiveOnly') }} ({{ inactiveCount }})</option>
          </select>

          <!-- Category Filter -->
          <select v-model="categoryFilter" class="filter-select mono">
            <option value="all">{{ t('marketplace.allCategories') }}</option>
            <option v-for="c in categories" :key="c.id" :value="c.id">
              {{ localized(c.nameEn, c.nameAr) }}
            </option>
          </select>

          <!-- Provider Filter -->
          <select v-model="providerFilter" class="filter-select mono">
            <option value="all">{{ t('common.all') }} {{ t('admin.providers') }}</option>
            <option v-for="pr in providerOptions" :key="pr.id" :value="pr.id">
              {{ pr.name }}
            </option>
          </select>

          <!-- Stock Filter -->
          <select v-model="stockFilter" class="filter-select mono">
            <option value="all">{{ t('catalog.availAll') }}</option>
            <option value="inStock">{{ t('catalog.inStock') }}</option>
            <option value="outOfStock">{{ t('admin.outOfStock') }}</option>
          </select>
        </div>

        <span class="mono counter-text ms-auto">
          {{ paginatedProducts.length }} {{ t('common.of') }} {{ totalCount }} {{ t('marketplace.products') }}
        </span>
      </div>

      <!-- Data Table -->
      <DataState
        :loading="loading && !adminProducts.length"
        :error="fetchError"
        :empty="!paginatedProducts.length && !loading"
        :empty-title="t('admin.noProducts')"
        skeleton-type="table"
        :skeleton-count="6"
        min-height="320px"
        @retry="loadProducts"
      >
        <div class="table-card">
          <div class="table-wrap">
            <table class="exec-table">
              <thead>
                <tr>
                  <th style="width: 70px;">{{ t('admin.editImage') }}</th>
                  <th>{{ t('admin.productNameEn') }}</th>
                  <th>{{ t('admin.sku') }}</th>
                  <th>{{ t('admin.category') }}</th>
                  <th>{{ t('admin.providers') }}</th>
                  <th>{{ t('admin.price') }}</th>
                  <th>{{ t('admin.stock') }}</th>
                  <th>{{ t('commerce.status') }}</th>
                  <th class="text-end" style="white-space: nowrap;">{{ t('admin.actions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in paginatedProducts" :key="p.id" class="exec-row">
                  <td>
                    <div class="prod-thumb-box">
                      <AppImage
                        :src="p.imageName"
                        placeholder-type="product"
                        :placeholder-text="p.sku"
                        :alt="localized(p.nameEn, p.nameAr)"
                        fit="contain"
                        class="prod-thumb"
                      />
                    </div>
                  </td>
                  <td>
                    <div class="prod-name-col">
                      <strong class="prod-name-en" dir="auto">{{ p.nameEn }}</strong>
                      <span class="prod-name-ar text-muted text-xs" dir="auto">{{ p.nameAr }}</span>
                    </div>
                  </td>
                  <td>
                    <span class="mono sku-tag">{{ p.sku }}</span>
                  </td>
                  <td>
                    <span class="cat-pill mono text-xs">{{ getCategoryName(p.categoryId) }}</span>
                  </td>
                  <td>
                    <div class="provider-cell">
                      <span class="provider-tag mono" :class="{ 'provider-tag--direct': p.provider.isDirect }">
                        <span class="material-symbols-outlined text-[13px]">
                          {{ p.provider.isDirect ? 'verified' : 'storefront' }}
                        </span>
                        <span>{{ p.provider.name }}</span>
                      </span>
                    </div>
                  </td>
                  <td>
                    <strong class="mono price-val">{{ formatPrice(p.price, locale) }} {{ p.currencySymbol || getCurrencyCode(p.currencyId) }}</strong>
                  </td>
                  <td>
                    <span class="mono stock-pill" :class="{ 'stock-pill--out': !p.stock || p.stock <= 0 }">
                      {{ p.stock ?? 0 }} {{ p.unit || 'pcs' }}
                    </span>
                  </td>
                  <td>
                    <span class="status-pill mono" :class="(p.isActive ?? true) ? 'status-pill--active' : 'status-pill--inactive'">
                      <span class="pill-dot"></span>
                      <span>{{ (p.isActive ?? true) ? t('common.active') : t('common.inactive') }}</span>
                    </span>
                  </td>
                  <td class="text-end" style="white-space: nowrap;">
                    <div class="row-actions">
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
                        class="row-action-btn"
                        :class="(p.isActive ?? true) ? 'row-action-btn--deactivate' : 'row-action-btn--activate'"
                        :title="(p.isActive ?? true) ? t('admin.deactivate') : t('admin.activate')"
                        @click="toggleActive(p)"
                      >
                        <span class="material-symbols-outlined text-[18px]">
                          {{ (p.isActive ?? true) ? 'visibility_off' : 'visibility' }}
                        </span>
                      </button>
                      <button
                        type="button"
                        class="row-action-btn row-action-btn--danger"
                        :title="t('common.delete')"
                        :aria-label="t('common.delete')"
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
            :page="page"
            :total-pages="totalPages"
            :total-items="totalCount"
            :page-size="pageSize"
            variant="table"
            @change="(p) => { page = p }"
          />
        </div>
      </DataState>

      <!-- Create / Edit Product Modal -->
      <BaseModal
        v-model="showModal"
        :title="editing ? t('admin.editProduct') : t('admin.newProduct')"
        max-width="720px"
        @close="closeModal"
      >
        <form class="product-form-stack" @submit.prevent="submit">
          <div v-if="formError" class="alert-banner alert-banner--danger mono">
            <span class="material-symbols-outlined text-[16px]">error</span>
            <span>{{ formError }}</span>
          </div>

          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label mono">{{ t('admin.nameEn') }} <span class="req">*</span></label>
              <input v-model="form.nameEn" type="text" required class="form-input" @input="onNameEnInput" />
            </div>
            <div class="form-group">
              <label class="form-label mono">
                {{ t('admin.nameAr') }}
                <span class="text-xs text-slate-400 font-normal ms-1">({{ t('common.optional') }})</span>
              </label>
              <input v-model="form.nameAr" type="text" class="form-input" dir="rtl" />
            </div>
          </div>

          <div class="form-grid-2">
            <div class="form-group">
              <div class="label-with-action">
                <label class="form-label mono">{{ t('admin.sku') }} <span class="req">*</span></label>
                <button
                  type="button"
                  class="btn-gen-sku mono"
                  :title="t('admin.autoGenerateSku')"
                  @click="generateSku"
                >
                  <span class="material-symbols-outlined text-[13px]">autorenew</span>
                  <span>{{ t('admin.auto') }}</span>
                </button>
              </div>
              <input v-model="form.sku" type="text" required class="form-input mono" />
            </div>
            <div class="form-group">
              <div class="label-with-action">
                <label class="form-label mono">{{ t('admin.slug') }} <span class="req">*</span></label>
                <span class="slug-badge mono">
                  <span class="material-symbols-outlined text-[12px]">lock</span>
                  <span>{{ t('admin.autoGenerated') }}</span>
                </span>
              </div>
              <input
                v-model="form.slug"
                type="text"
                class="form-input form-input--readonly mono"
                :placeholder="t('admin.autoGeneratedFromName')"
                readonly
                tabindex="-1"
              />
            </div>
          </div>

          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label mono">{{ t('admin.category') }} <span class="req">*</span></label>
              <select v-model="form.categoryId" required class="form-input mono">
                <option value="" disabled>{{ t('admin.category') }}</option>
                <option v-for="c in categories" :key="c.id" :value="c.id">
                  {{ localized(c.nameEn, c.nameAr) }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label mono">{{ t('admin.assignedProvider') }}</label>
              <select v-model="form.companyId" class="form-input mono">
                <option value="">{{ t('admin.noProvidersAssigned') }}</option>
                <option v-for="pr in providerOptions" :key="pr.id" :value="pr.id">
                  {{ pr.name }}
                </option>
              </select>
            </div>
          </div>

          <div class="form-grid-3">
            <div class="form-group">
              <label class="form-label mono">
                {{ t('admin.price') }}
                <span class="text-xs text-slate-400 font-normal ms-1">({{ t('common.optional') }})</span>
              </label>
              <input v-model.number="form.price" type="number" step="0.01" min="0" placeholder="0.00" class="form-input mono" />
            </div>
            <div class="form-group">
              <label class="form-label mono">
                {{ t('admin.stock') }}
                <span class="text-xs text-slate-400 font-normal ms-1">({{ t('common.optional') }})</span>
              </label>
              <input v-model.number="form.stock" type="number" min="0" placeholder="0" class="form-input mono" />
            </div>
            <div class="form-group">
              <label class="form-label mono">{{ t('admin.material') }}</label>
              <input v-model="form.material" type="text" placeholder="German Stainless Steel" class="form-input" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label mono">{{ t('admin.specifications') }}</label>
            <textarea v-model="form.description" rows="2" class="form-textarea"></textarea>
          </div>

          <!-- Product Images Multi-Slot Upload (Strict Min 3 Images Required) -->
          <div class="product-media-card p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20">
            <div class="flex items-center justify-between mb-2">
              <div>
                <label class="form-label mono font-bold text-slate-800 dark:text-slate-100 mb-0">
                  {{ t('admin.productImagesReq') }}
                </label>
                <p class="text-xs text-slate-500 mt-0.5">
                  {{ t('admin.productImagesHint') }}
                </p>
              </div>
              <span
                class="mono text-xs px-2.5 py-1 rounded-full font-bold transition-colors"
                :class="uploadedImagesCount >= 3 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'"
              >
                <span v-if="uploadedImagesCount >= 3">✓ {{ uploadedImagesCount }} {{ t('admin.imagesCompliant') }}</span>
                <span v-else>{{ uploadedImagesCount }} / 3 {{ t('admin.imagesRemaining') }}</span>
              </span>
            </div>

            <!-- Image Slots Grid -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div
                v-for="(img, idx) in form.images"
                :key="idx"
                class="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 relative flex flex-col gap-2"
              >
                <div class="flex items-center justify-between">
                  <span class="mono text-[11px] font-bold text-slate-700 dark:text-slate-200">
                    {{ idx === 0 ? t('admin.coverImage') : t('admin.imageIndex', { index: idx + 1 }) }}
                  </span>
                  <button
                    v-if="form.images.length > 3"
                    type="button"
                    class="text-rose-500 hover:text-rose-700 text-xs p-1"
                    :title="t('admin.removeSlot')"
                    @click="removeImageSlot(idx)"
                  >
                    <span class="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>

                <FileUpload
                  v-model="form.images[idx]"
                  :place="ATTACHMENT_PLACE.PROVIDERS"
                  :media-type="MEDIA_TYPE.IMAGE"
                  :label="idx === 0 ? t('admin.uploadCover') : t('admin.uploadImageIndex', { index: idx + 1 })"
                />
              </div>
            </div>

            <div class="mt-2.5 flex justify-end">
              <button
                type="button"
                class="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-400 py-1 px-3 rounded-lg border border-dashed border-sky-300 hover:border-sky-400 bg-sky-50/50 dark:bg-sky-950/20"
                @click="addImageSlot"
              >
                <span class="material-symbols-outlined text-[15px]">add_photo_alternate</span>
                <span>{{ t('admin.addImageSlot') }}</span>
              </button>
            </div>
          </div>

          <!-- Product Demonstration Video -->
          <div class="product-video-card p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20">
            <label class="form-label mono font-bold text-slate-800 dark:text-slate-100 mb-1">
              {{ t('admin.productVideoOptional') }}
            </label>
            <p class="text-xs text-slate-500 mb-2">
              {{ t('admin.productVideoDesc') }}
            </p>

            <div class="flex gap-2">
              <input
                v-model="form.videoUrl"
                type="url"
                class="form-input mono text-xs flex-1"
                :placeholder="t('admin.videoPlaceholder')"
              />
              <button
                v-if="form.videoUrl"
                type="button"
                class="px-2.5 text-xs text-rose-500 hover:text-rose-700 border border-slate-200 dark:border-slate-700 rounded-lg"
                @click="form.videoUrl = ''"
              >
                {{ t('common.clear') }}
              </button>
            </div>

            <div v-if="form.videoUrl" class="mt-2.5 p-2 rounded-xl bg-slate-900 text-white flex flex-col gap-2 max-w-md">
              <div class="flex items-center justify-between text-xs text-slate-300 px-1">
                <span class="flex items-center gap-1">
                  <span class="material-symbols-outlined text-[14px] text-red-400">play_circle</span>
                  <span>{{ t('admin.videoPreview') }}</span>
                </span>
                <a :href="form.videoUrl" target="_blank" rel="noopener noreferrer" class="text-sky-400 underline text-[11px]">
                  {{ t('admin.openLink') }}
                </a>
              </div>
              <video
                v-if="form.videoUrl.match(/\.(mp4|webm|ogg)($|\?)/i)"
                :src="form.videoUrl"
                controls
                class="w-full rounded-lg max-h-48 bg-black"
              ></video>
              <div v-else class="p-3 rounded-lg bg-slate-800 text-center text-xs text-slate-300">
                <span class="material-symbols-outlined text-[24px] text-sky-400 mb-1">movie</span>
                <p class="truncate font-mono">{{ form.videoUrl }}</p>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-checkbox-label">
              <input v-model="form.isActive" type="checkbox" class="form-checkbox" />
              <span class="mono">{{ t('admin.productActive') }}</span>
            </label>
          </div>

          <div class="modal-actions">
            <BaseButton variant="secondary" type="button" @click="closeModal">
              {{ t('common.cancel') }}
            </BaseButton>
            <BaseButton variant="primary" type="submit" :loading="formLoading">
              {{ editing ? t('common.save') : t('common.create') }}
            </BaseButton>
          </div>
        </form>
      </BaseModal>
    </div>
  </AdminLayout>
</template>

<style scoped>
.products-admin-view {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  width: 100%;
}

.products-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.head-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 9px;
  background: var(--wl-surface-soft, rgba(99,102,241,0.06));
  border: 1px solid var(--wl-border, rgba(99,102,241,0.15));
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 700;
  color: var(--wl-primary, #6366f1);
  margin-bottom: 0.35rem;
}

.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--wl-primary, #6366f1);
  box-shadow: 0 0 6px var(--wl-primary, #6366f1);
}

.head-title {
  font-size: 1.55rem;
  font-weight: 800;
  color: var(--wl-ink-strong, #0f172a);
  margin: 0;
  letter-spacing: -0.02em;
}

.head-subtitle {
  font-size: 13.5px;
  color: var(--wl-muted, #64748b);
  margin: 0.25rem 0 0;
}

/* ── KPI Ribbon ── */
.kpi-ribbon {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 0.85rem;
}

.kpi-card {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 1rem;
  background: var(--wl-surface, #ffffff);
  border: 1px solid var(--wl-border, #e2e8f0);
  border-radius: 12px;
  box-shadow: var(--wl-shadow-card, 0 1px 3px rgba(0,0,0,0.04));
}

.clickable-kpi {
  cursor: pointer;
  user-select: none;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.clickable-kpi:hover {
  border-color: var(--wl-primary, #6366f1);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(99, 102, 241, 0.12);
}

.clickable-kpi:focus-visible {
  outline: 2px solid var(--wl-primary, #6366f1);
  outline-offset: 2px;
}

.kpi-card--active {
  border-color: var(--wl-primary, #6366f1);
  background: var(--wl-surface-soft, #f8fafc);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.18);
}

.kpi-val-row {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.kpi-badge {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 6px;
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #e2e8f0;
}

.kpi-badge--warn {
  background: #fef3c7;
  color: #92400e;
  border-color: #fde68a;
}

.kpi-icon-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  flex-shrink: 0;
}

.kpi-content {
  display: flex;
  flex-direction: column;
}

.kpi-label {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--wl-muted, #64748b);
}

.kpi-value {
  font-size: 1.45rem;
  font-weight: 800;
  color: var(--wl-ink-strong, #0f172a);
  line-height: 1.2;
}

/* ── Toolbar Card ── */
.toolbar-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--wl-surface, #ffffff);
  border: 1px solid var(--wl-border, #e2e8f0);
  border-radius: 12px;
  box-shadow: var(--wl-shadow-card, 0 1px 3px rgba(0,0,0,0.04));
  flex-wrap: wrap;
}

.search-wrap {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 240px;
}

.search-icon {
  position: absolute;
  inset-inline-start: 12px;
  font-size: 18px;
  color: var(--wl-muted, #64748b);
  pointer-events: none;
}

.clear-search-btn {
  position: absolute;
  inset-inline-end: 10px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--wl-muted, #64748b);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
}

.toolbar-input {
  width: 100%;
  height: 40px;
  padding: 0 32px 0 38px;
  border: 1px solid var(--wl-border, #e2e8f0);
  border-radius: 8px;
  font-size: 13px;
  background: var(--wl-surface-soft, #f8fafc);
  color: var(--wl-ink-strong, #0f172a);
  outline: none;
  transition: all 0.15s;
}

.toolbar-input:focus {
  border-color: var(--wl-primary, #6366f1);
  background: #ffffff;
  box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.filter-select {
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--wl-border, #e2e8f0);
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 600;
  background: var(--wl-surface, #ffffff);
  color: var(--wl-ink-strong, #0f172a);
  outline: none;
  cursor: pointer;
}

.filter-select:focus {
  border-color: var(--wl-primary, #6366f1);
}

.counter-text {
  font-size: 12px;
  font-weight: 700;
  color: var(--wl-muted, #64748b);
}

/* ── Table Card ── */
.table-card {
  background: var(--wl-surface, #ffffff);
  border: 1px solid var(--wl-border, #e2e8f0);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--wl-shadow-card, 0 1px 3px rgba(0,0,0,0.04));
}

.table-wrap {
  overflow-x: auto;
}

.exec-table {
  width: 100%;
  border-collapse: collapse;
  text-align: start;
}

.exec-table th {
  padding: 10px 14px;
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--wl-muted, #64748b);
  background: var(--wl-surface-soft, #f8fafc);
  border-bottom: 1px solid var(--wl-border, #e2e8f0);
}

.exec-table td {
  padding: 12px 14px;
  font-size: 13px;
  border-bottom: 1px solid var(--wl-border, #f1f5f9);
  vertical-align: middle;
}

.exec-row:hover {
  background: var(--wl-surface-soft, #f8fafc);
}

.prod-thumb-box {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  background: var(--wl-surface-soft, #f8fafc);
  border: 1px solid var(--wl-border, #e2e8f0);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.prod-thumb {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.prod-name-col {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.prod-name-en {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--wl-ink-strong, #0f172a);
}

.prod-name-ar {
  font-size: 12px;
}

.sku-tag {
  display: inline-block;
  padding: 2px 7px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 11.5px;
  font-weight: 700;
  color: #334155;
}

.cat-pill {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  background: rgba(20,184,166,0.08);
  border: 1px solid rgba(20,184,166,0.2);
  border-radius: 9999px;
  font-size: 11.5px;
  font-weight: 600;
  color: #0d9488;
}

/* ── Provider Column Styling ── */
.provider-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.provider-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  background: rgba(99,102,241,0.08);
  border: 1px solid rgba(99,102,241,0.2);
  border-radius: 6px;
  font-size: 11.5px;
  font-weight: 700;
  color: #4f46e5;
  width: fit-content;
}

.provider-tag--direct {
  background: rgba(16,185,129,0.08);
  border-color: rgba(16,185,129,0.2);
  color: #059669;
}

.provider-tag--multi {
  background: rgba(245,158,11,0.08);
  border-color: rgba(245,158,11,0.25);
  color: #d97706;
}

.multi-badge {
  padding: 1px 4px;
  background: #f59e0b;
  color: #ffffff;
  border-radius: 9999px;
  font-size: 10px;
  font-weight: 800;
}

.provider-sublist {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.sub-pr-name {
  font-size: 10.5px;
}

.price-val {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--wl-ink-strong, #0f172a);
}

.stock-pill {
  display: inline-block;
  padding: 2px 7px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 700;
  background: #ecfdf5;
  color: #065f46;
  border: 1px solid #a7f3d0;
}

.stock-pill--out {
  background: #fef2f2;
  color: #991b1b;
  border-color: #fecaca;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 700;
}

.status-pill--active {
  background: #ecfdf5;
  color: #065f46;
}

.status-pill--inactive {
  background: #f8fafc;
  color: #64748b;
}

.pill-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.row-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.row-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid var(--wl-border, #e2e8f0);
  background: var(--wl-surface, #ffffff);
  color: var(--wl-ink-soft, #475569);
  cursor: pointer;
  transition: all 0.15s;
}

.row-action-btn:hover {
  border-color: var(--wl-primary, #6366f1);
  color: var(--wl-primary, #6366f1);
}

.row-action-btn--danger:hover {
  border-color: #ef4444;
  color: #ef4444;
}

/* ── Modal Forms ── */
.product-form-stack {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.85rem;
}

.form-grid-3 {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0.85rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.label-with-action {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.btn-gen-sku {
  background: none;
  border: none;
  font-size: 11px;
  font-weight: 700;
  color: var(--wl-primary, #6366f1);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 0;
}

.btn-gen-sku:hover {
  text-decoration: underline;
}

.form-input--readonly {
  background: var(--wl-surface-soft, #f8fafc) !important;
  color: var(--wl-muted, #64748b) !important;
  cursor: not-allowed;
  border-style: dashed;
  user-select: all;
}

.form-input--readonly:focus {
  outline: none !important;
  border-color: var(--wl-border, #e2e8f0) !important;
  box-shadow: none !important;
}

.slug-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10.5px;
  font-weight: 600;
  color: var(--wl-muted, #64748b);
  background: var(--wl-surface-soft, rgba(100, 116, 139, 0.08));
  padding: 1px 6px;
  border-radius: 4px;
}

.form-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--wl-ink-soft, #475569);
}

.req {
  color: #ef4444;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--wl-border, #e2e8f0);
  border-radius: 8px;
  font-size: 13px;
  color: var(--wl-ink-strong, #0f172a);
  background: var(--wl-surface, #ffffff);
  outline: none;
  box-sizing: border-box;
}

.form-input:focus,
.form-textarea:focus {
  border-color: var(--wl-primary, #6366f1);
  box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
}

.form-checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}

.form-checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--wl-primary, #6366f1);
  cursor: pointer;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--wl-border, #e2e8f0);
}

.alert-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12.5px;
}

.alert-banner--danger {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
}

@media (max-width: 900px) {
  .kpi-ribbon {
    grid-template-columns: repeat(2, 1fr);
  }
  .form-grid-2,
  .form-grid-3 {
    grid-template-columns: 1fr;
  }
}
</style>
