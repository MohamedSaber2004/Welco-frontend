<script setup lang="ts">
import { computed, ref, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { authService, services, contentRepository, companyRepository } from '../di/container'
import { t, locale } from '../i18n'
import type { CategoryDto, ProductDto } from '../domain/models/marketplace'
import type { CertificationDto } from '../domain/models/certification'
import type { LandingPageDto } from '../domain/models/content'
import type { CompanyDto } from '../domain/models/company'
import { toastService } from '../infrastructure/feedback/toast.service'
import DataState from '../components/ui/DataState.vue'
import SkeletonLoader from '../components/ui/SkeletonLoader.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import BaseButton from '../components/ui/BaseButton.vue'
import AppImage from '../components/ui/AppImage.vue'
import ImageViewer from '../components/ui/ImageViewer.vue'
import { formatPrice } from '../utils/format'
import { useCart } from '../composables/useCart'

const router = useRouter()
const { add: addToCart } = useCart()
const heroSearch = ref('')
const goSearch = () => {
  void router.push({ name: 'marketplace', query: heroSearch.value ? { search: heroSearch.value } : {} })
}

const cats = ref<CategoryDto[]>([])
const certifications = ref<CertificationDto[]>([])
const aboutPage = ref<LandingPageDto | null>(null)
const providers = ref<CompanyDto[]>([])
const providersLoading = ref(true)
const certificationsLoading = ref(true)
const mostSellingProducts = ref<ProductDto[]>([])
const mostSellingLoading = ref(true)

const imageViewer = ref({
  isOpen: false,
  src: null as string | null,
  alt: '',
})

function openImageViewer(src: string | null | undefined, alt: string) {
  if (!src) return
  imageViewer.value = { isOpen: true, src, alt }
}

function closeImageViewer() {
  imageViewer.value = { isOpen: false, src: null, alt: '' }
}

const handleAddToQuote = (id: string) => {
  const p = mostSellingProducts.value.find((x) => x.id === id)
  if (!p) return
  addToCart(p, 1)
  toastService.success(
    t('catalog.quoteSuccess', { product: localized(p.nameEn, p.nameAr) }),
  )
}

/* ── Category → providers → products, served by backend endpoints ── */
const expandedProviderId = ref<string | null>(null)
const tileProductPage = ref(1)
const tileProducts = ref<ProductDto[]>([])
const tileTotal = ref(0)
const tileLoading = ref(false)
const TILE_PAGE_SIZE = 4
const tileTotalPages = computed(() => Math.max(1, Math.ceil(tileTotal.value / TILE_PAGE_SIZE)))

const fetchTilePage = async () => {
  const id = expandedProviderId.value
  if (!id) return
  tileLoading.value = true
  try {
    const res = await companyRepository.getCompanyProducts(id, { page: tileProductPage.value, pageSize: TILE_PAGE_SIZE })
    tileProducts.value = Array.isArray(res?.data) ? res.data : []
    tileTotal.value = res?.totalCount ?? tileProducts.value.length
  } catch {
    tileProducts.value = []
    tileTotal.value = 0
  } finally {
    tileLoading.value = false
  }
}
const toggleProvider = (id: string) => {
  if (expandedProviderId.value === id) {
    expandedProviderId.value = null
    return
  }
  expandedProviderId.value = id
  tileProductPage.value = 1
  void fetchTilePage()
}
watch(tileProductPage, () => { void fetchTilePage() })

const explorerCatId = ref<string | null>(null)
const explorerProviderPage = ref(1)
const EXPLORER_PROVIDER_PAGE_SIZE = 5

const explorerProviders = ref<CompanyDto[]>([])
const explorerProviderTotal = ref(0)
const explorerProvidersLoading = ref(false)
const explorerProviderTotalPages = computed(() =>
  Math.max(1, Math.ceil(explorerProviderTotal.value / EXPLORER_PROVIDER_PAGE_SIZE)),
)

/* ══ Section 1 — Browse by Category: server-paginated (GET /categories) ══ */
const CAT_PAGE_SIZE = 8
const catsLoading = ref(false)
const catsTotal = ref(0)
const catPage = ref(1)
const catTotalPages = computed(() => Math.max(1, Math.ceil(catsTotal.value / CAT_PAGE_SIZE)))

const loadCats = async (page = 1) => {
  catsLoading.value = true
  try {
    const res = await services.marketplaceRepository.getCategoriesPaginated({
      pageNumber: page,
      pageSize: CAT_PAGE_SIZE,
    })
    cats.value = Array.isArray(res?.data) ? res.data : []
    catsTotal.value = res?.totalCount ?? cats.value.length
  } catch {
    cats.value = []
    catsTotal.value = 0
  } finally {
    catsLoading.value = false
  }
}
watch(catPage, (p) => { void loadCats(p) })

/* ══ Section 2 — Browse by Clinical Specialty: all categories, filters providers ══ */
const SPECIALTY_PREVIEW_COUNT = 8
const allCats = ref<CategoryDto[]>([])
const specialtyQuery = ref('')
const showAllSpecialties = ref(false)

const specialtySearchActive = computed(() => specialtyQuery.value.trim().length > 0)

const loadAllCats = async () => {
  try {
    allCats.value = await services.marketplaceRepository.getCategories()
  } catch {
    allCats.value = []
  }
}

/* Filtered client-side: the full set is already loaded for this filter. */
const matchingSpecialties = computed(() => {
  const q = specialtyQuery.value.trim().toLowerCase()
  if (!q) return allCats.value
  return allCats.value.filter((c) =>
    [c.nameEn, c.nameAr, c.slug].some((v) => (v ? String(v).toLowerCase().includes(q) : false)),
  )
})

/* Show a preview of 8; searching reveals every match without expanding. */
const visibleSpecialties = computed(() =>
  specialtySearchActive.value || showAllSpecialties.value
    ? matchingSpecialties.value
    : matchingSpecialties.value.slice(0, SPECIALTY_PREVIEW_COUNT),
)

const canExpandSpecialties = computed(
  () => !showAllSpecialties.value && matchingSpecialties.value.length > SPECIALTY_PREVIEW_COUNT,
)

const toggleShowAllSpecialties = () => {
  showAllSpecialties.value = !showAllSpecialties.value
}

const clearSpecialtySearch = () => {
  specialtyQuery.value = ''
}

/* Keep the provider explorer on a specialty the user can still see. */
watch(matchingSpecialties, (list) => {
  const first = list[0]
  if (!first) return
  if (!explorerCatId.value || !list.some((c) => c.id === explorerCatId.value)) {
    void selectExplorerCat(first.id)
  }
})

/* Roving-tabindex keyboard support for the tablist. */
const onCatExplorerKeydown = (e: KeyboardEvent, index: number) => {
  const list = visibleSpecialties.value
  if (!list.length) return
  let next = -1
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (index + 1) % list.length
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (index - 1 + list.length) % list.length
  else if (e.key === 'Home') next = 0
  else if (e.key === 'End') next = list.length - 1
  if (next < 0) return
  e.preventDefault()
  const target = list[next]
  if (!target) return
  void selectExplorerCat(target.id)
  void nextTick(() => {
    document.querySelector<HTMLButtonElement>(`[data-cat-pill="${target.id}"]`)?.focus()
  })
}

const fetchExplorerProviders = async () => {
  if (!explorerCatId.value) return
  explorerProvidersLoading.value = true
  try {
    const res = await services.marketplaceRepository.getCategoryProviders(explorerCatId.value, {
      page: explorerProviderPage.value,
      pageSize: EXPLORER_PROVIDER_PAGE_SIZE,
    })
    explorerProviders.value = Array.isArray(res?.data) ? res.data : []
    explorerProviderTotal.value = res?.totalCount ?? explorerProviders.value.length
  } catch {
    explorerProviders.value = []
    explorerProviderTotal.value = 0
  } finally {
    explorerProvidersLoading.value = false
  }
}

const selectExplorerCat = (id: string) => {
  explorerCatId.value = id
  explorerProviderPage.value = 1
  void fetchExplorerProviders()
}
const openProviderStorefront = (id: string) => {
  void router.push({
    name: 'provider-storefront',
    params: { id },
    query: explorerCatId.value ? { category: explorerCatId.value } : undefined,
  })
}
watch(explorerProviderPage, () => { void fetchExplorerProviders() })

onMounted(() => {
  // Fire calls independently in parallel so the Hero displays immediately and sections populate smoothly
  services.marketplaceRepository
    .getMostSellingProducts(8)
    .then((items) => {
      // Filter out test / dummy products (e.g. sku-9876)
      mostSellingProducts.value = (items || []).filter(
        (p) => p && p.sku !== 'sku-9876' && !p.nameEn?.toLowerCase().includes('test') && !p.nameAr?.includes('اختبار'),
      )
    })
    .catch(() => {
      mostSellingProducts.value = []
    })
    .finally(() => {
      mostSellingLoading.value = false
    })

  loadAllCats().then(() => {
    cats.value = allCats.value.slice(0, CAT_PAGE_SIZE)
    catsTotal.value = allCats.value.length
    catsLoading.value = false
  })

  companyRepository
    .getProvidersDirectory({ pageNumber: 1, pageSize: 8 })
    .then((p) => {
      if (p?.statusCode === 401 || !p?.data?.length) {
        providers.value = []
      } else {
        providers.value = p.data.slice(0, 8)
      }
    })
    .catch(() => {
      providers.value = []
    })
    .finally(() => {
      providersLoading.value = false
    })

  services.certificationService
    .load()
    .then(() => {
      certifications.value = services.certificationService.certifications.value
    })
    .catch(() => {
      certifications.value = []
    })
    .finally(() => {
      certificationsLoading.value = false
    })

  contentRepository
    .getLandingPageBySlug('about-us')
    .then((p) => {
      aboutPage.value = p && p.isActive !== false ? p : null
    })
    .catch(() => null)
})

const localized = (en?: string | null, ar?: string | null) => locale.value === 'ar' ? (ar || en || '') : (en || ar || '')

const priceModalOpen = ref(false)
const priceSubmitting = ref(false)
const priceSubmitted = ref(false)
const priceRefId = ref('')
const priceForm = ref({
  fullName: '',
  email: '',
  phone: '',
  organization: '',
  specialty: 'General Surgery',
  details: '',
  timeline: 'standard',
})

const openPriceModal = () => {
  const u = authService.user.value
  if (u) {
    if (!priceForm.value.fullName) priceForm.value.fullName = u.fullName || ''
    if (!priceForm.value.email) priceForm.value.email = u.email || ''
    if (!priceForm.value.phone) priceForm.value.phone = u.phoneNumber || ''
  }
  priceSubmitted.value = false
  priceModalOpen.value = true
}

const handlePriceSubmit = async () => {
  if (!priceForm.value.fullName.trim() || !priceForm.value.email.trim() || !priceForm.value.details.trim()) {
    toastService.error(t('auth.errGeneric'))
    return
  }
  priceSubmitting.value = true
  try {
    const refNum = `RFQ-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`
    priceRefId.value = refNum

    const companyId = authService.user.value?.companyId
    if (authService.isAuthenticated && services.salesRepository && companyId) {
      try {
        await services.salesRepository.createRfq({
          companyId,
          note: `[Fast Price Quote (${refNum})] Specialty: ${priceForm.value.specialty} | Org: ${priceForm.value.organization} | Timeline: ${priceForm.value.timeline}\n\nInstruments & Requirements:\n${priceForm.value.details}`,
          items: [],
        })
      } catch {}
    }

    priceSubmitted.value = true
    toastService.success(t('home.quoteSubmittedDesc'))
  } catch (e) {
    toastService.error(e instanceof Error ? e.message : t('common.error'))
  } finally {
    priceSubmitting.value = false
  }
}

const navigateToOemFromModal = () => {
  priceModalOpen.value = false
  void router.push({ name: 'oem' })
}
</script>

<template>
  <div class="home">
    <header class="hero">
      <div class="hero__glow" aria-hidden="true"></div>
      <div class="hero__inner">
        <div class="hero__copy">
          <h1 class="hero__title">
            {{ t('home.heroTitle') }} <span class="hero__title-accent">{{ t('home.heroTitleAccent') }}</span>
          </h1>
          <p class="hero__subtitle">{{ t('home.heroSubtitle') }}</p>

          <div class="hero__search">
            <form class="hero__search-bar" @submit.prevent="goSearch">
              <span class="material-symbols-outlined hero__search-icon" aria-hidden="true">search</span>
              <input
                v-model="heroSearch"
                :placeholder="locale === 'ar' ? 'ابحث برقم SKU أو اسم الأداة أو المعيار...' : 'Search SKU, instrument name or DIN standard...'"
                aria-label="Search surgical instruments"
              />
              <button
                v-if="heroSearch"
                type="button"
                class="hero__search-clear"
                @click="heroSearch = ''"
              >
                <span class="material-symbols-outlined text-[16px]">close</span>
              </button>
              <button class="hero__search-btn" type="submit">
                <span>{{ t('common.searchPlaceholder') }}</span>
                <span class="material-symbols-outlined hero__btn-arrow" aria-hidden="true">arrow_forward</span>
              </button>
            </form>
            <div class="hero__trust-strip">
              <span class="hero__trust-badge">
                <span class="material-symbols-outlined trust-icon">verified</span>
                <span class="mono">ISO 13485 ✓</span>
              </span>
              <span class="hero__trust-sep" aria-hidden="true">&bull;</span>
              <span class="hero__trust-badge">
                <span class="material-symbols-outlined trust-icon">check_circle</span>
                <span class="mono">{{ t('catalog.ceCertified') }} ✓</span>
              </span>
              <span class="hero__trust-sep" aria-hidden="true">&bull;</span>
              <span class="hero__trust-badge">
                <span class="material-symbols-outlined trust-icon">public</span>
                <span class="mono">40+ Countries 🌍</span>
              </span>
            </div>
          </div>

          <div class="hero__ctas">
            <button class="btn btn-primary btn-lg" type="button" @click="router.push({ name: 'marketplace' })">
              <span class="material-symbols-outlined text-[19px]">explore</span>
              <span>{{ t('nav.marketplace') }}</span>
            </button>
            <button class="btn btn-secondary btn-lg" type="button" @click="openPriceModal">
              <span class="material-symbols-outlined text-[19px]">request_quote</span>
              <span>{{ t('home.requestQuote') }}</span>
            </button>
          </div>
        </div>

        <div class="hero__logo-showcase">
          <div class="logo-showcase__card">
            <div class="logo-showcase__glow" aria-hidden="true"></div>
            <div class="logo-showcase__frame">
              <img
                src="/logo-512.png"
                alt="Welco Surgical Instruments"
                class="logo-showcase__img"
                width="280"
                height="280"
                loading="eager"
              />
            </div>
          </div>
        </div>
      </div>
    </header>

    <!-- Most Products Selling Section (First section after hero) -->
    <section class="section section--most-selling" aria-labelledby="most-selling-heading">
      <div class="section__inner">
        <div class="section-head">
          <div>
            <div class="mono section__eyebrow">{{ t('home.mostSellingEyebrow') }}</div>
            <h2 id="most-selling-heading" class="section-title">{{ t('home.mostSellingTitle') }}</h2>
          </div>
          <router-link to="/most-selling" class="btn btn-ghost btn-sm view-all-btn">
            <span>{{ t('common.viewAll') }}</span>
            <span class="icon--directional">→</span>
          </router-link>
        </div>
        <p class="section-desc">{{ t('home.mostSellingSubtitle') }}</p>

        <DataState
          :loading="mostSellingLoading && !mostSellingProducts.length"
          :empty="!mostSellingProducts.length && !mostSellingLoading"
          skeleton-type="product-card"
          :skeleton-count="4"
          min-height="250px"
        >
          <div class="product-grid">
            <article
              v-for="p in mostSellingProducts"
              :key="p.id"
              class="product-card"
              @click="router.push({ name: 'marketplace-product', params: { id: p.id } })"
            >
              <div class="product-card__media">
                <AppImage
                  :src="p.imageName"
                  placeholder-type="product"
                  :alt="localized(p.nameEn, p.nameAr)"
                  fit="cover"
                  class="product-card__img"
                />
                <div class="product-card__badges">
                  <span v-if="p.isNew" class="mono product-badge product-badge--new">{{ t('home.newBadge') }}</span>
                  <span
                    class="mono product-stock-badge"
                    :class="p.stock > 0 ? 'product-stock-badge--in' : 'product-stock-badge--out'"
                  >
                    <span class="stock-dot" :class="p.stock > 0 ? 'stock-dot--in' : 'stock-dot--out'"></span>
                    <span>{{ p.stock > 0 ? t('catalog.inStock') : t('catalog.madeToOrder') }}</span>
                  </span>
                </div>
              </div>
              <div class="product-card__body">
                <div class="mono product-card__category" dir="auto">{{ localized(p.categoryNameEn, p.categoryNameAr) }}</div>
                <h3 class="product-card__title" dir="auto">{{ localized(p.nameEn, p.nameAr) }}</h3>
                <div class="mono product-card__meta-alt" dir="auto">{{ locale === 'en' ? p.nameAr : p.nameEn }}</div>
                <div class="product-card__provider">
                  <span class="material-symbols-outlined provider-icon" aria-hidden="true">storefront</span>
                  <span class="provider-label">{{ locale === 'ar' ? 'المورد:' : 'Supplier:' }}</span>
                  <span class="provider-value" dir="auto">
                    {{ p.companyName || localized(p.supplierNameEn, p.supplierNameAr) || localized(p.manufacturerEn, p.manufacturerAr) || t('catalog.fallbackMfr') }}
                  </span>
                </div>
                <div class="product-card__foot">
                  <div class="price-wrap mono">
                    <span class="price-amount mono-num">{{ formatPrice(p.price, locale) }}</span>
                    <span class="price-currency">{{ p.currencySymbol || '$' }}</span>
                  </div>
                  <button class="btn btn-primary btn-sm btn-quote-white" type="button" @click.stop="handleAddToQuote(p.id)">
                    <span class="material-symbols-outlined text-[15px]">add_shopping_cart</span>
                    <span>{{ t('marketplace.addToQuote') }}</span>
                  </button>
                </div>
              </div>
            </article>
          </div>
        </DataState>
      </div>
    </section>

    <!-- Our Providers Section -->
<section class="section section--providers" aria-labelledby="providers-heading">
  <div class="section__inner">
    <div class="section-head">
      <div>
        <div class="mono section__eyebrow">{{ t('home.ourProvidersEyebrow') }}</div>
        <h2 id="providers-heading" class="section-title">{{ t('home.ourProviders') }}</h2>
      </div>
      <router-link to="/providers" class="btn btn-ghost btn-sm view-all-btn">
        <span>{{ t('common.viewAll') }}</span>
        <span class="icon--directional">→</span>
      </router-link>
    </div>
    <p class="section-desc">{{ t('home.ourProvidersSubtitle') }}</p>

    <DataState :loading="providersLoading && !providers.length" :empty="!providers.length && !providersLoading" skeleton-type="provider-grid" :skeleton-count="4" min-height="250px">
      <div class="providers-strip-grid">
        <article
          v-for="p in providers"
          :key="p.id"
          class="provider-tile"
          :class="{ 'is-expanded': expandedProviderId === p.id }"
        >
          <button
            type="button"
            class="provider-tile__main"
            :aria-expanded="expandedProviderId === p.id"
            @click="toggleProvider(p.id)"
          >
            <div class="provider-tile__logo">
              <AppImage
                :src="p.imageName"
                placeholder-type="company"
                :alt="p.name"
                fit="contain"
                height="70px"
              />
            </div>
            <div class="provider-tile__info">
              <div class="provider-tile__top">
                <span class="provider-tile__badge mono">
                  {{ t('home.verifiedSupplier') }}
                </span>
              </div>
              <h3 class="provider-tile__name" dir="auto">{{ p.name }}</h3>
              <div v-if="p.countryNameEn || p.countryNameAr" class="provider-tile__country mono">
                <span class="material-symbols-outlined text-[13px] text-teal-600">public</span>
                <span>{{ localized(p.countryNameEn, p.countryNameAr) }}</span>
              </div>
            </div>
          </button>
          <div class="provider-tile__foot">
            <span class="mono provider-tile__count">{{ t('provider.providerProducts') }}</span>
            <span class="material-symbols-outlined provider-tile__chev" :class="{ 'is-open': expandedProviderId === p.id }" aria-hidden="true">expand_more</span>
          </div>
          <div v-if="expandedProviderId === p.id" class="provider-tile__products">
            <div v-if="tileLoading" role="status"><SkeletonLoader type="provider-cards" :count="2" /></div>
            <div v-else-if="!tileProducts.length" class="mono provider-tile__empty">{{ t('provider.noProviderProducts') }}</div>
            <div v-else class="provider-mini-grid">
              <button
                v-for="prod in tileProducts"
                :key="prod.id"
                type="button"
                class="provider-mini"
                @click="router.push({ name: 'marketplace-product', params: { id: prod.id } })"
              >
                <AppImage
                  :src="prod.imageName"
  placeholder-type="product"
  :alt="localized(prod.nameEn, prod.nameAr)"
                  fit="contain"
                  class="provider-mini__img"
                />
                <span class="provider-mini__name" dir="auto">{{ localized(prod.nameEn, prod.nameAr) }}</span>
                <span class="provider-mini__price mono-num">{{ formatPrice(prod.price, locale) }} {{ prod.currencySymbol || '$' }}</span>
              </button>
            </div>
            <div v-if="tileTotalPages > 1" class="provider-pager">
              <button type="button" class="page-btn" :disabled="tileProductPage <= 1" :aria-label="t('common.prev')" @click="tileProductPage--">
                <span class="material-symbols-outlined text-[16px] icon--directional">chevron_left</span>
              </button>
              <span class="mono provider-pager__num">{{ tileProductPage }} / {{ tileTotalPages }}</span>
              <button type="button" class="page-btn" :disabled="tileProductPage >= tileTotalPages" :aria-label="t('common.next')" @click="tileProductPage++">
                <span class="material-symbols-outlined text-[16px] icon--directional">chevron_right</span>
              </button>
            </div>
            <router-link :to="{ name: 'provider-storefront', params: { id: p.id } }" class="provider-viewall mono">
              <span>{{ t('provider.viewCatalog') }}</span>
              <span class="material-symbols-outlined text-[14px] icon--directional">arrow_forward</span>
            </router-link>
          </div>
        </article>
      </div>
    </DataState>
  </div>
</section>

    <section class="section section--category" aria-labelledby="cat-heading">
      <div class="section__inner">
        <div class="section-head">
          <div>
            <div class="mono section__eyebrow">{{ t('home.browseByCategory') }}</div>
            <h2 id="cat-heading" class="section-title">{{ t('marketplace.categoriesTitle') }}</h2>
          </div>
          <router-link to="/categories" class="btn btn-ghost btn-sm view-all-btn">
            <span>{{ t('common.viewAll') }}</span>
            <span class="icon--directional">→</span>
          </router-link>
        </div>

        <DataState
          :loading="catsLoading && !cats.length"
          :empty="!cats.length && !catsLoading"
          skeleton-type="category-grid"
          :skeleton-count="8"
          min-height="160px"
        >
          <div class="cat-grid">
            <router-link
              v-for="c in cats"
              :key="c.id"
              :to="{ name: 'category-providers', params: { id: c.id } }"
              class="cat-card"
            >
              <div class="cat-media" @click.stop="openImageViewer(c.imageName, localized(c.nameEn, c.nameAr))">
                <AppImage
                  :src="c.imageName"
                  placeholder-type="category"
                  :placeholder-text="''"
                  :alt="localized(c.nameEn, c.nameAr)"
                  class="cat-media__img"
                  loading="eager"
                />
              </div>
              <div class="cat-body">
                <div class="cat-name" dir="auto">{{ localized(c.nameEn, c.nameAr) }}</div>
                <div class="cat-name-alt mono" dir="auto">{{ locale === 'en' ? c.nameAr : c.nameEn }}</div>
                <span class="mono cat-count">{{ t('landing.instrumentsCount', { count: c.productCount ?? 0 }) }}</span>
              </div>
            </router-link>
          </div>
        </DataState>

        <div v-if="catTotalPages > 1" class="cat-pager">
          <button
            type="button"
            class="page-btn"
            :disabled="catPage <= 1 || catsLoading"
            :aria-label="t('common.prev')"
            @click="catPage--"><span class="material-symbols-outlined text-[16px] icon--directional">chevron_left</span></button>
          <span class="mono cat-pager__num">{{ catPage }} / {{ catTotalPages }}</span>
          <button
            type="button"
            class="page-btn"
            :disabled="catPage >= catTotalPages || catsLoading"
            :aria-label="t('common.next')"
            @click="catPage++"><span class="material-symbols-outlined text-[16px] icon--directional">chevron_right</span></button>
        </div>
      </div>
    </section>

    <section class="section section--clinical" aria-labelledby="specialty-heading">
      <div class="section__inner">
        <div class="section-head">
          <div>
            <div class="mono section__eyebrow">{{ t('home.browseClinicalSpecialty') }}</div>
            <h2 id="specialty-heading" class="section-title">{{ t('marketplace.filterBySpecialty') }}</h2>
          </div>
        </div>

        <div class="cat-explorer card">
          <div class="cat-filter">
            <div class="cat-filter__field">
              <span class="material-symbols-outlined cat-filter__icon" aria-hidden="true">search</span>
              <label class="sr-only" for="specialty-filter-input">{{ t('home.searchSpecialties') }}</label>
              <input
                id="specialty-filter-input"
                v-model="specialtyQuery"
                type="search"
                class="cat-filter__input mono"
                :placeholder="t('home.searchSpecialties')"
                autocomplete="off"
                aria-describedby="specialty-filter-count"
              />
              <button
                v-if="specialtySearchActive"
                type="button"
                class="cat-filter__clear"
                :aria-label="t('home.clearSpecialtySearch')"
                @click="clearSpecialtySearch"
              >
                <span class="material-symbols-outlined" aria-hidden="true">close</span>
              </button>
            </div>
            <p id="specialty-filter-count" class="cat-filter__count mono" role="status" aria-live="polite">
              {{ t('home.specialtiesFound', { shown: visibleSpecialties.length, total: matchingSpecialties.length }) }}
            </p>
          </div>

          <div v-if="specialtySearchActive && !matchingSpecialties.length" class="cat-no-results">
            <span class="material-symbols-outlined cat-no-results__icon" aria-hidden="true">search_off</span>
            <p class="cat-no-results__text">
              {{ t('home.noSpecialtiesMatch', { q: specialtyQuery.trim() }) }}
            </p>
            <button type="button" class="btn btn-ghost btn-sm" @click="clearSpecialtySearch">
              {{ t('home.clearSpecialtySearch') }}
            </button>
          </div>

          <div v-else class="cat-explorer__intro">
            <div>
              <h3 class="cat-explorer__heading">{{ t('marketplace.filterBySpecialty') }}</h3>
            </div>
          </div>
          <div v-if="visibleSpecialties.length" class="cat-explorer__pills" role="tablist" :aria-label="t('marketplace.filterBySpecialty')">
              <button
                v-for="(c, index) in visibleSpecialties"
                :id="`cat-tab-${c.id}`"
                :key="c.id"
                :data-cat-pill="c.id"
                type="button"
                role="tab"
                class="pill cat-explorer__pill"
                :aria-label="`${localized(c.nameEn, c.nameAr)} · ${index + 1}`"
              :class="{ 'pill--active': explorerCatId === c.id }"
                :aria-selected="explorerCatId === c.id"
                :aria-controls="'cat-tabpanel'"
                :tabindex="explorerCatId === c.id ? 0 : -1"
                @click="selectExplorerCat(c.id)"
                @keydown="onCatExplorerKeydown($event, index)"
            >
              {{ localized(c.nameEn, c.nameAr) }}
            </button>
          </div>

          <div v-if="canExpandSpecialties || showAllSpecialties" class="cat-expand">
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              :aria-expanded="showAllSpecialties"
              @click="toggleShowAllSpecialties"
            >
              <span>{{ showAllSpecialties ? t('home.showFewerSpecialties') : t('home.showAllSpecialties', { count: matchingSpecialties.length }) }}</span>
              <span class="material-symbols-outlined icon--directional" aria-hidden="true">
                {{ showAllSpecialties ? 'expand_less' : 'expand_more' }}
              </span>
            </button>
          </div>

          <div
            v-if="explorerCatId"
            id="cat-tabpanel"
            class="cat-explorer__body"
            role="tabpanel"
            :aria-labelledby="`cat-tab-${explorerCatId}`"
            tabindex="0"
          >
            <div class="cat-explorer__head">
              <h3 class="cat-explorer__title">{{ t('provider.providersInCategory') }}</h3>
              <router-link :to="{ name: 'category-providers', params: { id: explorerCatId } }" class="provider-viewall mono">
                <span>{{ t('common.viewAll') }}</span>
                <span class="icon--directional">→</span>
              </router-link>
            </div>
            <Transition name="explorer-fade" mode="out-in">
              <div v-if="explorerProvidersLoading" key="loading" role="status" aria-label="Loading providers" class="cat-explorer__loading-wrap">
                <SkeletonLoader type="provider-cards" :count="5" />
              </div>
              <div v-else-if="!explorerProviders.length" key="empty" class="mono cat-explorer__empty">
                {{ t('provider.noProvidersHere') }}
              </div>
              <div v-else key="content">
                <div class="cat-explorer__providers">
                  <button
                    v-for="prov in explorerProviders"
                    :key="prov.id"
                    type="button"
                    class="cat-provider"
                    :aria-label="`${prov.name} · ${t('provider.viewCatalog')}`"
                    @click="openProviderStorefront(prov.id)"
                  >
                    <AppImage
                      :src="prov.imageName"
                      placeholder-type="company"
                      :placeholder-text="''"
                      :alt="prov.name"
                      fit="contain"
                      class="cat-provider__img"
                    />
                    <span class="cat-provider__name" dir="auto">{{ prov.name }}</span>
                    <span v-if="prov.countryNameEn || prov.countryNameAr" class="cat-provider__country mono">
                      {{ localized(prov.countryNameEn, prov.countryNameAr) }}
                    </span>
                    <span class="cat-provider__cta mono">{{ t('provider.viewCatalog') }} <span class="icon--directional">→</span></span>
                  </button>
                </div>
                <div v-if="explorerProviderTotalPages > 1" class="provider-pager">
                  <button type="button" class="page-btn" :disabled="explorerProviderPage <= 1" @click="explorerProviderPage--">‹</button>
                  <span class="mono provider-pager__num">{{ explorerProviderPage }} / {{ explorerProviderTotalPages }}</span>
                  <button type="button" class="page-btn" :disabled="explorerProviderPage >= explorerProviderTotalPages" @click="explorerProviderPage++">›</button>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </section>
    <!-- Audited Quality Standards Section -->
    <section class="section section--certs" aria-labelledby="home-certs-heading">
      <div class="section__inner">
        <div class="section-head">
          <div>
            <div class="mono section__eyebrow">{{ t('certifications.eyebrow') }}</div>
            <h2 id="home-certs-heading" class="section-title">{{ t('certifications.certsTitle') }}</h2>
          </div>
          <router-link to="/certifications" class="btn btn-ghost btn-sm view-all-btn">
            <span>{{ t('common.viewAll') }}</span>
            <span class="icon--directional">→</span>
          </router-link>
        </div>
        <DataState :loading="certificationsLoading && !certifications.length" :empty="!certifications.length && !certificationsLoading" skeleton-type="cert-grid" :skeleton-count="4" min-height="300px">
          <div class="home-certs-grid">
            <article
              v-for="c in certifications.filter(c => c.isActive).slice(0, 4)"
              :key="c.id"
              class="home-cert-card"
              @click="router.push('/certifications')"
            >
              <div class="home-cert-card__media" @click.stop="openImageViewer(c.certificationImageName, c.title)">
                <AppImage
                  :src="c.certificationImageName"
                  placeholder-type="document"
                  :placeholder-text="c.certificateNumber || c.title"
                  :alt="c.title"
                  aspect-ratio="16/10"
                  fit="contain"
                  loading="eager"
                />
              </div>
              <div class="home-cert-card__body">
                <div class="home-cert-card__badge mono">{{ c.certificateNumber || 'ISO / CE' }}</div>
                <h3 class="home-cert-card__title">{{ c.title }}</h3>
                <div class="home-cert-card__meta mono">{{ c.issuer }}</div>
              </div>
            </article>
          </div>
        </DataState>
      </div>
    </section>
    <section class="section section--about" aria-labelledby="about-heading">
      <div class="section__inner about-grid">
        <div class="about-content">
          <div class="mono section__eyebrow">{{ t('home.aboutEyebrow') }}</div>
          <h2 id="about-heading" class="section-title">{{ aboutPage?.heroTitle || t('home.aboutTitle') }}</h2>
          <p class="about-body">{{ aboutPage?.heroBody || t('home.aboutBody') }}</p>
          <p v-if="aboutPage?.contentBlock" class="about-body">{{ aboutPage.contentBlock }}</p>
          <div class="about-ctas">
            <router-link to="/marketplace" class="btn btn-primary">
              <span>{{ t('home.browseComplete') }}</span>
              <span class="icon--directional">→</span>
            </router-link>
            <router-link to="/about" class="btn btn-secondary">
              <span>{{ t('home.learnMoreAbout') }}</span>
            </router-link>
            <router-link to="/oem" class="btn btn-secondary">
              <span>{{ t('nav.oem') }}</span>
            </router-link>
          </div>
        </div>
<div class="about-media">
          <img src="/logo.jpeg" alt="Welco" class="about-media__img" loading="lazy" />
        </div>
      </div>
    </section>

<!-- Request Institutional Price Quote Modal -->
    <BaseModal v-model="priceModalOpen" :title="t('home.quoteModalTitle')" max-width="580px">
      <div v-if="priceSubmitted" class="quote-modal-success">
        <h3 class="success-head">{{ t('home.quoteSubmittedTitle') }}</h3>
        <p class="success-body">{{ t('home.quoteSubmittedDesc') }}</p>

        <div class="ref-ticket-box mono">
          <span class="ref-label">{{ t('home.quoteReference') }}:</span>
          <span class="ref-code">{{ priceRefId }}</span>
        </div>

        <div class="modal-success-actions">
          <BaseButton variant="primary" block @click="priceModalOpen = false">
            {{ t('common.close') }}
          </BaseButton>
          <button type="button" class="btn-link-oem mono" @click="navigateToOemFromModal">
            <span>{{ t('home.quoteOemLink') }}</span>
            <span class="icon--directional">→</span>
          </button>
        </div>
      </div>

      <form v-else class="quote-modal-form" @submit.prevent="handlePriceSubmit">
        <p class="quote-modal-desc">{{ t('home.quoteModalSubtitle') }}</p>

        <div class="modal-2col">
          <div class="modal-field">
            <label class="modal-lbl mono">{{ t('auth.fullName') }} *</label>
            <input v-model="priceForm.fullName" class="modal-inp" required :placeholder="t('auth.fullName')" />
          </div>
          <div class="modal-field">
            <label class="modal-lbl mono">{{ t('auth.email') }} *</label>
            <input v-model="priceForm.email" type="email" class="modal-inp" required :placeholder="t('auth.email')" />
          </div>
        </div>

        <div class="modal-2col">
          <div class="modal-field">
            <label class="modal-lbl mono">{{ t('home.quoteOrganization') }}</label>
            <input v-model="priceForm.organization" class="modal-inp" :placeholder="t('home.quoteOrganization')" />
          </div>
          <div class="modal-field">
            <label class="modal-lbl mono">{{ t('auth.phoneNumber') }}</label>
            <input v-model="priceForm.phone" class="modal-inp" :placeholder="t('auth.phoneNumber')" />
          </div>
        </div>

        <div class="modal-2col">
          <div class="modal-field">
            <label class="modal-lbl mono">{{ t('home.quoteSpecialty') }}</label>
            <select v-model="priceForm.specialty" class="modal-sel">
              <option value="General Surgery">General Surgery</option>
              <option value="Cardiovascular & Thoracic">Cardiovascular &amp; Thoracic</option>
              <option value="Orthopedics & Trauma">Orthopedics &amp; Trauma</option>
              <option value="Neurosurgery & Spine">Neurosurgery &amp; Spine</option>
              <option value="Ophthalmology">Ophthalmology</option>
              <option value="Dental & Maxillofacial">Dental &amp; Maxillofacial</option>
              <option value="Custom Sterile Sets">Custom Sterile Sets</option>
              <option value="Other Surgical Line">Other Surgical Line</option>
            </select>
          </div>
          <div class="modal-field">
            <label class="modal-lbl mono">{{ t('home.quoteTimeline') }}</label>
            <select v-model="priceForm.timeline" class="modal-sel">
              <option value="immediate">{{ t('home.quoteTimelineImmediate') }}</option>
              <option value="standard">{{ t('home.quoteTimelineStandard') }}</option>
              <option value="annual">{{ t('home.quoteTimelineAnnual') }}</option>
            </select>
          </div>
        </div>

        <div class="modal-field">
          <label class="modal-lbl mono">{{ t('home.quoteDetails') }} *</label>
          <textarea
            v-model="priceForm.details"
            rows="3"
            class="modal-txt"
            required
            :placeholder="t('home.quoteDetailsPlaceholder')"
          ></textarea>
        </div>

        <div class="modal-oem-callout mono">
          <span>{{ t('home.quoteOemPrompt') }}</span>
          <a href="/oem" class="oem-callout-link" @click.prevent="navigateToOemFromModal">
            {{ t('home.quoteOemLink') }} <span class="icon--directional">→</span>
          </a>
        </div>

        <div class="modal-actions-row">
          <BaseButton type="submit" variant="primary" :loading="priceSubmitting" block>
            {{ t('home.quoteSubmit') }}
          </BaseButton>
          <BaseButton type="button" variant="secondary" @click="priceModalOpen = false">
            {{ t('common.cancel') }}
          </BaseButton>
        </div>
      </form>
    </BaseModal>

    <ImageViewer
      v-model:modelValue="imageViewer.isOpen"
      :src="imageViewer.src"
      :alt="imageViewer.alt"
      :show-minimize="false"
      :show-maximize="false"
      :show-fullscreen="true"
      @close="closeImageViewer"
    />
  </div>
</template>

<style scoped>
.home {
  background: var(--wl-paper);
}

/* Hero Section */
.hero {
  background: var(--wl-surface);
  border-bottom: 1px solid var(--wl-border);
  position: relative;
  overflow: hidden;
}

.hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(700px 350px at 70% 20%, rgba(105, 169, 255, 0.06), transparent 60%),
              linear-gradient(rgba(0, 10, 25, 0.02) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 10, 25, 0.02) 1px, transparent 1px);
  background-size: auto, 24px 24px, 24px 24px;
  pointer-events: none;
}

.hero::after {
  content: '';
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  height: 2px;
  background: var(--wl-laser-sweep);
  opacity: 0.35;
}
.hero__contour {
  margin-top: 1.1rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 10px;
  letter-spacing: 0.07em;
  color: var(--wl-muted);
  border-top: 1px dashed var(--wl-line);
  padding-top: 0.65rem;
}
.hero__contour strong { color: var(--wl-ink-strong); font-weight: 700; }
.hero__contour .contour-sep { color: var(--wl-line-strong); }

.hero__inner {
  max-width: var(--wl-max-width);
  margin: 0 auto;
  padding: 3.5rem var(--wl-gutter) 3rem;
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 2.75rem;
  align-items: center;
  position: relative;
}

.hero__eyebrow {
  font-size: 10.5px;
  color: var(--wl-primary);
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  letter-spacing: 0.08em;
}

.hero__logo-box {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: var(--space-8);
  box-shadow: var(--wl-shadow-card);
  position: relative;
  overflow: hidden;
}
.hero__logo-box::before {
  content: '';
  position: absolute;
  top: 0;
  inset-inline: 0;
  height: 2px;
  background: var(--wl-laser-sweep);
  opacity: 0.6;
}
.hero__logo-box img {
  width: 100%;
  height: auto;
  max-height: 220px;
  object-fit: contain;
  border-radius: var(--radius-md);
}

.hero__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--fg-success, #198754);
  box-shadow: 0 0 0 3px rgba(25, 135, 84, 0.2);
}

.hero h1 {
  font-family: var(--wl-font-display);
  font-size: clamp(2.3rem, 4.4vw, 3.3rem);
  line-height: 1.05;
  font-weight: 800;
  letter-spacing: -0.028em;
  margin: 0.65rem 0 0.8rem;
  color: var(--wl-ink-strong);
}

.hero h1 em {
   font-style: normal;
   background: var(--brand-gradient);
   -webkit-background-clip: text;
   background-clip: text;
   color: transparent;
   filter: none;
}

.hero p {
  color: var(--wl-ink-soft);
  font-size: var(--step-0);
  line-height: 1.6;
  max-width: 540px;
}

/* 48px VIP Search Bar */
.hero__search {
  max-width: 520px;
  margin-top: 1.35rem;
}

.hero__search-bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: var(--space-1) var(--space-1) var(--space-1) var(--space-3);
  box-shadow: var(--shadow-card);
  transition: border-color 0.22s var(--wl-ease-spring), box-shadow 0.22s var(--wl-ease-spring), transform 0.16s ease;
  height: 48px;
}

.hero__search-bar:focus-within {
  border-color: var(--wl-primary);
  box-shadow: var(--wl-focus-ring);
  transform: translateY(-0.5px);
}

.hero__trust-strip {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.85rem;
  flex-wrap: wrap;
}

.hero__trust-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-steel-teal, #147D92);
}

.hero__trust-badge .trust-icon {
  font-size: 15px;
  color: var(--color-surgical-cyan, #28A7A1);
}

.hero__trust-sep {
  color: var(--color-muted, #7A90A8);
  font-size: 10px;
}

.search-icon {
  font-size: 19px;
  color: var(--wl-muted);
}

.hero__search-bar input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font-size: var(--step-0);
  font-family: var(--wl-font-body);
  color: var(--wl-ink-strong);
}

.hero__search-bar input::placeholder {
  color: var(--wl-muted);
}

.hero__kbd {
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-bottom-width: 2px;
  padding: 0.15rem 0.4rem;
  border-radius: var(--radius-sm);
  font-size: 10px;
  color: var(--wl-muted);
}

.hero__search-btn {
  background: var(--wl-primary);
  color: var(--wl-on-primary);
  border: none;
  padding: 0 var(--space-5);
  height: 38px;
  border-radius: var(--radius-sm);
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  box-shadow: var(--shadow-hover);
  transition: transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
}

.hero__search-btn:hover {
  background: var(--wl-primary-hover);
  transform: translateY(-0.5px);
}

.hero__search-btn:active:not(:disabled) {
  transform: scale(0.985);
}

.hero__search-btn:focus-visible {
  outline: none;
  box-shadow: var(--wl-focus-ring);
}

.hero__search-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none !important;
}

.hero__search-btn[aria-busy="true"] {
  pointer-events: none;
}

.hero__ctas {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-6);
  flex-wrap: wrap;
}

.hero__trust {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-6);
  font-size: var(--step-0);
  color: var(--wl-muted);
  flex-wrap: wrap;
}

.hero__trust .sep {
  color: var(--wl-border);
}

.hero__trust strong {
  color: var(--wl-ink-strong);
}

/* Specification HUD Graphic */
.hero__spec-hud {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: var(--space-5);
  box-shadow: var(--wl-shadow-card);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.hero__spec-hud::before {
  content: '';
  position: absolute;
  top: 0;
  inset-inline: 0;
  height: 2px;
  background: var(--wl-laser-sweep);
}

.hud-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 10px;
}

.hud-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 700;
  color: var(--wl-primary);
}

.hud-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--wl-success);
}

.hud-live {
  font-weight: 700;
  color: var(--wl-primary);
}

.hud-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem 0;
  border-top: 1px dashed var(--wl-border);
  border-bottom: 1px dashed var(--wl-border);
}

.hud-brand-logo {
  height: 48px;
  width: auto;
  border-radius: var(--radius-sm);
  margin-bottom: 0.5rem;
}

.hud-title {
  font-size: 10.5px;
  color: var(--wl-muted);
  letter-spacing: 0.06em;
}

.hud-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.hud-cell {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  background: var(--wl-surface-soft);
  padding: var(--space-2) var(--space-2);
  border-radius: var(--radius-sm);
  border: 1px solid var(--wl-border);
}

.hud-k {
  font-size: 8.5px;
  color: var(--wl-muted);
  letter-spacing: 0.04em;
}

.hud-v {
  font-size: 11px;
  color: var(--wl-ink-strong);
  font-weight: 700;
}

.hud-foot {
  display: flex;
  justify-content: space-between;
  font-size: 9.5px;
  color: var(--wl-muted);
}

/* Sections */
.section {
  padding: var(--space-10) 0;
}

.section--soft {
  background: var(--wl-surface);
  border-top: 1px solid var(--wl-border);
  border-bottom: 1px solid var(--wl-border);
}

/* Browse by Category + Browse by Clinical Specialty — banded canvases.
   Background/border treatment is defined together further down. */
.section--category,
.section--clinical {
  border-top: 1px solid var(--wl-border);
}

.section__inner {
  max-width: var(--wl-max-width);
  margin: 0 auto;
  padding: 0 var(--wl-gutter);
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: var(--space-6);
  gap: 1rem;
  flex-wrap: wrap;
}

.view-all-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0.45rem 0.95rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--wl-border);
  background: var(--wl-surface);
  color: var(--wl-primary);
  font-size: var(--step--1);
  font-weight: 700;
  text-decoration: none;
  transition: all 0.2s ease;
}

.view-all-btn:hover {
  background: var(--wl-surface-soft);
  border-color: var(--wl-primary);
  transform: translateX(2px);
}

[dir="rtl"] .view-all-btn:hover {
  transform: translateX(-2px);
}

.view-all-btn:active:not(:disabled) {
  transform: translateX(0);
}

.view-all-btn:focus-visible {
  outline: none;
  box-shadow: var(--wl-focus-ring);
}

.view-all-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none !important;
}

.view-all-btn[aria-busy="true"] {
  pointer-events: none;
}

/* Our Providers Section */
.section--providers {
  background: var(--wl-surface-soft);
  border-bottom: 1px solid var(--wl-border);
  padding: var(--space-8) 0;
}

.section-desc {
  font-size: var(--step-0);
  color: var(--fg-muted, #627D98);
  margin: calc(var(--space-2) * -1) 0 var(--space-6);
  max-width: 680px;
}

/* Home Cards Grid - Fixed 4-column grid on desktop/laptop, centered in container */
.home-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
  max-width: var(--wl-max-width);
  margin-inline: auto;
}

/* Our Providers Section */
.section--providers {
  background: var(--wl-surface-soft);
  border-bottom: 1px solid var(--wl-border);
  padding: var(--space-8) 0;
}

.providers-strip-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
  max-width: var(--wl-max-width);
  margin-inline: auto;
}

@media (max-width: 1024px) {
  .providers-strip-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .providers-strip-grid {
    grid-template-columns: 1fr;
  }
}

.provider-tile {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  text-decoration: none;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.provider-tile:hover {
  transform: translateY(-3px);
  border-color: var(--brand, #0F3D56);
  box-shadow: var(--shadow-hover);
}

.provider-tile:active:not(:disabled) {
  transform: translateY(-1px);
}

.provider-tile:focus-visible {
  outline: none;
  box-shadow: var(--wl-focus-ring);
}

.provider-tile:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none !important;
}

.provider-tile[aria-busy="true"] {
  pointer-events: none;
}

.provider-tile__logo {
  height: 110px;
  background: linear-gradient(180deg, var(--wl-surface-soft) 0%, var(--wl-surface) 100%);
  border-bottom: 1px solid var(--wl-border);
  padding: var(--space-3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.provider-tile__info {
  padding: var(--space-3) var(--space-3);
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: var(--space-1);
}

.provider-tile__top {
  display: flex;
  align-items: center;
}

.provider-tile__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: var(--step--1);
  font-weight: 700;
  color: var(--wl-success);
  background: var(--wl-success-soft);
  border: 1px solid var(--color-success-100);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-pill);
  letter-spacing: 0.02em;
}

.provider-tile__name {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--wl-ink-strong);
  margin: 0;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.provider-tile__country {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: var(--step--1);
  color: var(--fg-muted, #627D98);
  margin-top: auto;
  padding-top: 0.25rem;
}

/* Provider tile expansion (products per provider, paginated) */
.provider-tile__main {
  display: block;
  width: 100%;
  background: none;
  border: 0;
  padding: 0;
  margin: 0;
  text-align: start;
  cursor: pointer;
  color: inherit;
  font: inherit;
}
.provider-tile__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-top: 1px solid var(--border);
  background: var(--bg-subtle);
}
.provider-tile__count {
  font-size: var(--text-xs);
  color: var(--fg-muted);
}
.provider-tile__chev {
  font-size: 20px;
  color: var(--fg-subtle);
  transition: transform var(--duration-fast) var(--ease-out);
}
.provider-tile__chev.is-open { transform: rotate(180deg); color: var(--brand); }
.provider-tile__products {
  padding: var(--space-3);
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.provider-tile__empty {
  font-size: var(--text-xs);
  color: var(--fg-subtle);
  text-align: center;
  padding: var(--space-3) 0;
}
.provider-mini-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
}
.provider-mini {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  text-align: start;
  min-width: 0;
  transition: border-color var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out);
}
.provider-mini:hover { border-color: var(--border-focus); box-shadow: var(--ring-focus); }
.provider-mini__img { width: 100%; height: 64px; border-radius: var(--radius-sm); }
.provider-mini__name {
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--fg-heading);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.provider-mini__price { font-size: var(--text-sm); color: var(--fg-body); }
.provider-pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
}
.provider-pager__num { font-size: var(--text-xs); color: var(--fg-muted); }
.provider-viewall {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--brand);
  text-decoration: none;
  padding: var(--space-1) 0;
}
.provider-viewall:hover { text-decoration: underline; }

/* Category → providers explorer — pure white card with subtle borders & soft hover */
.cat-explorer {
  margin-top: clamp(2rem, 4vw, 3.25rem);
  padding: clamp(1.25rem, 3vw, 2.25rem);
  display: flex;
  flex-direction: column;
  gap: clamp(1.25rem, 2.5vw, 1.75rem);
  border: 1px solid var(--border, #d9e2ec);
  border-radius: var(--radius-xl, 12px);
  background: #ffffff;
  box-shadow: 0 4px 20px -2px rgba(15, 61, 86, 0.05), 0 1px 3px rgba(0, 0, 0, 0.02);
  color: var(--platform-ink, #0f3d56);
  transform: none;
}
.cat-explorer__intro {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
}
.cat-explorer__eyebrow {
  display: block;
  color: var(--platform-teal, #0b7f86);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-bottom: 0.25rem;
}
.cat-explorer__heading {
  margin: 0;
  color: var(--platform-ink, #0f3d56);
  font-size: clamp(1.25rem, 2.2vw, 1.6rem);
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1.25;
}
.cat-explorer__pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  overflow-x: visible;
  padding: 0.25rem 0.15rem 0.85rem;
  border-bottom: 1px solid #f1f5f9;
}
.cat-explorer__pills::-webkit-scrollbar {
  display: none;
}
.cat-explorer__pills .pill {
  flex-shrink: 0;
}
.cat-explorer__pill {
  flex-shrink: 0;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  padding: 0.5rem 1.15rem;
  border-radius: 9999px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  color: #475569;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.cat-explorer__pill:hover:not(.pill--active) {
  border-color: rgba(11, 127, 134, 0.35);
  background: #f1f5f9;
  color: var(--platform-ink, #0f3d56);
  transform: translateY(-1px);
}
.cat-explorer__pill.pill--active {
  background: var(--platform-teal, #0b7f86);
  border-color: var(--platform-teal, #0b7f86);
  color: #ffffff;
  box-shadow: 0 4px 14px rgba(11, 127, 134, 0.28);
  transform: translateY(-1px);
}
.cat-explorer__body {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.cat-explorer__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 0.25rem;
}
.cat-explorer__title {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--platform-ink, #0f3d56);
  margin: 0;
}
.cat-explorer__head .provider-viewall {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--platform-teal, #0b7f86);
  text-decoration: none;
  transition: color 0.15s ease, transform 0.15s ease;
}
.cat-explorer__head .provider-viewall:hover {
  text-decoration: underline;
  color: #085f65;
}
.cat-explorer__empty {
  font-size: var(--text-sm);
  color: var(--platform-ink-soft, #64748b);
  padding: 2.5rem 0;
  text-align: center;
}
.cat-explorer__providers {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 1rem;
}
.cat-provider {
  min-height: 195px;
  padding: 1.1rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.45rem;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  box-shadow: 0 1px 3px rgba(15, 61, 86, 0.04);
  cursor: pointer;
  transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
              border-color 0.2s ease,
              box-shadow 0.22s ease;
  min-width: 0;
}
.cat-provider:hover {
  border-color: rgba(11, 127, 134, 0.4);
  background: linear-gradient(180deg, #ffffff 0%, #f9fcfa 100%);
  box-shadow: 0 10px 24px -4px rgba(15, 61, 86, 0.09);
  transform: translateY(-3px);
}
.cat-provider:focus-visible {
  outline: 2px solid var(--platform-teal, #0b7f86);
  outline-offset: 2px;
}
.cat-provider__img {
  width: 100%;
  height: 72px;
  min-height: 72px;
  border-radius: 10px;
  border: 1px solid #edf2f7;
  background: #f8fafc;
  padding: 0;
  overflow: hidden;
  object-fit: contain;
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  align-items: center;
  justify-content: center;
}
.cat-provider__img:not(.is-placeholder) :deep(img) {
  padding: 0.5rem;
}
.cat-provider__img :deep(.app-image-placeholder) {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}
.cat-provider__img :deep(.placeholder-icon-badge) {
  margin: auto;
}
.cat-provider:hover .cat-provider__img {
  transform: scale(1.04);
}
.cat-provider__name {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--platform-ink, #0f3d56);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  margin-top: 0.25rem;
}
.cat-provider__country {
  font-size: 0.775rem;
  font-weight: 500;
  color: var(--platform-ink-soft, #64748b);
}
.cat-provider__cta {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.775rem;
  font-weight: 700;
  color: var(--platform-teal, #0b7f86);
  margin-top: auto;
  padding-top: 0.4rem;
  transition: gap 0.2s ease;
}
.cat-provider:hover .cat-provider__cta {
  gap: 0.5rem;
}

/* ── Explorer content transition ── */
.cat-explorer__loading-wrap { min-height: 180px; }

.explorer-fade-enter-active,
.explorer-fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.explorer-fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.explorer-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .explorer-fade-enter-active,
  .explorer-fade-leave-active {
    transition: none;
  }
}

@media (max-width: 640px) {
  .cat-explorer { padding: 1.15rem; border-radius: var(--radius-lg, 8px); }
  .cat-explorer__intro { align-items: start; flex-direction: column; }
  .cat-explorer__providers { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; }
  .cat-provider { min-height: 175px; padding: 0.85rem 0.65rem; }
  .cat-provider__img { height: 60px; min-height: 60px; }
  .provider-mini-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

/* Home Certs Grid - Fixed 4-column grid on desktop, centered */
.home-certs-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-2);
  max-width: var(--wl-max-width);
  margin-inline: auto;
  justify-items: center;
}

/* Responsive breakpoints for home cert cards */
@media (max-width: 1024px) {
  .home-certs-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .home-certs-grid {
    grid-template-columns: 1fr;
  }
}

.home-cert-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.home-cert-card:hover {
  transform: translateY(-3px);
  border-color: var(--wl-primary);
  box-shadow: var(--shadow-hover);
}

.home-cert-card:active:not(:disabled) {
  transform: translateY(-1px);
}

.home-cert-card:focus-visible {
  outline: none;
  box-shadow: var(--wl-focus-ring);
}

.home-cert-card:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none !important;
}

.home-cert-card[aria-busy="true"] {
  pointer-events: none;
}

.home-cert-card__media {
  height: 160px;
  background: var(--wl-surface-soft);
  overflow: hidden;
}

.home-cert-card__body {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  flex: 1;
}

.home-cert-card__badge {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--wl-primary);
  letter-spacing: 0.05em;
}

.home-cert-card__title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--fg-heading);
  margin: 0;
  line-height: 1.4;
}

.home-cert-card__issuer {
  font-size: var(--step--1);
  color: var(--wl-muted);
  margin-top: auto;
}

.section__eyebrow {
  font-size: var(--step--1);
  color: var(--brand);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: var(--space-1);
  text-shadow: none;
}

.section-title {
  font-family: var(--wl-font-display);
  font-size: var(--step-2);
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--fg-heading);
  margin: 0;
}

/* ── Specialty filter (browse by clinical specialty) ── */
.cat-filter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}
.cat-filter__field {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1 1 260px;
  min-width: 0;
  max-width: 420px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 9999px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.cat-filter__field:focus-within {
  border-color: var(--wl-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--wl-primary) 18%, transparent);
}
.cat-filter__icon {
  font-size: 18px;
  color: #64748b;
  margin-inline-start: 0.75rem;
  pointer-events: none;
}
.cat-filter__input {
  flex: 1 1 auto;
  min-width: 0;
  border: 0;
  background: transparent;
  padding: 0.55rem 0.6rem;
  font-size: 0.9rem;
  color: #0f172a;
}
.cat-filter__input:focus {
  outline: none;
  box-shadow: none;
}
.cat-filter__clear {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  margin-inline-end: 0.25rem;
  border: 0;
  border-radius: 9999px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.cat-filter__clear:hover {
  background: #f1f5f9;
  color: #0f172a;
}
.cat-filter__clear .material-symbols-outlined {
  font-size: 18px;
}
.cat-filter__count {
  font-size: 0.75rem;
  color: #64748b;
  white-space: nowrap;
}

.cat-no-results {
  display: grid;
  justify-items: center;
  gap: 0.6rem;
  padding: 2rem 1rem;
  text-align: center;
  border: 1px dashed #cbd5e1;
  border-radius: var(--wl-radius-lg);
  background: #f8fafc;
}
.cat-no-results__icon {
  font-size: 30px;
  color: #94a3b8;
}
.cat-no-results__text {
  margin: 0;
  font-size: 0.9rem;
  color: #475569;
}

.cat-expand {
  display: flex;
  justify-content: center;
  margin-top: 1rem;
}

.cat-pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 1.25rem;
}
.cat-pager__num {
  font-size: 0.8rem;
  color: #64748b;
}

/* Categories Grid */
.cat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: clamp(1rem, 2vw, 1.35rem);
  max-width: var(--wl-max-width);
  margin-inline: auto;
}

@media (max-width: 1100px) {
  .cat-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .cat-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.875rem;
  }
}

@media (max-width: 440px) {
  .cat-grid {
    grid-template-columns: 1fr;
  }
}

/* ── Cat card — pure white, clean borders & border-radius only ── */
.cat-card {
  background: #ffffff;
  border: 1px solid var(--border, #d9e2ec);
  border-radius: var(--radius-lg, 8px);
  padding: 0.875rem;
  text-decoration: none;
  box-shadow: 0 1px 3px rgba(15, 61, 86, 0.04), 0 3px 8px rgba(15, 61, 86, 0.02);
  transition: transform 0.24s cubic-bezier(0.16, 1, 0.3, 1),
              border-color 0.2s ease,
              box-shadow 0.24s ease;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  position: relative;
  overflow: hidden;
}

.cat-card:hover {
  transform: translateY(-4px);
  border-color: rgba(11, 127, 134, 0.42);
  box-shadow: 0 12px 28px -4px rgba(15, 61, 86, 0.1), 0 4px 10px -2px rgba(15, 61, 86, 0.04);
}

.cat-card:active {
  transform: translateY(-1px);
  transition-duration: 0.08s;
}

.cat-card:focus-visible {
  outline: 2px solid var(--platform-teal, #0b7f86);
  outline-offset: 2px;
  box-shadow: none;
}

/* ── Cat card image area ── */
.cat-media {
  width: 100%;
  height: 114px;
  border-radius: 12px;
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
  border: 1px solid #edf2f7;
  overflow: hidden;
  display: grid;
  place-items: center;
  padding: 0.65rem;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.cat-card:hover .cat-media {
  background: linear-gradient(180deg, #f0fdfa 0%, #e6f7f6 100%);
  border-color: rgba(11, 127, 134, 0.22);
}

.cat-media__img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

.cat-card:hover .cat-media__img {
  transform: scale(1.06);
}

.cat-media__icon {
  font-size: 32px;
  color: var(--wl-muted);
}

/* ── Cat card body ── */
.cat-body {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.15rem 0.2rem 0.25rem;
}

.cat-name {
  font-size: 0.975rem;
  font-weight: 700;
  color: var(--platform-ink, #0f3d56);
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cat-name-alt {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--platform-ink-soft, #64748b);
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cat-count {
  font-size: 0.75rem;
  color: var(--platform-teal, #0b7f86);
  font-weight: 600;
  margin-top: 0.35rem;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.cat-count::before {
  content: '';
  display: inline-block;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.75;
  flex-shrink: 0;
}

/* ── Staggered entrance animation for cat cards on load ── */
@media (prefers-reduced-motion: no-preference) {
  .cat-grid .cat-card {
    animation: catCardIn 0.38s var(--wl-ease-spring, cubic-bezier(0.2, 0, 0, 1)) both;
  }
  .cat-grid .cat-card:nth-child(1) { animation-delay: 0ms; }
  .cat-grid .cat-card:nth-child(2) { animation-delay: 40ms; }
  .cat-grid .cat-card:nth-child(3) { animation-delay: 80ms; }
  .cat-grid .cat-card:nth-child(4) { animation-delay: 120ms; }
  .cat-grid .cat-card:nth-child(5) { animation-delay: 160ms; }
  .cat-grid .cat-card:nth-child(6) { animation-delay: 200ms; }
  .cat-grid .cat-card:nth-child(7) { animation-delay: 240ms; }
  .cat-grid .cat-card:nth-child(8) { animation-delay: 280ms; }
}

@keyframes catCardIn {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Products Grid */
.product-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
  max-width: var(--wl-max-width);
  margin-inline: auto;
}

@media (max-width: 1024px) {
  .product-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .product-grid {
    grid-template-columns: 1fr;
  }
}

.product-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: var(--wl-shadow-card);
  cursor: pointer;
  transition: transform 0.2s var(--wl-ease-spring), border-color 0.2s ease, box-shadow 0.2s ease;
}

.product-card:hover {
  transform: translateY(-2px);
  border-color: var(--wl-primary-soft);
  box-shadow: var(--shadow-hover);
}

.product-card:active:not(:disabled) {
  transform: translateY(-1px);
}

.product-card:focus-visible {
  outline: none;
  box-shadow: var(--wl-focus-ring);
}

.product-card:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none !important;
}

.product-card[aria-busy="true"] {
  pointer-events: none;
}

.product-card__media {
  height: 200px;
  width: 100%;
  position: relative;
  overflow: hidden;
  display: block;
  background: var(--wl-surface-soft, #f8fafc);
}

.product-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  padding: 0;
  transition: transform 0.3s ease;
}

.product-card:hover .product-card__img {
  transform: scale(1.05);
}

.product-card__sku {
  font-size: var(--step--1);
  color: var(--wl-muted);
}

.product-card__badge {
  position: absolute;
  top: 10px;
  inset-inline-end: 10px;
  font-size: 9.5px;
  font-weight: 800;
  background: var(--wl-primary);
  color: var(--wl-on-primary);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-pill);
}

.product-card__stock {
  position: absolute;
  top: 10px;
  inset-inline-start: 10px;
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--wl-on-primary);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-pill);
  border: 1px solid rgba(255, 255, 255, 0.65);
  box-shadow: var(--shadow-card);
}

.product-card__stock--in {
  background: var(--fg-success, #198754);
}

.product-card__stock--out {
  background: var(--fg-danger, #DC3545);
}

.product-card__body {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.product-card__category {
  font-size: var(--step--1);
  color: var(--wl-muted);
  font-weight: 600;
}

.product-card__title {
  font-size: var(--step-1);
  font-weight: 700;
  color: var(--wl-ink-strong);
  margin: 0;
  line-height: 1.3;
}

.product-card__meta-alt {
  font-size: var(--step--1);
  color: var(--wl-muted);
}

.product-card__meta {
  font-size: var(--step--1);
  color: var(--wl-success);
  font-weight: 600;
  margin: var(--space-1) 0 var(--space-3);
}

.product-card__foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid var(--wl-surface-soft);
  padding-top: var(--space-3);
}

@media (max-width: 640px) {
  .product-card__foot {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-2);
  }
}

.section--most-selling {
  border-bottom: 1px solid var(--wl-border, #edf2f7);
  background-color: #ffffff;
}

.btn-quote-white {
  background: var(--wl-primary) !important;
  border-color: var(--wl-primary) !important;
  color: #ffffff !important;
  gap: 0.35rem;
}

.btn-quote-white,
.btn-quote-white * {
  color: #ffffff !important;
}

.btn-quote-white:hover {
  background: var(--wl-primary-hover) !important;
  border-color: var(--wl-primary-hover) !important;
  color: #ffffff !important;
}

@media (max-width: 1024px) {
  .hero__inner {
    padding: var(--space-8) var(--wl-gutter) var(--space-6);
    gap: var(--space-8);
  }
  .section {
    padding: var(--space-8) 0;
  }
}

@media (max-width: 900px) {
  .hero__inner {
    grid-template-columns: 1fr;
    gap: var(--space-8);
    padding: var(--space-7) var(--wl-gutter) var(--space-6);
  }
  .hero__logo-box {
    max-width: 380px;
    margin: 0 auto;
    width: 100%;
  }
}

@media (max-width: 640px) {
  .section {
    padding: var(--space-6) 0;
  }
  .section-head {
    margin-bottom: var(--space-4);
  }
  .section-title {
    font-size: clamp(1.25rem, 4.5vw, 1.5rem);
  }
  .hero__inner {
    padding: var(--space-6) var(--wl-gutter) var(--space-5);
    gap: var(--space-6);
  }
  .hero h1 {
    font-size: clamp(1.7rem, 6.5vw, 2.3rem);
    margin: 0.4rem 0 0.6rem;
  }
  .hero p {
    font-size: 14px;
    line-height: 1.55;
  }
  .hero__search {
    margin-top: 1rem;
    max-width: 100%;
  }
  .hero__ctas {
    display: flex;
    flex-direction: column;
    width: 100%;
    gap: 0.6rem;
    margin-top: var(--space-4);
  }
  .hero__ctas > * {
    width: 100%;
    justify-content: center;
  }
  .hero__logo-box {
    padding: 1rem;
    max-height: 180px;
  }
  .hero__logo-box img {
    max-height: 150px;
  }
}

@media (max-width: 440px) {
  .hero__search-bar {
    height: 44px;
    padding-inline-start: 0.65rem;
  }
  .hero__search-btn {
    height: 34px;
    padding: 0 0.85rem;
    font-size: 12px;
  }
}


/* Institutional Quote Modal Styles */
.quote-modal-desc {
  font-size: var(--step-0);
  color: var(--wl-muted);
  line-height: 1.5;
  margin: 0 0 var(--space-4);
}

.modal-2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.modal-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: var(--space-3);
}

.modal-lbl {
  font-size: var(--step--1);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--wl-ink-soft);
  text-align: start;
}

.modal-inp,
.modal-sel,
.modal-txt {
  width: 100%;
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  color: var(--fg-heading, #102A43);
  font-size: var(--step-0);
  padding: 0.65rem 0.85rem;
  outline: none;
  transition: all 0.18s ease;
  text-align: start;
}

.modal-inp:focus,
.modal-sel:focus,
.modal-txt:focus {
  background: var(--wl-surface);
  border-color: var(--wl-primary);
  box-shadow: var(--wl-focus-ring);
}

.modal-txt {
  resize: vertical;
  min-height: 80px;
}

.modal-oem-callout {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--wl-primary-soft);
  border: 1px dashed rgba(105, 169, 255, 0.3);
  border-radius: var(--radius-md);
  padding: 0.6rem 0.85rem;
  font-size: var(--step--1);
  margin-bottom: var(--space-4);
  gap: 0.5rem;
  flex-wrap: wrap;
}

.oem-callout-link {
  color: var(--wl-primary);
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;
}

.modal-actions-row {
  display: flex;
  gap: var(--space-3);
  margin-top: 0.5rem;
}

.quote-modal-success {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: var(--space-6) var(--space-2);
}

.success-head {
  font-size: var(--step-2);
  font-weight: 800;
  color: var(--wl-ink-strong);
  margin: 0 0 var(--space-2);
}

.success-body {
  font-size: var(--step-0);
  color: var(--wl-ink-soft);
  line-height: 1.55;
  max-width: 440px;
  margin: 0 auto var(--space-4);
}

.ref-ticket-box {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: 0.5rem 1rem;
  margin-bottom: var(--space-6);
}

.ref-label {
  font-size: var(--step--1);
  color: var(--wl-muted);
}

.ref-code {
  font-size: var(--step-0);
  font-weight: 800;
  color: var(--wl-primary);
  letter-spacing: 0.05em;
}

.modal-success-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  width: 100%;
  max-width: 320px;
}

.btn-link-oem {
  background: transparent;
  border: none;
  color: var(--wl-primary);
  font-size: var(--step--1);
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.4rem;
}

.btn-link-oem:hover {
  text-decoration: underline;
}

.btn-link-oem:active:not(:disabled) {
  transform: scale(0.98);
}

.btn-link-oem:focus-visible {
  outline: none;
  box-shadow: var(--wl-focus-ring);
}

.btn-link-oem:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none !important;
}

.btn-link-oem[aria-busy="true"] {
  pointer-events: none;
}

@media (max-width: 580px) {
  .modal-2col {
    grid-template-columns: 1fr;
    gap: 0;
  }
}

.about-grid {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: var(--space-8);
  align-items: center;
}

.about-content {
  display: flex;
  flex-direction: column;
}

.about-body {
  color: var(--fg-body, #42474D);
  line-height: 1.75;
  font-size: var(--step-0);
  margin: var(--space-3) 0 0;
  white-space: pre-wrap;
}

.about-ctas {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-top: var(--space-6);
}

.about-media {
  position: relative;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--wl-border);
  background: var(--bg-surface, #FFFFFF);
}

.about-media__img {
  width: 85%;
  max-width: 600px;
  height: auto;
  min-height: 180px;
  object-fit: contain;
  display: block;
  margin: 0 auto;
}

@media (max-width: 960px) {
  .about-grid {
    grid-template-columns: 1fr;
    gap: var(--space-6);
    justify-items: center;
  }

  .about-content {
    align-items: center;
    text-align: center;
  }

  .about-content .section__eyebrow {
    text-align: center;
    margin-inline: auto;
  }

  .about-content .section-title {
    text-align: center;
  }

  .about-body {
    text-align: center;
    max-width: 640px;
    margin-inline: auto;
  }

  .about-ctas {
    justify-content: center;
    align-items: center;
    width: 100%;
  }

  .about-media {
    max-width: 480px;
    width: 100%;
    margin-inline: auto;
  }
}

@media (max-width: 480px) {
  .about-ctas .btn {
    width: 100%;
    justify-content: center;
  }
}

/* 2026 platform landing treatment */
.home {
  background: var(--platform-mist, #F7F9FB);
  color: var(--platform-ink, #102A43);
}


/* ==========================================================================
   Clinical Precision Modern Architecture Styles
   ========================================================================== */

/* Hero Clinical Precision Light Architecture */
.home .hero {
  background: #FFFFFF !important;
  border-bottom: 1px solid var(--color-border, #D9E2EC) !important;
  position: relative;
  overflow: hidden;
  padding-block: clamp(3.2rem, 5.5vw, 4.8rem);
}

.home .hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(900px 450px at 80% 15%, rgba(20, 125, 146, 0.05), transparent 60%),
    radial-gradient(700px 350px at 15% 85%, rgba(15, 61, 86, 0.03), transparent 50%),
    linear-gradient(rgba(15, 61, 86, 0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(15, 61, 86, 0.02) 1px, transparent 1px);
  background-size: auto, auto, 28px 28px, 28px 28px;
  pointer-events: none;
}

.home .hero__glow {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 1200px;
  height: 100%;
  background: radial-gradient(circle at 60% 20%, rgba(40, 167, 161, 0.04), transparent 70%);
  pointer-events: none;
}

.home .hero__inner {
  max-width: 1320px;
  margin: 0 auto;
  padding: 0 clamp(1rem, 4vw, 2.5rem);
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: clamp(2rem, 4vw, 4rem);
  align-items: center;
  position: relative;
  z-index: 1;
}

.home .hero__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.85rem;
  border-radius: 9999px;
  background: var(--color-brand-ice, #EDF4FF);
  border: 1px solid #C8E0FF;
  color: var(--color-primary, #0F3D56);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  margin-bottom: 1.25rem;
}

.home .hero__badge-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-steel-teal, #147D92);
  box-shadow: 0 0 0 2px rgba(20, 125, 146, 0.25);
  animation: pulse-glow 2s infinite ease-in-out;
}

@keyframes pulse-glow {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.3); opacity: 0.7; }
}

.home .hero__title {
  color: var(--color-heading, #102A43) !important;
  font-size: clamp(2.3rem, 4.2vw, 3.5rem) !important;
  font-weight: 800 !important;
  line-height: 1.12 !important;
  letter-spacing: -0.035em !important;
  margin-bottom: 1rem;
}

.home .hero__title-accent {
  background: linear-gradient(135deg, #071520 0%, #00A389 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: var(--secondary, #00A389);
  display: inline-block;
}

.home .hero__subtitle {
  max-width: 580px;
  color: var(--color-body, #334E68) !important;
  font-size: clamp(1rem, 1.25vw, 1.125rem) !important;
  line-height: 1.65 !important;
  margin-bottom: 1.75rem;
}

.home .hero__search {
  max-width: 580px;
  margin-bottom: 0.75rem;
}

.home .hero__search-bar {
  display: flex;
  align-items: center;
  height: 52px;
  background: #FFFFFF;
  border: 1px solid var(--color-border, #D9E2EC);
  border-radius: 8px;
  padding: 0.35rem 0.45rem 0.35rem 1rem;
  box-shadow: 0 4px 18px rgba(16, 42, 67, 0.06);
  transition: all 0.2s ease;
}

.home .hero__search-bar:focus-within {
  background: #FFFFFF;
  border-color: var(--color-focus, #0EA5E9);
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.15), 0 8px 24px rgba(16, 42, 67, 0.08);
}

.home .hero__search-icon {
  color: var(--color-steel-teal, #147D92);
  font-size: 22px;
  margin-inline-end: 0.65rem;
  flex-shrink: 0;
}

.home .hero__search-bar input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--color-heading, #102A43);
  font-size: 0.95rem;
  caret-color: var(--color-steel-teal, #147D92);
  outline: none;
}

.home .hero__search-bar input::placeholder {
  color: var(--color-muted, #7A90A8);
}

.home .hero__search-clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--color-muted, #7A90A8);
  cursor: pointer;
  margin-inline-end: 0.5rem;
  transition: all 0.15s ease;
}
.home .hero__search-clear:hover {
  background: #EDF4FF;
  color: #102A43;
}

.home .hero__search-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  height: 40px;
  padding: 0 1.25rem;
  border-radius: 8px;
  background: var(--secondary, #00A389);
  color: #FFFFFF;
  font-weight: 600;
  font-size: 0.88rem;
  border: none;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.15s ease;
}

.home .hero__search-btn:hover {
  background: var(--secondary-hover, #008872);
  transform: translateY(-1px);
}

.home .hero__btn-arrow {
  font-size: 17px;
  transition: transform 0.2s ease;
}

.home .hero__search-btn:hover .hero__btn-arrow {
  transform: translateX(3px);
}
[dir='rtl'] .home .hero__search-btn:hover .hero__btn-arrow {
  transform: translateX(-3px);
}

.home .hero__ctas {
  display: flex;
  gap: 0.85rem;
  flex-wrap: wrap;
  margin-top: 1.5rem;
}

.home .hero__ctas .btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: #071520 !important;
  color: #FFFFFF !important;
  border: 1px solid rgba(0, 163, 137, 0.35) !important;
  border-radius: 8px !important;
  padding: 0.75rem 1.6rem !important;
  font-weight: 600 !important;
  box-shadow: 0 4px 14px rgba(7, 21, 32, 0.2) !important;
  transition: all 0.2s ease !important;
}

.home .hero__ctas .btn-primary:hover {
  background: #0D2235 !important;
  border-color: #00A389 !important;
  transform: translateY(-2px) !important;
  box-shadow: 0 8px 20px rgba(0, 163, 137, 0.25) !important;
}

.home .hero__ctas .btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: #FFFFFF !important;
  color: var(--color-heading, #071520) !important;
  border: 1px solid var(--color-border, #D8E2EC) !important;
  border-radius: 8px !important;
  padding: 0.75rem 1.6rem !important;
  font-weight: 600 !important;
  box-shadow: 0 1px 3px rgba(7, 21, 32, 0.04) !important;
  transition: all 0.2s ease !important;
}

.home .hero__ctas .btn-secondary:hover {
  background: var(--brand-soft, #E8F8F5) !important;
  border-color: var(--secondary, #00A389) !important;
  color: var(--secondary, #00A389) !important;
  transform: translateY(-2px) !important;
}

/* Hero Welco Logo Showcase */
.home .hero__logo-showcase {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  width: 100%;
}

.home .logo-showcase__card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 420px;
  padding: clamp(2.5rem, 5vw, 3.5rem) 2rem;
  background: #FFFFFF;
  border: 1px solid var(--color-border, #D9E2EC);
  border-radius: 12px;
  box-shadow:
    0 20px 48px rgba(15, 61, 86, 0.07),
    0 4px 14px rgba(15, 61, 86, 0.03);
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.3s ease;
  overflow: hidden;
}

.home .logo-showcase__card:hover {
  transform: translateY(-4px);
  border-color: #00A389;
  box-shadow:
    0 28px 56px rgba(0, 163, 137, 0.14),
    0 8px 20px rgba(7, 21, 32, 0.04);
}

.home .logo-showcase__card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #071520 0%, #00A389 50%, #0EA5E9 100%);
}

.home .logo-showcase__glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 280px;
  height: 280px;
  background: radial-gradient(circle, rgba(20, 125, 146, 0.08) 0%, rgba(40, 167, 161, 0.03) 50%, transparent 70%);
  pointer-events: none;
  filter: blur(20px);
}

.home .logo-showcase__frame {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 280px;
  padding: 1.75rem;
  background: #FAFCFE;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  box-shadow: inset 0 2px 6px rgba(16, 42, 67, 0.02);
  transition: transform 0.3s ease, border-color 0.3s ease;
}

.home .logo-showcase__card:hover .logo-showcase__frame {
  border-color: #C8E0FF;
  transform: scale(1.02);
}

.home .logo-showcase__img {
  width: 100%;
  max-width: 230px;
  height: auto;
  aspect-ratio: 1 / 1;
  object-fit: contain;
  display: block;
  filter: drop-shadow(0 6px 16px rgba(15, 61, 86, 0.06));
}

@media (max-width: 900px) {
  .home .logo-showcase__card {
    max-width: 340px;
    padding: 2rem 1.5rem;
  }
  .home .logo-showcase__frame {
    max-width: 220px;
    padding: 1.25rem;
  }
  .home .logo-showcase__img {
    max-width: 180px;
  }
}

/* Sections Global Modern Clean Styling */
.home .section {
  padding-block: clamp(3.5rem, 6vw, 6rem);
}

.home .section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 2rem;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.home .section__eyebrow {
  color: #147D92 !important;
  font-size: 0.75rem !important;
  font-weight: 700 !important;
  letter-spacing: 0.12em !important;
  text-transform: uppercase !important;
  margin-bottom: 0.4rem;
}

.home .section-title {
  color: #102A43 !important;
  font-size: clamp(1.85rem, 3.5vw, 2.75rem) !important;
  font-weight: 800 !important;
  letter-spacing: -0.04em !important;
  line-height: 1.15 !important;
}

.home .section-desc {
  max-width: 680px;
  color: #42474D !important;
  font-size: 1.05rem !important;
  line-height: 1.6 !important;
  margin-bottom: 2rem;
}

/* Section 1: Most Selling */
.home .section--most-selling {
  background: #FFFFFF !important;
  border-bottom: 1px solid #E2E8F0 !important;
}

/* Section 2: Providers & Partners (Clean Slate Background) */
.home .section--providers {
  background: #F8FAFC !important;
  border-bottom: 1px solid #E2E8F0 !important;
  color: #102A43 !important;
}

.home .section--providers .section-title {
  color: #102A43 !important;
}

.home .section--providers .section-desc {
  color: #42474D !important;
}

.home .section--providers .view-all-btn {
  color: #0F3D56 !important;
  border-color: #D9E2EC !important;
  background: #FFFFFF !important;
}

.home .section--providers .view-all-btn:hover {
  background: #F1F5F9 !important;
  border-color: #CBD5E1 !important;
}

/* Section 3: Categories */
.home .section--category {
  background: #FFFFFF !important;
  border-bottom: 1px solid #E2E8F0 !important;
}

/* Section 4: Clinical Specialty */
.home .section--clinical {
  background: #F8FAFC !important;
  border-bottom: 1px solid #E2E8F0 !important;
}

/* Section 5: Certifications (Clean White Showcase) */
.home .section--certs {
  background: #FFFFFF !important;
  border-bottom: 1px solid #E2E8F0 !important;
  color: #102A43 !important;
}

.home .section--certs .section-title {
  color: #102A43 !important;
}

.home .section--certs .section-desc {
  color: #42474D !important;
}

.home .section--certs .view-all-btn {
  color: #0F3D56 !important;
  border-color: #D9E2EC !important;
  background: #FFFFFF !important;
}

.home .section--certs .view-all-btn:hover {
  background: #F1F5F9 !important;
  border-color: #CBD5E1 !important;
}

/* Section 6: About */
.home .section--about {
  background: #F8FAFC !important;
}

.home .about-grid {
  background: #FFFFFF !important;
  border: 1px solid #E2E8F0 !important;
  border-radius: 12px !important;
  box-shadow: 0 8px 30px rgba(15, 61, 86, 0.05) !important;
  padding: clamp(2rem, 5vw, 4rem) !important;
}

/* Product Cards Elevation */
.home .product-card {
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(15, 61, 86, 0.04);
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  flex-direction: column;
}

.home .product-card:hover {
  transform: translateY(-4px);
  border-color: rgba(0, 163, 137, 0.4);
  box-shadow: 0 16px 36px rgba(0, 163, 137, 0.12);
}

.home .product-card__media {
  height: 210px;
  width: 100%;
  position: relative;
  background: #F8FAFC;
  overflow: hidden;
}

.home .product-card__badges {
  position: absolute;
  top: 10px;
  inset-inline-start: 10px;
  inset-inline-end: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  z-index: 3;
  pointer-events: none;
}

.home .product-badge--new {
  background: #071520;
  color: #FFFFFF;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.2rem 0.55rem;
  border-radius: 6px;
  box-shadow: 0 2px 6px rgba(7, 21, 32, 0.2);
}

.home .product-stock-badge {
  margin-inline-start: auto;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.25rem 0.6rem;
  border-radius: 6px;
  box-shadow: 0 2px 6px rgba(7, 21, 32, 0.08);
  white-space: nowrap;
}

.home .product-stock-badge--in {
  background: #DCFCE7;
  color: #059669;
  border: 1px solid #BBF7D0;
}

.home .product-stock-badge--out {
  background: #F1F5F9;
  color: #475569;
  border: 1px solid #CBD5E1;
}

.home .stock-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.home .stock-dot--in {
  background: #059669;
}
.home .stock-dot--out {
  background: #94A3B8;
}

.home .product-card__body {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  flex: 1;
}

.home .product-card__category {
  font-size: 0.75rem;
  font-weight: 700;
  color: #00A389;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.35rem;
}

.home .product-card__title {
  font-size: 1.05rem;
  font-weight: 700;
  color: #071520;
  line-height: 1.35;
  margin-bottom: 0.35rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.home .product-card__meta-alt {
  font-size: 0.85rem;
  color: #5A7184;
  margin-bottom: 0.5rem;
}

.home .product-card__provider {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
  color: #071520;
  background: #E8F8F5;
  border: 1px solid rgba(0, 163, 137, 0.3);
  border-radius: 6px;
  padding: 0.25rem 0.6rem;
  margin-bottom: 0.95rem;
  width: fit-content;
  max-width: 100%;
}

.home .product-card__provider .provider-icon {
  font-size: 15px;
  color: #00A389;
  flex-shrink: 0;
}

.home .product-card__provider .provider-label {
  font-weight: 700;
  color: #5A7184;
  font-size: 0.72rem;
  text-transform: uppercase;
}

.home .product-card__provider .provider-value {
  font-weight: 700;
  color: #071520;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.home .product-card__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: auto;
  padding-top: 0.75rem;
  border-top: 1px solid #F1F5F9;
}

.home .price-wrap {
  display: inline-flex;
  align-items: baseline;
  gap: 0.25rem;
  white-space: nowrap;
  min-width: 0;
  flex-shrink: 0;
}

.home .price-amount {
  font-size: 1rem;
  font-weight: 700;
  color: #071520;
  letter-spacing: -0.01em;
  line-height: 1.2;
}

.home .price-currency {
  font-size: 0.75rem;
  font-weight: 600;
  color: #5A7184;
  line-height: 1.2;
}

.home .btn-quote-white {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: #00A389 !important;
  color: #FFFFFF !important;
  border-radius: 6px !important;
  padding: 0.4rem 0.75rem !important;
  font-size: 0.78rem !important;
  font-weight: 600 !important;
  border: none !important;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.2s ease !important;
}

.home .btn-quote-white:hover {
  background: #008872 !important;
  transform: translateY(-1px);
}

/* Provider & Cert Tiles Modern Styling */
.home .provider-tile, .home .home-cert-card {
  border: 1px solid var(--border, #D8E2EC) !important;
  border-radius: var(--radius-lg, 8px) !important;
  box-shadow: 0 4px 16px rgba(7, 21, 32, 0.04) !important;
  background: #FFFFFF !important;
  transition: all 0.25s ease !important;
}

.home .provider-tile:hover, .home .home-cert-card:hover {
  border-color: rgba(0, 163, 137, 0.4) !important;
  box-shadow: 0 16px 36px rgba(0, 163, 137, 0.1) !important;
  transform: translateY(-4px) !important;
}

.home .provider-tile__logo {
  height: 130px !important;
  min-height: 130px !important;
  background: #F8FAFC !important;
  border-bottom: 1px solid #F1F5F9;
}

/* Cat Explorer Pills Active State */
.pill--active {
  background: #071520 !important;
  color: #FFFFFF !important;
  border-color: #00A389 !important;
  box-shadow: 0 4px 14px rgba(0, 163, 137, 0.25) !important;
}

@media (max-width: 900px) {
  .home .hero__inner {
    grid-template-columns: 1fr;
    gap: 2.5rem;
  }
}
</style>
