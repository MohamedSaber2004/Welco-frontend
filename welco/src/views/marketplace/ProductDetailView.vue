<script setup lang="ts">
import { ref, onMounted, computed, watch, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { t, locale } from '../../i18n'
import { services, authService } from '../../di/container'
import type { ProductDto } from '../../domain/models/marketplace'
import { useCart } from '../../composables/useCart'
import { useWishlist } from '../../composables/useWishlist'
import type { CompanyDto } from '../../domain/models/company'
import { toastService } from '../../infrastructure/feedback/toast.service'
import SkeletonLoader from '../../components/ui/SkeletonLoader.vue'
import DataState from '../../components/ui/DataState.vue'
import BackButton from '../../components/ui/BackButton.vue'
import BaseModal from '../../components/ui/BaseModal.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import AppImage from '../../components/ui/AppImage.vue'
import { resolveFileUrl, PLACEHOLDER, PLACEHOLDER_PNG, parseVideoSource } from '../../utils/file-url'
import { formatPrice } from '../../utils/format'

const route = useRoute()
const router = useRouter()
const { add, targetCurrency, setTargetCurrency } = useCart()

const product = ref<ProductDto | null>(null)
const loading = ref(true)
const imageFailed = ref(false)
const inspectModalOpen = ref(false)
const qty = ref(1)
const related = ref<ProductDto[]>([])
const activeTab = ref<'specs' | 'videos'>('specs')

/* Providers offering this same SKU (any of their listings). */
const offeredBy = ref<{ company: CompanyDto; listing: ProductDto }[]>([])
const offeredLoading = ref(false)
const isCurrentListing = (listingId: string): boolean => listingId === product.value?.id
const loadOfferedBy = async () => {
  const sku = product.value?.sku?.trim()
  if (!sku) {
    offeredBy.value = []
    return
  }
  offeredLoading.value = true
  try {
    const list = await services.marketplaceRepository.getSkuProviders(sku)
    const clean: { company: CompanyDto; listing: ProductDto }[] = []
    for (const e of list || []) {
      if (e && e.company && e.listing) clean.push({ company: e.company, listing: e.listing })
    }
    offeredBy.value = clean
  } catch {
    offeredBy.value = []
  } finally {
    offeredLoading.value = false
  }
}

// Inquiry form state
const inquiryName = ref('')
const inquiryOrg = ref('')
const inquiryEmail = ref('')
const inquiryMsg = ref('')
const inquirySending = ref(false)

function initInquiryUser() {
  if (authService.isAuthenticated && authService.user.value) {
    const u = authService.user.value
    if (!inquiryName.value) {
      inquiryName.value = u.fullName || ''
    }
    if (!inquiryEmail.value && u.email) {
      inquiryEmail.value = u.email
    }
    if (!inquiryOrg.value && u.company) {
      inquiryOrg.value = u.company.name || ''
    }
  }
}

const { isSaved, toggleSave, canEditWishlist } = useWishlist()
const rfqListIds = ref<string[]>(
  typeof window !== 'undefined' ? (JSON.parse(localStorage.getItem('welco-rfq-list') || '[]') as string[]) : [],
)

const localized = (en?: string | null, ar?: string | null) =>
  locale.value === 'ar' ? ar || en || '' : en || ar || ''

const pushRecentlyViewed = (p: ProductDto) => {
  try {
    const key = 'welco-recently-viewed'
    const raw = JSON.parse(localStorage.getItem(key) || '[]') as string[]
    const ids = [p.id, ...raw.filter((x) => x !== p.id)].slice(0, 8)
    localStorage.setItem(key, JSON.stringify(ids))
    const mapRaw = JSON.parse(localStorage.getItem('welco-recently-viewed-map') || '{}') as Record<string, unknown>
    ;(mapRaw as Record<string, ProductDto>)[p.id] = p
    localStorage.setItem('welco-recently-viewed-map', JSON.stringify(mapRaw))
  } catch {}
}

const loadProductData = async (id: string) => {
  loading.value = true
  imageFailed.value = false
  inspectModalOpen.value = false
  try {
    void services.marketplaceService.loadCurrencies().catch(() => {})
    void services.exchangeRateService.loadLatest('USD').catch(() => {})
    const p = await services.marketplaceService.getProduct(id)
    product.value = p
    if (p) {
      pushRecentlyViewed(p)
      qty.value = p.minOrderQty || 1
      void loadOfferedBy()

      // 1. Related products
      if (p.categoryId) {
        try {
          const page = await services.marketplaceRepository.getProducts({
            categoryId: p.categoryId,
            page: 1,
            pageSize: 6,
          })
          related.value = page.data.filter((item) => item.id !== p.id).slice(0, 3)
        } catch {
          related.value = []
        }
      }
      if (!related.value.length) {
        try {
          const page = await services.marketplaceRepository.getProducts({
            page: 1,
            pageSize: 6,
          })
          related.value = page.data.filter((item) => item.id !== p.id).slice(0, 3)
        } catch {
          related.value = []
        }
      }

      // 2. Clinical videos
      void loadProductVideos(p.id)
    }
  } catch (e) {
    console.error('Failed to load product', e)
    product.value = null
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadProductData(String(route.params.id))
  void services.contentService.loadSupportContact()
  initInquiryUser()
})

watch(
  () => authService.user.value,
  () => {
    initInquiryUser()
  },
  { immediate: true },
)

watch(
  () => route.params.id,
  (newId) => {
    if (newId) void loadProductData(String(newId))
  },
)

// Multi-image gallery state
const selectedImageIndex = ref(0)

const galleryImages = computed<string[]>(() => {
  if (!product.value) return []
  const list: string[] = []
  if (Array.isArray(product.value.images)) {
    for (const item of product.value.images) {
      if (item && typeof item === 'string' && item.trim()) {
        const clean = item.trim()
        if (!list.includes(clean)) list.push(clean)
      }
    }
  }
  if (product.value.imageName && typeof product.value.imageName === 'string') {
    const clean = product.value.imageName.trim()
    if (clean && !list.includes(clean)) {
      list.unshift(clean)
    }
  }
  return list
})

const activeImageName = computed(() => {
  if (!galleryImages.value.length) return null
  return galleryImages.value[selectedImageIndex.value] || galleryImages.value[0] || null
})

// Computed image URL with robust fallback verification
const productImageUrl = computed(() => {
  if (!activeImageName.value || imageFailed.value) return null
  const resolved = resolveFileUrl(activeImageName.value)
  if (!resolved || resolved === PLACEHOLDER || resolved === PLACEHOLDER_PNG) return null
  return resolved
})

const onImageError = () => {
  imageFailed.value = true
}

const selectImage = (idx: number) => {
  selectedImageIndex.value = idx
  imageFailed.value = false
}

const availableCurrencies = computed(() => services.marketplaceService.currencies.value)

const onCurrencySelectChange = () => {
  setTargetCurrency(targetCurrency.value)
}

const conversionRate = ref(1)

const updateConversionRate = async () => {
  if (!product.value) {
    conversionRate.value = 1
    return
  }
  const baseCur = (product.value.currencyCode || product.value.currency || 'USD').toUpperCase()
  const targetCur = (targetCurrency.value || 'USD').toUpperCase()
  if (baseCur === targetCur) {
    conversionRate.value = 1
    return
  }
  try {
    const rate = await services.exchangeRateService.getRate(baseCur, targetCur)
    if (typeof rate === 'number' && rate > 0) {
      conversionRate.value = rate
    } else {
      conversionRate.value = 1
    }
  } catch {
    conversionRate.value = 1
  }
}

watch([targetCurrency, product], () => {
  void updateConversionRate()
}, { immediate: true })

const displayPrice = computed(() => {
  if (!product.value) return 0
  const basePrice = product.value.price || 0
  const baseCur = (product.value.currencyCode || product.value.currency || 'USD').toUpperCase()
  const targetCur = (targetCurrency.value || 'USD').toUpperCase()
  if (baseCur === targetCur) return basePrice
  const rate = conversionRate.value
  if (rate && rate > 0) {
    return Math.round(basePrice * rate * 100) / 100
  }
  return basePrice
})

const activeCurrencySymbol = computed(() => {
  const targetCur = (targetCurrency.value || 'USD').toUpperCase()
  const c = availableCurrencies.value.find((x) => (x.code || '').toUpperCase() === targetCur)
  return c?.symbolNative || c?.symbol || targetCur
})

const currencySymbol = computed(() => activeCurrencySymbol.value)

interface ParsedSpecifications {
  bullets: string[]
  wireCapacity?: string
  wireCuttingCapacity?: string
}

const parsedSpecs = computed<ParsedSpecifications>(() => {
  const res: ParsedSpecifications = {
    bullets: [],
    wireCapacity: product.value?.wireCapacity || undefined,
    wireCuttingCapacity: product.value?.wireCuttingCapacity || undefined,
  }
  const raw = product.value?.specifications?.trim()
  if (!raw) return res

  if (raw.startsWith('{') && raw.endsWith('}')) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      if (typeof parsed.wireCapacity === 'string' && parsed.wireCapacity.trim()) {
        res.wireCapacity = parsed.wireCapacity.trim()
      }
      if (typeof parsed.wireCuttingCapacity === 'string' && parsed.wireCuttingCapacity.trim()) {
        res.wireCuttingCapacity = parsed.wireCuttingCapacity.trim()
      }
      if (Array.isArray(parsed.bullets)) {
        res.bullets.push(...parsed.bullets.map((b) => String(b).trim()).filter(Boolean))
      }
      if (typeof parsed.specification === 'string' && parsed.specification.trim()) {
        const lines = parsed.specification.split(/[\r\n]+/).map((l) => l.replace(/^[-*•\d.]+\s*/, '').trim()).filter(Boolean)
        res.bullets.push(...lines)
      }
      return res
    } catch {
      // not JSON, fallback to line parsing
    }
  }

  const lines = raw.split(/[\r\n]+/)
  for (const line of lines) {
    const clean = line.replace(/^[-*•\d.]+\s*/, '').trim()
    if (!clean) continue
    const lower = clean.toLowerCase()
    if (lower.startsWith('wire capacity:') || lower.startsWith('wire capacity :') || lower.startsWith('سعة السلك:')) {
      res.wireCapacity = clean.split(':')[1]?.trim() || clean
    } else if (lower.startsWith('wire cutting capacity:') || lower.startsWith('wire cutting capacity :') || lower.startsWith('سعة قطع السلك:')) {
      res.wireCuttingCapacity = clean.split(':')[1]?.trim() || clean
    } else {
      res.bullets.push(clean)
    }
  }
  return res
})

const hasSpecifications = computed(() => {
  return parsedSpecs.value.bullets.length > 0 || Boolean(parsedSpecs.value.wireCapacity) || Boolean(parsedSpecs.value.wireCuttingCapacity)
})

// ── Interactive High-Resolution Inspection Zoom & Pan ──
const zoomLevel = ref(1.0)
const panX = ref(0)
const panY = ref(0)
const isDragging = ref(false)
const dragStartX = ref(0)
const dragStartY = ref(0)

const zoomIn = () => {
  zoomLevel.value = Math.min(3.5, Math.round((zoomLevel.value + 0.3) * 10) / 10)
}
const zoomOut = () => {
  zoomLevel.value = Math.max(1.0, Math.round((zoomLevel.value - 0.3) * 10) / 10)
  if (zoomLevel.value === 1.0) {
    panX.value = 0
    panY.value = 0
  }
}
const resetZoom = () => {
  zoomLevel.value = 1.0
  panX.value = 0
  panY.value = 0
}

const onInspectWheel = (e: WheelEvent) => {
  if (e.deltaY < 0) {
    zoomIn()
  } else {
    zoomOut()
  }
}

const onPanStart = (e: MouseEvent) => {
  if (zoomLevel.value <= 1.0) return
  isDragging.value = true
  dragStartX.value = e.clientX - panX.value
  dragStartY.value = e.clientY - panY.value
}
const onPanMove = (e: MouseEvent) => {
  if (!isDragging.value || zoomLevel.value <= 1.0) return
  panX.value = e.clientX - dragStartX.value
  panY.value = e.clientY - dragStartY.value
}
const onPanEnd = () => {
  isDragging.value = false
}

watch(inspectModalOpen, (open) => {
  if (!open) {
    resetZoom()
  }
})

const onQtyChange = () => {
  if (!product.value) return
  const min = product.value.minOrderQty || 1
  const max = product.value.stock > 0 ? product.value.stock : 9999
  if (typeof qty.value !== 'number' || isNaN(qty.value) || qty.value < min) {
    qty.value = min
  } else if (qty.value > max) {
    qty.value = max
  }
}

const stockLabel = computed(() => {
  if (!product.value) return ''
  if (product.value.stock === 0) return t('marketplace.outOfStock')
  if (product.value.stock <= 5) return t('marketplace.lowStock')
  return t('marketplace.inStock')
})

const stockStatusClass = computed(() => {
  if (!product.value) return 'stock-badge--muted'
  if (product.value.stock === 0) return 'stock-badge--out'
  if (product.value.stock <= 5) return 'stock-badge--low'
  return 'stock-badge--in'
})

const handleAdd = () => {
  if (!product.value) return
  const min = product.value.minOrderQty || 1
  if (qty.value < min) qty.value = min
  add(product.value, qty.value)
  toastService.success(
    t('catalog.quoteSuccess', { product: localized(product.value.nameEn, product.value.nameAr) }),
  )
}

const handleAddAndGoCart = () => {
  handleAdd()
  void router.push({ name: 'cart' })
}

const waHref = computed(() => {
  if (!product.value) return ''
  const num = services.contentService.supportContact.value?.whatsAppNumber || ''
  const clean = num.replace(/\D/g, '')
  if (!clean) return ''
  const msg = t('pdp.waMessage', {
    name: localized(product.value.nameEn, product.value.nameAr),
    sku: product.value.sku,
    qty: String(qty.value),
  } as never)
  return `https://wa.me/${clean}?text=${encodeURIComponent(msg)}`
})

const isInRfqList = computed(() => (product.value ? rfqListIds.value.includes(product.value.id) : false))
function toggleRfqList() {
  if (!product.value) return
  const id = product.value.id
  if (rfqListIds.value.includes(id)) {
    rfqListIds.value = rfqListIds.value.filter((x) => x !== id)
    toastService.success(t('pdp.removedRfq'))
  } else {
    rfqListIds.value = [...rfqListIds.value, id]
    toastService.success(t('pdp.addedRfq'))
  }
  localStorage.setItem('welco-rfq-list', JSON.stringify(rfqListIds.value))
}

async function sendInquiry() {
  if (!authService.isAuthenticated) {
    toastService.info(t('pdp.loginRequiredForInquiry'))
    void router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }
  if (!inquiryName.value.trim() || !inquiryMsg.value.trim()) {
    toastService.error(t('common.error'))
    return
  }
  if (!product.value) return
  inquirySending.value = true
  try {
    const res = await services.salesService.createProductInquiry(
      product.value.id,
      inquiryName.value.trim(),
      inquiryOrg.value.trim() || 'Institutional Buyer',
      inquiryMsg.value.trim(),
      inquiryEmail.value.trim() || undefined,
    )
    if (res.ok) {
      inquiryName.value = ''
      inquiryOrg.value = ''
      inquiryEmail.value = ''
      inquiryMsg.value = ''
      initInquiryUser()
      toastService.success(t('common.operationDone'))
    } else {
      toastService.error(res.error || t('common.error'))
    }
  } catch {
    toastService.error(t('common.error'))
  } finally {
    inquirySending.value = false
  }
}

interface VideoItem {
  id?: string
  title: string
  url: string
  thumbnail?: string
}

const videoItems = ref<VideoItem[]>([])
const activeVideo = ref<VideoItem | null>(null)
const selectedVideoIdx = ref(0)
const currentFeaturedVideo = computed(() => videoItems.value[selectedVideoIdx.value] || videoItems.value[0] || null)

const extractYouTubeId = (url: string): string | null => {
  const m = url.match(
    /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i,
  )
  return m ? m[1] ?? null : null
}

const extractVimeoId = (url: string): string | null => {
  const m = url.match(/vimeo\.com\/(?:video\/)(\d+)/i)
  return m ? m[1] ?? null : null
}

const fetchVideoThumbnail = async (item: VideoItem): Promise<string | undefined> => {
  const parsed = parseVideoSource(item.url)
  if (parsed.type === 'youtube') {
    const ytId = extractYouTubeId(item.url)
    return ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : undefined
  }
  if (parsed.type === 'vimeo') {
    try {
      const vid = extractVimeoId(item.url)
      if (!vid) return undefined
      const r = await fetch(`https://vimeo.com/api/v2/video/${vid}.json`)
      const json = (await r.json()) as { thumbnail_large?: string }[]
      return json?.[0]?.thumbnail_large
    } catch {
      return undefined
    }
  }
  return new Promise<string | undefined>((resolve) => {
    const tmp = document.createElement('video')
    tmp.src = parsed.src
    tmp.muted = true
    tmp.preload = 'auto'
    tmp.crossOrigin = 'anonymous'
    let done = false
    const finish = (url: string | undefined) => {
      if (done) return
      done = true
      try {
        tmp.pause()
        URL.revokeObjectURL(url || '')
      } catch {}
      resolve(url)
    }
    tmp.addEventListener(
      'loadeddata',
      () => {
        tmp.currentTime = 1
      },
      { once: true },
    )
    tmp.addEventListener(
      'seeked',
      () => {
        try {
          const c = document.createElement('canvas')
          c.width = 480
          c.height = 270
          c.getContext('2d')!.drawImage(tmp, 0, 0, c.width, c.height)
          finish(c.toDataURL('image/jpeg', 0.82))
        } catch {
          finish(undefined)
        }
      },
      { once: true },
    )
    tmp.addEventListener('error', () => finish(undefined))
    setTimeout(() => finish(undefined), 6000)
  })
}

const loadProductVideos = async (productId: string) => {
  try {
    let media = await services.marketplaceService.getProductVideos(productId).catch(() => [] as import('../../domain/models/marketplace').ProductMediaDto[])
    if (!media.length && product.value?.videos?.length) {
      media = product.value.videos
    }
    if (!media.length && product.value?.videoUrl) {
      media = [{ productId, type: 2, url: product.value.videoUrl, sortOrder: 0, title: t('pdp.tabVideos') }]
    }
    const isCleanTitle = (t?: string) => {
      if (!t || !t.trim()) return false
      const trimmed = t.trim()
      if (trimmed.match(/\.(mp4|webm|mov|avi|mkv)$/i)) return false
      if (trimmed.match(/^[a-f0-9-]{12,}$/i)) return false
      if (trimmed.match(/^\d+_[a-f0-9]{12,}/i)) return false
      return true
    }

    const items: VideoItem[] = media.map((m, idx) => ({
      id: m.id || `video-${idx}`,
      title: isCleanTitle(m.title)
        ? m.title!
        : `${locale.value === 'ar' ? 'فيديو توضيحي' : 'Demonstration Video'}${media.length > 1 ? ` (${idx + 1})` : ''}`,
      url: m.url,
      thumbnail: '',
    }))
    for (const item of items) {
      item.thumbnail = await fetchVideoThumbnail(item)
    }
    videoItems.value = items
    selectedVideoIdx.value = 0
  } catch {
    videoItems.value = []
    selectedVideoIdx.value = 0
  }
}

const onVideosUpdated = (e: Event) => {
  const custom = e as CustomEvent<{ productId: string }>
  if (custom.detail?.productId === product.value?.id) {
    void loadProductVideos(product.value.id)
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('welco:product-videos-updated', onVideosUpdated)
}

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('welco:product-videos-updated', onVideosUpdated)
  }
})

// Description helper: reads either description, descriptionEn, or descriptionAr
const resolvedDescription = computed(() => {
  if (!product.value) return ''
  const p = product.value as ProductDto & { description?: string }
  if (locale.value === 'ar') {
    return p.descriptionAr || p.description || p.descriptionEn || ''
  }
  return p.descriptionEn || p.description || p.descriptionAr || ''
})
</script>

<template>
  <div class="page-shell pdp-view">
    <BackButton />

    <!-- Breadcrumb -->
    <nav class="breadcrumb mono" :aria-label="t('common.breadcrumb')">
      <router-link to="/">{{ t('nav.home') }}</router-link>
      <span class="sep">/</span>
      <router-link to="/marketplace">{{ t('nav.marketplace') }}</router-link>
      <template v-if="product?.categoryNameEn || product?.categoryNameAr">
        <span class="sep">/</span>
        <router-link
          :to="{ name: 'marketplace', query: { categoryId: product.categoryId } }"
          class="crumb-cat"
        >
          {{ localized(product.categoryNameEn, product.categoryNameAr) }}
        </router-link>
      </template>
      <span class="sep">/</span>
      <span class="current-crumb" dir="auto">
        {{ product ? localized(product.nameEn, product.nameAr) : '...' }}
      </span>
    </nav>

    <!-- Loading State -->
    <SkeletonLoader v-if="loading" type="pdp" :count="1" />

    <!-- Not Found State -->
    <DataState
      v-else-if="!product"
      :empty="true"
      :empty-title="t('pdp.notFoundTitle')"
      :empty-description="t('pdp.notFoundDesc')"
      @action="router.push({ name: 'marketplace' })"
    />

    <!-- Main Content -->
    <div v-else class="pdp-container">
      <div class="pdp-main-grid">
        <!-- ── Left Column: Surgical Visual Stage ── -->
        <div class="pdp-visual-stage">
          <!-- Top Badges Row -->
          <div class="pdp-badges-top">
            <span class="pdp-sku-pill mono">{{ product.sku }}</span>
            <div class="pdp-status-pills">
              <span v-if="product.isNew" class="pdp-new-pill mono">{{ t('pdp.newBadge') }}</span>
              <span v-else-if="product.isFeatured" class="pdp-featured-pill mono">{{ t('pdp.featuredBadge') }}</span>
              <span v-if="product.isActive" class="pdp-ce-pill mono">{{ t('catalog.ceMarked') }}</span>
            </div>
            <button
              type="button"
              class="pdp-wishlist-quick-btn"
              :class="{ 'is-saved': isSaved(product.id) }"
              :disabled="!canEditWishlist"
              :aria-label="isSaved(product.id) ? t('marketplace.removeFromWishlist') : t('marketplace.wishlistTitle')"
              @click="toggleSave(product.id)"
            >
              <span class="material-symbols-outlined">
                {{ isSaved(product.id) ? 'favorite' : 'favorite_border' }}
              </span>
            </button>
          </div>

          <!-- Clean Image Viewport -->
          <div
            class="pdp-image-viewport"
            @click="inspectModalOpen = true"
          >
            <!-- Real Product Image -->
            <template v-if="productImageUrl">
              <img
                :src="productImageUrl"
                :alt="localized(product.nameEn, product.nameAr)"
                class="pdp-hero-image"
                loading="eager"
                @error="onImageError"
              />
              <button type="button" class="pdp-inspect-trigger mono" @click.stop="inspectModalOpen = true">
                <span class="material-symbols-outlined text-[18px]">zoom_in</span>
                <span>{{ t('pdp.inspectInstrument') }}</span>
              </button>
            </template>

            <!-- Clean Minimal Placeholder Fallback -->
            <div v-else class="pdp-schematic-fallback">
              <div class="pdp-fallback-icon-wrap">
                <span class="material-symbols-outlined pdp-schematic-icon">medical_services</span>
              </div>
              <span class="pdp-schematic-text mono">{{ product.sku }}</span>
              <span class="pdp-schematic-sub">{{ t('pdp.verifiedInstrument') }}</span>
            </div>
          </div>

          <!-- Multi-Image Thumbnails Gallery Strip -->
          <div v-if="galleryImages.length > 1" class="pdp-gallery-strip" role="tablist" :aria-label="t('admin.productImagesReq')">
            <button
              v-for="(img, idx) in galleryImages"
              :key="idx"
              type="button"
              class="pdp-gallery-thumb"
              :class="{ 'is-active': selectedImageIndex === idx }"
              :aria-label="`Photo ${idx + 1}`"
              @click.stop="selectImage(idx)"
            >
              <img
                :src="resolveFileUrl(img)"
                :alt="`${localized(product.nameEn, product.nameAr)} - ${idx + 1}`"
                class="pdp-gallery-thumb-img"
              />
            </button>
          </div>

          <!-- Visual Stage Footer: Technical Spec Bar -->
          <div v-if="product.material || product.lengthCm || product.isActive" class="pdp-visual-foot mono">
            <div class="visual-foot__left">
              <span v-if="product.material" class="foot-material">{{ product.material }}</span>
              <span v-if="product.lengthCm" class="foot-length"><template v-if="product.material"> · </template>{{ product.lengthCm }} cm</span>
            </div>
            <div v-if="product.isActive" class="visual-foot__right">
              <span class="foot-cert">{{ t('catalog.ceMarked') }}</span>
            </div>
          </div>
        </div>

        <!-- ── Right Column: Commercial & Ordering Details ── -->
        <div class="pdp-order-col">
          <!-- Category Eyebrow -->
          <router-link
            v-if="product.categoryId"
            :to="{ name: 'marketplace', query: { categoryId: product.categoryId } }"
            class="pdp-cat-eyebrow mono"
          >
            {{ localized(product.categoryNameEn, product.categoryNameAr) || t('marketplace.allCategories') }}
          </router-link>

          <!-- Product Title Group -->
          <div class="pdp-title-group">
            <h1 class="pdp-title" dir="auto">
              {{ localized(product.nameEn, product.nameAr) }}
            </h1>
            <div class="pdp-title-alt mono" dir="auto">
              {{ locale === 'ar' ? product.nameEn : product.nameAr }}
            </div>
          </div>

          <!-- Bulleted Specifications under Product Title -->
          <div v-if="hasSpecifications" class="pdp-specs-bullets-card">
            <div class="specs-bullets-header mono">
              <span class="material-symbols-outlined text-[16px] text-indigo-600">checklist</span>
              <span>{{ locale === 'ar' ? 'المواصفات الفنية' : 'Technical Specifications' }}</span>
            </div>
            <ul class="specs-bullets-list">
              <li v-for="(spec, sIdx) in parsedSpecs.bullets" :key="sIdx" class="spec-bullet-item">
                <span class="bullet-dot"></span>
                <span class="bullet-text">{{ spec }}</span>
              </li>
              <li v-if="parsedSpecs.wireCapacity" class="spec-bullet-item spec-bullet-highlight">
                <span class="material-symbols-outlined bullet-icon text-indigo-600">electric_bolt</span>
                <span class="bullet-label mono">{{ locale === 'ar' ? 'سعة السلك:' : 'Wire Capacity:' }}</span>
                <strong class="bullet-value">{{ parsedSpecs.wireCapacity }}</strong>
              </li>
              <li v-if="parsedSpecs.wireCuttingCapacity" class="spec-bullet-item spec-bullet-highlight">
                <span class="material-symbols-outlined bullet-icon text-amber-600">content_cut</span>
                <span class="bullet-label mono">{{ locale === 'ar' ? 'سعة قطع السلك:' : 'Wire Cutting Capacity:' }}</span>
                <strong class="bullet-value">{{ parsedSpecs.wireCuttingCapacity }}</strong>
              </li>
            </ul>
          </div>

          <!-- Provider / Supplier & Regulatory Bar -->
          <div class="pdp-supplier-strip">
            <div class="pdp-provider-chip">
              <span class="material-symbols-outlined provider-icon" aria-hidden="true">storefront</span>
              <span class="provider-lbl">{{ t('pdp.supplierLabel') }}</span>
              <router-link
                v-if="product.companyId && (product.companyName || product.supplierNameEn)"
                :to="{ name: 'provider-storefront', params: { id: product.companyId } }"
                class="provider-name is-link"
              >
                {{ product.companyName || localized(product.supplierNameEn, product.supplierNameAr) }}
              </router-link>
              <strong v-else class="provider-name">
                {{ product.companyName || localized(product.supplierNameEn, product.supplierNameAr) || t('catalog.fallbackMfr') }}
              </strong>
            </div>

            <div v-if="product.manufacturerEn || product.manufacturerAr" class="pdp-manufacturer-chip mono">
              <span class="mfg-lbl">{{ t('pdp.mfgLabel') }}</span>
              <span class="mfg-val">{{ localized(product.manufacturerEn, product.manufacturerAr) }}</span>
            </div>
            
            <span v-if="product.isActive" class="pdp-compliance-tag mono">{{ t('catalog.ceMarked') }}</span>
          </div>

          <!-- Key Technical Specs Strip -->
          <div class="pdp-specs-strip">
            <div v-if="product.material" class="spec-chip">
              <span class="spec-chip__k mono">{{ t('pdp.specMaterial') || 'Material' }}</span>
              <strong class="spec-chip__v">{{ product.material }}</strong>
            </div>
            <div v-if="product.lengthCm" class="spec-chip">
              <span class="spec-chip__k mono">{{ t('pdp.specLength') || 'Length' }}</span>
              <strong class="spec-chip__v">{{ product.lengthCm }} cm</strong>
            </div>
            <div class="spec-chip">
              <span class="spec-chip__k mono">{{ t('pdp.inventoryLabel') }}</span>
              <strong class="spec-chip__v">
                {{ product.stock > 0 ? t('catalog.inStock') : t('catalog.madeToOrder') }}
                <span v-if="product.stock > 0" class="mono text-muted"> ({{ product.stock }})</span>
              </strong>
            </div>
            <div v-if="product.unit || product.unitAr" class="spec-chip">
              <span class="spec-chip__k mono">{{ t('pdp.unitLabel') }}</span>
              <strong class="spec-chip__v">{{ locale === 'ar' ? (product.unitAr || product.unit) : (product.unit || product.unitAr) }}</strong>
            </div>
          </div>

          <!-- Price & Commercial Card -->
          <div class="pdp-price-card">
            <div class="pdp-price-header">
              <div class="price-figure-wrap">
                <strong class="pdp-price-figure mono">
                  {{ formatPrice(displayPrice, locale) }}
                </strong>
                <!-- Interactive Currency Selector -->
                <div class="pdp-currency-select-wrap">
                  <select
                    v-model="targetCurrency"
                    class="pdp-currency-select mono"
                    :aria-label="t('checkout.currency')"
                    @change="onCurrencySelectChange"
                  >
                    <option v-for="c in availableCurrencies" :key="c.code" :value="c.code">
                      {{ c.code }} ({{ c.symbol || c.symbolNative }})
                    </option>
                  </select>
                </div>
                <span class="pdp-unit-caption mono">
                  / {{ locale === 'ar' ? (product.unitAr || product.unit || 'قطعة') : (product.unit || 'pcs') }}
                </span>
                <span v-if="targetCurrency !== (product.currencyCode || 'USD')" class="pdp-original-price-note mono text-xs text-muted">
                  ({{ formatPrice(product.price, locale) }} {{ product.currencyCode || 'USD' }})
                </span>
              </div>

              <!-- Live Inventory Badge -->
              <span class="stock-badge" :class="stockStatusClass">
                <span class="live-dot"></span>
                <span>{{ stockLabel }}</span>
              </span>
            </div>

            <!-- Commercial Terms Bar -->
            <div class="pdp-terms-bar mono">
              <div v-if="product.minOrderQty" class="terms-item">
                <span class="material-symbols-outlined text-[15px]">inventory_2</span>
                <span>MOQ: {{ product.minOrderQty }} {{ locale === 'ar' ? (product.unitAr || product.unit || 'قطعة') : (product.unit || 'pcs') }}</span>
              </div>
              <template v-if="product.isActive">
                <span v-if="product.minOrderQty" class="dot-sep">·</span>
                <div class="terms-item">
                  <span class="material-symbols-outlined text-[15px]">verified</span>
                  <span>{{ t('catalog.ceMarked') }}</span>
                </div>
              </template>
            </div>
          </div>

          <!-- Primary Order Actions -->
          <div class="pdp-order-actions">
            <!-- Stepper -->
            <div class="pdp-qty-wrapper">
              <label class="pdp-qty-label mono">Quantity</label>
              <div class="pdp-qty-stepper">
                <button
                  type="button"
                  class="stepper-btn"
                  :disabled="qty <= (product.minOrderQty || 1)"
                  aria-label="Decrease quantity"
                  @click="qty = Math.max(product.minOrderQty || 1, qty - 1)"
                >
                  <span class="material-symbols-outlined">remove</span>
                </button>
                <input
                  v-model.number="qty"
                  type="number"
                  :min="product.minOrderQty || 1"
                  :max="product.stock > 0 ? product.stock : 9999"
                  class="stepper-val mono"
                  aria-label="Quantity"
                  @change="onQtyChange"
                />
                <button
                  type="button"
                  class="stepper-btn"
                  :disabled="product.stock > 0 && qty >= product.stock"
                  aria-label="Increase quantity"
                  @click="qty++"
                >
                  <span class="material-symbols-outlined">add</span>
                </button>
              </div>
            </div>

            <!-- Primary CTAs -->
            <div class="pdp-cta-group">
              <button class="btn-primary-cta" type="button" @click="handleAdd">
                <span class="material-symbols-outlined text-[20px]">shopping_cart</span>
                <span>{{ t('marketplace.addToQuote') }}</span>
              </button>
              <button class="btn-secondary-quote" type="button" @click="handleAddAndGoCart">
                <span>Direct Quotation</span>
              </button>
            </div>
          </div>

          <!-- Tertiary Actions Bar -->
          <div class="pdp-tertiary-actions">
            <button
              type="button"
              class="tert-link tert-link--rfq mono"
              :class="{ 'is-active': isInRfqList }"
              @click="toggleRfqList"
            >
              <span class="material-symbols-outlined text-[16px]">
                {{ isInRfqList ? 'check_circle' : 'add_circle' }}
              </span>
              <span>{{ isInRfqList ? t('pdp.inRfq') : t('pdp.addToRfq') }}</span>
            </button>

            <a
              v-if="waHref"
              :href="waHref"
              target="_blank"
              rel="noopener noreferrer"
              class="tert-link tert-link--wa mono"
            >
              <span class="material-symbols-outlined text-[16px]">chat</span>
              <span>WhatsApp Inquiry</span>
            </a>

            <button
              type="button"
              class="tert-link tert-link--fav mono"
              :class="{ 'is-active': isSaved(product.id) }"
              :disabled="!canEditWishlist"
              @click="toggleSave(product.id)"
            >
              <span class="material-symbols-outlined text-[16px]">
                {{ isSaved(product.id) ? 'favorite' : 'favorite_border' }}
              </span>
              <span>{{ isSaved(product.id) ? t('marketplace.removeFromWishlist') : t('marketplace.wishlistTitle') }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- ── Technical Tabs Section ── -->
      <div class="pdp-tabs-container">
        <div class="pdp-tabs">
          <div class="pdp-tab-headers mono" role="tablist">
            <button
              type="button"
              class="pdp-tab-btn"
              :class="{ 'is-active': activeTab === 'specs' }"
              role="tab"
              @click="activeTab = 'specs'"
            >
              <span class="material-symbols-outlined text-[17px]">description</span>
              <span>{{ t('pdp.tabSpecs') }}</span>
            </button>

            <button
              type="button"
              class="pdp-tab-btn"
              :class="{ 'is-active': activeTab === 'videos' }"
              role="tab"
              @click="activeTab = 'videos'"
            >
              <span class="material-symbols-outlined text-[17px]">play_circle</span>
              <span>{{ t('pdp.tabVideos') }}</span>
              <span v-if="videoItems.length" class="tab-count mono">{{ videoItems.length }}</span>
            </button>
          </div>

          <!-- Tab Content: Specs -->
          <div v-if="activeTab === 'specs'" class="pdp-tab-content">
            <div v-if="resolvedDescription" class="pdp-desc-box">
              <p class="desc-text" dir="auto">
                {{ resolvedDescription }}
              </p>
            </div>

            <!-- Structured Specifications Table (from API data only) -->
            <dl class="pdp-spec-list">
              <div v-if="product.sku" class="spec-row">
                <dt class="mono">SKU</dt>
                <dd class="mono">{{ product.sku }}</dd>
              </div>
              <div v-if="product.material" class="spec-row">
                <dt class="mono">{{ t('pdp.specMaterial') }}</dt>
                <dd>{{ product.material }}</dd>
              </div>
              <div v-if="product.lengthCm" class="spec-row">
                <dt class="mono">{{ t('pdp.specLength') }}</dt>
                <dd>{{ product.lengthCm }} cm ({{ (product.lengthCm / 2.54).toFixed(1) }} in)</dd>
              </div>
              <div v-if="product.unit || product.unitAr" class="spec-row">
                <dt class="mono">{{ t('pdp.specPackaging') }}</dt>
                <dd>{{ locale === 'ar' ? (product.unitAr || product.unit) : (product.unit || product.unitAr) }} · MOQ: {{ product.minOrderQty || 1 }}</dd>
              </div>
              <div v-if="product.categoryNameEn || product.categoryNameAr" class="spec-row">
                <dt class="mono">{{ t('marketplace.categoriesTitle') }}</dt>
                <dd>{{ localized(product.categoryNameEn, product.categoryNameAr) }}</dd>
              </div>
              <div v-if="product.manufacturerEn || product.manufacturerAr || product.companyName" class="spec-row">
                <dt class="mono">{{ t('pdp.manufacturerLabel') }}</dt>
                <dd>{{ localized(product.manufacturerEn, product.manufacturerAr) || product.companyName }}</dd>
              </div>
              <div v-if="product.isActive" class="spec-row">
                <dt class="mono">{{ t('pdp.specRegulatory') }}</dt>
                <dd>{{ t('catalog.ceMarked') }}</dd>
              </div>
            </dl>

            <!-- Custom specifications string if provided from API -->
            <div v-if="product.specifications" class="pdp-spec-notes mono">
              <div class="spec-notes-title">Additional Technical Notes:</div>
              <div class="spec-notes-body">{{ product.specifications }}</div>
            </div>
          </div>

          <!-- Tab Content: Videos -->
          <div v-else-if="activeTab === 'videos'" class="pdp-tab-content">
            <div v-if="videoItems.length" class="pdp-video-showcase">
              <!-- Prominent Responsive Video Cinema Player -->
              <div v-if="currentFeaturedVideo" class="pdp-main-video-wrapper">
                <iframe
                  v-if="parseVideoSource(currentFeaturedVideo.url).type === 'youtube' || parseVideoSource(currentFeaturedVideo.url).type === 'vimeo'"
                  :src="parseVideoSource(currentFeaturedVideo.url).embedUrl"
                  class="pdp-featured-video-frame"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowfullscreen
                ></iframe>
                <video
                  v-else
                  :key="currentFeaturedVideo.url"
                  :src="parseVideoSource(currentFeaturedVideo.url).src"
                  class="pdp-featured-video-player"
                  controls
                  playsinline
                  preload="metadata"
                ></video>
              </div>

              <!-- Multi-video playlist strip (only shown if > 1 video) -->
              <div v-if="videoItems.length > 1" class="pdp-video-playlist">
                <div class="pdp-playlist-header">
                  <span class="mono text-xs text-muted font-bold">{{ locale === 'ar' ? 'فيديوهات المنتج المتاحة' : 'Available Product Videos' }} ({{ videoItems.length }})</span>
                </div>
                <div class="pdp-playlist-strip">
                  <button
                    v-for="(v, idx) in videoItems"
                    :key="v.id"
                    type="button"
                    class="pdp-playlist-card"
                    :class="{ 'is-active': selectedVideoIdx === idx }"
                    @click="selectedVideoIdx = idx"
                  >
                    <div class="pdp-playlist-thumb">
                      <img v-if="v.thumbnail" :src="v.thumbnail" alt="" class="pdp-playlist-thumb__img" />
                      <div v-else class="pdp-playlist-thumb__fallback">
                        <span class="material-symbols-outlined text-[20px]">videocam</span>
                      </div>
                      <div class="pdp-playlist-play-icon">
                        <span class="material-symbols-outlined text-[16px]">play_arrow</span>
                      </div>
                    </div>
                    <div class="pdp-playlist-meta">
                      <span class="pdp-playlist-badge mono">{{ locale === 'ar' ? 'فيديو' : 'Video' }} {{ idx + 1 }}</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
            <EmptyState
              v-else
              :title="t('pdp.videoDemo')"
              :description="t('pdp.videoComingSoon')"
            />
          </div>
        </div>
      </div>

      <!-- ── Direct Technical & Bulk Institutional Inquiry Panel ── -->
      <div class="pdp-inquiry-panel">
        <div class="inquiry-header">
          <span class="inquiry-eyebrow mono">{{ t('pdp.inquiryEyebrow') }}</span>
          <h2 class="inquiry-title">{{ t('pdp.inquiryTitle') }}</h2>
          <p class="inquiry-hint">{{ t('pdp.inquiryHint') }}</p>
          <div v-if="!authService.isAuthenticated" class="inquiry-auth-notice">
            <span class="material-symbols-outlined text-[18px]">lock</span>
            <span>{{ t('pdp.inquiryAuthNotice') }}</span>
            <router-link :to="{ name: 'login', query: { redirect: route.fullPath } }" class="inquiry-login-link mono">
              {{ t('nav.login') }} →
            </router-link>
          </div>
        </div>

        <form class="inquiry-form" @submit.prevent="sendInquiry">
          <div class="field">
            <label class="mono">{{ t('pdp.inquiryName') }} *</label>
            <input
              v-model="inquiryName"
              type="text"
              required
              :placeholder="t('pdp.inquiryNamePh')"
              class="inquiry-input"
            />
          </div>

          <div class="field">
            <label class="mono">{{ t('pdp.inquiryOrg') }}</label>
            <input
              v-model="inquiryOrg"
              type="text"
              :placeholder="t('pdp.inquiryOrgPh')"
              class="inquiry-input"
            />
          </div>

          <div class="field field--full">
            <label class="mono">{{ t('auth.email') }}</label>
            <input
              v-model="inquiryEmail"
              type="email"
              placeholder="procurement@hospital.org"
              class="inquiry-input"
            />
          </div>

          <div class="field field--full">
            <label class="mono">{{ t('pdp.inquiryMsg') }} *</label>
            <textarea
              v-model="inquiryMsg"
              rows="3"
              required
              :placeholder="t('pdp.inquiryMsgPh')"
              class="inquiry-textarea"
            ></textarea>
          </div>

          <div class="inquiry-submit-row">
            <button
              class="btn-inquiry-submit"
              type="submit"
              :disabled="inquirySending"
            >
              <span v-if="inquirySending" class="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
              <span v-else class="material-symbols-outlined text-[18px]">{{ authService.isAuthenticated ? 'send' : 'lock' }}</span>
              <span>{{ inquirySending ? 'Sending...' : (authService.isAuthenticated ? t('pdp.sendInquiry') : t('pdp.sendInquiry')) }}</span>
            </button>
            <p class="inquiry-foot mono">{{ t('pdp.inquiryFoot') }}</p>
          </div>
        </form>
      </div>

      <!-- ── Related Surgical Instruments ── -->
      <section v-if="related.length" class="pdp-related-section">
        <div class="related-header">
          <div>
            <span class="related-eyebrow mono">{{ t('pdp.relatedEyebrow') }}</span>
            <h3 class="related-title">{{ t('marketplace.relatedProducts') }}</h3>
          </div>
          <router-link
            :to="{ name: 'marketplace', query: product.categoryId ? { categoryId: product.categoryId } : undefined }"
            class="browse-more-link mono"
          >
            <span>{{ t('marketplace.browseMarketplace') }} <span class="icon--directional">→</span></span>
          </router-link>
        </div>

        <div class="related-grid">
          <article
            v-for="p in related"
            :key="p.id"
            class="rel-card"
            @click="router.push({ name: 'marketplace-product', params: { id: p.id } })"
          >
            <div class="rel-media">
              <AppImage
                :src="p.imageName || p.images?.[0]"
                placeholder-type="product"
                :placeholder-text="p.sku"
                :alt="localized(p.nameEn, p.nameAr)"
                fit="contain"
                class="rel-media__img"
              />
              <span class="rel-sku mono">{{ p.sku }}</span>
            </div>

            <div class="rel-body">
              <span class="rel-cat mono">{{ localized(p.categoryNameEn, p.categoryNameAr) }}</span>
              <h4 class="rel-name" dir="auto">{{ localized(p.nameEn, p.nameAr) }}</h4>
              <div class="rel-name-alt mono" dir="auto">{{ locale === 'ar' ? p.nameEn : p.nameAr }}</div>
              <div v-if="p.lengthCm || p.material" class="rel-specs-mono mono">
                {{ p.lengthCm ? `${p.lengthCm} cm` : '' }}{{ p.lengthCm && p.material ? ' · ' : '' }}{{ p.material || '' }}
              </div>
              <div class="rel-foot">
                <strong class="mono rel-price">
                  {{ formatPrice(p.price, locale) }} {{ p.currencySymbol || p.currencyCode || p.currency || '$' }}
                </strong>
                <span class="rel-cta-hint mono">{{ t('admin.certView') }} <span class="icon--directional">→</span></span>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section v-if="offeredLoading || offeredBy.length > 1" class="offered-section" aria-labelledby="offered-heading">
        <div class="offered-head">
          <h3 id="offered-heading" class="offered-title">{{ t('provider.offeredBy') }}</h3>
          <span class="mono offered-count">{{ offeredBy.length }}</span>
        </div>
        <div v-if="offeredLoading" role="status"><SkeletonLoader type="provider-cards" :count="3" /></div>
        <div class="offered-grid">
          <button
            v-for="entry in offeredBy"
            :key="entry.company.id"
            type="button"
            class="offer-card"
            :class="{ 'is-current': isCurrentListing(entry.listing.id) }"
            @click="router.push({ name: 'marketplace-product', params: { id: entry.listing.id } })"
          >
            <span class="offer-card__name" dir="auto">{{ entry.company.name }}</span>
            <span v-if="entry.company.countryNameEn || entry.company.countryNameAr" class="offer-card__country mono">
              {{ locale === 'ar' ? entry.company.countryNameAr || entry.company.countryNameEn : entry.company.countryNameEn || entry.company.countryNameAr }}
            </span>
            <span class="offer-card__foot">
              <strong class="mono-num">{{ formatPrice(entry.listing.price, locale) }} {{ entry.listing.currencySymbol || entry.listing.currencyCode || '$' }}</strong>
              <span v-if="isCurrentListing(entry.listing.id)" class="badge badge--solid badge--pill">{{ t('marketplace.current') }}</span>
            </span>
          </button>
        </div>
      </section>
    </div>

    <!-- ── Video Playback Modal ── -->
    <BaseModal
      :model-value="!!activeVideo"
      :title="activeVideo?.title || t('pdp.tabVideos')"
      max-width="840px"
      @update:model-value="(val) => { if (!val) activeVideo = null }"
    >
      <div v-if="activeVideo" class="pdp-video-modal">
        <div class="video-modal-viewport">
          <iframe
            v-if="parseVideoSource(activeVideo.url).type === 'youtube' || parseVideoSource(activeVideo.url).type === 'vimeo'"
            :src="parseVideoSource(activeVideo.url).embedUrl"
            class="video-embed-frame"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
          ></iframe>
          <video
            v-else
            :src="parseVideoSource(activeVideo.url).src"
            class="video-native-player"
            controls
            autoplay
          ></video>
        </div>
        <div class="video-modal-foot">
          <h4 class="text-base font-bold text-ink-strong">{{ activeVideo.title }}</h4>
          <p v-if="product" class="text-xs text-muted mt-1 mono">{{ product.sku }} · {{ localized(product.nameEn, product.nameAr) }}</p>
        </div>
      </div>
    </BaseModal>

    <!-- ── Instrument High-Resolution Inspection Modal ── -->
    <BaseModal
      :model-value="inspectModalOpen"
      :title="product ? localized(product.nameEn, product.nameAr) : 'Instrument Inspection'"
      max-width="960px"
      @update:model-value="(val) => { inspectModalOpen = val; if (!val) resetZoom(); }"
    >
      <div v-if="product" class="pdp-inspect-modal">
        <!-- Floating Interactive Zoom Toolbar -->
        <div class="inspect-toolbar mono">
          <div class="zoom-controls-group">
            <button
              type="button"
              class="zoom-btn"
              :title="locale === 'ar' ? 'تكبير' : 'Zoom In'"
              aria-label="Zoom in"
              @click="zoomIn"
            >
              <span class="material-symbols-outlined text-[18px]">add</span>
            </button>
            <span class="zoom-percent-badge">{{ Math.round(zoomLevel * 100) }}%</span>
            <button
              type="button"
              class="zoom-btn"
              :disabled="zoomLevel <= 1.0"
              :title="locale === 'ar' ? 'تصغير' : 'Zoom Out'"
              aria-label="Zoom out"
              @click="zoomOut"
            >
              <span class="material-symbols-outlined text-[18px]">remove</span>
            </button>
            <button
              type="button"
              class="zoom-btn zoom-btn--reset"
              :disabled="zoomLevel === 1.0 && panX === 0 && panY === 0"
              :title="locale === 'ar' ? 'إعادة ضبط' : 'Reset Zoom'"
              @click="resetZoom"
            >
              <span class="material-symbols-outlined text-[18px]">restart_alt</span>
              <span>100%</span>
            </button>
          </div>
          <span class="zoom-hint text-xs text-muted hidden sm:inline-block">
            {{ zoomLevel > 1.0 ? (locale === 'ar' ? 'اسحب للتحريك أو استخدم العجلة' : 'Drag to pan or use wheel') : (locale === 'ar' ? 'انقر أو استخدم العجلة للتكبير' : 'Click or scroll to zoom') }}
          </span>
        </div>

        <div
          class="inspect-viewport"
          :class="{ 'is-zoomed': zoomLevel > 1.0, 'is-dragging': isDragging }"
          @wheel.prevent="onInspectWheel"
          @mousedown="onPanStart"
          @mousemove="onPanMove"
          @mouseup="onPanEnd"
          @mouseleave="onPanEnd"
        >
          <img
            v-if="productImageUrl"
            :src="productImageUrl"
            :alt="localized(product.nameEn, product.nameAr)"
            class="inspect-image"
            :style="{
              transform: `scale(${zoomLevel}) translate(${panX / zoomLevel}px, ${panY / zoomLevel}px)`,
              cursor: zoomLevel > 1.0 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
              transition: isDragging ? 'none' : 'transform 0.15s ease-out',
            }"
            draggable="false"
            @click="zoomLevel === 1.0 ? zoomIn() : null"
          />
          <div v-else class="pdp-schematic-fallback">
            <div class="pdp-fallback-icon-wrap">
              <span class="material-symbols-outlined pdp-schematic-icon text-[36px]">medical_services</span>
            </div>
            <span class="pdp-schematic-text mono text-lg">{{ product.sku }}</span>
            <span class="pdp-schematic-sub">{{ t('pdp.verifiedInstrument') }}</span>
          </div>
        </div>

        <div v-if="galleryImages.length > 1" class="inspect-gallery-strip">
          <button
            v-for="(img, idx) in galleryImages"
            :key="idx"
            type="button"
            class="inspect-thumb"
            :class="{ 'is-active': selectedImageIndex === idx }"
            @click="selectImage(idx)"
          >
            <img :src="resolveFileUrl(img)" :alt="`Photo ${idx + 1}`" class="inspect-thumb-img" />
          </button>
        </div>

        <div class="inspect-foot mono">
          <div class="inspect-foot__spec">
            <span class="font-bold text-ink-strong">{{ product.sku }}</span>
            <span v-if="product.material"> · {{ product.material }}</span>
            <span v-if="product.lengthCm"> · {{ product.lengthCm }} cm</span>
          </div>
          <div v-if="product.isActive" class="inspect-foot__badge">
            <span>{{ t('catalog.ceMarked') }}</span>
          </div>
        </div>
      </div>
    </BaseModal>
  </div>
</template>

<style scoped>
.pdp-view {
  width: 100%;
}

/* Breadcrumb */
.breadcrumb {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--step--1);
  color: var(--wl-muted);
  margin-bottom: var(--space-6);
  flex-wrap: wrap;
}

.breadcrumb a {
  color: var(--wl-primary);
  text-decoration: none;
  transition: color 0.15s ease;
}

.breadcrumb a:hover {
  text-decoration: underline;
  color: var(--wl-primary-hover);
}

.breadcrumb a:focus-visible {
  outline: 2px solid var(--wl-primary);
  outline-offset: 2px;
}

.breadcrumb .sep {
  color: var(--wl-line-strong);
}

.current-crumb {
  color: var(--wl-ink-strong);
  font-weight: 600;
}

/* 2-Column Main Grid */
.pdp-main-grid {
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  gap: var(--space-10);
  align-items: start;
}

/* ── Visual Stage ── */
.pdp-visual-stage {
  border: 1px solid var(--wl-line);
  border-radius: var(--radius-md);
  overflow: hidden;
  position: relative;
  background: var(--wl-surface);
  box-shadow: var(--shadow-card);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

/* ── Multi-Image Gallery Strip ── */
.pdp-gallery-strip {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--wl-surface-soft, #f8fafc);
  border-top: 1px solid var(--wl-line, #e2e8f0);
  overflow-x: auto;
  scrollbar-width: thin;
}

.pdp-gallery-thumb {
  width: 64px;
  height: 64px;
  border-radius: 8px;
  border: 2px solid transparent;
  padding: 2px;
  background: #ffffff;
  cursor: pointer;
  overflow: hidden;
  flex-shrink: 0;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.pdp-gallery-thumb:hover {
  border-color: var(--wl-primary-soft, #99f6e4);
  transform: translateY(-2px);
}

.pdp-gallery-thumb.is-active {
  border-color: var(--wl-primary, #00A389);
  box-shadow: 0 0 0 2px rgba(0, 163, 137, 0.25);
}

.pdp-gallery-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 6px;
}

.inspect-gallery-strip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 0.75rem;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  overflow-x: auto;
}

.inspect-thumb {
  width: 58px;
  height: 58px;
  border-radius: 8px;
  border: 2px solid transparent;
  padding: 2px;
  background: #ffffff;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.18s ease;
}

.inspect-thumb.is-active {
  border-color: var(--wl-primary, #00A389);
  box-shadow: 0 0 0 2px rgba(0, 163, 137, 0.3);
}

.inspect-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 5px;
}

.pdp-visual-stage:hover {
  box-shadow: var(--shadow-hover);
}

.pdp-badges-top {
  position: absolute;
  top: var(--space-4);
  inset-inline: var(--space-4);
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 2;
  gap: var(--space-2);
}

.pdp-sku-pill {
  background: var(--wl-surface);
  border: 1px solid var(--wl-line);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-md);
  font-size: var(--step--1);
  font-weight: 700;
  color: var(--wl-ink-strong);
  box-shadow: var(--shadow-card);
  letter-spacing: 0.04em;
}

.pdp-status-pills {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.pdp-new-pill {
  background: var(--wl-primary);
  color: var(--wl-on-primary);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-pill);
  font-size: var(--step--1);
  font-weight: 800;
  letter-spacing: 0.05em;
}

.pdp-featured-pill {
  background: var(--wl-warning);
  color: var(--wl-on-primary);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-pill);
  font-size: var(--step--1);
  font-weight: 800;
}

.pdp-ce-pill {
  background: rgba(16, 185, 129, 0.14);
  color: var(--wl-success);
  border: 1px solid rgba(16, 185, 129, 0.25);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-pill);
  font-size: var(--step--1);
  font-weight: 700;
}

.pdp-wishlist-quick-btn {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--wl-line);
  background: var(--wl-surface);
  color: var(--wl-muted);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: all 0.18s var(--wl-ease-spring);
  box-shadow: var(--shadow-card);
}

.pdp-wishlist-quick-btn:hover:not(:disabled) {
  transform: scale(1.08);
  color: var(--wl-danger);
  border-color: var(--wl-danger);
  background: var(--wl-danger-soft);
}

.pdp-wishlist-quick-btn:focus-visible {
  outline: 2px solid var(--wl-primary);
  outline-offset: 2px;
}

.pdp-wishlist-quick-btn.is-saved {
  color: var(--wl-danger);
  border-color: var(--wl-danger);
  background: var(--wl-danger-soft);
}

.pdp-image-viewport {
  min-height: 440px;
  max-height: 540px;
  display: grid;
  place-items: center;
  padding: var(--space-8);
  position: relative;
  cursor: zoom-in;
  overflow: hidden;
  background: var(--bg-surface, #ffffff);
}

.pdp-hero-image {
  width: 100%;
  max-height: 420px;
  object-fit: contain;
  transition: transform 0.3s var(--wl-ease-spring);
  user-select: none;
}

.pdp-image-viewport:hover .pdp-hero-image {
  transform: scale(1.025);
}

.pdp-inspect-trigger {
  position: absolute;
  bottom: 1rem;
  inset-inline-end: 1rem;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.75rem;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border, #D9E2EC);
  color: var(--fg-heading, #102A43);
  border-radius: var(--radius-pill);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: var(--shadow-xs);
  transition: all 0.2s ease;
}

.pdp-image-viewport:hover .pdp-inspect-trigger {
  background: var(--brand, #6366F1);
  color: #ffffff;
  border-color: var(--brand, #6366F1);
}

.pdp-inspect-trigger:focus-visible {
  outline: 2px solid var(--brand, #6366F1);
  outline-offset: 2px;
}

.pdp-schematic-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-8) var(--space-4);
  color: var(--fg-muted, #627D98);
  text-align: center;
  width: 100%;
  min-height: 340px;
  background: var(--bg-subtle, #F8FAFC);
  border-radius: var(--radius-md, 6px);
  border: 1px dashed var(--border, #D9E2EC);
}

.pdp-fallback-icon-wrap {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: var(--bg-surface, #ffffff);
  border: 1px solid var(--border, #D9E2EC);
  display: grid;
  place-items: center;
  box-shadow: var(--shadow-xs);
}

.pdp-schematic-icon {
  font-size: 30px;
  color: var(--secondary, #147D92);
}

.pdp-schematic-text {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--fg-heading, #102A43);
}

.pdp-schematic-sub {
  font-size: 12px;
  color: var(--fg-muted, #627D98);
}

.pdp-visual-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) var(--space-4);
  background: var(--wl-surface);
  border-top: 1px solid var(--wl-line);
  font-size: var(--step--1);
  color: var(--wl-muted);
  flex-wrap: wrap;
  gap: var(--space-2);
}

.foot-material {
  color: var(--wl-ink-strong);
  font-weight: 600;
}

.foot-cert {
  color: var(--wl-primary);
  font-weight: 600;
}

/* ── Order Column ── */
.pdp-order-col {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.pdp-cat-eyebrow {
  font-size: var(--step--1);
  color: var(--wl-primary);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-decoration: none;
  display: inline-block;
  transition: color 0.15s ease;
}

.pdp-cat-eyebrow:hover {
  text-decoration: underline;
  color: var(--wl-primary-hover);
}

.pdp-cat-eyebrow:focus-visible {
  outline: 2px solid var(--wl-primary);
  outline-offset: 2px;
}

.pdp-title-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.pdp-title {
  font-size: clamp(1.75rem, 2.8vw, 2.35rem);
  font-weight: 800;
  line-height: 1.18;
  color: var(--wl-ink-strong);
  margin: 0;
  overflow-wrap: anywhere;
  letter-spacing: -0.015em;
}

.pdp-title-alt {
  font-size: var(--step-0);
  color: var(--wl-muted);
  font-weight: 500;
  margin: 0;
  overflow-wrap: anywhere;
}

.pdp-supplier-strip {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.pdp-provider-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.35rem 0.85rem;
  background: var(--bg-surface, #ffffff);
  border: 1px solid var(--border, #D9E2EC);
  border-radius: var(--radius-md, 6px);
  font-size: 13px;
  color: var(--fg-heading, #102A43);
  box-shadow: var(--shadow-xs);
  transition: all 0.15s ease;
}

.pdp-provider-chip:hover {
  border-color: var(--border-strong, #C2C7CD);
}

.pdp-provider-chip .provider-icon {
  font-size: 17px;
  color: var(--secondary, #147D92);
}

.pdp-provider-chip .provider-lbl {
  font-size: 12px;
  color: var(--fg-muted, #627D98);
  font-weight: 500;
}

.pdp-provider-chip .provider-name {
  font-weight: 700;
  color: var(--fg-heading, #102A43);
}

.pdp-provider-chip .provider-name.is-link {
  color: var(--secondary, #00A389);
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
  transition: color 0.15s ease;
}

.pdp-provider-chip .provider-name.is-link:hover {
  color: var(--secondary-hover, #008872);
}

.pdp-manufacturer-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 12.5px;
  color: var(--wl-muted);
}

.pdp-manufacturer-chip .mfg-lbl {
  font-weight: 600;
}

.dot-sep {
  opacity: 0.45;
}

.pdp-compliance-tag {
  color: var(--wl-primary);
  font-weight: 700;
  font-size: 12.5px;
  background: rgba(20, 125, 146, 0.08);
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

/* Quick Specs Strip */
.pdp-specs-strip {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--wl-surface);
  border: 1px solid var(--wl-line);
  border-radius: var(--radius-md);
}

.spec-chip {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.spec-chip__k {
  font-size: var(--step--1);
  color: var(--wl-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.spec-chip__v {
  font-size: var(--step-0);
  color: var(--wl-ink-strong);
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Price & Commercial Card */
.pdp-price-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-line);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  position: relative;
  overflow: hidden;
}

.pdp-price-card::before {
  content: '';
  position: absolute;
  top: 0;
  inset-inline: 0;
  height: 2.5px;
  background: linear-gradient(90deg, var(--brand, #6366F1), var(--secondary, #14B8A6));
  opacity: 0.95;
}

.pdp-price-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.price-figure-wrap {
  display: flex;
  align-items: baseline;
}

.pdp-price-figure {
  font-size: 2.3rem;
  font-weight: 800;
  color: var(--wl-ink-strong);
  letter-spacing: -0.03em;
  line-height: 1;
}

.pdp-currency-unit {
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--wl-primary);
  margin-inline-start: var(--space-1);
}

.pdp-unit-caption {
  font-size: var(--step-0);
  color: var(--wl-muted);
  margin-inline-start: var(--space-1);
}

.stock-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-xs, 3px);
  font-size: var(--step-0);
  font-weight: 700;
}

.stock-badge--in {
  background: var(--color-success-500, #198754);
  color: #ffffff;
}

.stock-badge--low {
  background: var(--color-warning-500, #E67E22);
  color: #ffffff;
}

.stock-badge--out {
  background: var(--color-danger-500, #DC3545);
  color: #ffffff;
}

.live-dot {
  width: 7px;
  height: 7px;
  border-radius: var(--radius-full);
  background: currentColor;
  box-shadow: 0 0 6px currentColor;
}

.pdp-terms-bar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--wl-surface);
  border-radius: var(--radius-sm);
  font-size: var(--step--1);
  color: var(--wl-ink-soft);
  flex-wrap: wrap;
}

.terms-item {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

/* Order Actions Row */
.pdp-order-actions {
  display: flex;
  align-items: flex-end;
  gap: var(--space-4);
  margin-top: var(--space-1);
}

.pdp-qty-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  flex-shrink: 0;
}

.pdp-qty-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--wl-muted);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.pdp-qty-stepper {
  display: inline-flex;
  align-items: center;
  height: 48px;
  background: var(--wl-surface);
  border: 1px solid var(--border, #D9E2EC);
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: var(--shadow-card);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.pdp-qty-stepper:focus-within,
.pdp-qty-stepper:hover {
  border-color: var(--wl-primary);
  box-shadow: var(--wl-focus-ring);
}

.stepper-btn {
  width: 44px;
  height: 100%;
  border: none;
  background: var(--wl-surface-soft);
  color: var(--wl-ink-strong);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: all 0.16s ease;
  flex-shrink: 0;
}

.stepper-btn:hover:not(:disabled) {
  background: var(--wl-primary-soft);
  color: var(--wl-primary);
}

.stepper-btn:focus-visible {
  outline: 2px solid var(--wl-primary);
  outline-offset: -2px;
}

.stepper-btn:active:not(:disabled) {
  transform: scale(0.92);
}

.stepper-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.stepper-val {
  width: 64px;
  height: 100%;
  border: none;
  border-inline-start: 1px solid var(--wl-border);
  border-inline-end: 1px solid var(--wl-border);
  background: var(--wl-surface);
  text-align: center;
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--wl-ink-strong);
  outline: none;
  -moz-appearance: textfield;
}

.stepper-val::-webkit-inner-spin-button,
.stepper-val::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.pdp-cta-group {
  display: flex;
  flex: 1;
  gap: var(--space-3);
}

.btn-primary-cta {
  flex: 1.4;
  height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  background: var(--wl-primary);
  color: var(--wl-on-primary);
  border: none;
  border-radius: var(--radius-md);
  font-weight: 700;
  font-size: var(--step-0);
  padding: 0 var(--space-5);
  cursor: pointer;
  transition: all 0.18s var(--wl-ease-spring);
  box-shadow: var(--wl-primary-shadow);
  white-space: nowrap;
}

.btn-primary-cta:hover:not(:disabled) {
  background: var(--wl-primary-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-hover);
}

.btn-primary-cta:focus-visible {
  outline: 2px solid var(--wl-primary);
  outline-offset: 2px;
}

.btn-primary-cta:active:not(:disabled) {
  transform: scale(0.985);
}

.btn-primary-cta:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary-quote {
  flex: 1;
  height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  background: transparent;
  color: var(--wl-ink-strong);
  border: 1px solid var(--border-strong, #C2C7CD);
  border-radius: var(--radius-md);
  font-weight: 700;
  font-size: var(--step-0);
  padding: 0 var(--space-4);
  cursor: pointer;
  transition: all 0.16s ease;
  white-space: nowrap;
}

.btn-secondary-quote:hover:not(:disabled) {
  background: var(--wl-surface-soft);
  border-color: var(--wl-primary);
  color: var(--wl-primary);
}

.btn-secondary-quote:focus-visible {
  outline: 2px solid var(--wl-primary);
  outline-offset: 2px;
}

/* Tertiary Actions Bar */
.pdp-tertiary-actions {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
  padding-top: var(--space-3);
  border-top: 1px dashed var(--wl-line);
}

.tert-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--wl-ink-soft);
  text-decoration: none;
  background: var(--wl-surface);
  border: 1px solid var(--wl-line);
  cursor: pointer;
  font-size: var(--step--1);
  font-weight: 600;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-pill);
  transition: all 0.15s ease;
}

.tert-link:hover {
  color: var(--wl-primary);
  border-color: var(--wl-primary);
  background: var(--wl-primary-soft);
}

.tert-link:focus-visible {
  outline: 2px solid var(--wl-primary);
  outline-offset: 2px;
}

/* ── Technical Tabs ── */
.pdp-tabs-container {
  margin-top: var(--space-10);
}

.pdp-tabs {
  background: var(--wl-surface);
  border: 1px solid var(--wl-line);
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: var(--shadow-card);
}

.pdp-tab-headers {
  display: flex;
  border-bottom: 1px solid var(--wl-line);
  background: var(--wl-surface);
  overflow-x: auto;
}

.pdp-tab-btn {
  flex: 1;
  min-width: 140px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-3);
  background: transparent;
  border: none;
  border-bottom: 2.5px solid transparent;
  font-size: var(--step-0);
  font-weight: 600;
  color: var(--wl-muted);
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.pdp-tab-btn:hover:not(:disabled) {
  color: var(--wl-ink-strong);
  background: rgba(0, 0, 0, 0.015);
}

.pdp-tab-btn:focus-visible {
  outline: 2px solid var(--wl-primary);
  outline-offset: -2px;
}

.pdp-tab-btn.is-active {
  color: var(--wl-primary);
  border-bottom-color: var(--wl-primary);
  background: var(--wl-surface);
  font-weight: 700;
}

.tab-count {
  background: var(--wl-primary-soft);
  color: var(--wl-primary);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-pill);
  font-size: var(--step--1);
  font-weight: 700;
}

.pdp-tab-content {
  padding: var(--space-6);
}

.pdp-desc-box {
  background: var(--wl-surface);
  border: 1px solid var(--wl-line);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  margin-bottom: var(--space-6);
}

.desc-text {
  font-size: var(--step-0);
  color: var(--wl-ink-soft);
  line-height: 1.68;
  margin: 0;
}

.pdp-spec-list {
  display: flex;
  flex-direction: column;
  margin: 0;
}

.spec-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--wl-line);
  font-size: var(--step-0);
  gap: var(--space-6);
}

.spec-row:last-child {
  border-bottom: none;
}

.spec-row dt {
  color: var(--wl-muted);
  font-size: var(--step--1);
  text-transform: uppercase;
  flex-shrink: 0;
  letter-spacing: 0.05em;
}

.spec-row dd {
  margin: 0;
  color: var(--wl-ink-strong);
  font-weight: 600;
  text-align: end;
}

.pdp-spec-notes {
  margin-top: var(--space-6);
  padding: var(--space-3) var(--space-4);
  background: var(--wl-surface-soft);
  border: 1px dashed var(--wl-line);
  border-radius: var(--radius-sm);
  font-size: var(--step--1);
}

.spec-notes-title {
  font-weight: 700;
  color: var(--wl-ink-strong);
  margin-bottom: var(--space-1);
}

.spec-notes-body {
  white-space: pre-wrap;
  color: var(--wl-ink-soft);
  line-height: 1.5;
}


/* ── Video Showcase in PDP ── */
.pdp-video-showcase {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  max-width: 900px;
  margin: 0 auto;
}

.pdp-main-video-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #090d16;
  border-radius: var(--radius-lg, 16px);
  overflow: hidden;
  border: 1px solid var(--wl-line);
  box-shadow: 0 12px 32px -8px rgba(0, 0, 0, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
}

.pdp-featured-video-frame {
  width: 100%;
  height: 100%;
  border: none;
}

.pdp-featured-video-player {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
  outline: none;
}

/* Playlist Strip for multiple videos */
.pdp-video-playlist {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.pdp-playlist-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pdp-playlist-strip {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  overflow-x: auto;
  padding: 4px;
}

.pdp-playlist-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--wl-surface);
  border: 1px solid var(--wl-line);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.18s ease;
  flex-shrink: 0;
}

.pdp-playlist-card:hover {
  border-color: var(--wl-primary);
  transform: translateY(-2px);
}

.pdp-playlist-card.is-active {
  border-color: var(--wl-primary);
  background: var(--wl-surface-hover);
  box-shadow: 0 0 0 2px rgba(20, 184, 166, 0.35);
}

.pdp-playlist-thumb {
  position: relative;
  width: 64px;
  aspect-ratio: 16 / 9;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: #000;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.pdp-playlist-thumb__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.pdp-playlist-thumb__fallback {
  color: var(--wl-muted);
}

.pdp-playlist-play-icon {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  opacity: 0.8;
  transition: opacity 0.18s;
}

.pdp-playlist-card:hover .pdp-playlist-play-icon {
  opacity: 1;
  background: rgba(20, 184, 166, 0.65);
}

.pdp-playlist-meta {
  display: flex;
  flex-direction: column;
}

.pdp-playlist-badge {
  font-size: var(--step--1);
  font-weight: 600;
  color: var(--wl-ink-strong);
}

/* ── Institutional Inquiry Panel ── */
.pdp-inquiry-panel {
  display: grid;
  grid-template-columns: 0.95fr 1.05fr;
  gap: var(--space-8);
  background: var(--wl-surface);
  border: 1px solid var(--wl-line);
  padding: var(--space-8);
  margin-top: var(--space-10);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
  position: relative;
  overflow: hidden;
}

.pdp-inquiry-panel::before {
  content: '';
  position: absolute;
  top: 0;
  inset-inline: 0;
  height: 2.5px;
  background: linear-gradient(90deg, var(--brand, #6366F1), var(--secondary, #14B8A6));
  opacity: 0.95;
}

.inquiry-eyebrow {
  font-size: var(--step--1);
  color: var(--wl-primary);
  font-weight: 700;
  letter-spacing: 0.08em;
}

.inquiry-title {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--wl-ink-strong);
  margin: var(--space-1) 0 var(--space-2);
}

.inquiry-hint {
  font-size: var(--step-0);
  color: var(--wl-ink-soft);
  line-height: 1.6;
  margin: 0;
}

.inquiry-auth-notice {
  margin-top: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-surface-elevated, #fffbeb);
  border: 1px solid var(--border-warning, #fde68a);
  border-radius: var(--radius-sm);
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--step--1);
  color: var(--fg-warning, #92400e);
}

.inquiry-login-link {
  font-weight: 700;
  color: var(--wl-primary);
  text-decoration: underline;
  margin-inline-start: var(--space-2);
}

.inquiry-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
  align-content: start;
}

.inquiry-form .field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.inquiry-form .field--full {
  grid-column: 1 / -1;
}

.inquiry-form label {
  font-size: var(--step--1);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--wl-muted);
  font-weight: 600;
}

.inquiry-input,
.inquiry-textarea {
  border: 1px solid var(--wl-line);
  padding: var(--space-2) var(--space-3);
  font-size: var(--step-0);
  background: var(--wl-surface);
  border-radius: var(--radius-sm);
  color: var(--wl-ink-strong);
  outline: none;
  font-family: var(--wl-font-body);
  transition: border-color 0.16s ease;
}

.inquiry-input:focus,
.inquiry-textarea:focus {
  border-color: var(--wl-primary);
  box-shadow: var(--wl-focus-ring);
}

.inquiry-submit-row {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-1);
}

.btn-inquiry-submit {
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  background: var(--wl-primary);
  color: var(--wl-on-primary);
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--step-0);
  font-weight: 700;
  cursor: pointer;
  transition: all 0.18s ease;
  box-shadow: var(--wl-primary-shadow);
}

.btn-inquiry-submit:hover:not(:disabled) {
  background: var(--wl-primary-hover);
}

.btn-inquiry-submit:focus-visible {
  outline: 2px solid var(--wl-primary);
  outline-offset: 2px;
}

.btn-inquiry-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Offered-by providers (same SKU across companies) */
.offered-section {
  margin-top: var(--space-8);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.offered-head {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.offered-title {
  font-size: var(--text-xl);
  font-weight: var(--weight-semibold);
  color: var(--fg-heading);
  margin: 0;
}
.offered-count {
  font-size: var(--text-xs);
  color: var(--fg-muted);
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  padding: var(--space-1) var(--space-3);
}
.offered-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-3);
}
.offer-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-1);
  padding: var(--space-4);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  text-align: start;
  transition: border-color var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out);
}
.offer-card:hover { border-color: var(--border-focus); box-shadow: var(--ring-focus); }
.offer-card.is-current { border-color: var(--brand); }
.offer-card__name {
  font-size: var(--text-base);
  font-weight: var(--weight-medium);
  color: var(--fg-heading);
}
.offer-card__country { font-size: var(--text-xs); color: var(--fg-subtle); }
.offer-card__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  width: 100%;
  margin-top: var(--space-1);
  font-size: var(--text-base);
  color: var(--fg-body);
}
.inquiry-foot {
  font-size: var(--step--1);
  color: var(--wl-muted);
  margin: 0;
}

/* ── Related Instruments Section ── */
.pdp-related-section {
  margin-top: var(--space-10);
  padding-top: var(--space-6);
  border-top: 1px solid var(--wl-line);
}

.related-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: var(--space-6);
  flex-wrap: wrap;
  gap: var(--space-4);
}

.related-eyebrow {
  font-size: var(--step--1);
  color: var(--wl-primary);
  font-weight: 700;
  letter-spacing: 0.08em;
}

.related-title {
  font-size: 1.55rem;
  font-weight: 800;
  color: var(--wl-ink-strong);
  margin: var(--space-1) 0 0;
}

.browse-more-link {
  color: var(--wl-primary);
  font-size: var(--step-0);
  font-weight: 700;
  text-decoration: none;
}

.browse-more-link:hover {
  text-decoration: underline;
}

.browse-more-link:focus-visible {
  outline: 2px solid var(--wl-primary);
  outline-offset: 2px;
}

.related-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--space-6);
}

.rel-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-line);
  border-radius: var(--radius-lg);
  overflow: hidden;
  cursor: pointer;
  box-shadow: var(--shadow-card);
  transition: all 0.22s var(--wl-ease-spring);
  display: flex;
  flex-direction: column;
}

.rel-card:hover:not(:disabled) {
  border-color: var(--wl-primary);
  transform: translateY(-4px);
  box-shadow: var(--shadow-hover);
}

.rel-card:focus-visible {
  outline: 2px solid var(--wl-primary);
  outline-offset: 2px;
}

.rel-media {
  height: 150px;
  display: grid;
  place-items: center;
  position: relative;
  overflow: hidden;
  border-bottom: 1px solid var(--wl-line);
}

.rel-media__img {
  max-height: 110px;
  max-width: 85%;
  object-fit: contain;
  transition: transform 0.25s ease;
}

.rel-card:hover .rel-media__img {
  transform: scale(1.06);
}

.rel-fallback {
  color: var(--wl-muted);
}

.rel-sku {
  position: absolute;
  bottom: var(--space-1);
  inset-inline-start: var(--space-1);
  background: var(--wl-surface);
  border: 1px solid var(--wl-line);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--step--1);
  font-weight: 700;
}

.rel-body {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  flex: 1;
}

.rel-cat {
  font-size: var(--step--1);
  color: var(--wl-primary);
  font-weight: 700;
  text-transform: uppercase;
}

.rel-name {
  font-size: var(--step-0);
  font-weight: 700;
  color: var(--wl-ink-strong);
  margin: 0;
  overflow-wrap: anywhere;
}

.rel-name-alt {
  font-size: var(--step--1);
  color: var(--wl-muted);
  overflow-wrap: anywhere;
}

.rel-specs-mono {
  font-size: var(--step--1);
  color: var(--wl-muted);
  margin-top: var(--space-1);
}

.rel-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
  padding-top: var(--space-3);
  border-top: 1px solid var(--wl-line);
}

.rel-price {
  font-size: var(--step-0);
  font-weight: 800;
  color: var(--wl-ink-strong);
}

.rel-cta-hint {
  font-size: var(--step--1);
  font-weight: 700;
  color: var(--wl-primary);
}

/* ── Modal Styles ── */
.pdp-video-modal {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.video-modal-viewport {
  width: 100%;
  aspect-ratio: 16/9;
  background: #000;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--wl-line);
}

.video-embed-frame,
.video-native-player {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}

.video-modal-foot {
  padding: var(--space-1) var(--space-2);
}

.pdp-inspect-modal {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.inspect-viewport {
  width: 100%;
  min-height: 440px;
  max-height: 600px;
  border-radius: var(--radius-md);
  overflow: hidden;
  display: grid;
  place-items: center;
  padding: var(--space-8);
  border: 1px solid var(--wl-line);
}

.inspect-image {
  max-width: 100%;
  max-height: 520px;
  object-fit: contain;
  filter: drop-shadow(0 16px 32px rgba(0, 0, 0, 0.35));
}

.inspect-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) var(--space-3);
  font-size: var(--step--1);
  color: var(--wl-muted);
  border-top: 1px solid var(--wl-line);
}

.inspect-foot__badge {
  color: var(--wl-primary);
  font-weight: 700;
}

/* ── Bulleted Specifications Card under Title ── */
.pdp-specs-bullets-card {
  margin-top: var(--space-4);
  margin-bottom: var(--space-4);
  background: var(--wl-surface-subtle, #f8fafc);
  border: 1px solid var(--wl-line);
  border-radius: var(--radius-md);
  padding: var(--space-4) var(--space-5);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.specs-bullets-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--step--1);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--wl-ink-strong);
  margin-bottom: var(--space-3);
  padding-bottom: var(--space-2);
  border-bottom: 1px dashed var(--wl-line);
}

.specs-bullets-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.spec-bullet-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2-5, 0.625rem);
  font-size: var(--step--1);
  color: var(--wl-ink-body, #334155);
  line-height: 1.5;
}

.bullet-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--wl-primary, #4f46e5);
  margin-top: 0.45rem;
  flex-shrink: 0;
}

.bullet-text {
  flex: 1;
}

.spec-bullet-highlight {
  align-items: center;
  background: var(--wl-surface, #ffffff);
  border: 1px solid var(--wl-line);
  border-radius: var(--radius-sm);
  padding: 0.35rem 0.65rem;
  margin-top: 0.25rem;
}

.bullet-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.bullet-label {
  font-size: var(--step--1);
  color: var(--wl-muted);
  font-weight: 600;
}

.bullet-value {
  font-size: var(--step--1);
  color: var(--wl-ink-strong);
  font-weight: 700;
}

/* ── PDP Interactive Currency Selector ── */
.pdp-currency-select-wrap {
  display: inline-flex;
  align-items: center;
  margin-inline-start: var(--space-1);
}

.pdp-currency-select {
  background: var(--wl-surface, #ffffff);
  border: 1px solid var(--wl-line);
  border-radius: var(--radius-sm);
  padding: 0.2rem 0.5rem;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--wl-primary, #4f46e5);
  cursor: pointer;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.pdp-currency-select:hover,
.pdp-currency-select:focus {
  border-color: var(--wl-primary);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
}

.pdp-original-price-note {
  display: block;
  width: 100%;
  margin-top: var(--space-1);
}

/* ── Interactive Zoom Toolbar ── */
.inspect-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  background: var(--wl-surface-subtle, #f1f5f9);
  border-radius: var(--radius-sm);
  border: 1px solid var(--wl-line);
  margin-bottom: var(--space-3);
  gap: var(--space-3);
}

.zoom-controls-group {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.zoom-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.3rem 0.6rem;
  font-size: 0.85rem;
  font-weight: 600;
  border-radius: var(--radius-sm);
  border: 1px solid var(--wl-line);
  background: var(--wl-surface, #ffffff);
  color: var(--wl-ink-strong);
  cursor: pointer;
  transition: all 0.15s ease;
}

.zoom-btn:hover:not(:disabled) {
  background: var(--wl-primary, #4f46e5);
  color: #ffffff;
  border-color: var(--wl-primary);
}

.zoom-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.zoom-btn--reset {
  font-size: 0.8rem;
}

.zoom-percent-badge {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--wl-primary);
  min-width: 48px;
  text-align: center;
}

.zoom-hint {
  font-size: 0.75rem;
  color: var(--wl-muted);
}

.inspect-viewport {
  position: relative;
  user-select: none;
  touch-action: none;
}

.inspect-viewport.is-zoomed {
  cursor: grab;
}

.inspect-viewport.is-dragging {
  cursor: grabbing;
}

/* ── Responsive Media Queries ── */
@media (max-width: 1024px) {
  .pdp-main-grid {
    grid-template-columns: 1fr;
    gap: var(--space-8);
  }
}

@media (max-width: 860px) {
  .pdp-inquiry-panel {
    grid-template-columns: 1fr;
    gap: var(--space-6);
  }
}

@media (max-width: 640px) {
  .pdp-view {
    padding: var(--space-4) var(--space-3) var(--space-10);
  }
  .pdp-image-viewport {
    min-height: 300px;
    max-height: 360px;
    padding: var(--space-6) var(--space-4);
  }
  .pdp-hero-image {
    max-height: 280px;
  }
  .pdp-order-actions {
    flex-direction: column;
    align-items: stretch;
  }
  .pdp-qty-stepper {
    width: 100%;
    justify-content: space-between;
  }
  .stepper-btn {
    flex: 1;
  }
  .pdp-cta-group {
    flex-direction: column;
  }
  .inquiry-form {
    grid-template-columns: 1fr;
  }
  .spec-row {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-1);
  }
  .spec-row dd {
    text-align: start;
  }
}

[dir='rtl'] .spec-row dd {
  text-align: start;
}
[dir='rtl'] .pdp-tab-btn.is-active {
  border-bottom-color: var(--wl-primary);
}
</style>





