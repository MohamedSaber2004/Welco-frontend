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

export interface GroupedAdminProduct extends ProductDto {
  providers: ProductProviderInfo[]
  rawInstances: ProductDto[]
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

// Group products by normalized SKU / name and aggregate multiple providers without duplicating rows
const groupedProducts = computed<GroupedAdminProduct[]>(() => {
  const map = new Map<string, GroupedAdminProduct>()

  for (const p of rawProducts.value) {
    if (!p) continue
    const key = (p.sku && p.sku.trim().toLowerCase()) || (p.slug && p.slug.trim().toLowerCase()) || (p.nameEn && p.nameEn.trim().toLowerCase()) || p.id

    const providerId = p.companyId || p.supplierId || ''
    let providerName = p.companyName || p.supplierNameEn || ''
    if (!providerName && providerId && companyMap.value.has(providerId)) {
      const comp = companyMap.value.get(providerId)!
      providerName = comp.name
    }

    const providerItem: ProductProviderInfo | null = providerName ? {
      id: providerId || providerName,
      name: providerName,
    } : null

    const existing = map.get(key)
    if (existing) {
      existing.rawInstances.push(p)
      if (providerItem && !existing.providers.some(pr => pr.name.toLowerCase() === providerItem.name.toLowerCase() || (pr.id && pr.id === providerItem.id))) {
        existing.providers.push(providerItem)
      }
      existing.stock = (existing.stock ?? 0) + (p.stock ?? 0)
      if (p.imageName && !existing.imageName) existing.imageName = p.imageName
    } else {
      const initialProviders: ProductProviderInfo[] = providerItem ? [providerItem] : []
      map.set(key, {
        ...p,
        providers: initialProviders,
        rawInstances: [p],
      })
    }
  }

  const list = Array.from(map.values())
  for (const item of list) {
    if (!item.providers.length) {
      item.providers.push({
        id: 'direct',
        name: t('admin.noProvidersAssigned'),
        isDirect: true,
      })
    }
  }
  return list
})

// Reset pagination to page 1 whenever any filter or search term changes
watch([search, categoryFilter, stockFilter, providerFilter], () => {
  page.value = 1
})

// Full-catalog search and filters across 100% of products (not limited to current page)
const filteredGroupedProducts = computed(() => {
  let list = groupedProducts.value

  if (categoryFilter.value !== 'all') {
    list = list.filter((p) => p.categoryId === categoryFilter.value)
  }

  if (stockFilter.value === 'inStock') {
    list = list.filter((p) => (p.stock ?? 0) > 0)
  } else if (stockFilter.value === 'outOfStock') {
    list = list.filter((p) => !p.stock || p.stock <= 0)
  }

  if (providerFilter.value !== 'all') {
    const pf = providerFilter.value.toLowerCase()
    list = list.filter((p) =>
      p.providers.some((pr) => pr.id.toLowerCase() === pf || pr.name.toLowerCase().includes(pf)),
    )
  }

  const rawSearch = search.value.trim()
  if (rawSearch) {
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
      const descEn = (p.descriptionEn || p.description || '').toLowerCase()
      const descAr = normalizeText(p.descriptionAr)
      const provText = p.providers.map((pr) => `${pr.name.toLowerCase()} ${normalizeText(pr.name)}`).join(' ')

      const haystack = `${en} ${ar} ${sku} ${catEn} ${catAr} ${catCurrent} ${mat} ${slug} ${descEn} ${descAr} ${provText}`

      return searchTokens.every((tok) => haystack.includes(tok))
    })
  }

  return list
})

const totalCount = computed(() => filteredGroupedProducts.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / pageSize)))

const inStockCount = computed(() => groupedProducts.value.filter((p) => (p.stock ?? 0) > 0).length)
const outOfStockCount = computed(() => groupedProducts.value.filter((p) => !p.stock || p.stock <= 0).length)

const paginatedProducts = computed(() => {
  const start = (page.value - 1) * pageSize
  return filteredGroupedProducts.value.slice(start, start + pageSize)
})

// Unique providers options for toolbar filter dropdown
const providerOptions = computed(() => {
  const map = new Map<string, { id: string; name: string }>()
  for (const c of companies.value) {
    if (c?.id && c?.name) map.set(c.id, { id: c.id, name: c.name })
  }
  for (const p of groupedProducts.value) {
    for (const pr of p.providers) {
      if (pr.id && !pr.isDirect && !map.has(pr.id)) {
        map.set(pr.id, { id: pr.id, name: pr.name })
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
})

// --- Product Modal State ---
const showModal = ref(false)
const editing = ref<GroupedAdminProduct | ProductDto | null>(null)
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
  stock: 10,
  imageName: '',
  material: '',
  currencyId: currencies.value[0]?.id || '',
  categoryId: categories.value[0]?.id || '',
  companyId: '',
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
  form.value.sku = `WL-${prefix}-${Math.floor(1000 + Math.random() * 9000)}`
}

const openCreate = () => {
  editing.value = null
  form.value = emptyForm()
  formError.value = ''
  slugTouched.value = false
  showModal.value = true
}

const openEdit = (p: GroupedAdminProduct | ProductDto) => {
  editing.value = p
  form.value = {
    nameEn: p.nameEn ?? '',
    nameAr: p.nameAr ?? '',
    sku: p.sku ?? '',
    slug: p.slug ?? '',
    description: p.descriptionEn || p.description || '',
    price: p.price ?? 0,
    stock: p.stock ?? 0,
    imageName: p.imageName ?? '',
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
  if (!f.nameEn.trim() || !f.nameAr.trim()) { formError.value = t('admin.errBothNames'); return }
  if (!f.sku.trim()) { formError.value = t('admin.errSku'); return }
  if (!f.slug.trim()) { f.slug = slugify(f.nameEn) || `prd-${Date.now()}` }
  if (!f.categoryId) { formError.value = t('admin.errCategory'); return }
  const numPrice = Number(f.price)
  if (isNaN(numPrice) || numPrice <= 0) {
    formError.value = t('admin.errPricePositive')
    return
  }
  const numStock = Number(f.stock)
  if (isNaN(numStock) || numStock < 0) {
    formError.value = t('admin.errStockPositive')
    return
  }
  formLoading.value = true
  formError.value = ''
  try {
    if (editing.value) {
      const payload: UpdateProductPayload = {
        nameEn: f.nameEn.trim(),
        nameAr: f.nameAr.trim(),
        sku: f.sku.trim(),
        slug: f.slug.trim().toLowerCase(),
        description: f.description.trim() || undefined,
        price: numPrice,
        stock: numStock,
        imageName: f.imageName.trim() || null,
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
        nameAr: f.nameAr.trim(),
        sku: f.sku.trim(),
        slug: f.slug.trim().toLowerCase(),
        description: f.description.trim() || undefined,
        price: numPrice,
        stock: numStock,
        imageName: f.imageName.trim() || null,
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

const confirmDelete = async (p: GroupedAdminProduct | ProductDto) => {
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

const toggleActive = async (p: GroupedAdminProduct) => {
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

watch([search, categoryFilter, stockFilter, providerFilter], () => {
  page.value = 1
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
        <div class="kpi-card mono">
          <div class="kpi-icon-box" style="background: rgba(99,102,241,0.1); color: #6366F1;">
            <span class="material-symbols-outlined">inventory_2</span>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">{{ t('admin.productsTitle') }}</span>
            <span class="kpi-value">{{ groupedProducts.length }}</span>
          </div>
        </div>

        <div class="kpi-card mono">
          <div class="kpi-icon-box" style="background: rgba(16,185,129,0.1); color: #10B981;">
            <span class="material-symbols-outlined">check_circle</span>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">{{ t('catalog.inStock') }}</span>
            <span class="kpi-value">{{ inStockCount }}</span>
          </div>
        </div>

        <div class="kpi-card mono">
          <div class="kpi-icon-box" style="background: rgba(244,63,94,0.1); color: #F43F5E;">
            <span class="material-symbols-outlined">warning</span>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">{{ t('admin.outOfStock') }}</span>
            <span class="kpi-value">{{ outOfStockCount }}</span>
          </div>
        </div>

        <div class="kpi-card mono">
          <div class="kpi-icon-box" style="background: rgba(20,184,166,0.1); color: #14B8A6;">
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
        :loading="loading && !groupedProducts.length"
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
                      <template v-if="p.providers.length === 1">
                        <span class="provider-tag mono" :class="{ 'provider-tag--direct': p.providers[0]?.isDirect }">
                          <span class="material-symbols-outlined text-[13px]">
                            {{ p.providers[0]?.isDirect ? 'verified' : 'storefront' }}
                          </span>
                          <span>{{ p.providers[0]?.name }}</span>
                        </span>
                      </template>
                      <template v-else-if="p.providers.length > 1">
                        <div class="multi-provider-wrap">
                          <span class="provider-tag provider-tag--multi mono" :title="p.providers.map(pr => pr.name).join(', ')">
                            <span class="material-symbols-outlined text-[13px]">groups</span>
                            <span>{{ p.providers[0]?.name }}</span>
                            <span class="multi-badge">+{{ p.providers.length - 1 }}</span>
                          </span>
                          <div class="provider-sublist mono text-xs text-muted">
                            <span v-for="(pr, pidx) in p.providers.slice(1, 3)" :key="pidx" class="sub-pr-name">
                              &bull; {{ pr.name }}
                            </span>
                          </div>
                        </div>
                      </template>
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
                      <span>{{ (p.isActive ?? true) ? t('admin.activate') : t('admin.deactivate') }}</span>
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
              <label class="form-label mono">{{ t('admin.nameAr') }} <span class="req">*</span></label>
              <input v-model="form.nameAr" type="text" required class="form-input" dir="rtl" />
            </div>
          </div>

          <div class="form-grid-2">
            <div class="form-group">
              <div class="label-with-action">
                <label class="form-label mono">{{ t('admin.sku') }} <span class="req">*</span></label>
                <button type="button" class="btn-gen-sku mono" @click="generateSku">{{ t('admin.sku') }}</button>
              </div>
              <input v-model="form.sku" type="text" required class="form-input mono" />
            </div>
            <div class="form-group">
              <label class="form-label mono">{{ t('admin.category') }} <span class="req">*</span></label>
              <select v-model="form.categoryId" required class="form-input mono">
                <option value="" disabled>{{ t('admin.category') }}</option>
                <option v-for="c in categories" :key="c.id" :value="c.id">
                  {{ localized(c.nameEn, c.nameAr) }}
                </option>
              </select>
            </div>
          </div>

          <!-- Provider Assignment -->
          <div class="form-group">
            <label class="form-label mono">{{ t('admin.assignedProvider') }}</label>
            <select v-model="form.companyId" class="form-input mono">
              <option value="">{{ t('admin.noProvidersAssigned') }}</option>
              <option v-for="pr in providerOptions" :key="pr.id" :value="pr.id">
                {{ pr.name }}
              </option>
            </select>
          </div>

          <div class="form-grid-3">
            <div class="form-group">
              <label class="form-label mono">{{ t('admin.price') }} <span class="req">*</span></label>
              <input v-model.number="form.price" type="number" step="0.01" min="0.01" required class="form-input mono" />
            </div>
            <div class="form-group">
              <label class="form-label mono">{{ t('admin.stock') }} <span class="req">*</span></label>
              <input v-model.number="form.stock" type="number" min="0" required class="form-input mono" />
            </div>
            <div class="form-group">
              <label class="form-label mono">{{ t('admin.material') }}</label>
              <input v-model="form.material" type="text" placeholder="German Stainless Steel" class="form-input" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label mono">{{ t('admin.specifications') }}</label>
            <textarea v-model="form.description" rows="3" class="form-textarea"></textarea>
          </div>

          <!-- Product Image Upload -->
          <div class="form-group">
            <label class="form-label mono">{{ t('admin.productImage') }}</label>
            <FileUpload
              v-model="form.imageName"
              :place="ATTACHMENT_PLACE.PROVIDERS"
              :media-type="MEDIA_TYPE.IMAGE"
              :label="t('admin.editImage')"
            />
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
  grid-template-columns: repeat(4, 1fr);
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
