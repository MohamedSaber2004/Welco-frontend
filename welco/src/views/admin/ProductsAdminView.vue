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
import { services, companyRepository, attachmentService } from '../../di/container'
import { confirmService } from '../../infrastructure/feedback/confirm.service'
import { toastService } from '../../infrastructure/feedback/toast.service'
import { resolveFileUrl, parseVideoSource } from '../../utils/file-url'
import { t, locale } from '../../i18n'
import type {
  ProductDto,
  CategoryDto,
  CurrencyDto,
  CreateProductPayload,
  UpdateProductPayload,
  ProductMediaDto,
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

export interface ProductVideoEntry {
  url: string
  title: string
  provider?: 'youtube' | 'vimeo' | 'html5'
}

const emptyForm = () => ({
  nameEn: '',
  nameAr: '',
  sku: '',
  slug: '',
  description: '',
  specificationText: '',
  wireCapacity: '',
  wireCuttingCapacity: '',
  price: '' as unknown as number | undefined,
  stock: '' as unknown as number | undefined,
  imageName: '',
  images: ['', '', ''] as string[],
  videoUrl: '',
  videos: [] as ProductVideoEntry[],
  material: '',
  currencyId: currencies.value[0]?.id || '',
  categoryId: categories.value[0]?.id || '',
  companyId: '',
  isActive: true,
  isMostSelling: false,
})
const form = ref(emptyForm())

// --- Dynamic Multi-Image Management ---
const multiImageInput = ref<HTMLInputElement | null>(null)
const uploadingImages = ref(false)
const uploadProgressText = ref('')
const directImageUrl = ref('')
const showUrlInputModal = ref(false)
const isDraggingOverImages = ref(false)

const triggerMultiImagePick = () => {
  multiImageInput.value?.click()
}

const removeImage = (idx: number) => {
  form.value.images.splice(idx, 1)
}

const setCoverImage = (idx: number) => {
  if (idx <= 0 || idx >= form.value.images.length) return
  const item = form.value.images[idx]
  if (!item) return
  form.value.images.splice(idx, 1)
  form.value.images.unshift(item)
  toastService.success(locale.value === 'ar' ? 'تم تعيين صورة الغلاف الرئيسية' : 'Primary cover image set')
}

const uploadImageFiles = async (files: File[]) => {
  const imageFiles = files.filter((f) => f.type.startsWith('image/'))
  if (imageFiles.length === 0) return
  uploadingImages.value = true
  let successCount = 0
  try {
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i]
      if (!file) continue
      uploadProgressText.value = `${i + 1} / ${imageFiles.length}`
      const res = await attachmentService.upload({
        file,
        place: ATTACHMENT_PLACE.PROVIDERS,
        fileType: MEDIA_TYPE.IMAGE,
      })
      if (res.ok && res.data) {
        successCount++
        form.value.images.push(res.data)
      }
    }
    if (successCount > 0) {
      toastService.success(
        locale.value === 'ar'
          ? `تم رفع ${successCount} صور بنجاح`
          : `${successCount} images uploaded successfully`,
      )
    }
  } catch (err) {
    toastService.error(err instanceof Error ? err.message : t('common.error'))
  } finally {
    uploadingImages.value = false
    uploadProgressText.value = ''
  }
}

const onMultipleFilesSelected = async (e: Event) => {
  const target = e.target as HTMLInputElement
  const files = target.files
  if (!files || files.length === 0) return
  await uploadImageFiles(Array.from(files))
  target.value = ''
}

const onDropImages = async (e: DragEvent) => {
  isDraggingOverImages.value = false
  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return
  await uploadImageFiles(Array.from(files))
}

const addDirectImageUrl = () => {
  const url = directImageUrl.value.trim()
  if (!url) return
  form.value.images.push(url)
  directImageUrl.value = ''
  showUrlInputModal.value = false
  toastService.success(locale.value === 'ar' ? 'تمت إضافة رابط الصورة' : 'Image link added')
}

const uploadedImagesCount = computed(() => form.value.images.filter((img) => Boolean(img && img.trim())).length)

// --- Dynamic Multi-Video Management ---
const newVideoUrl = ref('')
const newVideoTitle = ref('')
const videoFileInput = ref<HTMLInputElement | null>(null)
const uploadingVideo = ref(false)
const uploadingVideoFileName = ref('')
const uploadingVideoSizeMb = ref(0)
const previewVideoIdx = ref<number | null>(null)
const showVideoUrlModal = ref(false)
const isDraggingOverVideos = ref(false)

const triggerVideoFileInput = () => {
  videoFileInput.value?.click()
}

const addVideoItem = () => {
  const url = newVideoUrl.value.trim()
  if (!url) {
    toastService.error(t('admin.videoUrl'))
    return
  }
  const parsed = parseVideoSource(url)
  const title = newVideoTitle.value.trim() || `Video ${form.value.videos.length + 1}`
  form.value.videos.push({
    url,
    title,
    provider: parsed.type as 'youtube' | 'vimeo' | 'html5',
  })
  newVideoUrl.value = ''
  newVideoTitle.value = ''
  showVideoUrlModal.value = false
  toastService.success(t('admin.videoUploaded'))
}

const removeVideoItem = (idx: number) => {
  form.value.videos.splice(idx, 1)
  if (previewVideoIdx.value === idx) {
    previewVideoIdx.value = null
  }
}

const setPrimaryVideo = (idx: number) => {
  if (idx <= 0 || idx >= form.value.videos.length) return
  const item = form.value.videos[idx]
  if (!item) return
  form.value.videos.splice(idx, 1)
  form.value.videos.unshift(item)
  toastService.success(locale.value === 'ar' ? 'تم تعيين الفيديو كرئيسي' : 'Primary video updated')
}

const toggleVideoPreview = (idx: number) => {
  previewVideoIdx.value = previewVideoIdx.value === idx ? null : idx
}

const uploadVideoFiles = async (files: File[]) => {
  const videoFiles = files.filter((f) => f.type.startsWith('video/') || /\.(mp4|webm|ogg|mov)$/i.test(f.name))
  if (videoFiles.length === 0) {
    toastService.error(t('attachment.unsupportedType'))
    return
  }

  // Guard against files exceeding 100MB limit
  for (const file of videoFiles) {
    const sizeMb = file.size / (1024 * 1024)
    if (sizeMb > 100) {
      toastService.error(
        locale.value === 'ar'
          ? `حجم الفيديو (${sizeMb.toFixed(1)}MB) كبير جداً. الحد الأقصى المسموح به هو 100MB.`
          : `Video file (${sizeMb.toFixed(1)}MB) exceeds 100MB limit. Please compress the video before uploading.`,
      )
      return
    }
  }

  uploadingVideo.value = true
  let successCount = 0
  try {
    for (let i = 0; i < videoFiles.length; i++) {
      const file = videoFiles[i]
      if (!file) continue
      uploadingVideoFileName.value = file.name
      uploadingVideoSizeMb.value = +(file.size / (1024 * 1024)).toFixed(1)
      const res = await attachmentService.upload({
        file,
        place: ATTACHMENT_PLACE.PROVIDERS,
        fileType: MEDIA_TYPE.VIDEO,
      })
      if (res.ok && res.data) {
        successCount++
        form.value.videos.push({
          url: res.data,
          title: file.name.replace(/\.[^/.]+$/, ''),
          provider: 'html5',
        })
      }
    }
    if (successCount > 0) {
      toastService.success(t('admin.videoUploaded'))
    }
  } catch (err) {
    toastService.error(err instanceof Error ? err.message : t('common.error'))
  } finally {
    uploadingVideo.value = false
    uploadingVideoFileName.value = ''
    uploadingVideoSizeMb.value = 0
  }
}

const onVideoFileSelected = async (e: Event) => {
  const target = e.target as HTMLInputElement
  const files = target.files
  if (!files || files.length === 0) return
  await uploadVideoFiles(Array.from(files))
  target.value = ''
}

const onDropVideos = async (e: DragEvent) => {
  isDraggingOverVideos.value = false
  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return
  await uploadVideoFiles(Array.from(files))
}

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
  previewVideoIdx.value = null
  newVideoUrl.value = ''
  newVideoTitle.value = ''
  showUrlInputModal.value = false
  showModal.value = true
}

const openEdit = (p: AdminProductItem | ProductDto) => {
  editing.value = p
  let imgs: string[] = []
  if (Array.isArray(p.images) && p.images.length > 0) {
    imgs = p.images.map((img) => (img || '').trim()).filter(Boolean)
  } else if (p.imageName && p.imageName.trim()) {
    imgs = [p.imageName.trim()]
  }

  let vids: ProductVideoEntry[] = []
  if (Array.isArray(p.videos) && p.videos.length > 0) {
    vids = p.videos.map((v, i) => ({
      url: v.url,
      title: v.title || `Video ${i + 1}`,
      provider: parseVideoSource(v.url).type as 'youtube' | 'vimeo' | 'html5',
    }))
  } else if (p.videoUrl) {
    vids = [{
      url: p.videoUrl,
      title: 'Main Demonstration Video',
      provider: parseVideoSource(p.videoUrl).type as 'youtube' | 'vimeo' | 'html5',
    }]
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
    imageName: p.imageName ?? '',
    images: imgs,
    videoUrl: p.videoUrl ?? '',
    videos: vids,
    material: p.material ?? '',
    currencyId: p.currencyId ?? '',
    categoryId: p.categoryId ?? '',
    companyId: p.companyId ?? '',
    isActive: p.isActive ?? true,
    isMostSelling: Boolean(p.isMostSelling),
  }
  formError.value = ''
  slugTouched.value = true
  previewVideoIdx.value = null
  newVideoUrl.value = ''
  newVideoTitle.value = ''
  showUrlInputModal.value = false
  showModal.value = true

  if (p.id) {
    services.marketplaceRepository.getProductById(p.id).then((full) => {
      if (full && editing.value?.id === p.id) {
        if (Array.isArray(full.images) && full.images.length > 0) {
          form.value.images = [...full.images]
          form.value.imageName = full.images[0] || form.value.imageName
        }
        if (full.videoUrl && !form.value.videos.some((x) => x.url === full.videoUrl)) {
          form.value.videos.unshift({
            url: full.videoUrl,
            title: 'Main Demonstration Video',
            provider: parseVideoSource(full.videoUrl).type as 'youtube' | 'vimeo' | 'html5',
          })
        }
        if (full.isActive !== undefined) {
          form.value.isActive = full.isActive
        }
        if (full.isMostSelling !== undefined) {
          form.value.isMostSelling = Boolean(full.isMostSelling)
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
    }).catch(() => {})

    services.marketplaceRepository.getProductVideos(p.id).then((serverVids) => {
      if (Array.isArray(serverVids) && serverVids.length > 0) {
        form.value.videos = serverVids.map((v, i) => ({
          url: v.url,
          title: v.title || `Video ${i + 1}`,
          provider: parseVideoSource(v.url).type as 'youtube' | 'vimeo' | 'html5',
        }))
      }
    }).catch(() => {})
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
  const validVideos = f.videos.map((v) => ({ url: v.url.trim(), title: v.title?.trim() || '' })).filter((v) => Boolean(v.url))
  const primaryVideo = validVideos[0]?.url || f.videoUrl.trim() || undefined
  const nameArVal = f.nameAr.trim() || undefined

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
        nameAr: nameArVal,
        sku: f.sku.trim(),
        slug: f.slug.trim().toLowerCase(),
        description: f.description.trim() || undefined,
        specifications: finalSpecsString,
        price: numPrice,
        stock: numStock,
        imageName: primaryImage,
        images: validImages,
        videoUrl: primaryVideo,
        material: f.material.trim() || undefined,
        currencyId: f.currencyId || null,
        categoryId: f.categoryId,
        isActive: f.isActive,
        isMostSelling: Boolean(f.isMostSelling),
      }
      savedProduct = await services.marketplaceRepository.updateProduct(editing.value.id, payload)
      toastService.success(t('admin.productUpdated'))
    } else {
      const payload: CreateProductPayload = {
        nameEn: f.nameEn.trim(),
        nameAr: nameArVal,
        sku: f.sku.trim(),
        slug: f.slug.trim().toLowerCase(),
        description: f.description.trim() || undefined,
        specifications: finalSpecsString,
        price: numPrice,
        stock: numStock,
        imageName: primaryImage,
        images: validImages,
        videoUrl: primaryVideo,
        material: f.material.trim() || undefined,
        currencyId: f.currencyId || null,
        categoryId: f.categoryId,
        isActive: f.isActive ?? true,
        isMostSelling: Boolean(f.isMostSelling),
      }
      savedProduct = await services.marketplaceRepository.createProduct(payload)
      toastService.success(t('admin.productCreated'))
    }

    // Persist multiple videos via API endpoint
    if (savedProduct?.id && validVideos.length > 0) {
      const videoPayload: ProductMediaDto[] = validVideos.map((v, idx) => ({
        productId: savedProduct.id,
        type: 2,
        url: v.url,
        title: v.title || undefined,
        duration: undefined,
        sortOrder: idx,
      }))
      try {
        await services.marketplaceRepository.updateProductVideos(savedProduct.id, videoPayload)
      } catch (vErr) {
        if (import.meta.env.DEV) console.warn('[products] videos sync failed', vErr)
      }
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

const toggleMostSelling = async (p: AdminProductItem) => {
  try {
    const next = !Boolean(p.isMostSelling)
    await services.marketplaceRepository.updateProduct(p.id, {
      nameEn: p.nameEn,
      nameAr: p.nameAr,
      sku: p.sku,
      slug: p.slug || `sku-${p.sku}`,
      price: p.price,
      stock: p.stock,
      categoryId: p.categoryId,
      isActive: p.isActive ?? true,
      isMostSelling: next,
    })
    p.isMostSelling = next
    const target = rawProducts.value.find((x) => x.id === p.id)
    if (target) target.isMostSelling = next
    toastService.success(
      next
        ? (locale.value === 'ar' ? 'تم تعيين المنتج كأكثر مبيعاً' : 'Product set as Most Selling')
        : (locale.value === 'ar' ? 'تمت إزالة صفة الأكثر مبيعاً' : 'Most Selling flag removed'),
    )
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
                        :src="p.imageName || p.images?.[0]"
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
                      <div class="flex items-center gap-1.5 flex-wrap">
                        <strong class="prod-name-en" dir="auto">{{ p.nameEn }}</strong>
                        <span
                          v-if="p.isMostSelling"
                          class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                          :title="locale === 'ar' ? 'المنتج مضاف إلى الأكثر مبيعاً' : 'Featured in Most Selling'"
                        >
                          <span class="material-symbols-outlined text-[12px]">local_fire_department</span>
                          <span>{{ locale === 'ar' ? 'الأكثر مبيعاً' : 'Most Selling' }}</span>
                        </span>
                      </div>
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
                        :class="p.isMostSelling ? 'text-amber-600 bg-amber-500/10 hover:bg-amber-500/20' : 'text-slate-400 hover:text-amber-600'"
                        :title="p.isMostSelling ? (locale === 'ar' ? 'إزالة من الأكثر مبيعاً' : 'Remove from Most Selling') : (locale === 'ar' ? 'تعيين كأكثر مبيعاً' : 'Set as Most Selling')"
                        @click="toggleMostSelling(p)"
                      >
                        <span class="material-symbols-outlined text-[18px]">
                          {{ p.isMostSelling ? 'local_fire_department' : 'whatshot' }}
                        </span>
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
            <label class="form-label mono">
              {{ locale === 'ar' ? 'الوصف العام للمنتج' : 'Product Description' }}
              <span class="text-xs text-slate-400 font-normal ms-1">({{ t('common.optional') }})</span>
            </label>
            <textarea
              v-model="form.description"
              rows="2"
              class="form-textarea"
              :placeholder="locale === 'ar' ? 'نبذة تعريفية مختصرة عن الأداة واستخداماتها...' : 'Brief overview of the instrument and its surgical application...'"
            ></textarea>
          </div>

          <!-- Product Technical Specifications & Capacities -->
          <div class="product-specs-card">
            <div class="flex items-center gap-2 mb-2">
              <span class="material-symbols-outlined text-indigo-600 text-[18px]">format_list_bulleted</span>
              <label class="form-label mono mb-0 font-bold text-slate-800 dark:text-slate-100">
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
              class="form-textarea mono text-xs"
              :placeholder="locale === 'ar' ? '• فولاذ ألماني مقاوم للصدأ عالي الجودة\n• تشطيب غير عاكس للضوء\n• قابل للتعقيم بالبخار حتى 134 درجة مئوية' : '• High-grade surgical stainless steel\n• Non-reflective satin finish\n• Autoclavable up to 134°C'"
            ></textarea>

            <!-- Specific capacity fields (optional) -->
            <div class="form-grid-2 mt-3">
              <div class="form-group mb-0">
                <label class="form-label mono text-xs">
                  <span class="material-symbols-outlined text-[14px] text-indigo-600 align-middle me-1">electric_bolt</span>
                  {{ locale === 'ar' ? 'سعة السلك (Wire Capacity)' : 'Wire Capacity' }}
                  <span class="text-xs text-slate-400 font-normal ms-1">({{ t('common.optional') }})</span>
                </label>
                <input
                  v-model="form.wireCapacity"
                  type="text"
                  class="form-input text-xs"
                  :placeholder="locale === 'ar' ? 'مثال: Up to 1.5mm' : 'e.g. Up to 1.5mm'"
                />
              </div>
              <div class="form-group mb-0">
                <label class="form-label mono text-xs">
                  <span class="material-symbols-outlined text-[14px] text-amber-600 align-middle me-1">content_cut</span>
                  {{ locale === 'ar' ? 'سعة قطع السلك (Wire Cutting Capacity)' : 'Wire Cutting Capacity' }}
                  <span class="text-xs text-slate-400 font-normal ms-1">({{ t('common.optional') }})</span>
                </label>
                <input
                  v-model="form.wireCuttingCapacity"
                  type="text"
                  class="form-input text-xs"
                  :placeholder="locale === 'ar' ? 'مثال: Up to 2.2mm soft wire' : 'e.g. Up to 2.2mm soft wire'"
                />
              </div>
            </div>
          </div>

          <!-- Product Images Section -->
          <input
            ref="multiImageInput"
            type="file"
            multiple
            accept="image/*"
            class="hidden"
            @change="onMultipleFilesSelected"
          />

          <div class="product-media-card">
            <!-- Header with Title, Rule note, and Status Badge -->
            <div class="media-card-header">
              <div class="media-header-title">
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-teal-600 dark:text-teal-400 text-[20px]">photo_library</span>
                  <label class="form-label mono mb-0 text-sm font-bold text-slate-900 dark:text-slate-100">
                    {{ t('admin.productImagesReq') }} <span class="req">*</span>
                  </label>
                </div>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {{ locale === 'ar' ? 'يجب رفع 3 صور على الأقل للمنتج (PNG, JPG, WebP)' : 'Upload at least 3 photos of the product (PNG, JPG, WebP)' }}
                </p>
              </div>

              <!-- Compliance Status Badge -->
              <div class="flex items-center gap-2">
                <span
                  class="media-status-badge"
                  :class="uploadedImagesCount >= 3 ? 'media-status-badge--success' : 'media-status-badge--warning'"
                >
                  <span class="material-symbols-outlined text-[15px]">
                    {{ uploadedImagesCount >= 3 ? 'check_circle' : 'pending' }}
                  </span>
                  <span>
                    {{ uploadedImagesCount >= 3
                      ? (locale === 'ar' ? `✓ مكتمل (${uploadedImagesCount} صور)` : `✓ ${uploadedImagesCount} Photos Compliant`)
                      : (locale === 'ar' ? `${uploadedImagesCount} من 3 صور (مطلوب 3 كحد أدنى)` : `${uploadedImagesCount} / 3 Photos (Min 3 Required)`) }}
                  </span>
                </span>

                <!-- Quick URL toggle button -->
                <button
                  type="button"
                  class="btn-media-action"
                  :title="locale === 'ar' ? 'إضافة رابط صورة' : 'Add image URL'"
                  @click="showUrlInputModal = !showUrlInputModal"
                >
                  <span class="material-symbols-outlined text-[15px]">link</span>
                  <span>{{ locale === 'ar' ? 'رابط' : 'URL' }}</span>
                </button>
              </div>
            </div>

            <!-- Optional URL input bar -->
            <div v-if="showUrlInputModal" class="media-url-bar">
              <input
                v-model="directImageUrl"
                type="url"
                class="form-input text-xs flex-1"
                :placeholder="locale === 'ar' ? 'أدخل رابط الصورة المباشر...' : 'Enter direct image URL...'"
                @keydown.enter.prevent="addDirectImageUrl"
              />
              <button type="button" class="btn-primary-sm" @click="addDirectImageUrl">
                {{ locale === 'ar' ? 'إضافة' : 'Add' }}
              </button>
              <button type="button" class="btn-secondary-sm" @click="showUrlInputModal = false">
                {{ t('common.cancel') }}
              </button>
            </div>

            <!-- Upload Dropzone -->
            <div
              class="media-dropzone"
              :class="{ 'media-dropzone--active': isDraggingOverImages }"
              @dragover.prevent="isDraggingOverImages = true"
              @dragleave.prevent="isDraggingOverImages = false"
              @drop.prevent="onDropImages"
              @click="triggerMultiImagePick"
            >
              <div class="dropzone-content">
                <div class="dropzone-icon-circle">
                  <span v-if="uploadingImages" class="material-symbols-outlined text-[24px] animate-spin text-teal-600">
                    progress_activity
                  </span>
                  <span v-else class="material-symbols-outlined text-[24px] text-teal-600">
                    cloud_upload
                  </span>
                </div>
                <div class="dropzone-text">
                  <p class="dropzone-title">
                    <span v-if="uploadingImages">
                      {{ locale === 'ar' ? 'جاري رفع الصور...' : 'Uploading images...' }} {{ uploadProgressText }}
                    </span>
                    <span v-else>
                      <strong class="text-teal-600 font-semibold">{{ locale === 'ar' ? 'انقر لاختيار الصور' : 'Click to select photos' }}</strong>
                      {{ locale === 'ar' ? ' أو اسحب الملفات هنا' : ' or drag and drop files here' }}
                    </span>
                  </p>
                  <p class="dropzone-subtitle">
                    {{ locale === 'ar' ? 'يمكنك اختيار عدة صور دفعة واحدة (PNG, JPG, WebP بحد أقصى 5MB لكل صورة)' : 'Select multiple photos at once (PNG, JPG, WebP up to 5MB each)' }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Uploaded Images Gallery Grid -->
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

                <!-- Cover badge on 1st image -->
                <div v-if="idx === 0" class="media-cover-badge">
                  <span class="material-symbols-outlined text-[13px]">star</span>
                  <span>{{ locale === 'ar' ? 'الرئيسية' : 'Cover' }}</span>
                </div>
                <div v-else class="media-order-pill">
                  #{{ idx + 1 }}
                </div>

                <!-- Hover actions overlay -->
                <div class="media-thumb-overlay">
                  <div class="thumb-overlay-top">
                    <button
                      v-if="idx > 0"
                      type="button"
                      class="btn-overlay-action btn-set-cover"
                      :title="locale === 'ar' ? 'تعيين كصورة رئيسية' : 'Set as primary cover'"
                      @click="setCoverImage(idx)"
                    >
                      <span class="material-symbols-outlined text-[14px]">star</span>
                      <span>{{ locale === 'ar' ? 'غلاف' : 'Cover' }}</span>
                    </button>
                    <span v-else></span>

                    <button
                      type="button"
                      class="btn-overlay-action btn-delete-thumb"
                      :title="locale === 'ar' ? 'حذف الصورة' : 'Remove photo'"
                      @click="removeImage(idx)"
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

              <!-- Compact Add Button at end of grid -->
              <button
                type="button"
                class="media-thumb-add-tile"
                @click="triggerMultiImagePick"
              >
                <span class="material-symbols-outlined text-[22px] text-teal-600 mb-1">add_photo_alternate</span>
                <span class="text-[11px] font-bold text-slate-700 dark:text-slate-300">{{ locale === 'ar' ? '+ إضافة صور' : '+ Add Photos' }}</span>
              </button>
            </div>
          </div>

          <!-- Product Videos Section -->
          <input
            ref="videoFileInput"
            type="file"
            accept="video/mp4,video/webm,video/ogg,video/quicktime"
            class="hidden"
            @change="onVideoFileSelected"
          />

          <div class="product-media-card mt-4">
            <!-- Header -->
            <div class="media-card-header">
              <div class="media-header-title">
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-rose-600 dark:text-rose-400 text-[20px]">smart_display</span>
                  <label class="form-label mono mb-0 text-sm font-bold text-slate-900 dark:text-slate-100">
                    {{ t('admin.productVideos') }}
                    <span class="text-xs text-slate-400 font-normal ms-1">({{ t('common.optional') }})</span>
                  </label>
                </div>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {{ locale === 'ar' ? 'رفع فيديو توضيحي للمنتج (MP4, WebM) أو إضافة رابط خارجي' : 'Upload product demonstration videos (MP4, WebM) or add video links' }}
                </p>
              </div>

              <div class="flex items-center gap-2">
                <span v-if="form.videos.length > 0" class="media-count-pill">
                  {{ form.videos.length }} {{ locale === 'ar' ? 'فيديو' : 'Videos' }}
                </span>

                <!-- Quick Link toggle button -->
                <button
                  type="button"
                  class="btn-media-action"
                  :title="locale === 'ar' ? 'إضافة رابط فيديو' : 'Add video link'"
                  @click="showVideoUrlModal = !showVideoUrlModal"
                >
                  <span class="material-symbols-outlined text-[15px]">link</span>
                  <span>{{ locale === 'ar' ? 'رابط خارجي' : 'Video Link' }}</span>
                </button>
              </div>
            </div>

            <!-- Optional Video Link Input Bar -->
            <div v-if="showVideoUrlModal" class="media-url-bar">
              <input
                v-model="newVideoUrl"
                type="url"
                class="form-input text-xs flex-1"
                :placeholder="locale === 'ar' ? 'رابط الفيديو (YouTube, Vimeo, أو MP4 مباشر)...' : 'Video URL (YouTube, Vimeo, or MP4 link)...'"
                @keydown.enter.prevent="addVideoItem"
              />
              <input
                v-model="newVideoTitle"
                type="text"
                class="form-input text-xs md:w-44"
                :placeholder="locale === 'ar' ? 'العنوان (اختياري)' : 'Title (optional)'"
                @keydown.enter.prevent="addVideoItem"
              />
              <button type="button" class="btn-primary-sm" :disabled="!newVideoUrl.trim()" @click="addVideoItem">
                {{ locale === 'ar' ? 'إضافة' : 'Add' }}
              </button>
              <button type="button" class="btn-secondary-sm" @click="showVideoUrlModal = false">
                {{ t('common.cancel') }}
              </button>
            </div>

            <!-- Video File Dropzone -->
            <div
              class="media-dropzone media-dropzone--video"
              :class="{ 'media-dropzone--active': isDraggingOverVideos }"
              @dragover.prevent="isDraggingOverVideos = true"
              @dragleave.prevent="isDraggingOverVideos = false"
              @drop.prevent="onDropVideos"
              @click="!uploadingVideo && triggerVideoFileInput()"
            >
              <div class="dropzone-content">
                <div class="dropzone-icon-circle dropzone-icon-circle--rose">
                  <span v-if="uploadingVideo" class="material-symbols-outlined text-[24px] animate-spin text-rose-600">
                    progress_activity
                  </span>
                  <span v-else class="material-symbols-outlined text-[24px] text-rose-600">
                    video_file
                  </span>
                </div>
                <div class="dropzone-text w-full max-w-sm">
                  <template v-if="uploadingVideo">
                    <p class="dropzone-title font-semibold text-rose-700 dark:text-rose-400">
                      {{ locale === 'ar' ? 'جاري رفع الفيديو إلى الخادم...' : 'Uploading video to server...' }}
                      <span class="ms-1 font-mono">({{ attachmentService.progress.value }}%)</span>
                    </p>
                    <p class="text-[11px] text-slate-500 font-mono mt-0.5 truncate">
                      {{ uploadingVideoFileName }} ({{ uploadingVideoSizeMb }} MB)
                    </p>
                    <!-- Real-time Progress Bar -->
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
                      {{ locale === 'ar' ? ' أو اسحب الملف هنا' : ' or drag and drop video here' }}
                    </p>
                    <p class="dropzone-subtitle">
                      {{ locale === 'ar' ? 'يدعم MP4, WebM (بحد أقصى 100MB — ينصح بضغط الفيديو لسرعة الرفع)' : 'Supports MP4, WebM (up to 100MB — compressed videos upload faster)' }}
                    </p>
                  </template>
                </div>
              </div>
            </div>

            <!-- Uploaded Videos List -->
            <div v-if="form.videos.length > 0" class="videos-card-list">
              <div
                v-for="(vid, vIdx) in form.videos"
                :key="vIdx"
                class="video-card-item"
              >
                <div class="video-card-main">
                  <!-- Video Icon / Provider -->
                  <div
                    class="video-card-badge"
                    :class="vid.provider === 'youtube' ? 'bg-red-600' : vid.provider === 'vimeo' ? 'bg-sky-500' : 'bg-rose-600'"
                  >
                    <span class="material-symbols-outlined text-[18px] text-white">
                      {{ vid.provider === 'youtube' ? 'play_arrow' : vid.provider === 'vimeo' ? 'movie' : 'videocam' }}
                    </span>
                  </div>

                  <!-- Details -->
                  <div class="video-card-info">
                    <div class="flex items-center gap-2">
                      <strong class="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                        {{ vid.title || (locale === 'ar' ? `فيديو ${vIdx + 1}` : `Video ${vIdx + 1}`) }}
                      </strong>
                      <span v-if="vIdx === 0" class="video-primary-badge">
                        {{ locale === 'ar' ? 'الرئيسي' : 'Primary' }}
                      </span>
                    </div>
                    <p class="text-[11px] font-mono text-slate-400 dark:text-slate-500 truncate mt-0.5">
                      {{ vid.url }}
                    </p>
                  </div>

                  <!-- Actions -->
                  <div class="video-card-actions">
                    <button
                      type="button"
                      class="btn-video-preview"
                      @click="toggleVideoPreview(vIdx)"
                    >
                      <span class="material-symbols-outlined text-[15px]">
                        {{ previewVideoIdx === vIdx ? 'visibility_off' : 'visibility' }}
                      </span>
                      <span>{{ previewVideoIdx === vIdx ? (locale === 'ar' ? 'إخفاء' : 'معاينة') : (locale === 'ar' ? 'معاينة' : 'Preview') }}</span>
                    </button>

                    <button
                      v-if="vIdx > 0"
                      type="button"
                      class="btn-video-primary"
                      :title="locale === 'ar' ? 'تعيين كفيديو رئيسي' : 'Make primary'"
                      @click="setPrimaryVideo(vIdx)"
                    >
                      <span class="material-symbols-outlined text-[16px]">vertical_align_top</span>
                    </button>

                    <button
                      type="button"
                      class="btn-video-delete"
                      :title="locale === 'ar' ? 'حذف الفيديو' : 'Delete video'"
                      @click="removeVideoItem(vIdx)"
                    >
                      <span class="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                </div>

                <!-- Video player inside card -->
                <div v-if="previewVideoIdx === vIdx" class="video-player-container">
                  <iframe
                    v-if="parseVideoSource(vid.url).type === 'youtube' || parseVideoSource(vid.url).type === 'vimeo'"
                    :src="parseVideoSource(vid.url).embedUrl"
                    class="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowfullscreen
                  ></iframe>
                  <video
                    v-else
                    :src="resolveFileUrl(vid.url)"
                    controls
                    class="w-full h-full object-contain"
                  ></video>
                </div>
              </div>
            </div>
          </div>

          <div class="form-grid-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <div class="form-group mb-0">
              <label class="form-checkbox-label">
                <input v-model="form.isActive" type="checkbox" class="form-checkbox" />
                <span class="mono">{{ t('admin.productActive') }}</span>
              </label>
            </div>
            <div class="form-group mb-0">
              <label class="form-checkbox-label">
                <input v-model="form.isMostSelling" type="checkbox" class="form-checkbox" />
                <span class="mono font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <span class="material-symbols-outlined text-[16px]">local_fire_department</span>
                  {{ locale === 'ar' ? 'منتج أكثر مبيعاً (Most Selling)' : 'Most Selling Product' }}
                </span>
              </label>
              <p class="text-[11px] text-slate-500 ms-6 mt-0.5">
                {{ locale === 'ar' ? 'يظهر المنتج بشكل مميز في قسم الأكثر مبيعاً بالصفحة الرئيسية' : 'Displays this product in the Most Selling showcase on the homepage' }}
              </p>
            </div>
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

/* ── Product Specifications Card ── */
.product-specs-card {
  background: var(--wl-surface-subtle, #f8fafc);
  border: 1px solid var(--wl-border, #e2e8f0);
  border-radius: 12px;
  padding: 16px;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
}

/* ── Modern Clinical Media Cards ── */
.product-media-card {
  background: var(--wl-surface-subtle, #f8fafc);
  border: 1px solid var(--wl-border, #e2e8f0);
  border-radius: 12px;
  padding: 16px;
  transition: all 0.2s ease;
}

.media-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.media-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 9999px;
}

.media-status-badge--success {
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
}

.media-status-badge--warning {
  background: #fffbeb;
  color: #b45309;
  border: 1px solid #fde68a;
}

.btn-media-action {
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

.btn-media-action:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.media-url-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: var(--wl-surface, #ffffff);
  border: 1px solid var(--wl-border, #e2e8f0);
  border-radius: 8px;
  margin-bottom: 12px;
}

.btn-primary-sm {
  padding: 6px 12px;
  font-size: 11.5px;
  font-weight: 600;
  border-radius: 6px;
  background: #0d9488;
  color: #ffffff;
  border: none;
  cursor: pointer;
}

.btn-primary-sm:hover:not(:disabled) {
  background: #0f766e;
}

.btn-secondary-sm {
  padding: 6px 10px;
  font-size: 11.5px;
  font-weight: 500;
  border-radius: 6px;
  background: transparent;
  color: #64748b;
  border: none;
  cursor: pointer;
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

.media-dropzone:hover,
.media-dropzone--active {
  border-color: #0d9488;
  background: #f0fdfa;
}

.media-dropzone--video:hover,
.media-dropzone--video.media-dropzone--active {
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

/* ── Videos Card List ── */
.videos-card-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
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

.video-primary-badge {
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fde68a;
  font-size: 9.5px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 3px;
}

.video-card-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.btn-video-preview {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid var(--wl-border, #e2e8f0);
  background: var(--wl-surface, #ffffff);
  color: var(--wl-ink-soft, #475569);
  border-radius: 6px;
  cursor: pointer;
}

.btn-video-preview:hover {
  background: #f1f5f9;
}

.btn-video-primary {
  padding: 4px 6px;
  border: none;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  border-radius: 4px;
}

.btn-video-primary:hover {
  color: #d97706;
}

.btn-video-delete {
  padding: 4px 6px;
  border: none;
  background: transparent;
  color: #ef4444;
  cursor: pointer;
  border-radius: 4px;
}

.btn-video-delete:hover {
  background: #fee2e2;
}

.video-player-container {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--wl-border, #e2e8f0);
  aspect-ratio: 16 / 9;
  max-width: 500px;
  margin-inline: auto;
  background: #000000;
  border-radius: 6px;
  overflow: hidden;
}
</style>
