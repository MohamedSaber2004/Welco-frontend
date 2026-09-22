<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
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
import { formatPrice } from '../utils/format'

const router = useRouter()
const heroSearch = ref('')
const goSearch = () => {
  void router.push({ name: 'marketplace', query: heroSearch.value ? { search: heroSearch.value } : {} })
}

const cats = ref<CategoryDto[]>([])
const certifications = ref<CertificationDto[]>([])
const landingPages = ref<LandingPageDto[]>([])
const aboutPage = ref<LandingPageDto | null>(null)
const providers = ref<CompanyDto[]>([])
const loading = ref(true)

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
const EXPLORER_PROVIDER_PAGE_SIZE = 4

const explorerProviders = ref<CompanyDto[]>([])
const explorerProviderTotal = ref(0)
const explorerProvidersLoading = ref(false)
const explorerProviderTotalPages = computed(() =>
  Math.max(1, Math.ceil(explorerProviderTotal.value / EXPLORER_PROVIDER_PAGE_SIZE)),
)

watch(cats, (list) => {
  const first = list[0]
  if (!explorerCatId.value && first) void selectExplorerCat(first.id)
})

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

const openCategoryProviders = (catId: string) => {
  void router.push({ name: 'category-providers', params: { id: catId } })
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

const FOUNDING_YEAR = 1994

onMounted(async () => {
  loading.value = true
  const svc = services.marketplaceService
  try {
    await Promise.allSettled([
      svc.loadCategories(),
      services.certificationService.load(),
      services.contentService.loadSupport(),
      contentRepository.getLandingPages({ pageNumber: 1, pageSize: 20 }).then((p) => (landingPages.value = p.data)).catch(() => []),
      contentRepository
        .getLandingPageBySlug('about-us')
        .then((p) => {
          aboutPage.value = p && p.isActive !== false ? p : null
        })
        .catch(() => null),
      companyRepository
        .getProvidersDirectory({ pageNumber: 1, pageSize: 8 })
        .then((p) => {
          // Handle 401 in guest mode - backend doesn't allow public access
          if (p?.statusCode === 401 || !p?.data?.length) {
            providers.value = []
          } else {
            providers.value = p.data.filter((c) => c.isActive !== false).slice(0, 8)
          }
        })
        .catch(() => {
          providers.value = []
        }),
    ])
    if (svc.categories.value.length) cats.value = svc.categories.value.slice(0, 8)
    certifications.value = services.certificationService.certifications.value
  } finally {
    loading.value = false
  }
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
      <div class="hero__inner">
        <div class="hero__copy">
          <h1>{{ t('home.heroTitle') }} <em>{{ t('home.heroTitleAccent') }}</em></h1>
          <p>{{ t('home.heroSubtitle') }}</p>
          <div class="hero__search">
            <form class="hero__search-bar" @submit.prevent="goSearch">
              <input v-model="heroSearch" :placeholder="t('marketplace.searchPlaceholder')" />
              <button class="hero__search-btn" type="submit">{{ t('common.searchPlaceholder') }}</button>
            </form>
          </div>
          <div class="hero__ctas">
            <button class="btn btn-primary btn-lg" type="button" @click="router.push({ name: 'marketplace' })">
              <span>{{ t('nav.marketplace') }}</span>
            </button>
            <button class="btn btn-secondary btn-lg" type="button" @click="openPriceModal">
              <span class="material-symbols-outlined text-[20px]">request_quote</span>
              <span>{{ t('home.requestQuote') }}</span>
            </button>
          </div>
        </div>
        <div class="hero__logo-box">
          <img src="/logo.jpeg" alt="Welco — Surgical Instruments" width="420" height="220" loading="eager" />
        </div>
      </div>
    </header>

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

    <DataState :loading="loading && !providers.length" :empty="!providers.length && !loading" skeleton-type="provider-grid" :skeleton-count="4" min-height="250px">
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
              <button type="button" class="page-btn" :disabled="tileProductPage <= 1" @click="tileProductPage--">‹</button>
              <span class="mono provider-pager__num">{{ tileProductPage }} / {{ tileTotalPages }}</span>
              <button type="button" class="page-btn" :disabled="tileProductPage >= tileTotalPages" @click="tileProductPage++">›</button>
            </div>
            <router-link :to="{ name: 'provider-storefront', params: { id: p.id } }" class="provider-viewall mono">
              <span>{{ t('provider.viewCatalog') }}</span>
              <span class="icon--directional">→</span>
            </router-link>
          </div>
        </article>
      </div>
    </DataState>
  </div>
</section>

    <section class="section section--soft" aria-labelledby="cat-heading">
      <div class="section__inner">
        <div class="section-head">
          <div>
            <div class="mono section__eyebrow">{{ t('home.browseClinicalSpecialty') }}</div>
            <h2 id="cat-heading" class="section-title">{{ t('marketplace.categoriesTitle') }}</h2>
          </div>
          <router-link to="/categories" class="btn btn-ghost btn-sm view-all-btn">
            <span>{{ t('common.viewAll') }}</span>
            <span class="icon--directional">→</span>
          </router-link>
        </div>
        <DataState :loading="loading && !cats.length" :empty="!cats.length && !loading" skeleton-type="category-grid" :skeleton-count="8" min-height="160px">
          <div class="cat-grid">
            <router-link v-for="c in cats" :key="c.id" :to="{ name: 'category-providers', params: { id: c.id } }" class="cat-card">
              <div class="cat-media">
                <AppImage
                  :src="c.imageName"
                  placeholder-type="category"
                  :placeholder-text="localized(c.nameEn, c.nameAr)"
                  :alt="localized(c.nameEn, c.nameAr)"
                  class="cat-media__img"
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

        <div v-if="cats.length" class="cat-explorer card">
          <div class="cat-explorer__pills" role="tablist" :aria-label="t('marketplace.categoriesTitle')">
            <button
              v-for="c in cats"
              :key="c.id"
              type="button"
              role="tab"
              class="pill"
              :class="{ 'pill--active': explorerCatId === c.id }"
              :aria-selected="explorerCatId === c.id"
              @click="selectExplorerCat(c.id)"
            >
              {{ localized(c.nameEn, c.nameAr) }}
            </button>
          </div>

          <div v-if="explorerCatId" class="cat-explorer__body">
            <div class="cat-explorer__head">
              <h3 class="cat-explorer__title">{{ t('provider.providersInCategory') }}</h3>
              <router-link :to="{ name: 'category-providers', params: { id: explorerCatId } }" class="provider-viewall mono">
                <span>{{ t('common.viewAll') }}</span>
                <span class="icon--directional">→</span>
              </router-link>
            </div>
            <div v-if="explorerProvidersLoading" role="status"><SkeletonLoader type="provider-cards" :count="4" /></div>
            <div v-else-if="!explorerProviders.length" class="mono cat-explorer__empty">
              {{ t('provider.noProvidersHere') }}
            </div>
            <div v-else>
              <div class="cat-explorer__providers">
                <button
                  v-for="prov in explorerProviders"
                  :key="prov.id"
                  type="button"
                  class="cat-provider"
                  @click="openProviderStorefront(prov.id)"
                >
                  <AppImage
                    :src="prov.imageName"
                    placeholder-type="company"
                    :placeholder-text="prov.name"
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
          </div>
        </div>
      </div>
    </section>
    <!-- Audited Quality Standards Section -->
    <section class="section section--soft" aria-labelledby="home-certs-heading">
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
        <DataState :loading="loading && !certifications.length" :empty="!certifications.length && !loading" skeleton-type="cert-grid" :skeleton-count="4" min-height="300px">
          <div class="home-certs-grid">
            <article
              v-for="c in certifications.filter(c => c.isActive).slice(0, 3)"
              :key="c.id"
              class="home-cert-card"
              @click="router.push('/certifications')"
            >
              <div class="home-cert-card__media">
                <AppImage
                  :src="c.certificationImageName"
                  placeholder-type="document"
                  :placeholder-text="c.certificateNumber || c.title"
                  :alt="c.title"
                  aspect-ratio="16/10"
                  fit="contain"
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
    <section class="section section--soft" aria-labelledby="about-heading">
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

/* Category → providers → products explorer */
.cat-explorer {
  margin-top: var(--space-6);
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.cat-explorer__pills {
  display: flex;
  gap: var(--space-2);
  overflow-x: auto;
  padding-bottom: var(--space-1);
  scrollbar-width: none;
}
.cat-explorer__pills::-webkit-scrollbar { display: none; }
.cat-explorer__pills .pill { flex-shrink: 0; }
.cat-explorer__body { display: flex; flex-direction: column; gap: var(--space-4); }
.cat-explorer__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
.cat-explorer__title {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--fg-heading);
  margin: 0;
}
.cat-explorer__subtitle {
  font-size: var(--text-base);
  font-weight: var(--weight-medium);
  color: var(--fg-heading);
  margin: 0;
}
.cat-explorer__empty {
  font-size: var(--text-sm);
  color: var(--fg-subtle);
  padding: var(--space-4) 0;
  text-align: center;
}
.cat-explorer__providers {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: var(--space-3);
}
.cat-provider {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-3);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: border-color var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out);
  min-width: 0;
}
.cat-provider:hover { border-color: var(--border-strong); }
.cat-provider.is-selected {
  border-color: var(--brand);
  box-shadow: var(--ring-focus);
}
.cat-provider__img { width: 100%; height: 56px; border-radius: var(--radius-sm); }
.cat-provider__name {
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--fg-heading);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.cat-provider__country { font-size: var(--text-xs); color: var(--fg-subtle); }
.cat-provider__cta {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--brand);
  margin-top: var(--space-1);
}
.cat-explorer__products { display: flex; flex-direction: column; gap: var(--space-3); }
.cat-explorer__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: var(--space-3);
}
@media (max-width: 640px) {
  .cat-explorer { padding: var(--space-4); }
  .provider-mini-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

/* Home Certs Grid - Fixed 4-column grid on desktop, centered */
.home-certs-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
  max-width: var(--wl-max-width);
  margin-inline: auto;
}

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

/* Categories Grid */
.cat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
  max-width: var(--wl-max-width);
  margin-inline: auto;
}

@media (max-width: 1024px) {
  .cat-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .cat-grid {
    grid-template-columns: 1fr;
  }
}

.cat-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  text-decoration: none;
  box-shadow: var(--shadow-card);
  transition: transform 0.2s var(--wl-ease-spring), border-color 0.2s ease, box-shadow 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.cat-card:hover {
  transform: translateY(-2px);
  border-color: var(--wl-primary-soft);
  box-shadow: var(--shadow-hover);
}

.cat-card:active:not(:disabled) {
  transform: translateY(-1px);
}

.cat-card:focus-visible {
  outline: none;
  box-shadow: var(--wl-focus-ring);
}

.cat-card:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none !important;
}

.cat-card[aria-busy="true"] {
  pointer-events: none;
}

.cat-media {
  width: 100%;
  height: 100px;
  border-radius: var(--radius-md);
  background: var(--wl-surface-soft);
  overflow: hidden;
  display: grid;
  place-items: center;
}

.cat-media__img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: var(--space-2);
}

.cat-media__icon {
  font-size: 32px;
  color: var(--wl-muted);
}

.cat-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.cat-name {
  font-size: var(--step-0);
  font-weight: 700;
  color: var(--wl-ink-strong);
}

.cat-name-alt {
  font-size: var(--step--1);
  color: var(--wl-muted);
}

.cat-count {
  font-size: var(--step--1);
  color: var(--wl-primary);
  font-weight: 600;
  margin-top: var(--space-1);
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
  height: 180px;
  position: relative;
  overflow: hidden;
  display: grid;
  place-items: center;
}

.product-card__img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: var(--space-3);
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
  border: 1.5px solid var(--wl-border);
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
  background: var(--platform-mist);
  color: var(--platform-ink);
}
.home .hero {
  min-height: min(700px, 76vh);
  background: linear-gradient(118deg, #062f45 0%, #0b6370 58%, #13969a 100%) !important;
  border: 0;
  border-radius: 0 0 2rem 2rem;
  color: white;
}
.home .hero::before {
  background: radial-gradient(circle at 78% 24%, rgba(214, 243, 106, .26), transparent 20rem), linear-gradient(135deg, transparent 0 55%, rgba(255,255,255,.08) 55% 56%, transparent 56%);
  opacity: 1;
}
.home .hero::after { height: 4px; background: var(--platform-lime); opacity: .85; }
.home .hero__inner { max-width: 1320px; min-height: min(700px, 76vh); grid-template-columns: minmax(0, 1.05fr) minmax(360px, .8fr); gap: clamp(2rem, 6vw, 7rem); padding-block: clamp(3.5rem, 8vw, 7rem); }
.home .hero__copy { position: relative; z-index: 1; }
.home .hero h1 { max-width: 760px; margin-top: .45rem; color: #f7fffe; font-size: clamp(2.65rem, 5.8vw, 5.7rem); line-height: .98; letter-spacing: -.065em; }
.home .hero h1 em { color: var(--platform-lime) !important; background: none; }
.home .hero p { max-width: 620px; color: rgba(247,255,254,.78); font-size: clamp(1rem, 1.4vw, 1.2rem); line-height: 1.7; }
.home .hero__search { max-width: 610px; }
.home .hero__search-bar { height: 58px; padding-inline-start: 1rem; border: 1px solid rgba(255,255,255,.28); background: rgba(255,255,255,.12); box-shadow: 0 15px 35px rgba(1,27,40,.18); transition: background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease; }
.home .hero__search-bar input { color: #f7fffe; caret-color: var(--platform-lime); transition: color 180ms ease; }
.home .hero__search-bar input::placeholder { color: rgba(255,255,255,.65); opacity: 1; transition: color 180ms ease, opacity 180ms ease, transform 180ms ease; }
.home .hero__search-bar:focus-within { background: #fff; border-color: var(--platform-lime); box-shadow: 0 0 0 4px rgba(214,243,106,.22), 0 18px 40px rgba(1,27,40,.24); }
.home .hero__search-bar input:focus,
.home .hero__search-bar input:focus-visible { color: #071923; caret-color: var(--platform-teal); background: transparent; border-color: transparent; box-shadow: none; outline: 0; }
.home .hero__search-bar input:focus::placeholder { color: #52656b; opacity: .72; transform: translateX(6px); animation: hero-placeholder-pulse 1.35s ease-in-out infinite alternate; }
@keyframes hero-placeholder-pulse { from { opacity: .42; letter-spacing: 0; } to { opacity: .86; letter-spacing: .018em; } }
.home .hero__search-btn { height: 46px; border-radius: 999px; background: var(--platform-lime); color: var(--platform-ink); }
.home .hero__ctas .btn-primary { background: white; color: var(--platform-ink); border-color: white; border-radius: 999px; padding-inline: 1.4rem; }
.home .hero__ctas .btn-secondary { background: transparent; color: white; border-color: rgba(255,255,255,.45); border-radius: 999px; padding-inline: 1.4rem; }
.home .hero__logo-box { min-height: 360px; border: 1px solid rgba(255,255,255,.22); border-radius: 1.5rem; background: rgba(255,255,255,.10); box-shadow: 0 24px 70px rgba(1,27,40,.22); transform: rotate(2deg); }
.home .hero__logo-box::before { background: var(--platform-lime); height: 4px; }
.home .hero__logo-box img { border-radius: 1rem; mix-blend-mode: screen; opacity: .94; }
.home .section { padding-block: clamp(4rem, 8vw, 8rem); }
.home .section--providers { background: #fff; border: 0; }
.home .section--soft { background: var(--platform-mist); border: 0; }
.home .section-head { align-items: end; margin-bottom: 1rem; }
.home .section__eyebrow { color: var(--platform-teal) !important; font-weight: 800; letter-spacing: .14em; }
.home .section-title { max-width: 700px; color: var(--platform-ink); font-size: clamp(2rem, 4vw, 3.6rem); letter-spacing: -.055em; line-height: 1.04; }
.home .section-desc { max-width: 680px; color: var(--platform-ink-soft); font-size: 1.05rem; }
.home .provider-tile, .home .cat-card, .home .home-cert-card, .home .cat-explorer { border: 1px solid var(--platform-border); border-radius: 1.1rem; box-shadow: 0 8px 26px rgba(9,47,67,.06); background: #fff; }
.home .provider-tile:hover, .home .cat-card:hover, .home .home-cert-card:hover { border-color: rgba(11,127,134,.45); box-shadow: var(--platform-shadow); transform: translateY(-4px); }
.home .cat-media { border-radius: 1rem 1rem 0 0; background: var(--platform-aqua); }
.home .cat-explorer { background: var(--platform-ink); color: white; border: 0; }
.home .cat-explorer__title, .home .cat-explorer .provider-viewall { color: white; }
.home .about-grid { border-radius: 1.5rem; padding: clamp(2rem, 5vw, 5rem); background: var(--platform-aqua); }
.home .about-content .section-title { max-width: 620px; }
.home .about-media { border-radius: 1rem; overflow: hidden; box-shadow: var(--platform-shadow); background: white; }
.home .about-media__img { mix-blend-mode: multiply; }

.home .provider-tile__logo {
  height: 142px;
  min-height: 142px;
  width: 100%;
  min-width: 0;
  padding: 1rem;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, var(--platform-aqua), #f9fcfb);
}
.home .provider-tile__logo :deep(.app-image-placeholder) {
  inset: 0;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.home .provider-tile__logo :deep(.placeholder-icon-badge) {
  width: 52px;
  height: 52px;
  flex: 0 0 52px;
}
.home .provider-tile__logo :deep(.placeholder-icon) { font-size: 26px; }
.home .provider-tile__logo :deep(.placeholder-text) { display: none; }

@media (prefers-reduced-motion: reduce) {
  .home .hero__search-bar input:focus::placeholder { animation: none; }
}

@media (max-width: 760px) {
  .home .hero, .home .hero__inner { min-height: auto; }
  .home .hero__inner { grid-template-columns: 1fr; gap: 2.5rem; }
  .home .hero__logo-box { min-height: 230px; max-width: 520px; transform: rotate(0); }
  .home .hero h1 { font-size: clamp(2.7rem, 13vw, 4.4rem); }
}
</style>




