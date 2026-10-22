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
import { services, companyService, authService, attachmentService } from '../../di/container'
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
import { formatDate } from '../../utils/format'
import { resolveFileUrl, parseVideoSource } from '../../utils/file-url'

export interface ProductVideoEntry {
  id?: string
  url: string
  title?: string
  sortOrder: number
}

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
const activeDetailsImageIdx = ref(0)
const loadingDetailsFull = ref(false)

const currentDetailsImage = computed(() => {
  if (!selectedProduct.value) return ''
  const imgs = selectedProduct.value.images
  if (Array.isArray(imgs) && imgs.length > 0) {
    return imgs[activeDetailsImageIdx.value] || imgs[0] || selectedProduct.value.imageName || ''
  }
  return selectedProduct.value.imageName || ''
})

const allDetailsVideos = computed(() => {
  if (!selectedProduct.value) return []
  const list: { url: string; title?: string }[] = []
  if (Array.isArray(selectedProduct.value.videos) && selectedProduct.value.videos.length > 0) {
    for (const v of selectedProduct.value.videos) {
      if (v.url && !list.some((x) => x.url === v.url)) {
        list.push({ url: v.url, title: v.title })
      }
    }
  }
  if (selectedProduct.value.videoUrl && !list.some((x) => x.url === selectedProduct.value?.videoUrl)) {
    list.unshift({ url: selectedProduct.value.videoUrl, title: 'Main Demonstration Video' })
  }
  return list
})

const openDetails = async (p: ProductDto) => {
  activeDetailsImageIdx.value = 0
  selectedProduct.value = { ...p }
  showDetailsModal.value = true
  loadingDetailsFull.value = true

  try {
    const [full, vids] = await Promise.all([
      services.marketplaceRepository.getProductById(p.id).catch(() => null),
      services.marketplaceRepository.getProductVideos(p.id).catch(() => [] as ProductMediaDto[]),
    ])
    if (selectedProduct.value && selectedProduct.value.id === p.id) {
      if (full) {
        selectedProduct.value = {
          ...selectedProduct.value,
          ...full,
          images: (Array.isArray(full.images) && full.images.length > 0) ? full.images : selectedProduct.value.images,
          videos: (Array.isArray(full.videos) && full.videos.length > 0) ? full.videos : selectedProduct.value.videos,
          videoUrl: full.videoUrl || selectedProduct.value.videoUrl,
        }
      }
      if (Array.isArray(vids) && vids.length > 0) {
        selectedProduct.value.videos = vids
      }
    }
  } finally {
    loadingDetailsFull.value = false
  }
}

const closeDetails = () => {
  showDetailsModal.value = false
  selectedProduct.value = null
  activeDetailsImageIdx.value = 0
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
  specificationText: '',
  wireCapacity: '',
  wireCuttingCapacity: '',
  price: '' as unknown as number,
  stock: 0,
  imageName: '',
  images: [] as string[],
  videos: [] as ProductVideoEntry[],
  material: '',
  currencyId: currencies.value[0]?.id || ('' as string),
  categoryId: categories.value[0]?.id || ('' as string),
  isActive: true,
})
const form = ref(emptyForm())

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
  form.value.sku = `${prefix}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`
  if (!form.value.slug && (!editing.value || !editing.value.slug)) {
    updateAutoSlug()
  }
}

/* ── Modern Media Suite (Multi-Image & Video) ── */
const uploadingMedia = ref(false)
const activeUploadName = ref('')
const newVideoLink = ref('')
const showVideoUrlInput = ref(false)
const previewImageModal = ref<string | null>(null)

const imageInputRef = ref<HTMLInputElement | null>(null)
const triggerImagePicker = () => {
  imageInputRef.value?.click()
}

const onImagePicked = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const files = input.files ? Array.from(input.files) : []
  if (!files.length) return
  input.value = ''
  uploadingMedia.value = true
  formError.value = ''
  try {
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        toastService.error(`${file.name}: ${t('attachment.unsupportedType')}`)
        continue
      }
      if (file.size > 20 * 1024 * 1024) {
        toastService.error(`${file.name}: ${t('attachment.fileTooLarge')}`)
        continue
      }
      activeUploadName.value = file.name
      const res = await attachmentService.upload({
        file,
        place: ATTACHMENT_PLACE.PROVIDERS,
        fileType: MEDIA_TYPE.IMAGE,
      })
      if (res.ok && res.data) {
        form.value.images.push(res.data)
        if (!form.value.imageName) {
          form.value.imageName = res.data
        }
      }
    }
    toastService.success(locale.value === 'ar' ? 'تم رفع الصور بنجاح' : 'Photos uploaded successfully')
  } catch (err) {
    toastService.error(err instanceof Error ? err.message : t('common.error'))
  } finally {
    uploadingMedia.value = false
    activeUploadName.value = ''
  }
}

const setAsCoverImage = (index: number) => {
  const [img] = form.value.images.splice(index, 1)
  if (img) {
    form.value.images.unshift(img)
    form.value.imageName = img
    toastService.success(locale.value === 'ar' ? 'تم تعيين صورة الغلاف' : 'Cover photo updated')
  }
}

const removeGalleryImage = (index: number) => {
  form.value.images.splice(index, 1)
  form.value.imageName = form.value.images[0] || ''
}

const videoFileInputRef = ref<HTMLInputElement | null>(null)
const triggerVideoPicker = () => {
  videoFileInputRef.value?.click()
}

const onVideoPicked = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  input.value = ''
  if (file.size > 100 * 1024 * 1024) {
    toastService.error(`${file.name}: Video must be under 100MB`)
    return
  }
  uploadingMedia.value = true
  activeUploadName.value = file.name
  try {
    const res = await attachmentService.upload({
      file,
      place: ATTACHMENT_PLACE.PROVIDERS,
      fileType: MEDIA_TYPE.VIDEO,
    })
    if (res.ok && res.data) {
      form.value.videos.push({
        id: undefined,
        url: res.data,
        title: file.name.replace(/\.[^.]+$/, ''),
        sortOrder: form.value.videos.length,
      })
      toastService.success(t('admin.videoUploaded'))
    }
  } catch (err) {
    toastService.error(err instanceof Error ? err.message : t('common.error'))
  } finally {
    uploadingMedia.value = false
    activeUploadName.value = ''
  }
}

const addVideoLink = () => {
  const link = newVideoLink.value.trim()
  if (!link) return
  form.value.videos.push({
    id: undefined,
    url: link,
    title: link.includes('youtube') ? 'YouTube Video' : link.includes('vimeo') ? 'Vimeo Video' : 'Product Video',
    sortOrder: form.value.videos.length,
  })
  newVideoLink.value = ''
  showVideoUrlInput.value = false
}

const removeVideo = (index: number) => {
  form.value.videos.splice(index, 1)
  form.value.videos.forEach((v, i) => {
    v.sortOrder = i
  })
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

const loadingEditMedia = ref(false)

const openEdit = async (p: ProductDto) => {
  editing.value = p
  loadingEditMedia.value = true

  let imgs: string[] = []
  if (Array.isArray(p.images) && p.images.length > 0) {
    imgs = [...p.images]
  } else if (p.imageName && p.imageName.trim()) {
    imgs = [p.imageName.trim()]
  }

  let vids: ProductVideoEntry[] = []
  if (Array.isArray(p.videos) && p.videos.length > 0) {
    vids = p.videos.map((v, i) => ({
      id: v.id,
      url: v.url,
      title: v.title || `Video ${i + 1}`,
      sortOrder: v.sortOrder ?? i,
    }))
  } else if (p.videoUrl) {
    vids = [{ url: p.videoUrl, title: 'Product Video', sortOrder: 0 }]
  }

  let specText = ''
  let wireCap = p.wireCapacity || ''
  let wireCutCap = p.wireCuttingCapacity || ''
  if (p.specifications) {
    const raw = p.specifications.trim()
    if (raw.startsWith('{') && raw.endsWith('}')) {
      try {
        const parsed = JSON.parse(raw)
        if (parsed.wireCapacity) wireCap = String(parsed.wireCapacity).trim()
        if (parsed.wireCuttingCapacity) wireCutCap = String(parsed.wireCuttingCapacity).trim()
        if (Array.isArray(parsed.bullets)) {
          specText = parsed.bullets.join('\n')
        } else if (typeof parsed.specification === 'string') {
          specText = parsed.specification
        }
      } catch {
        specText = raw
      }
    } else {
      specText = raw
    }
  }

  form.value = {
    nameEn: p.nameEn ?? '',
    nameAr: p.nameAr ?? '',
    sku: p.sku ?? '',
    slug: p.slug || slugify(p.nameEn || '') || (p.sku ? slugify(p.sku) : ''),
    description: p.descriptionEn || p.description || '',
    specificationText: specText,
    wireCapacity: wireCap,
    wireCuttingCapacity: wireCutCap,
    price: (p.price !== undefined && p.price !== null) ? p.price : ('' as unknown as number),
    stock: (p.stock !== undefined && p.stock !== null) ? p.stock : ('' as unknown as number),
    imageName: imgs[0] || p.imageName || '',
    images: imgs,
    videos: vids,
    material: p.material ?? '',
    currencyId: p.currencyId ?? '',
    categoryId: p.categoryId ?? '',
    isActive: p.isActive ?? true,
  }
  formError.value = ''
  slugTouched.value = true
  showModal.value = true

  try {
    const [full, serverVids] = await Promise.all([
      services.marketplaceRepository.getProductById(p.id).catch(() => null),
      services.marketplaceRepository.getProductVideos(p.id).catch(() => [] as ProductMediaDto[]),
    ])
    if (editing.value?.id === p.id) {
      if (full) {
        if (Array.isArray(full.images) && full.images.length > 0) {
          form.value.images = [...full.images]
          form.value.imageName = full.images[0] || form.value.imageName
        }
        if (full.videoUrl && !form.value.videos.some((x) => x.url === full.videoUrl)) {
          form.value.videos.unshift({ url: full.videoUrl, title: 'Main Demonstration Video', sortOrder: 0 })
        }
        if (full.isActive !== undefined) {
          form.value.isActive = full.isActive
        }
        if (full.specifications) {
          try {
            const parsed = JSON.parse(full.specifications)
            if (parsed.wireCapacity && !form.value.wireCapacity) form.value.wireCapacity = String(parsed.wireCapacity).trim()
            if (parsed.wireCuttingCapacity && !form.value.wireCuttingCapacity) form.value.wireCuttingCapacity = String(parsed.wireCuttingCapacity).trim()
            if (Array.isArray(parsed.bullets) && !form.value.specificationText) {
              form.value.specificationText = parsed.bullets.join('\n')
            }
          } catch {}
        }
      }
      if (Array.isArray(serverVids) && serverVids.length > 0) {
        form.value.videos = serverVids.map((v, i) => ({
          id: v.id,
          url: v.url,
          title: v.title || `Video ${i + 1}`,
          sortOrder: v.sortOrder ?? i,
        }))
      }
    }
  } finally {
    loadingEditMedia.value = false
  }
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

  const validImages = form.value.images.map((x) => x.trim()).filter(Boolean)
  if (validImages.length < 3) {
    formError.value = `${t('admin.errMinThreeImages')} (${validImages.length}/3)`
    toastService.error(formError.value)
    return
  }

  let numPrice: number | undefined = undefined
  if (f.price !== undefined && (f.price as unknown) !== '' && f.price !== null) {
    const parsed = Number(f.price)
    if (isNaN(parsed) || parsed < 0) {
      formError.value = t('admin.errPricePositive')
      return
    }
    numPrice = parsed
  }

  let numStock: number | undefined = undefined
  if (f.stock !== undefined && (f.stock as unknown) !== '' && f.stock !== null) {
    const parsed = Number(f.stock)
    if (isNaN(parsed) || parsed < 0) {
      formError.value = t('admin.errStockPositive')
      return
    }
    numStock = parsed
  }

  formLoading.value = true
  formError.value = ''
  try {
    const bulletLines = (f.specificationText || '')
      .split(/[\r\n]+/)
      .map((l) => l.replace(/^[-*•\d.]+\s*/, '').trim())
      .filter(Boolean)

    const specsObject: Record<string, unknown> = {}
    if (bulletLines.length > 0) {
      specsObject.bullets = bulletLines
      specsObject.specification = bulletLines.join('\n')
    }
    if (f.wireCapacity && f.wireCapacity.trim()) {
      specsObject.wireCapacity = f.wireCapacity.trim()
    }
    if (f.wireCuttingCapacity && f.wireCuttingCapacity.trim()) {
      specsObject.wireCuttingCapacity = f.wireCuttingCapacity.trim()
    }

    const finalSpecsString = Object.keys(specsObject).length > 0
      ? JSON.stringify(specsObject)
      : undefined

    let savedProduct: ProductDto
    if (editing.value) {
      const payload: UpdateProductPayload = {
        nameEn: f.nameEn.trim(),
        nameAr: f.nameAr.trim() || undefined,
        sku: f.sku.trim(),
        slug: f.slug.trim().toLowerCase(),
        description: f.description.trim() || undefined,
        specifications: finalSpecsString,
        price: numPrice,
        stock: numStock,
        imageName: validImages[0] || null,
        images: validImages,
        videoUrl: f.videos[0]?.url || undefined,
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
        nameAr: f.nameAr.trim() || undefined,
        sku: f.sku.trim(),
        slug: f.slug.trim().toLowerCase(),
        description: f.description.trim() || undefined,
        specifications: finalSpecsString,
        price: numPrice,
        stock: numStock,
        imageName: validImages[0] || null,
        images: validImages,
        videoUrl: f.videos[0]?.url || undefined,
        material: f.material.trim() || undefined,
        currencyId: f.currencyId || null,
        categoryId: f.categoryId,
        isActive: f.isActive ?? true,
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

    <!-- KPI Summary Cards — first three double as stock filters -->
    <section class="kpi-grid" role="group" :aria-label="t('admin.productsTitle')">
      <button
        type="button"
        class="kpi-card"
        :aria-pressed="stockFilter === 'all' && categoryFilter === 'all'"
        :class="{ 'is-active': stockFilter === 'all' && categoryFilter === 'all' }"
        @click="stockFilter = 'all'; categoryFilter = 'all'"
      >
        <div class="kpi-icon-box bg-primary-soft">
          <span class="material-symbols-outlined text-primary" aria-hidden="true">inventory_2</span>
        </div>
        <div class="kpi-info">
          <span class="kpi-label mono">{{ t('admin.productsTitle') }}</span>
          <strong class="kpi-value mono">{{ products.length }}</strong>
        </div>
      </button>

      <button
        type="button"
        class="kpi-card"
        :aria-pressed="stockFilter === 'inStock'"
        :class="{ 'is-active': stockFilter === 'inStock' }"
        @click="stockFilter = stockFilter === 'inStock' ? 'all' : 'inStock'"
      >
        <div class="kpi-icon-box bg-emerald-soft">
          <span class="material-symbols-outlined text-emerald-600" aria-hidden="true">check_circle</span>
        </div>
        <div class="kpi-info">
          <span class="kpi-label mono">{{ t('admin.inStock') }}</span>
          <strong class="kpi-value mono text-emerald-600">{{ inStockCount }}</strong>
        </div>
      </button>

      <button
        type="button"
        class="kpi-card"
        :aria-pressed="stockFilter === 'outOfStock'"
        :class="{ 'is-active': stockFilter === 'outOfStock' }"
        @click="stockFilter = stockFilter === 'outOfStock' ? 'all' : 'outOfStock'"
      >
        <div class="kpi-icon-box bg-rose-soft">
          <span class="material-symbols-outlined text-rose-600" aria-hidden="true">warning</span>
        </div>
        <div class="kpi-info">
          <span class="kpi-label mono">{{ t('admin.outOfStock') }}</span>
          <strong class="kpi-value mono text-rose-600">{{ outOfStockCount }}</strong>
        </div>
      </button>

      <div class="kpi-card kpi-card--stat">
        <div class="kpi-icon-box bg-indigo-soft">
          <span class="material-symbols-outlined text-indigo-600" aria-hidden="true">category</span>
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
          <option value="all">{{ t('common.all') }} ({{ t('marketplace.stock') }})</option>
          <option value="inStock">{{ t('admin.inStock') }}</option>
          <option value="outOfStock">{{ t('admin.outOfStock') }}</option>
        </select>

        <span class="mono items-count-badge">
          {{ filtered.length }} {{ t('admin.productsTitle') || 'Products' }}
        </span>
      </div>
    </div>

    <!-- Products Data View (Cards Grid) -->
    <DataState
      :loading="loading"
      :error="fetchError"
      skeleton-type="catalog-grid"
      :skeleton-count="4"
      use-spinner
      :spinner-label="t('common.loading')"
      :empty="!filtered.length && !loading"
      :empty-title="t('provider.noProducts')"
      :empty-description="t('provider.noProductsDesc')"
      @retry="loadAll"
    >
      <div class="products-grid-container">
        <div class="products-card-grid">
          <article
            v-for="(p, i) in paginated"
            :key="p.id"
            class="catalog-product-card anim-fade-in-up"
            :style="{ animationDelay: `${(i % pageSize) * 50}ms` }"
            @click="openDetails(p)"
          >
            <div class="card-media-box">
              <AppImage
                :src="p.imageName || p.images?.[0]"
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
                <span class="card-currency-val mono text-xs">{{ getCurrencyCode(p.currencyId) || 'USD' }}</span>
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
          v-if="filtered.length > pageSize"
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
              :src="currentDetailsImage"
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

        <!-- Multi-photo gallery strip if product has multiple images -->
        <div v-if="(selectedProduct.images?.length ?? 0) > 1" class="mt-3 mb-2 flex items-center gap-2 overflow-x-auto p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
          <button
            v-for="(img, idx) in selectedProduct.images"
            :key="idx"
            type="button"
            class="w-14 h-14 rounded-lg overflow-hidden border flex-shrink-0 bg-white transition-all cursor-pointer p-0"
            :class="activeDetailsImageIdx === idx ? 'border-teal-500 ring-2 ring-teal-500/50 scale-105' : 'border-slate-200 dark:border-slate-700 hover:border-slate-400 opacity-80 hover:opacity-100'"
            @click.stop="activeDetailsImageIdx = idx"
          >
            <AppImage
              :src="img"
              placeholder-type="product"
              fit="cover"
              class="w-full h-full pointer-events-none"
            />
          </button>
        </div>

        <div class="specs-quad-grid">
          <div class="spec-card">
            <span class="spec-k mono">{{ t('admin.sku') }}</span>
            <strong class="spec-v mono">{{ selectedProduct.sku }}</strong>
          </div>
          <div v-if="selectedProduct.material" class="spec-card">
            <span class="spec-k mono">{{ t('admin.material') || 'Material' }}</span>
            <strong class="spec-v">{{ selectedProduct.material }}</strong>
          </div>
          <div class="spec-card">
            <span class="spec-k mono">{{ t('admin.submittedDate') || 'Created' }}</span>
            <span class="spec-v mono text-xs">
              {{ selectedProduct.createdAt ? formatDate(selectedProduct.createdAt, locale) : '—' }}
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

        <div v-if="allDetailsVideos.length" class="spec-block">
          <span class="spec-k mono">{{ t('admin.productVideos') || 'Videos' }}</span>
          <div class="details-videos mt-2 flex flex-col gap-3">
            <div
              v-for="(video, idx) in allDetailsVideos"
              :key="idx"
              class="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-black aspect-video max-w-xl"
            >
              <iframe
                v-if="parseVideoSource(video.url).type === 'youtube' || parseVideoSource(video.url).type === 'vimeo'"
                :src="parseVideoSource(video.url).embedUrl"
                class="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen
              />
              <video
                v-else
                :src="parseVideoSource(video.url).src"
                controls
                playsinline
                preload="metadata"
                class="w-full h-full object-contain"
                @click.stop
              />
            </div>
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
            <label class="field-label" for="pp-name-ar">
              {{ t('admin.productNameAr') }}
              <span class="text-xs text-slate-400 font-normal ms-1">({{ t('common.optional') }})</span>
            </label>
            <input id="pp-name-ar" v-model="form.nameAr" type="text" class="field-input" />
          </div>
        </div>

        <div class="form-row two-cols">
          <div class="form-field">
            <div class="field-label-row">
              <label class="field-label" for="pp-sku">{{ t('admin.sku') }} *</label>
              <button
                type="button"
                class="btn-text-action mono"
                :title="t('admin.autoGenerateSku')"
                @click="generateSku"
              >
                <span class="material-symbols-outlined text-[13px]">autorenew</span>
                <span>{{ t('admin.auto') }}</span>
              </button>
            </div>
            <input id="pp-sku" v-model="form.sku" type="text" class="field-input mono" placeholder="e.g. PRD-MED-001" required />
          </div>
          <div class="form-field">
            <div class="field-label-row">
              <label class="field-label" for="pp-slug">{{ t('admin.slug') }} *</label>
              <span class="slug-badge mono">
                <span class="material-symbols-outlined text-[12px]">lock</span>
                <span>{{ t('admin.autoGenerated') }}</span>
              </span>
            </div>
            <input
              id="pp-slug"
              v-model="form.slug"
              type="text"
              class="field-input field-input--readonly mono"
              :placeholder="t('admin.autoGeneratedFromName')"
              readonly
              tabindex="-1"
            />
          </div>
        </div>

        <div class="form-row two-cols">
          <div class="form-field">
            <label class="field-label" for="pp-price">
              {{ t('admin.price') }}
              <span class="text-xs text-slate-400 font-normal ms-1">({{ t('common.optional') }})</span>
            </label>
            <div class="input-with-affix">
              <input
                id="pp-price"
                v-model.number="form.price"
                type="number"
                min="0"
                step="any"
                class="field-input mono-num"
                placeholder="0.00"
              />
              <span class="input-affix mono text-xs">{{ getCurrencyCode(form.currencyId) || 'USD' }}</span>
            </div>
          </div>
          <div class="form-field">
            <label class="field-label" for="pp-stock">
              {{ t('admin.stock') }}
              <span class="text-xs text-slate-400 font-normal ms-1">({{ t('common.optional') }})</span>
            </label>
            <input id="pp-stock" v-model.number="form.stock" type="number" min="0" step="1" class="field-input mono-num" placeholder="0" />
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
          <textarea id="pp-desc" v-model="form.description" class="field-textarea" rows="2" placeholder="Provide product overview, intended use, etc."></textarea>
        </div>

        <!-- Product Technical Specifications & Capacities -->
        <div class="product-specs-card">
          <div class="flex items-center gap-2 mb-2">
            <span class="material-symbols-outlined text-indigo-600 text-[18px]">format_list_bulleted</span>
            <label class="field-label mb-0 font-bold text-slate-800 dark:text-slate-100">
              {{ locale === 'ar' ? 'المواصفات الفنية (نقاط / قائمة)' : 'Technical Specifications (Bullet Points)' }}
              <span class="text-xs text-slate-400 font-normal ms-1">({{ t('common.optional') }})</span>
            </label>
          </div>
          <p class="text-xs text-slate-500 mb-2">
            {{ locale === 'ar' ? 'اكتب كل مواصفة في سطر منفصل؛ ستظهر كنقاط مرتبة أسفل اسم المنتج مباشرة.' : 'Enter each specification on a new line; they will be displayed as bullet points under the product title.' }}
          </p>
          <textarea
            v-model="form.specificationText"
            rows="3"
            class="field-textarea mono-num text-xs"
            :placeholder="locale === 'ar' ? '• فولاذ ألماني مقاوم للصدأ عالي الجودة\n• تشطيب غير عاكس للضوء\n• قابل للتعقيم بالبخار حتى 134 درجة مئوية' : '• High-grade surgical stainless steel\n• Non-reflective satin finish\n• Autoclavable up to 134°C'"
          ></textarea>

          <!-- Specific capacity fields (optional) -->
          <div class="form-row two-cols mt-3">
            <div class="form-field mb-0">
              <label class="field-label text-xs">
                <span class="material-symbols-outlined text-[14px] text-indigo-600 align-middle me-1">electric_bolt</span>
                {{ locale === 'ar' ? 'سعة السلك (Wire Capacity)' : 'Wire Capacity' }}
                <span class="text-xs text-slate-400 font-normal ms-1">({{ t('common.optional') }})</span>
              </label>
              <input
                v-model="form.wireCapacity"
                type="text"
                class="field-input text-xs"
                :placeholder="locale === 'ar' ? 'مثال: Up to 1.5mm' : 'e.g. Up to 1.5mm'"
              />
            </div>
            <div class="form-field mb-0">
              <label class="field-label text-xs">
                <span class="material-symbols-outlined text-[14px] text-amber-600 align-middle me-1">content_cut</span>
                {{ locale === 'ar' ? 'سعة قطع السلك (Wire Cutting Capacity)' : 'Wire Cutting Capacity' }}
                <span class="text-xs text-slate-400 font-normal ms-1">({{ t('common.optional') }})</span>
              </label>
              <input
                v-model="form.wireCuttingCapacity"
                type="text"
                class="field-input text-xs"
                :placeholder="locale === 'ar' ? 'مثال: Up to 2.2mm soft wire' : 'e.g. Up to 2.2mm soft wire'"
              />
            </div>
          </div>
        </div>

        <!-- Hidden File Inputs -->
        <input
          ref="imageInputRef"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          multiple
          class="hidden"
          @change="onImagePicked"
        />
        <input
          ref="videoFileInputRef"
          type="file"
          accept="video/mp4,video/webm,video/ogg,video/quicktime"
          class="hidden"
          @change="onVideoPicked"
        />

        <!-- Multi-Photo Gallery Section (Min 3 Photos) -->
        <div class="product-media-card">
          <div class="media-card-header">
            <div class="media-header-title">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-teal-600 text-[20px]">collections</span>
                <label class="form-label mono mb-0 text-sm font-bold text-slate-900 dark:text-slate-100">
                  {{ t('admin.productImagesReq') }}
                  <span class="text-rose-500">*</span>
                </label>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {{ locale === 'ar' ? 'الحد الأدنى 3 صور للمنتج. الصورة الأولى هي صورة الغلاف.' : 'Minimum 3 photos required. The first image serves as the marketplace cover.' }}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <div v-if="loadingEditMedia" class="flex items-center gap-1.5 text-xs text-teal-600 font-medium">
                <span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                <span>{{ locale === 'ar' ? 'جاري جلب الوسائط...' : 'Loading media...' }}</span>
              </div>
              <div class="media-counter-pill" :class="form.images.length >= 3 ? 'media-counter-pill--valid' : 'media-counter-pill--pending'">
                <span class="material-symbols-outlined text-[15px]">
                  {{ form.images.length >= 3 ? 'check_circle' : 'info' }}
                </span>
                <span>{{ form.images.length }} / 3 {{ locale === 'ar' ? 'صور' : 'Photos' }}</span>
              </div>
            </div>
          </div>

          <!-- Dropzone -->
          <div
            class="media-dropzone"
            @click="!uploadingMedia && triggerImagePicker()"
          >
            <div class="dropzone-content">
              <div class="dropzone-icon-circle">
                <span v-if="uploadingMedia" class="material-symbols-outlined text-[24px] animate-spin text-teal-600">
                  progress_activity
                </span>
                <span v-else class="material-symbols-outlined text-[24px] text-teal-600">
                  add_photo_alternate
                </span>
              </div>
              <div class="dropzone-text w-full max-w-sm">
                <template v-if="uploadingMedia">
                  <p class="dropzone-title font-semibold text-teal-700 dark:text-teal-400">
                    {{ locale === 'ar' ? 'جاري رفع الصور إلى الخادم...' : 'Uploading photos to server...' }}
                    <span class="ms-1 font-mono">({{ attachmentService.progress.value }}%)</span>
                  </p>
                  <p class="text-[11px] text-slate-500 font-mono mt-0.5 truncate">{{ activeUploadName }}</p>
                  <div class="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden mt-2">
                    <div
                      class="bg-teal-600 h-full transition-all duration-200"
                      :style="{ width: attachmentService.progress.value + '%' }"
                    ></div>
                  </div>
                </template>
                <template v-else>
                  <p class="dropzone-title">
                    <strong class="text-teal-600 font-semibold">{{ locale === 'ar' ? 'انقر لاختيار الصور' : 'Click to select photos' }}</strong>
                    {{ locale === 'ar' ? ' (يمكنك اختيار عدة صور معاً)' : ' (select multiple photos together)' }}
                  </p>
                  <p class="dropzone-subtitle">
                    {{ locale === 'ar' ? 'يدعم PNG, JPG, WebP (بحد أقصى 20MB لكل صورة)' : 'Supports PNG, JPG, WebP (up to 20MB each)' }}
                  </p>
                </template>
              </div>
            </div>
          </div>

          <!-- Gallery Grid of Uploaded Images -->
          <div v-if="form.images.length > 0" class="media-gallery-grid">
            <div
              v-for="(img, idx) in form.images"
              :key="idx"
              class="media-thumb-card group"
              :class="{ 'media-thumb-card--cover': idx === 0 }"
            >
              <img
                :src="resolveFileUrl(img)"
                :alt="`Product photo ${idx + 1}`"
                class="media-thumb-img"
                loading="lazy"
              />
              <div v-if="idx === 0" class="media-cover-badge">
                <span class="material-symbols-outlined text-[13px]">star</span>
                <span>{{ locale === 'ar' ? 'الرئيسية' : 'Cover' }}</span>
              </div>
              <div v-else class="media-order-pill">
                #{{ idx + 1 }}
              </div>
              <div class="media-thumb-overlay">
                <div class="thumb-overlay-top">
                  <button
                    v-if="idx > 0"
                    type="button"
                    class="btn-overlay-action btn-set-cover"
                    :title="locale === 'ar' ? 'تعيين كصورة رئيسية' : 'Set as primary cover'"
                    @click="setAsCoverImage(idx)"
                  >
                    <span class="material-symbols-outlined text-[14px]">star</span>
                    <span>{{ locale === 'ar' ? 'غلاف' : 'Cover' }}</span>
                  </button>
                  <span v-else></span>
                  <button
                    type="button"
                    class="btn-overlay-action btn-delete-thumb"
                    :title="locale === 'ar' ? 'حذف الصورة' : 'Remove photo'"
                    @click="removeGalleryImage(idx)"
                  >
                    <span class="material-symbols-outlined text-[15px]">delete</span>
                  </button>
                </div>
                <div class="thumb-overlay-bottom">
                  <a
                    :href="resolveFileUrl(img)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="btn-overlay-action btn-view-full"
                    :title="locale === 'ar' ? 'معاينة بالحجم الكامل' : 'Open in new tab'"
                  >
                    <span class="material-symbols-outlined text-[13px]">open_in_new</span>
                  </a>
                </div>
              </div>
            </div>
            <button
              type="button"
              class="media-thumb-add-tile"
              @click="triggerImagePicker"
            >
              <span class="material-symbols-outlined text-[22px] text-teal-600 mb-1">add_photo_alternate</span>
              <span class="text-[11px] font-bold text-slate-700 dark:text-slate-300">{{ locale === 'ar' ? '+ إضافة صور' : '+ Add Photos' }}</span>
            </button>
          </div>
        </div>

        <!-- Product Videos Section -->
        <div class="product-media-card mt-4">
          <div class="media-card-header">
            <div class="media-header-title">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-rose-600 text-[20px]">smart_display</span>
                <label class="form-label mono mb-0 text-sm font-bold text-slate-900 dark:text-slate-100">
                  {{ t('admin.productVideos') }}
                  <span class="text-xs text-slate-400 font-normal ms-1">({{ t('common.optional') }})</span>
                </label>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {{ locale === 'ar' ? 'فيديوهات توضيحية واستعراض سريري للمنتج (رفع ملف مباشر أو رابط YouTube / Vimeo)' : 'Demonstration & clinical videos (direct upload or YouTube / Vimeo link)' }}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="btn-pill-action"
                @click="showVideoUrlInput = !showVideoUrlInput"
              >
                <span class="material-symbols-outlined text-[15px]">link</span>
                <span>{{ showVideoUrlInput ? (locale === 'ar' ? 'إلغاء الرابط' : 'Cancel Link') : (locale === 'ar' ? '+ رابط فيديو' : '+ Add Link') }}</span>
              </button>
            </div>
          </div>

          <!-- Collapsible video URL input -->
          <div v-if="showVideoUrlInput" class="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 mb-3 flex gap-2">
            <input
              v-model="newVideoLink"
              type="url"
              placeholder="https://www.youtube.com/watch?v=... or https://vimeo.com/..."
              class="field-input text-xs mono flex-1"
              @keydown.enter.prevent="addVideoLink"
            />
            <BaseButton variant="primary" size="sm" type="button" @click="addVideoLink">
              {{ locale === 'ar' ? 'إضافة' : 'Add' }}
            </BaseButton>
          </div>

          <!-- Video Upload Dropzone -->
          <div
            class="media-dropzone media-dropzone--video"
            @click="!uploadingMedia && triggerVideoPicker()"
          >
            <div class="dropzone-content">
              <div class="dropzone-icon-circle dropzone-icon-circle--rose">
                <span v-if="uploadingMedia && activeUploadName.match(/\.(mp4|webm|mov|avi|mkv)$/i)" class="material-symbols-outlined text-[24px] animate-spin text-rose-600">
                  progress_activity
                </span>
                <span v-else class="material-symbols-outlined text-[24px] text-rose-600">
                  video_file
                </span>
              </div>
              <div class="dropzone-text w-full max-w-sm">
                <template v-if="uploadingMedia && activeUploadName.match(/\.(mp4|webm|mov|avi|mkv)$/i)">
                  <p class="dropzone-title font-semibold text-rose-700 dark:text-rose-400">
                    {{ locale === 'ar' ? 'جاري رفع الفيديو إلى الخادم...' : 'Uploading video to server...' }}
                    <span class="ms-1 font-mono">({{ attachmentService.progress.value }}%)</span>
                  </p>
                  <p class="text-[11px] text-slate-500 font-mono mt-0.5 truncate">{{ activeUploadName }}</p>
                  <div class="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden mt-2">
                    <div
                      class="bg-rose-600 h-full transition-all duration-200"
                      :style="{ width: attachmentService.progress.value + '%' }"
                    ></div>
                  </div>
                </template>
                <template v-else>
                  <p class="dropzone-title">
                    <strong class="text-rose-600 font-semibold">{{ locale === 'ar' ? 'انقر لرفع ملف فيديو' : 'Click to upload video file' }}</strong>
                    {{ locale === 'ar' ? ' (يدعم MP4, WebM بحد أقصى 100MB)' : ' (supports MP4, WebM up to 100MB)' }}
                  </p>
                </template>
              </div>
            </div>
          </div>

          <!-- Uploaded Videos List -->
          <div v-if="form.videos.length > 0" class="videos-card-list mt-3">
            <div
              v-for="(vid, vIdx) in form.videos"
              :key="vIdx"
              class="video-card-item"
            >
              <div class="video-card-main">
                <div class="video-card-badge bg-rose-600">
                  <span class="material-symbols-outlined text-[18px] text-white">videocam</span>
                </div>
                <div class="video-card-info">
                  <strong class="text-xs font-bold text-slate-800 dark:text-slate-100 truncate block">
                    {{ vid.title || `Video ${vIdx + 1}` }}
                  </strong>
                  <p class="text-[11px] font-mono text-slate-400 truncate mt-0.5">{{ vid.url }}</p>
                </div>
                <div class="video-card-actions">
                  <button
                    type="button"
                    class="btn-video-delete"
                    :title="locale === 'ar' ? 'حذف الفيديو' : 'Delete video'"
                    @click="removeVideo(vIdx)"
                  >
                    <span class="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
              </div>
              <div class="video-player-container mt-2">
                <iframe
                  v-if="parseVideoSource(vid.url).type === 'youtube' || parseVideoSource(vid.url).type === 'vimeo'"
                  :src="parseVideoSource(vid.url).embedUrl"
                  class="w-full h-48 border-0 rounded-lg"
                  allowfullscreen
                ></iframe>
                <video
                  v-else
                  :src="resolveFileUrl(vid.url)"
                  controls
                  class="w-full max-h-48 rounded-lg bg-black"
                  @click.stop
                ></video>
              </div>
            </div>
          </div>
        </div>

        <div class="form-field">
          <label class="toggle-label flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
            <input v-model="form.isActive" type="checkbox" class="w-4 h-4 rounded text-teal-600 focus:ring-teal-500" />
            <div class="flex flex-col">
              <span class="text-sm font-semibold text-slate-900 dark:text-slate-100">{{ locale === 'ar' ? 'المنتج نشط ومعروض في المتجر' : 'Active & Published in Marketplace' }}</span>
              <span class="text-xs text-slate-500">{{ locale === 'ar' ? 'عند التفعيل، يظهر المنتج لجميع العملاء في المتجر ومحركات البحث.' : 'When enabled, this product is visible to all buyers in the catalog.' }}</span>
            </div>
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
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  /* Reset native button chrome so the card keeps its div appearance */
  width: 100%;
  font: inherit;
  color: inherit;
  text-align: start;
}
.kpi-card:focus-visible {
  outline: 2px solid var(--wl-primary);
  outline-offset: 2px;
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
  position: relative;
}

.catalog-product-card::before {
  content: '';
  position: absolute;
  top: 0;
  inset-inline: 0;
  height: 2px;
  background: var(--wl-laser-sweep);
  opacity: 0;
  transition: opacity 0.22s var(--wl-ease-spring);
  pointer-events: none;
  z-index: 1;
}

.catalog-product-card:hover::before {
  opacity: 1;
}

.catalog-product-card:hover {
  transform: translateY(-3px);
  border-color: var(--wl-primary);
  box-shadow: var(--shadow-md);
}

.card-media-box {
  position: relative;
  aspect-ratio: 4 / 3;
  max-height: 220px;
  background: var(--wl-surface-soft, #f8fafc);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: var(--space-3, 0.75rem);
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

.product-specs-card {
  background: var(--wl-surface-subtle, #f8fafc);
  border: 1px solid var(--wl-border, #e2e8f0);
  border-radius: 12px;
  padding: 16px;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
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

.field-input--readonly {
  background: var(--wl-surface-soft, #f8fafc) !important;
  color: var(--wl-muted, #64748b) !important;
  cursor: not-allowed;
  border-style: dashed;
  user-select: all;
}

.field-input--readonly:focus {
  outline: none !important;
  border-color: var(--wl-border, #e2e8f0) !important;
  box-shadow: none !important;
}

.slug-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 600;
  color: var(--wl-muted, #64748b);
  background: var(--wl-surface-soft, rgba(100, 116, 139, 0.08));
  padding: 1px 6px;
  border-radius: 4px;
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

/* ── Modern Clinical Media Cards ── */
.product-media-card {
  background: var(--wl-surface-subtle, #f8fafc);
  border: 1px solid var(--wl-border, #e2e8f0);
  border-radius: 12px;
  padding: 16px;
  transition: all 0.2s ease;
  margin-top: 12px;
}

.media-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.media-counter-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 9999px;
}

.media-counter-pill--valid {
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
}

.media-counter-pill--pending {
  background: #fffbeb;
  color: #b45309;
  border: 1px solid #fde68a;
}

.btn-pill-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid var(--wl-border, #e2e8f0);
  background: var(--wl-surface, #ffffff);
  color: var(--wl-ink-soft, #475569);
  cursor: pointer;
  transition: all 0.15s;
}

.btn-pill-action:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.media-dropzone {
  border: 2px dashed #cbd5e1;
  background: var(--wl-surface, #ffffff);
  border-radius: 10px;
  padding: 16px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.media-dropzone:hover {
  border-color: #0d9488;
  background: #f0fdfa;
}

.media-dropzone--video:hover {
  border-color: #e11d48;
  background: #fff1f2;
}

.dropzone-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
}

.dropzone-icon-circle {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #f0fdfa;
  border: 1px solid #ccfbf1;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.dropzone-icon-circle--rose {
  background: #fff1f2;
  border-color: #ffe4e6;
}

.dropzone-title {
  font-size: 13px;
  color: var(--wl-ink-strong, #1e293b);
  margin: 0;
}

.dropzone-subtitle {
  font-size: 11px;
  color: var(--wl-muted, #64748b);
  margin: 2px 0 0;
}

.media-gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.media-thumb-card {
  position: relative;
  aspect-ratio: 1 / 1;
  border-radius: 8px;
  border: 1px solid var(--wl-border, #e2e8f0);
  background: var(--wl-surface, #ffffff);
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.media-thumb-card--cover {
  border-color: #0d9488;
  box-shadow: 0 0 0 2px rgba(13, 148, 136, 0.25);
}

.media-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.2s ease;
}

.media-thumb-card:hover .media-thumb-img {
  transform: scale(1.04);
}

.media-cover-badge {
  position: absolute;
  top: 4px;
  inset-inline-start: 4px;
  background: #0d9488;
  color: #ffffff;
  font-size: 9px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 2px;
  z-index: 2;
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
}

.media-order-pill {
  position: absolute;
  top: 4px;
  inset-inline-start: 4px;
  background: rgba(15, 23, 42, 0.7);
  color: #ffffff;
  font-size: 9px;
  font-weight: 600;
  padding: 1px 4px;
  border-radius: 3px;
  z-index: 2;
}

.media-thumb-overlay {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.65);
  opacity: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 6px;
  transition: opacity 0.15s ease;
  z-index: 3;
}

.media-thumb-card:hover .media-thumb-overlay {
  opacity: 1;
}

.thumb-overlay-top,
.thumb-overlay-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.btn-overlay-action {
  padding: 3px 5px;
  font-size: 9px;
  font-weight: 700;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 2px;
  color: #ffffff;
}

.btn-set-cover {
  background: #0d9488;
}

.btn-delete-thumb {
  background: #e11d48;
}

.btn-view-full {
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(4px);
}

.media-thumb-add-tile {
  aspect-ratio: 1 / 1;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  background: var(--wl-surface, #ffffff);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
}

.media-thumb-add-tile:hover {
  border-color: #0d9488;
  background: #f0fdfa;
}

.videos-card-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.video-card-item {
  border: 1px solid var(--wl-border, #e2e8f0);
  background: var(--wl-surface, #ffffff);
  border-radius: 8px;
  padding: 10px 12px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.03);
}

.video-card-main {
  display: flex;
  align-items: center;
  gap: 10px;
}

.video-card-badge {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.video-card-info {
  flex: 1;
  min-width: 0;
}

.btn-video-delete {
  background: none;
  border: none;
  color: #ef4444;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.btn-video-delete:hover {
  background: #fef2f2;
}
</style>
