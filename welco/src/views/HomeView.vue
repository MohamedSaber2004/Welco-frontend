<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { authService, services, contentRepository, companyRepository } from '../di/container'
import { t, locale } from '../i18n'
import type { CategoryDto, ProductDto } from '../domain/models/marketplace'
import type { CountryDto } from '../domain/models/location'
import type { CertificationDto } from '../domain/models/certification'
import type { LandingPageDto } from '../domain/models/content'
import type { CompanyDto } from '../domain/models/company'
import { useCart } from '../composables/useCart'
import { toastService } from '../infrastructure/feedback/toast.service'
import DataState from '../components/ui/DataState.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import BaseButton from '../components/ui/BaseButton.vue'
import AppImage from '../components/ui/AppImage.vue'
import { productMediaUrl, resolveFileUrl } from '../utils/file-url'

const router = useRouter()
const isAdmin = computed(() => authService.isAdmin.value)
const { add } = useCart()

const heroSearch = ref('')
const goSearch = () => {
  void router.push({ name: 'marketplace', query: heroSearch.value ? { search: heroSearch.value } : {} })
}

const featured = ref<ProductDto[]>([])
const cats = ref<CategoryDto[]>([])
const countries = ref<CountryDto[]>([])
const certifications = ref<CertificationDto[]>([])
const landingPages = ref<LandingPageDto[]>([])
const aboutPage = ref<LandingPageDto | null>(null)
const providers = ref<CompanyDto[]>([])
const loading = ref(true)

const FOUNDING_YEAR = 1994

onMounted(async () => {
  loading.value = true
  const svc = services.marketplaceService
  try {
    await Promise.allSettled([
      svc.loadCategories(),
      svc.loadFeatured(),
      services.locationService.loadCountries().then(() => (countries.value = [...services.locationService.countries.value])).catch(() => []),
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
        .getCompanies({ pageNumber: 1, pageSize: 8 })
        .then((p) => {
          if (p?.data?.length) {
            providers.value = p.data.filter((c) => c.isActive !== false).slice(0, 8)
          } else {
            providers.value = []
          }
        })
        .catch(() => {
          providers.value = []
        }),
    ])
    if (svc.categories.value.length) cats.value = svc.categories.value.slice(0, 8)
    if (svc.featured.value.length) featured.value = svc.featured.value.slice(0, 3)
    certifications.value = services.certificationService.certifications.value
  } finally {
    loading.value = false
  }
})

const yearsOfExperience = computed(() => `${new Date().getFullYear() - FOUNDING_YEAR}+`)
const activeCerts = computed(() => certifications.value.filter((c) => !c.expiryDate || new Date(c.expiryDate) > new Date()))
const identityBadges = computed(() => {
  return activeCerts.value.slice(0, 3).map((c) => c.certificateNumber || c.title).filter(Boolean)
})
const whyItems = computed(() => {
  const items: Array<{ b: string; label: string; badge: string; tone: string }> = [
    { b: `${yearsOfExperience.value}`, label: t('home.whyYears'), badge: 'EST. 1994', tone: 'indigo' },
  ]
  const isoCert = activeCerts.value.find((c) => c.certificateNumber?.toUpperCase().includes('ISO') || c.title?.toUpperCase().includes('ISO'))
  const certBadge = isoCert ? isoCert.certificateNumber || isoCert.title : activeCerts.value[0]?.certificateNumber || activeCerts.value[0]?.title
  if (certBadge) {
    items.push({ b: certBadge, label: t('home.whyCertified'), badge: 'AUDITED', tone: 'emerald' })
  }
  if (countries.value.length > 0) {
    items.push({ b: `${countries.value.length}+`, label: t('home.whyCountries'), badge: 'GLOBAL', tone: 'teal' })
  }
  items.push({ b: 'OEM / ODM', label: t('home.whyOem'), badge: 'DIRECT', tone: 'amber' })
  return items
})
const localized = (en?: string | null, ar?: string | null) => locale.value === 'ar' ? (ar || en || '') : (en || ar || '')
const handleAdd = (id: string) => {
  const p = (featured.value.find(x => x.id === id) ?? services.marketplaceService.products.value.find((x) => x.id === id))
  if (!p) return
  add(p, 1)
  toastService.success(t('catalog.quoteSuccess', { product: localized(p.nameEn, p.nameAr) }))
}

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

        <DataState :loading="loading && !providers.length" :empty="!providers.length && !loading" skeleton-type="catalog-grid" :skeleton-count="4" min-height="160px">
          <div class="providers-strip-grid">
            <router-link
              v-for="p in providers"
              :key="p.id"
              :to="{ name: 'marketplace', query: { search: p.name } }"
              class="provider-tile"
            >
              <div class="provider-tile__logo">
                <AppImage
                  :src="p.imageName"
                  placeholder-type="company"
                  :placeholder-text="p.name"
                  :alt="p.name"
                  fit="contain"
                  height="70px"
                />
              </div>
              <div class="provider-tile__info">
                <div class="provider-tile__top">
                  <span class="provider-tile__badge mono">
                    <span class="material-symbols-outlined text-[12px]">verified</span>
                    {{ t('home.verifiedSupplier') }}
                  </span>
                </div>
                <h3 class="provider-tile__name" dir="auto">{{ p.name }}</h3>
                <div v-if="p.countryNameEn || p.countryNameAr" class="provider-tile__country mono">
                  <span class="material-symbols-outlined text-[13px] text-teal-600">public</span>
                  <span>{{ localized(p.countryNameEn, p.countryNameAr) }}</span>
                </div>
              </div>
            </router-link>
          </div>
        </DataState>
      </div>
    </section>
    <section class="section" aria-labelledby="metrics-heading">
      <div class="section__inner">
        <h2 id="metrics-heading" class="visually-hidden">{{ t('home.metricsHeading') }}</h2>
        <div class="metrics-grid">
          <div v-for="item in whyItems" :key="item.b" class="metric-card" :class="`metric-card--${item.tone}`">
            <div class="metric-card__top">
              <span class="mono metric-card__label">{{ item.label }}</span>
              <span class="metric-card__badge mono" :class="`badge--${item.tone}`">{{ item.badge }}</span>
            </div>
            <div class="metric-card__value mono-num">{{ item.b }}</div>
            <div class="metric-card__bar" :class="`bar--${item.tone}`"></div>
          </div>
        </div>
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
            <router-link v-for="c in cats" :key="c.id" :to="{ name: 'marketplace', query: { categoryId: c.id } }" class="cat-card">
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
      </div>
    </section>
    <section class="section" aria-labelledby="featured-heading">
      <div class="section__inner">
        <div class="section-head">
          <div>
            <div class="mono section__eyebrow">{{ t('home.clinicalHighlights') }}</div>
            <h2 id="featured-heading" class="section-title">{{ t('marketplace.featuredSubtitle') }}</h2>
          </div>
          <router-link to="/marketplace" class="btn btn-ghost btn-sm view-all-btn">
            <span>{{ t('common.viewAll') }}</span>
            <span class="icon--directional">→</span>
          </router-link>
        </div>
        <DataState :loading="loading && !featured.length" :empty="!featured.length && !loading" skeleton-type="catalog-grid" :skeleton-count="3" min-height="220px">
          <div class="product-grid">
            <article
              v-for="p in featured"
              :key="p.id"
              class="card product-card"
              @click="router.push({ name: 'marketplace-product', params: { id: p.id } })"
            >
              <div class="product-card__media" :style="{ background: productMediaUrl(p.imageName, p.imageGradient).background }">
                <AppImage
                  :src="p.imageName"
                  placeholder-type="product"
                  :placeholder-text="p.sku"
                  :alt="localized(p.nameEn, p.nameAr)"
                  fit="contain"
                  class="product-card__img"
                />
                <span v-if="p.isNew" class="mono product-card__badge">{{ t('home.newBadge') }}</span>
                <span v-if="p.stock > 0" class="mono product-card__stock product-card__stock--in">{{ t('catalog.inStock') }}</span>
                <span v-else class="mono product-card__stock product-card__stock--out">{{ t('catalog.madeToOrder') }}</span>
              </div>
              <div class="product-card__body">
                <div class="mono product-card__category" dir="auto">{{ localized(p.categoryNameEn, p.categoryNameAr) }}</div>
                <h3 class="product-card__title" dir="auto">{{ localized(p.nameEn, p.nameAr) }}</h3>
                <div class="mono product-card__meta-alt" dir="auto">{{ locale === 'en' ? p.nameAr : p.nameEn }}</div>
                <div class="mono product-card__meta">{{ p.manufacturerEn || 'Welco Surgical' }} · CE Class IIa</div>
                <div class="product-card__foot">
                  <strong class="mono-num">{{ Math.ceil(p.price).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US') }} {{ p.currencySymbol || '$' }}</strong>
                  <button class="btn btn-primary btn-sm" type="button" @click.stop="handleAdd(p.id)">
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

    <!-- Audited Quality Standards Section -->
    <section v-if="certifications.length" class="section section--soft" aria-labelledby="home-certs-heading">
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
        <div class="home-certs-grid">
          <article
            v-for="c in certifications.slice(0, 3)"
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
      </div>
    </section>
    <section class="section section--soft" aria-labelledby="about-heading">
      <div class="section__inner about-grid">
        <div>
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
          <div class="mono about-media__badge">{{ yearsOfExperience }} · EST. 1994</div>
        </div>
      </div>
    </section>

    <!-- Request Institutional Price Quote Modal -->
    <BaseModal v-model="priceModalOpen" :title="t('home.quoteModalTitle')" max-width="580px">
      <div v-if="priceSubmitted" class="quote-modal-success">
        <div class="success-icon-badge">
          <span class="material-symbols-outlined text-[36px] text-emerald-600">verified</span>
        </div>
        <h3 class="success-head">{{ t('home.quoteSubmittedTitle') }}</h3>
        <p class="success-body">{{ t('home.quoteSubmittedDesc') }}</p>

        <div class="ref-ticket-box mono">
          <span class="ref-label">{{ t('home.quoteReference') }}:</span>
          <span class="ref-code">{{ priceRefId }}</span>
        </div>

        <div class="modal-success-actions">
          <BaseButton variant="primary" block @click="priceModalOpen = false">
            {{ t('common.ok') }}
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
  background: radial-gradient(700px 350px at 70% 20%, rgba(79,70,229,0.06), transparent 60%),
              linear-gradient(rgba(15,23,42,0.02) 1px, transparent 1px),
              linear-gradient(90deg, rgba(15,23,42,0.02) 1px, transparent 1px);
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
  color: #4F46E5;
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
  border-radius: var(--radius-xl);
  padding: 1.75rem;
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
  border-radius: 12px;
}

.hero__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #10B981;
  box-shadow: 0 0 0 3px rgba(16,185,129,0.2);
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
  color: var(--wl-primary);
}

.hero p {
  color: var(--wl-ink-soft);
  font-size: 15.5px;
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
  gap: 0.65rem;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 12px;
  padding: 0.35rem 0.35rem 0.35rem 0.95rem;
  box-shadow: var(--shadow-sm);
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
  font-size: 14px;
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
  border-radius: 6px;
  font-size: 10px;
  color: var(--wl-muted);
}

.hero__search-btn {
  background: var(--wl-primary);
  color: #fff;
  border: none;
  padding: 0 1.25rem;
  height: 38px;
  border-radius: 8px;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  box-shadow: 0 2px 8px -2px rgba(79, 70, 229, 0.35);
  transition: transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
}

.hero__search-btn:hover {
  background: var(--wl-primary-hover);
  transform: translateY(-0.5px);
}

.hero__ctas {
  display: flex;
  gap: 0.85rem;
  margin-top: 1.5rem;
  flex-wrap: wrap;
}

.hero__trust {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin-top: 1.5rem;
  font-size: 11.5px;
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
  border-radius: 16px;
  padding: 1.6rem;
  box-shadow: var(--wl-shadow-card);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
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
  border-radius: 8px;
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
  padding: 0.55rem 0.75rem;
  border-radius: 8px;
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
  padding: 3.5rem 0;
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
  margin-bottom: 1.5rem;
  gap: 1rem;
  flex-wrap: wrap;
}

.view-all-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.95rem;
  border-radius: var(--wl-radius-md, 8px);
  border: 1px solid var(--wl-border);
  background: var(--wl-surface);
  color: var(--wl-primary);
  font-size: 0.8125rem;
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

/* Our Providers Section */
.section--providers {
  background: var(--wl-surface-soft, #383A40);
  border-bottom: 1px solid var(--wl-border, #e2e8f0);
  padding: 3rem 0;
}

.section-desc {
  font-size: 0.95rem;
  color: var(--wl-muted, #64748b);
  margin: -0.5rem 0 1.75rem;
  max-width: 680px;
}

.providers-strip-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.25rem;
}

.provider-tile {
  background: var(--wl-surface, #2B2D31);
  border: 1px solid var(--wl-border, #e2e8f0);
  border-radius: var(--wl-radius-lg, 12px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  text-decoration: none;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.provider-tile:hover {
  transform: translateY(-3px);
  border-color: var(--wl-primary, #0d9488);
  box-shadow: 0 10px 20px -5px rgba(0, 0, 0, 0.08);
}

.provider-tile__logo {
  height: 110px;
  background: linear-gradient(180deg, var(--wl-surface-soft, #383A40) 0%, var(--wl-surface, #2B2D31) 100%);
  border-bottom: 1px solid var(--wl-border, #f1f5f9);
  padding: 0.85rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.provider-tile__info {
  padding: 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 0.4rem;
}

.provider-tile__top {
  display: flex;
  align-items: center;
}

.provider-tile__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.65rem;
  font-weight: 700;
  color: #047857;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  padding: 0.15rem 0.45rem;
  border-radius: 9999px;
  letter-spacing: 0.02em;
}

.provider-tile__name {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--wl-text, #0f172a);
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
  font-size: 0.78rem;
  color: var(--wl-muted, #64748b);
  margin-top: auto;
  padding-top: 0.25rem;
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

/* Home Certs Grid */
.home-certs-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.25rem;
}

.home-cert-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--wl-radius-xl, 14px);
  overflow: hidden;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.home-cert-card:hover {
  transform: translateY(-3px);
  border-color: var(--wl-primary);
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
}

.home-cert-card__media {
  height: 160px;
  background: var(--wl-surface-soft);
  overflow: hidden;
}

.home-cert-card__body {
  padding: 1.15rem;
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
  color: var(--wl-text);
  margin: 0;
  line-height: 1.4;
}

.home-cert-card__issuer {
  font-size: 0.8125rem;
  color: var(--wl-muted);
  margin-top: auto;
}

@media (max-width: 768px) {
  .home-certs-grid {
    grid-template-columns: 1fr;
  }
}

.section__eyebrow {
  font-size: 10.5px;
  color: #4F46E5;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 0.25rem;
}

.section-title {
  font-family: var(--wl-font-display);
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--wl-ink-strong);
  margin: 0;
}

/* Metrics Grid */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

.metric-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 12px;
  padding: 1.25rem 1.4rem;
  box-shadow: var(--shadow-xs);
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  position: relative;
  overflow: hidden;
}

.metric-card__top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.metric-card__label {
  font-size: 11px;
  color: var(--wl-muted);
  font-weight: 600;
}

.metric-card__badge {
  font-size: 9.5px;
  font-weight: 700;
  padding: 0.15rem 0.45rem;
  border-radius: 9999px;
}

.metric-card__value {
  font-size: 1.85rem;
  font-weight: 800;
  color: var(--wl-ink-strong);
  letter-spacing: -0.02em;
}

.metric-card__bar {
  height: 3px;
  border-radius: 9999px;
  width: 100%;
}

.badge--indigo { background: rgba(79,70,229,0.08); color: #4F46E5; }
.bar--indigo { background: #4F46E5; }

.badge--emerald { background: rgba(16,185,129,0.08); color: #059669; }
.bar--emerald { background: #10B981; }

.badge--teal { background: var(--wl-primary-soft); color: var(--wl-primary); }
.bar--teal { background: var(--wl-primary); }

.badge--amber { background: var(--wl-warning-soft); color: var(--wl-warning); }
.bar--amber { background: var(--wl-warning); }

/* Categories Grid */
.cat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.15rem;
}

.cat-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 12px;
  padding: 1.25rem;
  text-decoration: none;
  box-shadow: var(--shadow-xs);
  transition: transform 0.2s var(--wl-ease-spring), border-color 0.2s ease, box-shadow 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.cat-card:hover {
  transform: translateY(-2px);
  border-color: rgba(79, 70, 229, 0.3);
  box-shadow: var(--shadow-sm);
}

.cat-media {
  width: 100%;
  height: 100px;
  border-radius: 8px;
  background: var(--wl-surface-soft);
  overflow: hidden;
  display: grid;
  place-items: center;
}

.cat-media__img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 6px;
}

.cat-media__icon {
  font-size: 32px;
  color: var(--wl-muted);
}

.cat-body {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.cat-name {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--wl-ink-strong);
}

.cat-name-alt {
  font-size: 11px;
  color: var(--wl-muted);
}

.cat-count {
  font-size: 10.5px;
  color: var(--wl-primary);
  font-weight: 600;
  margin-top: 0.2rem;
}

/* Products Grid */
.product-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.25rem;
}

.product-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: var(--wl-shadow-card);
  cursor: pointer;
  transition: transform 0.2s var(--wl-ease-spring), border-color 0.2s ease, box-shadow 0.2s ease;
}

.product-card:hover {
  transform: translateY(-2px);
  border-color: rgba(79, 70, 229, 0.3);
  box-shadow: var(--shadow-md);
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
  padding: 1rem;
}

.product-card__sku {
  font-size: 12px;
  color: var(--wl-muted);
}

.product-card__badge {
  position: absolute;
  top: 10px;
  inset-inline-end: 10px;
  font-size: 9.5px;
  font-weight: 800;
  background: var(--wl-primary);
  color: #fff;
  padding: 0.15rem 0.5rem;
  border-radius: 9999px;
}

.product-card__stock {
  position: absolute;
  top: 10px;
  inset-inline-start: 10px;
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #fff;
  padding: 0.2rem 0.6rem;
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.65);
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.25);
}

.product-card__stock--in {
  background: #059669;
}

.product-card__stock--out {
  background: #DC2626;
}

.product-card__body {
  padding: 1.25rem 1.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.product-card__category {
  font-size: 10.5px;
  color: var(--wl-muted);
  font-weight: 600;
}

.product-card__title {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--wl-ink-strong);
  margin: 0;
  line-height: 1.3;
}

.product-card__meta-alt {
  font-size: 11px;
  color: var(--wl-muted);
}

.product-card__meta {
  font-size: 11px;
  color: #059669;
  font-weight: 600;
  margin: 0.2rem 0 0.85rem;
}

.product-card__foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid var(--wl-surface-soft);
  padding-top: 0.85rem;
}

@media (max-width: 1024px) {
  .hero__inner {
    padding: 2.75rem var(--wl-gutter) 2.25rem;
    gap: 2rem;
  }
  .section {
    padding: 2.75rem 0;
  }
}

@media (max-width: 900px) {
  .hero__inner {
    grid-template-columns: 1fr;
    gap: 2rem;
    padding: 2.5rem var(--wl-gutter) 2rem;
  }
  .hero__logo-box {
    max-width: 380px;
    margin: 0 auto;
    width: 100%;
  }
  .metrics-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.85rem;
  }
  .cat-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.85rem;
  }
  .product-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }
}

@media (max-width: 640px) {
  .section {
    padding: 2rem 0;
  }
  .section-head {
    margin-bottom: 1.15rem;
  }
  .section-title {
    font-size: clamp(1.25rem, 4.5vw, 1.5rem);
  }
  .hero__inner {
    padding: 1.75rem var(--wl-gutter) 1.5rem;
    gap: 1.5rem;
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
    margin-top: 1.15rem;
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
  .metrics-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.6rem;
  }
  .metric-card {
    padding: 0.95rem 1rem;
    gap: 0.45rem;
  }
  .metric-card__value {
    font-size: 1.35rem;
  }
  .cat-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.6rem;
  }
  .cat-card {
    padding: 0.75rem 0.85rem;
  }
  .product-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
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
  .metrics-grid {
    grid-template-columns: 1fr;
  }
  .cat-grid {
    grid-template-columns: 1fr;
  }
}

/* Institutional Quote Modal Styles */
.quote-modal-desc {
  font-size: 13.5px;
  color: var(--wl-ink-muted, #64748B);
  line-height: 1.5;
  margin: 0 0 1.25rem;
}

.modal-2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.85rem;
  margin-bottom: 0.85rem;
}

.modal-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.85rem;
}

.modal-lbl {
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--wl-ink-muted, #475569);
  text-align: start;
}

.modal-inp,
.modal-sel,
.modal-txt {
  width: 100%;
  background: var(--wl-surface-soft, #383A40);
  border: 1.5px solid var(--wl-border, #E2E8F0);
  border-radius: 9px;
  color: var(--wl-ink-strong, #0F172A);
  font-size: 13.5px;
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
  border: 1px dashed rgba(79, 70, 229, 0.3);
  border-radius: 8px;
  padding: 0.6rem 0.85rem;
  font-size: 11.5px;
  margin-bottom: 1.1rem;
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
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.quote-modal-success {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 1.5rem 0.5rem;
}

.success-icon-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--wl-success-soft);
  margin-bottom: 1rem;
}

.success-head {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--wl-ink-strong);
  margin: 0 0 0.5rem;
}

.success-body {
  font-size: 13.5px;
  color: var(--wl-ink-soft);
  line-height: 1.55;
  max-width: 440px;
  margin: 0 auto 1.25rem;
}

.ref-ticket-box {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: 8px;
  padding: 0.5rem 1rem;
  margin-bottom: 1.5rem;
}

.ref-label {
  font-size: 11.5px;
  color: var(--wl-muted);
}

.ref-code {
  font-size: 14px;
  font-weight: 800;
  color: var(--wl-primary);
  letter-spacing: 0.05em;
}

.modal-success-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
  max-width: 320px;
}

.btn-link-oem {
  background: transparent;
  border: none;
  color: var(--wl-primary);
  font-size: 12px;
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

@media (max-width: 580px) {
  .modal-2col {
    grid-template-columns: 1fr;
    gap: 0;
  }
}

.about-grid {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 2.5rem;
  align-items: center;
}

.about-body {
  color: var(--wl-ink-soft, #334155);
  line-height: 1.75;
  font-size: 1rem;
  margin: 1rem 0 0;
  white-space: pre-wrap;
}

.about-ctas {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-top: 1.5rem;
}

.about-media {
  position: relative;
  border-radius: var(--wl-radius-lg, 16px);
  overflow: hidden;
  border: 1px solid var(--wl-line, #e2e8f0);
  background: var(--wl-surface, #fff);
}

.about-media__img {
  width: 100%;
  height: 100%;
  min-height: 260px;
  object-fit: cover;
  display: block;
}

.about-media__badge {
  position: absolute;
  inset-inline-start: 1rem;
  bottom: 1rem;
  background: rgba(11, 29, 42, 0.85);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 0.4rem 0.8rem;
  border-radius: 999px;
}

@media (max-width: 860px) {
  .about-grid {
    grid-template-columns: 1fr;
  }
}
</style>