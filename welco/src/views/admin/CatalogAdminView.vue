<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AdminLayout from '../../components/layout/AdminLayout.vue'
import DataState from '../../components/ui/DataState.vue'
import AppPagination from '../../components/ui/AppPagination.vue'
import BaseModal from '../../components/ui/BaseModal.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import FileUpload from '../../components/ui/FileUpload.vue'
import { ATTACHMENT_PLACE, MEDIA_TYPE } from '../../config/api.config'
import { services } from '../../di/container'
import { confirmService } from '../../infrastructure/feedback/confirm.service'
import { toastService } from '../../infrastructure/feedback/toast.service'
import { t, locale } from '../../i18n'
import { productMediaUrl, resolveFileUrl } from '../../utils/file-url'
import type {
  ProductDto,
  ProductMediaDto,
  CategoryDto,
  CurrencyDto,
  CreateProductPayload,
  UpdateProductPayload,
  CreateCategoryPayload,
  UpdateCategoryPayload,
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

const showProductModal = ref(false)
const editingProduct = ref<ProductDto | null>(null)
const formLoading = ref(false)
const formError = ref('')
const slugTouched = ref(false)

const emptyForm = () => ({
  nameEn: '',
  nameAr: '',
  sku: '',
  slug: '',
  description: '',
  price: 0,
  stock: 0,
  specifications: '',
  imageName: '',
  material: '',
  lengthCm: '' as number | '',
  currencyId: '' as string,
  categoryId: '' as string,
  isActive: true,
})

const productForm = ref(emptyForm())

const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

const onNameEnInput = () => {
  if (!slugTouched.value) productForm.value.slug = slugify(productForm.value.nameEn)
}

const openCreateProduct = () => {
  editingProduct.value = null
  productForm.value = emptyForm()
  formError.value = ''
  slugTouched.value = false
  showProductModal.value = true
}

const openEditProduct = (p: ProductDto) => {
  editingProduct.value = p
  productForm.value = {
    nameEn: p.nameEn ?? '',
    nameAr: p.nameAr ?? '',
    sku: p.sku ?? '',
    slug: p.slug ?? '',
    description: p.descriptionEn || p.description || '',
    price: p.price ?? 0,
    stock: p.stock ?? 0,
    specifications: p.specifications ?? '',
    imageName: p.imageName ?? '',
    material: p.material ?? '',
    lengthCm: p.lengthCm ?? ('' as number | ''),
    currencyId: p.currencyId ?? '',
    categoryId: p.categoryId ?? '',
    isActive: p.isActive ?? true,
  }
  formError.value = ''
  slugTouched.value = true
  showProductModal.value = true
}

const closeProductModal = () => {
  showProductModal.value = false
  formError.value = ''
}

const validateProductForm = (): string => {
  if (!productForm.value.nameEn.trim() || !productForm.value.nameAr.trim()) return t('admin.errBothNames')
  if (!productForm.value.sku.trim()) return t('admin.errSku')
  if (!productForm.value.slug.trim()) return t('admin.slug')
  if (!productForm.value.categoryId) return t('admin.errCategory')
  if (Number(productForm.value.price) < 0) return t('admin.price')
  if (!Number.isInteger(Number(productForm.value.stock)) || Number(productForm.value.stock) < 0) return t('admin.stock')
  return ''
}

const submitProduct = async () => {
  const validationError = validateProductForm()
  if (validationError) {
    formError.value = validationError
    return
  }
  formLoading.value = true
  formError.value = ''
  try {
    const f = productForm.value
    const lengthValue = f.lengthCm === '' ? undefined : Number(f.lengthCm)
    if (editingProduct.value) {
      const payload: UpdateProductPayload = {
        nameEn: f.nameEn.trim(),
        nameAr: f.nameAr.trim(),
        sku: f.sku.trim(),
        slug: f.slug.trim().toLowerCase(),
        description: f.description.trim() || undefined,
        price: Number(f.price),
        stock: Number(f.stock),
        specifications: f.specifications.trim() || undefined,
        imageName: f.imageName.trim() || null,
        material: f.material.trim() || undefined,
        lengthCm: lengthValue,
        currencyId: f.currencyId || null,
        categoryId: f.categoryId,
        isActive: f.isActive,
      }
      await services.marketplaceRepository.updateProduct(editingProduct.value.id, payload)
      toastService.success(t('admin.productUpdated'))
    } else {
      const payload: CreateProductPayload = {
        nameEn: f.nameEn.trim(),
        nameAr: f.nameAr.trim(),
        sku: f.sku.trim(),
        slug: f.slug.trim().toLowerCase(),
        description: f.description.trim() || undefined,
        price: Number(f.price),
        stock: Number(f.stock),
        specifications: f.specifications.trim() || undefined,
        imageName: f.imageName.trim() || null,
        material: f.material.trim() || undefined,
        lengthCm: lengthValue,
        currencyId: f.currencyId || null,
        categoryId: f.categoryId,
      }
      await services.marketplaceRepository.createProduct(payload)
      toastService.success(t('admin.productCreated'))
    }
    closeProductModal()
    await loadProducts()
  } catch (e) {
    formError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    formLoading.value = false
  }
}

const actionPendingId = ref<string | null>(null)

const confirmDeleteProduct = async (p: ProductDto) => {
  const ok = await confirmService.confirmDelete(
    `${t('admin.deleteProductConfirm')}\n${p.nameEn} (${p.sku})`,
    t('common.delete'),
  )
  if (!ok) return
  actionPendingId.value = p.id
  try {
    await services.marketplaceRepository.deleteProduct(p.id)
    toastService.success(t('admin.productDeleted'))
    await loadProducts()
  } catch (e) {
    toastService.error(e instanceof Error ? e.message : t('common.error'))
  } finally {
    actionPendingId.value = null
  }
}

const buildTogglePayload = (p: ProductDto, nextActive: boolean): UpdateProductPayload => ({
  nameEn: p.nameEn,
  nameAr: p.nameAr,
  sku: p.sku,
  slug: (p.slug ?? '').toLowerCase(),
  description: p.descriptionEn || p.description || undefined,
  price: p.price,
  stock: p.stock,
  specifications: p.specifications || undefined,
  imageName: p.imageName ?? null,
  material: p.material || undefined,
  lengthCm: p.lengthCm,
  currencyId: p.currencyId ?? null,
  categoryId: p.categoryId,
  isActive: nextActive,
})

const toggleProductActive = async (p: ProductDto) => {
  const nextActive = !p.isActive
  const ok = await confirmService.confirmAction(
    nextActive ? t('admin.activateProductConfirm') : t('admin.deactivateProductConfirm'),
    {
      title: nextActive ? t('admin.activate') : t('admin.deactivate'),
      variant: nextActive ? 'primary' : 'warning',
      icon: nextActive ? 'check_circle' : 'block',
      confirmText: nextActive ? t('admin.activate') : t('admin.deactivate'),
      cancelText: t('common.cancel'),
    },
  )
  if (!ok) return
  actionPendingId.value = p.id
  try {
    await services.marketplaceRepository.updateProduct(p.id, buildTogglePayload(p, nextActive))
    toastService.success(nextActive ? t('admin.productActivated') : t('admin.productDeactivated'))
    await loadProducts()
  } catch (e) {
    toastService.error(e instanceof Error ? e.message : t('common.error'))
  } finally {
    actionPendingId.value = null
  }
}

const showDetailsModal = ref(false)
const selectedProduct = ref<ProductDto | null>(null)
const selectedVideos = ref<ProductMediaDto[]>([])
const detailsLoading = ref(false)

const openProductDetails = async (p: ProductDto) => {
  selectedProduct.value = p
  selectedVideos.value = p.videos ?? []
  showDetailsModal.value = true
  detailsLoading.value = true
  try {
    const [fresh, videos] = await Promise.all([
      services.marketplaceRepository.getProductById(p.id).catch(() => null),
      services.marketplaceRepository.getProductVideos(p.id).catch(() => [] as ProductMediaDto[]),
    ])
    if (fresh) selectedProduct.value = fresh
    selectedVideos.value = videos ?? []
  } finally {
    detailsLoading.value = false
  }
}

const closeDetailsModal = () => {
  showDetailsModal.value = false
  selectedProduct.value = null
  selectedVideos.value = []
}

const detailsImageUrl = computed(() => {
  const p = selectedProduct.value
  if (!p) return ''
  return resolveFileUrl(p.imageName ?? null, '')
})

// ----------------------------------------------------
// 4. CATEGORY ACTIONS: add / details / edit / delete
// Backend: POST / PUT {id} (IsActive) / DELETE {id} / GET {id}
// Image upload reuses the attachment service (place=providers,
// fileType=image) — the stored name is served via /files/{name}.
// ----------------------------------------------------
const showCategoryModal = ref(false)
const editingCategory = ref<CategoryDto | null>(null)
const categoryFormLoading = ref(false)
const categoryFormError = ref('')

const emptyCategoryForm = () => ({
  nameEn: '',
  nameAr: '',
  description: '',
  imageName: '',
  parentCategoryId: '' as string,
  isActive: true,
})

const categoryForm = ref(emptyCategoryForm())

const parentOptions = computed(() => {
  const list = Array.isArray(categories.value) ? categories.value : []
  if (!editingCategory.value) return list
  return list.filter((c) => c.id !== editingCategory.value?.id)
})

const categoryParentName = (c: CategoryDto): string => {
  if (!c.parentCategoryId) return t('admin.noParentCategory')
  const parent = categories.value.find((x) => x.id === c.parentCategoryId)
  if (!parent) return c.parentCategoryId
  return localized(parent.nameEn, parent.nameAr)
}

const openCreateCategory = () => {
  editingCategory.value = null
  categoryForm.value = emptyCategoryForm()
  categoryFormError.value = ''
  showCategoryModal.value = true
}

const openEditCategory = (c: CategoryDto) => {
  editingCategory.value = c
  categoryForm.value = {
    nameEn: c.nameEn ?? '',
    nameAr: c.nameAr ?? '',
    description: c.descriptionEn ?? '',
    imageName: c.imageName ?? '',
    parentCategoryId: c.parentCategoryId ?? '',
    isActive: c.isActive ?? true,
  }
  categoryFormError.value = ''
  showCategoryModal.value = true
}

const closeCategoryModal = () => {
  showCategoryModal.value = false
  categoryFormError.value = ''
}

const submitCategory = async () => {
  const f = categoryForm.value
  if (!f.nameEn.trim() || !f.nameAr.trim()) {
    categoryFormError.value = t('admin.errBothNames')
    return
  }
  if (editingCategory.value && f.parentCategoryId === editingCategory.value.id) {
    categoryFormError.value = t('admin.parentCategory')
    return
  }
  categoryFormLoading.value = true
  categoryFormError.value = ''
  try {
    if (editingCategory.value) {
      const payload: UpdateCategoryPayload = {
        nameEn: f.nameEn.trim(),
        nameAr: f.nameAr.trim(),
        description: f.description.trim() || undefined,
        imageName: f.imageName.trim() || null,
        parentCategoryId: f.parentCategoryId || null,
        isActive: f.isActive,
      }
      await services.marketplaceRepository.updateCategory(editingCategory.value.id, payload)
      toastService.success(t('admin.categoryUpdated'))
    } else {
      const payload: CreateCategoryPayload = {
        nameEn: f.nameEn.trim(),
        nameAr: f.nameAr.trim(),
        description: f.description.trim() || undefined,
        imageName: f.imageName.trim() || null,
        parentCategoryId: f.parentCategoryId || null,
      }
      await services.marketplaceRepository.createCategory(payload)
      toastService.success(t('admin.categoryCreated'))
    }
    closeCategoryModal()
    await loadCategories()
  } catch (e) {
    categoryFormError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    categoryFormLoading.value = false
  }
}

const categoryActionPendingId = ref<string | null>(null)

const confirmDeleteCategory = async (c: CategoryDto) => {
  const ok = await confirmService.confirmDelete(
    `${t('admin.deleteCategoryConfirm')}\n${localized(c.nameEn, c.nameAr)}`,
    t('common.delete'),
  )
  if (!ok) return
  categoryActionPendingId.value = c.id
  try {
    await services.marketplaceRepository.deleteCategory(c.id)
    toastService.success(t('admin.categoryDeleted'))
    await loadCategories()
  } catch (e) {
    toastService.error(e instanceof Error ? e.message : t('common.error'))
  } finally {
    categoryActionPendingId.value = null
  }
}

const showCategoryDetailsModal = ref(false)
const selectedCategory = ref<CategoryDto | null>(null)

const openCategoryDetails = (c: CategoryDto) => {
  selectedCategory.value = c
  showCategoryDetailsModal.value = true
}

const closeCategoryDetails = () => {
  showCategoryDetailsModal.value = false
  selectedCategory.value = null
}

const categoryDetailsImageUrl = computed(() => {
  const c = selectedCategory.value
  if (!c) return ''
  return resolveFileUrl(c.imageName ?? null, '')
})

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
        <div v-if="activeTab === 'products'" class="catalog-admin__actions">
          <BaseButton variant="primary" @click="openCreateProduct">
            <span class="material-symbols-outlined text-[18px]">add</span>
            <span>{{ t('admin.newProduct') }}</span>
          </BaseButton>
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
                  <th>{{ t('admin.status') }}</th>
                  <th class="text-right">{{ t('common.actions') }}</th>
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
                  <td>
                    <span
                      class="status-dot-badge mono"
                      :class="p.isActive ? 'status-dot-badge--active' : 'status-dot-badge--inactive'"
                    >
                      <span class="dot"></span>
                      <span>{{ p.isActive ? t('admin.active') : t('admin.inactive') }}</span>
                    </span>
                  </td>
                  <td>
                    <div class="row-actions">
                      <button
                        type="button"
                        class="action-btn"
                        :title="t('admin.viewDetails')"
                        :aria-label="t('admin.viewDetails')"
                        @click="openProductDetails(p)"
                      >
                        <span class="material-symbols-outlined text-[18px]">visibility</span>
                      </button>
                      <button
                        type="button"
                        class="action-btn action-btn--edit"
                        :title="t('common.edit')"
                        :aria-label="t('common.edit')"
                        @click="openEditProduct(p)"
                      >
                        <span class="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      <button
                        type="button"
                        class="action-btn"
                        :class="p.isActive ? 'action-btn--deactivate' : 'action-btn--activate'"
                        :title="p.isActive ? t('admin.deactivate') : t('admin.activate')"
                        :aria-label="p.isActive ? t('admin.deactivate') : t('admin.activate')"
                        :disabled="actionPendingId === p.id"
                        @click="toggleProductActive(p)"
                      >
                        <span class="material-symbols-outlined text-[18px]">{{
                          p.isActive ? 'block' : 'check_circle'
                        }}</span>
                      </button>
                      <button
                        type="button"
                        class="action-btn action-btn--delete"
                        :title="t('common.delete')"
                        :aria-label="t('common.delete')"
                        :disabled="actionPendingId === p.id"
                        @click="confirmDeleteProduct(p)"
                      >
                        <span class="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

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
          <BaseButton variant="primary" @click="openCreateCategory">
            <span class="material-symbols-outlined text-[18px]">add</span>
            <span>{{ t('admin.newCategory') }}</span>
          </BaseButton>
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
                  <th>{{ t('admin.status') }}</th>
                  <th class="text-right">{{ t('common.actions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in paginatedCategories" :key="c.id">
                  <td>
                    <div class="category-cell">
                      <div class="category-icon-box">
                        <img
                          v-if="c.imageName"
                          :src="resolveFileUrl(c.imageName, '')"
                          :alt="c.nameEn"
                          class="category-thumb__img"
                          loading="lazy"
                        />
                        <span v-else class="material-symbols-outlined text-[20px]">folder</span>
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
                  <td>
                    <span
                      class="status-dot-badge mono"
                      :class="(c.isActive ?? true) ? 'status-dot-badge--active' : 'status-dot-badge--inactive'"
                    >
                      <span class="dot"></span>
                      <span>{{ (c.isActive ?? true) ? t('admin.active') : t('admin.inactive') }}</span>
                    </span>
                  </td>
                  <td>
                    <div class="row-actions">
                      <button
                        type="button"
                        class="action-btn"
                        :title="t('admin.viewDetails')"
                        :aria-label="t('admin.viewDetails')"
                        @click="openCategoryDetails(c)"
                      >
                        <span class="material-symbols-outlined text-[18px]">visibility</span>
                      </button>
                      <button
                        type="button"
                        class="action-btn action-btn--edit"
                        :title="t('common.edit')"
                        :aria-label="t('common.edit')"
                        @click="openEditCategory(c)"
                      >
                        <span class="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      <button
                        type="button"
                        class="action-btn action-btn--delete"
                        :title="t('common.delete')"
                        :aria-label="t('common.delete')"
                        :disabled="categoryActionPendingId === c.id"
                        @click="confirmDeleteCategory(c)"
                      >
                        <span class="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

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

      <BaseModal
        v-model="showProductModal"
        :title="editingProduct ? t('admin.editProduct') : t('admin.newProduct')"
        max-width="720px"
        @close="closeProductModal"
      >
        <form class="admin-modal-form" @submit.prevent="submitProduct">
          <div class="form-row two-cols">
            <div class="form-field">
              <label class="field-label" for="product-name-en">{{ t('admin.productNameEn') }} *</label>
              <input
                id="product-name-en"
                v-model="productForm.nameEn"
                type="text"
                class="field-input"
                required
                @input="onNameEnInput"
              />
            </div>
            <div class="form-field">
              <label class="field-label" for="product-name-ar">{{ t('admin.productNameAr') }} *</label>
              <input
                id="product-name-ar"
                v-model="productForm.nameAr"
                type="text"
                class="field-input"
                required
              />
            </div>
          </div>

          <div class="form-row two-cols">
            <div class="form-field">
              <label class="field-label" for="product-sku">{{ t('admin.sku') }} *</label>
              <input id="product-sku" v-model="productForm.sku" type="text" class="field-input mono" required />
            </div>
            <div class="form-field">
              <label class="field-label" for="product-slug">{{ t('admin.slug') }} *</label>
              <input
                id="product-slug"
                v-model="productForm.slug"
                type="text"
                class="field-input mono"
                required
                @input="slugTouched = true"
              />
            </div>
          </div>

          <div class="form-field full-width">
            <label class="field-label" for="product-description">{{ t('admin.description') }}</label>
            <textarea
              id="product-description"
              v-model="productForm.description"
              class="field-textarea"
              rows="3"
            ></textarea>
          </div>

          <div class="form-row three-cols">
            <div class="form-field">
              <label class="field-label" for="product-price">{{ t('admin.price') }} *</label>
              <input
                id="product-price"
                v-model.number="productForm.price"
                type="number"
                min="0"
                step="0.01"
                class="field-input mono"
                required
              />
            </div>
            <div class="form-field">
              <label class="field-label" for="product-stock">{{ t('admin.stock') }} *</label>
              <input
                id="product-stock"
                v-model.number="productForm.stock"
                type="number"
                min="0"
                step="1"
                class="field-input mono"
                required
              />
            </div>
            <div class="form-field">
              <label class="field-label" for="product-length">{{ t('admin.lengthCm') }}</label>
              <input
                id="product-length"
                v-model.number="productForm.lengthCm"
                type="number"
                min="0"
                step="0.1"
                class="field-input mono"
              />
            </div>
          </div>

          <div class="form-row two-cols">
            <div class="form-field">
              <label class="field-label" for="product-category">{{ t('admin.category') }} *</label>
              <select id="product-category" v-model="productForm.categoryId" class="field-select" required>
                <option value="" disabled>{{ t('admin.category') }}</option>
                <option v-for="c in categories" :key="c.id" :value="c.id">
                  {{ localized(c.nameEn, c.nameAr) }}
                </option>
              </select>
            </div>
            <div class="form-field">
              <label class="field-label" for="product-currency">{{ t('admin.currency') }}</label>
              <select id="product-currency" v-model="productForm.currencyId" class="field-select">
                <option value="">{{ t('common.all') }}</option>
                <option v-for="c in uniqueCurrencies" :key="c.id" :value="c.id">
                  {{ c.code }} ({{ c.symbol }})
                </option>
              </select>
            </div>
          </div>

          <div class="form-row two-cols">
            <div class="form-field">
              <label class="field-label" for="product-material">{{ t('admin.material') }}</label>
              <input id="product-material" v-model="productForm.material" type="text" class="field-input" />
            </div>
            <div class="form-field">
              <FileUpload
                :model-value="productForm.imageName || null"
                :place="ATTACHMENT_PLACE.PROVIDERS"
                :file-type="MEDIA_TYPE.IMAGE"
                accept="image/*"
                :label="t('admin.productImage')"
                :hint="t('attachment.dropHint')"
                @update:modelValue="productForm.imageName = $event ?? ''"
              />
            </div>
          </div>

          <div class="form-field full-width">
            <label class="field-label" for="product-specs">{{ t('admin.specifications') }}</label>
            <textarea
              id="product-specs"
              v-model="productForm.specifications"
              class="field-textarea mono"
              rows="2"
            ></textarea>
          </div>

          <div v-if="editingProduct" class="form-field full-width">
            <label class="toggle-label">
              <input v-model="productForm.isActive" type="checkbox" />
              <span>{{ t('admin.productActive') }}</span>
            </label>
          </div>

          <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>

          <div class="modal-foot">
            <BaseButton variant="secondary" type="button" @click="closeProductModal">
              {{ t('common.cancel') }}
            </BaseButton>
            <BaseButton variant="primary" type="submit" :loading="formLoading">
              {{ t('common.save') }}
            </BaseButton>
          </div>
        </form>
      </BaseModal>

      <!-- Product Details Modal -->
      <BaseModal
        v-model="showDetailsModal"
        :title="t('admin.productDetails')"
        max-width="640px"
        @close="closeDetailsModal"
      >
        <div v-if="detailsLoading && !selectedProduct" class="details-loading">
          {{ t('common.loading') }}
        </div>
        <div v-else-if="selectedProduct" class="product-details">
          <div class="details-hero">
            <div class="details-thumb">
              <img
                v-if="detailsImageUrl"
                :src="detailsImageUrl"
                :alt="selectedProduct.nameEn"
                class="details-thumb__img"
              />
              <span v-else class="mono text-[10px]">{{ selectedProduct.sku }}</span>
            </div>
            <div class="details-hero__info">
              <strong class="details-name">{{ localized(selectedProduct.nameEn, selectedProduct.nameAr) }}</strong>
              <div class="details-sub mono">{{ selectedProduct.nameEn }} · {{ selectedProduct.nameAr }}</div>
              <div class="details-badges">
                <span class="mono sku-tag">{{ selectedProduct.sku }}</span>
                <span
                  class="status-dot-badge mono"
                  :class="
                    selectedProduct.isActive ? 'status-dot-badge--active' : 'status-dot-badge--inactive'
                  "
                >
                  <span class="dot"></span>
                  <span>{{ selectedProduct.isActive ? t('admin.active') : t('admin.inactive') }}</span>
                </span>
              </div>
            </div>
          </div>

          <div class="details-grid">
            <div class="detail-item">
              <span class="detail-k mono">{{ t('admin.price') }}</span>
              <strong class="detail-v mono"
                >{{ selectedProduct.price.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US') }}
                {{
                  selectedProduct.currencySymbol ||
                  selectedProduct.currencyCode ||
                  selectedProduct.currency
                }}</strong
              >
            </div>
            <div class="detail-item">
              <span class="detail-k mono">{{ t('admin.stock') }}</span>
              <strong class="detail-v mono">{{ selectedProduct.stock }}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-k mono">{{ t('admin.category') }}</span>
              <strong class="detail-v">{{
                localized(selectedProduct.categoryNameEn, selectedProduct.categoryNameAr)
              }}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-k mono">{{ t('admin.slug') }}</span>
              <strong class="detail-v mono">{{ selectedProduct.slug }}</strong>
            </div>
            <div v-if="selectedProduct.material" class="detail-item">
              <span class="detail-k mono">{{ t('admin.material') }}</span>
              <strong class="detail-v">{{ selectedProduct.material }}</strong>
            </div>
            <div v-if="selectedProduct.lengthCm != null" class="detail-item">
              <span class="detail-k mono">{{ t('admin.lengthCm') }}</span>
              <strong class="detail-v mono">{{ selectedProduct.lengthCm }}</strong>
            </div>
          </div>

          <div v-if="selectedProduct.descriptionEn || selectedProduct.description" class="details-desc">
            <span class="detail-k mono">{{ t('admin.description') }}</span>
            <p>{{ selectedProduct.descriptionEn || selectedProduct.description }}</p>
          </div>

          <div v-if="selectedProduct.specifications" class="details-desc">
            <span class="detail-k mono">{{ t('admin.specifications') }}</span>
            <p class="mono">{{ selectedProduct.specifications }}</p>
          </div>

          <div class="details-meta mono">
            <span>ID: {{ selectedProduct.id }}</span>
            <span v-if="selectedVideos.length">· {{ selectedVideos.length }} video(s)</span>
          </div>

          <div class="modal-foot">
            <BaseButton
              v-if="selectedProduct"
              :variant="selectedProduct.isActive ? 'secondary' : 'primary'"
              :loading="actionPendingId === selectedProduct.id"
              @click="selectedProduct && toggleProductActive(selectedProduct)"
            >
              {{ selectedProduct.isActive ? t('admin.deactivate') : t('admin.activate') }}
            </BaseButton>
            <BaseButton variant="secondary" @click="closeDetailsModal">
              {{ t('common.close') }}
            </BaseButton>
          </div>
        </div>
      </BaseModal>

      <!-- Add / Edit Category Modal -->
      <BaseModal
        v-model="showCategoryModal"
        :title="editingCategory ? t('admin.editCategory') : t('admin.newCategory')"
        max-width="640px"
        @close="closeCategoryModal"
      >
        <form class="admin-modal-form" @submit.prevent="submitCategory">
          <div class="form-row two-cols">
            <div class="form-field">
              <label class="field-label" for="category-name-en">{{ t('admin.categoryNameEn') }} *</label>
              <input
                id="category-name-en"
                v-model="categoryForm.nameEn"
                type="text"
                class="field-input"
                required
              />
            </div>
            <div class="form-field">
              <label class="field-label" for="category-name-ar">{{ t('admin.categoryNameAr') }} *</label>
              <input
                id="category-name-ar"
                v-model="categoryForm.nameAr"
                type="text"
                class="field-input"
                required
              />
            </div>
          </div>

          <div class="form-field full-width">
            <label class="field-label" for="category-description">{{ t('admin.description') }}</label>
            <textarea
              id="category-description"
              v-model="categoryForm.description"
              class="field-textarea"
              rows="3"
            ></textarea>
          </div>

          <div class="form-field full-width">
            <FileUpload
              :model-value="categoryForm.imageName || null"
              :place="ATTACHMENT_PLACE.PROVIDERS"
              :file-type="MEDIA_TYPE.IMAGE"
              accept="image/*"
              :label="t('admin.categoryImage')"
              :hint="t('attachment.dropHint')"
              @update:modelValue="categoryForm.imageName = $event ?? ''"
            />
          </div>

          <div class="form-field full-width">
            <label class="field-label" for="category-parent">{{ t('admin.parentCategory') }}</label>
            <select id="category-parent" v-model="categoryForm.parentCategoryId" class="field-select">
              <option value="">{{ t('admin.noParentCategory') }}</option>
              <option v-for="c in parentOptions" :key="c.id" :value="c.id">
                {{ localized(c.nameEn, c.nameAr) }}
              </option>
            </select>
          </div>

          <div v-if="editingCategory" class="form-field full-width">
            <label class="toggle-label">
              <input v-model="categoryForm.isActive" type="checkbox" />
              <span>{{ t('admin.categoryActive') }}</span>
            </label>
          </div>

          <p v-if="categoryFormError" class="form-error" role="alert">{{ categoryFormError }}</p>

          <div class="modal-foot">
            <BaseButton variant="secondary" type="button" @click="closeCategoryModal">
              {{ t('common.cancel') }}
            </BaseButton>
            <BaseButton variant="primary" type="submit" :loading="categoryFormLoading">
              {{ t('common.save') }}
            </BaseButton>
          </div>
        </form>
      </BaseModal>

      <!-- Category Details Modal -->
      <BaseModal
        v-model="showCategoryDetailsModal"
        :title="t('admin.categoryDetails')"
        max-width="560px"
        @close="closeCategoryDetails"
      >
        <div v-if="selectedCategory" class="product-details">
          <div class="details-hero">
            <div class="details-thumb">
              <img
                v-if="categoryDetailsImageUrl"
                :src="categoryDetailsImageUrl"
                :alt="selectedCategory.nameEn"
                class="details-thumb__img"
              />
              <span v-else class="material-symbols-outlined text-[28px]">folder</span>
            </div>
            <div class="details-hero__info">
              <strong class="details-name">{{ localized(selectedCategory.nameEn, selectedCategory.nameAr) }}</strong>
              <div class="details-sub mono">{{ selectedCategory.nameEn }} · {{ selectedCategory.nameAr }}</div>
              <div class="details-badges">
                <span class="mono count-badge">{{ selectedCategory.productCount ?? 0 }} {{ t('admin.productsTitle') }}</span>
                <span
                  class="status-dot-badge mono"
                  :class="(selectedCategory.isActive ?? true) ? 'status-dot-badge--active' : 'status-dot-badge--inactive'"
                >
                  <span class="dot"></span>
                  <span>{{ (selectedCategory.isActive ?? true) ? t('admin.active') : t('admin.inactive') }}</span>
                </span>
              </div>
            </div>
          </div>

          <div v-if="selectedCategory.descriptionEn" class="details-desc">
            <span class="detail-k mono">{{ t('admin.description') }}</span>
            <p>{{ selectedCategory.descriptionEn }}</p>
          </div>

          <div class="details-grid">
            <div class="detail-item">
              <span class="detail-k mono">{{ t('admin.parentCategory') }}</span>
              <strong class="detail-v">{{ categoryParentName(selectedCategory) }}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-k mono">{{ t('admin.productsTitle') }}</span>
              <strong class="detail-v mono">{{ selectedCategory.productCount ?? 0 }}</strong>
            </div>
          </div>

          <div class="details-meta mono">
            <span>ID: {{ selectedCategory.id }}</span>
          </div>

          <div class="modal-foot">
            <BaseButton variant="secondary" @click="openEditCategory(selectedCategory!)">
              {{ t('common.edit') }}
            </BaseButton>
            <BaseButton variant="secondary" @click="closeCategoryDetails">
              {{ t('common.close') }}
            </BaseButton>
          </div>
        </div>
      </BaseModal>
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

.catalog-admin__header {
  flex-wrap: wrap;
  gap: 1rem;
}

.catalog-admin__actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
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
  align-items: center;
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
  overflow: hidden;
}

.category-thumb__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
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

.action-btn--activate:hover {
  color: #059669;
  border-color: #059669;
}

.action-btn--deactivate:hover {
  color: #d97706;
  border-color: #d97706;
}

.action-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.text-right {
  text-align: end;
}

.status-dot-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 11px;
  font-weight: 700;
  padding: 0.2rem 0.55rem;
  border-radius: 9999px;
  white-space: nowrap;
}

.status-dot-badge .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-dot-badge--active {
  background: #ecfdf5;
  color: #059669;
}
.status-dot-badge--active .dot {
  background: #10b981;
}

.status-dot-badge--inactive {
  background: #f1f5f9;
  color: #64748b;
}
.status-dot-badge--inactive .dot {
  background: #94a3b8;
}

.form-error {
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #dc2626;
  font-size: 0.82rem;
  padding: 0.6rem 0.85rem;
  border-radius: var(--wl-radius-sm);
  margin: 0;
}

/* Product details modal */
.product-details {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.details-loading {
  padding: 2rem;
  text-align: center;
  color: var(--wl-muted);
}

.details-hero {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

.details-thumb {
  width: 72px;
  height: 72px;
  border-radius: var(--wl-radius-sm);
  border: 1px solid var(--wl-line);
  display: grid;
  place-items: center;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--wl-paper);
}

.details-thumb__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.details-hero__info {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
}

.details-name {
  font-size: 1.05rem;
  color: var(--wl-ink-strong);
}

.details-sub {
  font-size: 0.72rem;
  color: var(--wl-muted);
}

.details-badges {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
}

.details-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  background: var(--wl-paper);
  padding: 0.65rem 0.85rem;
  border-radius: var(--wl-radius-sm);
  border: 1px solid var(--wl-line);
}

.detail-k {
  font-size: 10px;
  color: var(--wl-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.detail-v {
  font-size: 0.85rem;
  color: var(--wl-ink-strong);
}

.details-desc {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.details-desc p {
  margin: 0;
  font-size: 0.88rem;
  color: var(--wl-ink-strong);
  line-height: 1.6;
  white-space: pre-wrap;
}

.details-meta {
  font-size: 11px;
  color: var(--wl-muted);
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
