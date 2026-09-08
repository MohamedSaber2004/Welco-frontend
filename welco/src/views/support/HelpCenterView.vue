<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { t } from '../../i18n'
import { authService } from '../../di/container'
import { contentService } from '../../di/container'
import { toastService } from '../../infrastructure/feedback/toast.service'
import SkeletonLoader from '../../components/ui/SkeletonLoader.vue'
import DataState from '../../components/ui/DataState.vue'
import { resolveFileUrl, isStoredFileName, PLACEHOLDER } from '../../utils/file-url'
import BackButton from '../../components/ui/BackButton.vue'

const router = useRouter()
const search = ref('')
const activeCategory = ref('all')

const categories = contentService.helpCategories
const articles = contentService.helpArticles
const faqs = contentService.faqs
const myTickets = contentService.myTickets
const loading = ref(true)
const openFaq = ref<string | null>(null)
const isAuthed = computed(() => authService.isAuthenticated)
const isBuyer = computed(() => authService.isOrganizationUser.value)
const isSeller = computed(() => authService.isAdmin.value || authService.isWelcoStaff.value)

// Ticket Creation State
const ticketSubject = ref('')
const ticketMessage = ref('')
const submittingTicket = ref(false)
const ticketSuccess = ref(false)
const ticketError = ref('')

const ICONS: Record<string, string> = {
  cart: 'shopping_bag',
  ship: 'local_shipping',
  return: 'assignment_return',
  autoclave: 'sanitizer',
  faq: 'help',
  shield: 'verified_user',
}

const quickTags = computed(() => {
  const allCats = Array.isArray(categories.value) ? categories.value : []
  return allCats.map((c) => c?.name).filter((n): n is string => Boolean(n)).slice(0, 6)
})

function applyQuickFilter(term: string) {
  search.value = term
  activeCategory.value = 'all'
  setTimeout(() => {
    document.querySelector('.article-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, 100)
}

function clearSearch() {
  search.value = ''
}

const filteredArticles = computed(() => {
  const rawList = Array.isArray(articles.value) ? articles.value : []
  const q = search.value.trim().toLowerCase()
  return rawList.filter((a) => {
    if (!a || a.isActive === false) return false
    if (activeCategory.value !== 'all' && a.categoryId !== activeCategory.value) return false
    if (q) {
      const matchTitle = a.title ? String(a.title).toLowerCase().includes(q) : false
      const matchBody = a.body ? String(a.body).toLowerCase().includes(q) : false
      const matchId = a.id ? String(a.id).toLowerCase().includes(q) : false
      return matchTitle || matchBody || matchId
    }
    return true
  })
})

const COLOR_PALETTE = ['#4F46E5', '#0D9488', '#F43F5E', '#10B981', '#6366F1', '#D97706', '#0284C7', '#8B5CF6']

const visibleFaqs = computed(() => {
  const list = Array.isArray(faqs.value) ? faqs.value : []
  return list.filter((f) => f && f.isActive !== false)
})

const guideCards = computed(() => {
  const allCats = Array.isArray(categories.value) ? categories.value.filter((c) => c && c.isActive !== false) : []
  const allArts = Array.isArray(articles.value) ? articles.value.filter((a) => a && a.isActive !== false) : []

  return allCats.map((cat, idx) => {
    const arts = allArts.filter((a) => a && a.categoryId === cat.id)
    const count = cat.articleCount ?? arts.length
    const firstArticle = arts[0]
    const desc = firstArticle && firstArticle.body
      ? firstArticle.body.slice(0, 115) + (firstArticle.body.length > 115 ? '…' : '')
      : ''
    const color = COLOR_PALETTE[idx % COLOR_PALETTE.length]
    return {
      def: {
        key: cat.id,
        title: cat.name,
        icon: cat.icon || 'menu_book',
        tag: 'KNOWLEDGE TOPIC',
        color,
      },
      cat,
      count,
      desc,
      firstArticle,
      isLinked: true,
    }
  })
})

function onGuideClick(card: (typeof guideCards.value)[number]) {
  if (card.cat) {
    activeCategory.value = card.cat.id
    search.value = ''
  } else if (card.firstArticle) {
    activeCategory.value = card.firstArticle.categoryId
    search.value = ''
  } else {
    activeCategory.value = 'all'
  }
  setTimeout(() => {
    document.querySelector('.article-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, 120)
}

async function submitTicket() {
  if (!ticketSubject.value.trim() || !ticketMessage.value.trim()) return
  if (!isAuthed.value) {
    router.push({ path: '/auth/login', query: { redirect: '/help' } })
    return
  }

  submittingTicket.value = true
  ticketError.value = ''
  ticketSuccess.value = false
  try {
    await contentService.createTicket(ticketSubject.value.trim(), ticketMessage.value.trim())
    ticketSuccess.value = true
    ticketSubject.value = ''
    ticketMessage.value = ''
    toastService.success(t('help.ticketCreated'))
  } catch (err: any) {
    const msg = err?.message || t('auth.errGeneric')
    ticketError.value = msg
    toastService.error(msg)
  } finally {
    submittingTicket.value = false
  }
}

function resetTicketForm() {
  ticketSuccess.value = false
  ticketError.value = ''
  ticketSubject.value = ''
  ticketMessage.value = ''
}

function scrollToEscalation() {
  document.getElementById('direct-escalation')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

onMounted(async () => {
  const promises: Promise<any>[] = [
    contentService.loadSupport(),
    contentService.loadSupportContact(),
  ]
  if (isAuthed.value) {
    promises.push(contentService.loadMyTickets())
  }
  await Promise.allSettled(promises)
  loading.value = false
})

function categoryName(id: string): string {
  return categories.value.find((c) => c.id === id)?.name ?? id
}

// Images that 404 — those cards fall back to an icon instead of a broken frame.
const brokenThumbs = ref(new Set<string>())
function markThumbBroken(key: string): void {
  brokenThumbs.value.add(key)
}

function categoryIconName(icon?: string | null, fallback = 'article'): string {
  const raw = (icon ?? '').trim()
  if (!raw) return fallback
  if (isStoredFileName(raw)) return fallback
  return ICONS[raw] ?? (/^[a-z_]+$/.test(raw) ? raw : fallback)
}

interface CategoryVisual {
  kind: 'img' | 'icon'
  src: string
  name: string
}

/**
 * Visual for a help category, resolved from backend data only:
 * stored upload -> image, otherwise a material icon. Articles carry no
 * image of their own, so they reuse their category's visual.
 */
function categoryVisual(categoryId?: string | null, fallback = 'article'): CategoryVisual {
  const cat = categories.value.find((c) => c.id === categoryId)
  const icon = (cat?.icon ?? '').trim()
  if (cat && icon && isStoredFileName(icon) && !brokenThumbs.value.has(`cat:${cat.id}`)) {
    const src = resolveFileUrl(icon, '')
    if (src) return { kind: 'img', src, name: categoryIconName(icon, fallback) }
  }
  return { kind: 'icon', src: '', name: categoryIconName(icon, fallback) }
}
</script>

<template>
  <div class="page-shell">
    <!-- Breadcrumbs / Back Bar -->
    <div class="help-nav-bar">
      <BackButton fallback="/" variant="ghost" />
      <nav class="help-crumb mono" :aria-label="t('common.breadcrumb')">
        <router-link to="/">{{ t('nav.home') }}</router-link>
        <span class="crumb-sep icon--directional" aria-hidden="true">/</span>
        <span class="crumb-current">{{ t('nav.help') }}</span>
      </nav>
    </div>

    <!-- Enhanced Hero with Support Diagnostics Graphics -->
    <section class="help-hero">
      <div class="help-hero__grid">
        <div class="help-hero__copy">
          <div class="help-eyebrow mono">
            <span class="live-dot" aria-hidden="true"></span>
            <span>{{ t('help.heroEyebrow') }}</span>
          </div>
          <h1 class="help-title">{{ t('help.title') }}</h1>
          <p class="help-desc">{{ t('help.subtitle') }}</p>

          <!-- 48px VIP Search Control -->
          <div class="help-search-box">
            <div class="help-search-input-wrap">
              <span class="material-symbols-outlined search-icon" aria-hidden="true">search</span>
              <input
                v-model="search"
                class="help-search-field"
                :placeholder="t('help.searchPlaceholder')"
                :aria-label="t('help.searchPlaceholder')"
              />
              <button
                v-if="search"
                type="button"
                class="search-clear-btn"
                :aria-label="t('common.clearInput')"
                @click="clearSearch"
              >
                <span class="material-symbols-outlined text-[16px]">close</span>
              </button>
              <span v-else class="search-kbd mono" aria-hidden="true">ESC</span>
            </div>

            <!-- Quick Filter Tags -->
            <div v-if="quickTags.length" class="quick-tags-wrap">
              <span class="quick-tags-label mono">{{ t('help.popularTopics') }}</span>
              <button
                v-for="tag in quickTags"
                :key="tag"
                type="button"
                class="quick-tag-btn mono"
                @click="applyQuickFilter(tag)"
              >
                {{ tag }}
              </button>
            </div>
          </div>
        </div>

        <!-- Right Side: Bespoke Surgical Support Telemetry & Architecture Graphic -->
        <div class="help-hero__graphic" aria-hidden="true">
          <div class="telemetry-card">
            <div class="telemetry-head">
              <div class="telemetry-badge mono">
                <span class="pulse-ring"></span>
                <span>SUPPORT NETWORK STATUS</span>
              </div>
              <span class="telemetry-sla mono">&lt; 2h SLA</span>
            </div>

            <!-- Interactive Architecture SVG Schematic -->
            <div class="schematic-container">
              <svg class="schematic-svg" viewBox="0 0 320 190" fill="none">
                <defs>
                  <linearGradient id="laserGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#4F46E5" />
                    <stop offset="100%" stop-color="#0D9488" />
                  </linearGradient>
                </defs>

                <!-- Connecting Laser Lines -->
                <line x1="160" y1="95" x2="60" y2="45" class="laser-line" />
                <line x1="160" y1="95" x2="260" y2="45" class="laser-line" />
                <line x1="160" y1="95" x2="60" y2="150" class="laser-line" />
                <line x1="160" y1="95" x2="260" y2="150" class="laser-line" />

                <!-- Center Node (Welco Clinical Support) -->
                <circle cx="160" cy="95" r="28" class="node-center-outer" />
                <circle cx="160" cy="95" r="20" class="node-center-inner" />
                <text x="160" y="93" text-anchor="middle" class="node-center-text mono">WELCO</text>
                <text x="160" y="103" text-anchor="middle" class="node-center-sub mono">SUPPORT</text>

                <!-- Peripheral Node: Top-Left (Sterilization IFU) -->
                <g class="sat-node sat-node--teal">
                  <circle cx="60" cy="45" r="18" class="sat-circle" />
                  <text x="60" y="43" text-anchor="middle" class="sat-title mono">IFU 134°C</text>
                  <text x="60" y="52" text-anchor="middle" class="sat-desc mono">STERILE</text>
                </g>

                <!-- Peripheral Node: Top-Right (RFQ & Contracts) -->
                <g class="sat-node sat-node--indigo">
                  <circle cx="260" cy="45" r="18" class="sat-circle" />
                  <text x="260" y="43" text-anchor="middle" class="sat-title mono">B2B RFQ</text>
                  <text x="260" y="52" text-anchor="middle" class="sat-desc mono">CONTRACTS</text>
                </g>

                <!-- Peripheral Node: Bottom-Left (Freight & Logistics) -->
                <g class="sat-node sat-node--amber">
                  <circle cx="60" cy="150" r="18" class="sat-circle" />
                  <text x="60" y="148" text-anchor="middle" class="sat-title mono">FREIGHT</text>
                  <text x="60" y="157" text-anchor="middle" class="sat-desc mono">INCOTERMS</text>
                </g>

                <!-- Peripheral Node: Bottom-Right (Regulatory & CE) -->
                <g class="sat-node sat-node--emerald">
                  <circle cx="260" cy="150" r="18" class="sat-circle" />
                  <text x="260" y="148" text-anchor="middle" class="sat-title mono">CE · MDR</text>
                  <text x="260" y="157" text-anchor="middle" class="sat-desc mono">DOSSIERS</text>
                </g>
              </svg>
            </div>

            <div class="telemetry-metrics">
              <div class="telemetry-metric">
                <strong class="metric-val mono">100%</strong>
                <span class="metric-lbl mono">LOT TRACEABLE</span>
              </div>
              <div class="telemetry-metric-sep"></div>
              <div class="telemetry-metric">
                <strong class="metric-val mono">ISO 13485</strong>
                <span class="metric-lbl mono">AUDITED PROTOCOL</span>
              </div>
              <div class="telemetry-metric-sep"></div>
              <div class="telemetry-metric">
                <strong class="metric-val mono">99.4%</strong>
                <span class="metric-lbl mono">RESOLUTION RATE</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <SkeletonLoader v-if="loading" type="category-grid" :count="6" />

    <template v-else>
      <!-- Enhanced Guide Cards (No 'view all' text links) -->
      <section v-if="guideCards.length" class="guides-section">
        <div class="help-grid">
          <article
            v-for="card in guideCards"
            :key="card.def.key"
            class="help-card"
            :class="{ 'help-card--empty': !card.isLinked && !card.count, 'help-card--linked': card.isLinked }"
            @click="onGuideClick(card)"
          >
            <!-- Card Laser Top Accent -->
            <div class="help-card__accent" :style="{ background: card.def.color }"></div>

            <div class="help-card__top">
              <div class="hc-icon-wrapper" :style="{ color: card.def.color, background: `${card.def.color}14` }">
                <img
                  v-if="categoryVisual(card.cat?.id, 'menu_book').kind === 'img'"
                  :src="categoryVisual(card.cat?.id, 'menu_book').src"
                  alt=""
                  loading="lazy"
                  class="hc-thumb-img"
                  @error="markThumbBroken(`cat:${card.cat?.id}`)"
                />
                <span v-else class="material-symbols-outlined hc-icon">{{ categoryVisual(card.cat?.id, 'menu_book').name }}</span>
              </div>
              <span class="help-card__tag mono">{{ card.def.tag }}</span>
            </div>

            <h3 class="help-card__title">{{ card.cat?.name ?? card.def.title }}</h3>
            <p v-if="card.desc" class="help-card__desc">{{ card.desc }}</p>

            <!-- Bottom Information Pill without redundant 'view all' text -->
            <div class="help-card__footer">
              <span class="help-card__count mono">
                {{ card.count ? t('help.protocolsDocumented', { count: card.count }) : t('help.technicalGuide') }}
              </span>
              <span class="material-symbols-outlined card-arrow icon--directional" aria-hidden="true">arrow_forward</span>
            </div>
          </article>
        </div>
      </section>

      <!-- Knowledge Base Articles Directory -->
      <section class="article-section">
        <div class="section-head">
          <div>
            <div class="section-eyebrow mono">
              <span class="material-symbols-outlined text-[14px]">menu_book</span>
              <span>{{ t('help.articlesEyebrow') }}</span>
            </div>
            <h2 class="section-title">{{ t('help.articles') }}</h2>
          </div>
          <span class="article-counter mono">{{ t('help.articlesLoaded', { count: filteredArticles.length }) }}</span>
        </div>

        <!-- Topic Tabs -->
        <div class="cat-pills" role="tablist">
          <button
            class="pill"
            :class="{ 'pill--active': activeCategory === 'all' }"
            @click="activeCategory = 'all'"
          >
            <span class="material-symbols-outlined text-[16px]">grid_view</span>
            <span>{{ t('common.all') }}</span>
          </button>
          <button
            v-for="c in categories"
            :key="c.id"
            class="pill"
            :class="{ 'pill--active': activeCategory === c.id }"
            @click="activeCategory = c.id"
          >
            <img
              v-if="c.icon && isStoredFileName(c.icon)"
              :src="resolveFileUrl(c.icon, '')"
              :alt="c.name"
              class="pill-img"
              @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
            />
            <span
              v-else-if="c.icon && ICONS[c.icon]"
              class="material-symbols-outlined text-[16px]"
            >
              {{ ICONS[c.icon] }}
            </span>
            <span v-else-if="c.icon">{{ c.icon }}</span>
            <span>{{ c.name }}</span>
            <span class="pill__count mono">{{ c.articleCount ?? 0 }}</span>
          </button>
        </div>

        <DataState
          :empty="!filteredArticles.length"
          :empty-title="t('help.noResults')"
          :empty-description="t('help.noResultsDesc')"
          min-height="200px"
        >
          <div class="article-grid">
            <article v-for="a in filteredArticles" :key="a.id" class="article-card">
              <div class="article-card__head">
                <span class="article-thumb" aria-hidden="true">
                  <img
                    v-if="categoryVisual(a.categoryId).kind === 'img'"
                    :src="categoryVisual(a.categoryId).src"
                    alt=""
                    loading="lazy"
                    class="article-thumb__img"
                    @error="markThumbBroken(`cat:${a.categoryId}`)"
                  />
                  <span v-else class="material-symbols-outlined">{{ categoryVisual(a.categoryId).name }}</span>
                </span>
                <div class="article-card__meta">
                  <span class="article-cat mono">{{ categoryName(a.categoryId) }}</span>
                  <span class="article-read-time mono">{{ t('help.readTime', { minutes: 3 }) }}</span>
                </div>
              </div>
              <h3 class="article-card__title">{{ a.title }}</h3>
              <p class="article-card__body">{{ a.body }}</p>
            </article>
          </div>
        </DataState>
      </section>

      <!-- Frequently Asked Questions Accordion -->
      <section class="faq-section">
        <div class="section-head">
          <div>
            <div class="section-eyebrow mono">
              <span class="material-symbols-outlined text-[14px]">help_center</span>
              <span>{{ t('help.faqEyebrow') }}</span>
            </div>
            <h2 class="section-title">{{ t('help.faq') }}</h2>
          </div>
          <span class="article-counter mono">{{ t('help.articlesLoaded', { count: visibleFaqs.length }) }}</span>
        </div>

        <div class="faq-accordion-box">
          <div
            v-for="(f, idx) in visibleFaqs"
            :key="f.id"
            class="faq-item"
            :class="{ open: openFaq === f.id }"
          >
            <button
              type="button"
              class="faq-item__header"
              :aria-expanded="openFaq === f.id"
              @click="openFaq = openFaq === f.id ? null : f.id"
            >
              <div class="faq-item__left">
                <span class="faq-index mono">{{ String(idx + 1).padStart(2, '0') }}</span>
                <span class="faq-item__q">{{ f.question }}</span>
              </div>
              <span class="material-symbols-outlined faq-item__chev" aria-hidden="true">
                expand_more
              </span>
            </button>
            <Transition name="expand">
              <div v-if="openFaq === f.id" class="faq-item__body">
                <p class="faq-item__a">{{ f.answer }}</p>
              </div>
            </Transition>
          </div>
        </div>
      </section>

      <!-- Role-Specific Action Panels -->
      <section v-if="isBuyer && isAuthed" class="help-role-card">
        <div class="role-card__left">
          <div class="role-card__icon-wrap">
            <span class="material-symbols-outlined">support_agent</span>
          </div>
          <div>
            <h3 class="role-card__title">{{ t('help.myTickets') }}</h3>
            <p class="role-card__desc">{{ t('help.myTicketsDesc') }}</p>
          </div>
        </div>
        <div class="role-card__actions">
          <button class="btn btn-primary" @click="router.push('/help/my-tickets')">{{ t('help.myTickets') }}</button>
          <button class="btn btn-ghost" @click="scrollToEscalation">{{ t('help.createTicket') }}</button>
        </div>
      </section>

      <section v-else-if="isSeller && isAuthed" class="help-role-card">
        <div class="role-card__left">
          <div class="role-card__icon-wrap">
            <span class="material-symbols-outlined">admin_panel_settings</span>
          </div>
          <div>
            <h3 class="role-card__title">{{ t('help.manageHelp') }}</h3>
            <p class="role-card__desc">{{ t('help.staffDesc') }}</p>
          </div>
        </div>
        <div class="role-card__actions">
          <button class="btn btn-primary" @click="router.push('/admin/tickets')">{{ t('help.staffQueue') }}</button>
          <button class="btn btn-ghost" @click="router.push('/admin/help')">{{ t('help.manageHelp') }}</button>
        </div>
      </section>

      <!-- Direct Contact & Ticket Creation Escalation Desk -->
      <section id="direct-escalation" class="help-contact-banner">
        <div class="contact-header">
          <div class="contact-copy">
            <div class="contact-eyebrow mono">
              <span class="live-dot" aria-hidden="true"></span>
              <span>{{ t('help.ticketsEyebrow') }}</span>
            </div>
            <h2 class="contact-title">{{ t('help.getInTouch') }}</h2>
            <p class="contact-desc">{{ t('help.escalationDesc') }}</p>
          </div>
          <router-link
            v-if="isAuthed"
            to="/help/my-tickets"
            class="my-tickets-badge-link mono"
          >
            <span class="material-symbols-outlined text-[18px]">confirmation_number</span>
            <span>{{ t('help.myTickets') }}</span>
            <span v-if="myTickets.length > 0" class="tickets-count-pill">{{ myTickets.length }}</span>
            <span class="material-symbols-outlined text-[16px] icon--directional">arrow_forward</span>
          </router-link>
        </div>

        <div class="escalation-grid">
          <!-- Left Column: Direct Communication Channels -->
          <div class="escalation-channels">
            <div class="channel-group-header">
              <div class="channel-group-title mono">
                <span class="material-symbols-outlined text-[18px]">contact_phone</span>
                <span>{{ t('help.channelsTitle') }}</span>
              </div>
              <p class="channel-group-desc">{{ t('help.channelsDesc') }}</p>
            </div>

            <div class="channel-cards-list">
              <!-- Official Support Email -->
              <a
                v-if="contentService.supportContact.value.supportEmail"
                class="channel-card"
                :href="'mailto:' + contentService.supportContact.value.supportEmail"
                target="_blank"
                rel="noopener noreferrer"
              >
                <div class="channel-icon channel-icon--email">
                  <span class="material-symbols-outlined">mail</span>
                </div>
                <div class="channel-info">
                  <span class="channel-type mono">{{ t('help.channelEmailTitle') }}</span>
                  <span class="channel-value">{{ contentService.supportContact.value.supportEmail }}</span>
                  <span class="channel-note">{{ t('help.channelEmailNote') }}</span>
                </div>
                <span class="material-symbols-outlined channel-arrow icon--directional">open_in_new</span>
              </a>

              <!-- WhatsApp Quick Dispatch -->
              <a
                v-if="contentService.supportContact.value.whatsAppNumber"
                class="channel-card"
                :href="'https://wa.me/' + contentService.supportContact.value.whatsAppNumber.replace(/\D/g, '')"
                target="_blank"
                rel="noopener noreferrer"
              >
                <div class="channel-icon channel-icon--whatsapp">
                  <span class="material-symbols-outlined">chat</span>
                </div>
                <div class="channel-info">
                  <span class="channel-type mono">{{ t('help.channelWaTitle') }}</span>
                  <span class="channel-value">{{ contentService.supportContact.value.whatsAppNumber }}</span>
                  <span class="channel-note">{{ t('help.channelWaNote') }}</span>
                </div>
                <span class="material-symbols-outlined channel-arrow icon--directional">open_in_new</span>
              </a>

              <!-- Engineering Hotline Desk -->
              <a
                v-if="contentService.supportContact.value.phoneNumber"
                class="channel-card"
                :href="'tel:' + contentService.supportContact.value.phoneNumber.replace(/\s+/g, '')"
              >
                <div class="channel-icon channel-icon--phone">
                  <span class="material-symbols-outlined">call</span>
                </div>
                <div class="channel-info">
                  <span class="channel-type mono">{{ t('help.channelPhoneTitle') }}</span>
                  <span class="channel-value">{{ contentService.supportContact.value.phoneNumber }}</span>
                  <span class="channel-note">{{ t('help.channelPhoneNote') }}</span>
                </div>
                <span class="material-symbols-outlined channel-arrow icon--directional">call_made</span>
              </a>
            </div>

            <div class="escalation-sla-badge mono">
              <span class="material-symbols-outlined text-[16px]">verified</span>
              <span>{{ t('help.slaBadge') }}</span>
            </div>
          </div>

          <!-- Right Column: Interactive Ticket Form or Sign-in Prompt -->
          <div class="escalation-form-panel">
            <div class="form-panel-header">
              <div class="panel-badge mono">
                <span class="material-symbols-outlined text-[18px]">edit_note</span>
                <span>{{ t('help.createTicket') }}</span>
              </div>
              <p class="panel-subtitle">{{ t('help.ticketPanelSubtitle') }}</p>
            </div>

            <!-- Authenticated: Ticket Form -->
            <div v-if="isAuthed" class="ticket-card-content">
              <!-- Success State -->
              <div v-if="ticketSuccess" class="ticket-success-state">
                <div class="success-icon-wrap">
                  <span class="material-symbols-outlined text-[36px]">check_circle</span>
                </div>
                <h3 class="success-title">{{ t('common.success') }}</h3>
                <p class="success-desc">{{ t('help.ticketCreated') }}</p>
                <div class="success-actions">
                  <button type="button" class="btn btn-primary" @click="router.push('/help/my-tickets')">
                    <span class="material-symbols-outlined text-[18px]">visibility</span>
                    <span>{{ t('help.myTickets') }}</span>
                  </button>
                  <button type="button" class="btn btn-ghost" @click="resetTicketForm">
                    <span class="material-symbols-outlined text-[18px]">add</span>
                    <span>{{ t('help.createTicket') }}</span>
                  </button>
                </div>
              </div>

              <!-- Form State -->
              <form v-else class="ticket-form" @submit.prevent="submitTicket">
                <div class="form-field">
                  <label class="form-label mono" for="ticket-subject">
                    <span>{{ t('help.subject') }}</span>
                    <span class="required-star">*</span>
                  </label>
                  <input
                    id="ticket-subject"
                    v-model="ticketSubject"
                    class="form-input"
                    :placeholder="t('help.subjectPlaceholder')"
                    required
                    :disabled="submittingTicket"
                  />
                </div>

                <div class="form-field">
                  <label class="form-label mono" for="ticket-message">
                    <span>{{ t('help.message') }}</span>
                    <span class="required-star">*</span>
                  </label>
                  <textarea
                    id="ticket-message"
                    v-model="ticketMessage"
                    class="form-textarea"
                    rows="4"
                    :placeholder="t('help.messagePlaceholder')"
                    required
                    :disabled="submittingTicket"
                  ></textarea>
                </div>

                <div v-if="ticketError" class="ticket-error-alert" role="alert">
                  <span class="material-symbols-outlined text-[18px]">error</span>
                  <span>{{ ticketError }}</span>
                </div>

                <button
                  type="submit"
                  class="btn btn-primary btn-submit-ticket mono"
                  :disabled="submittingTicket || !ticketSubject.trim() || !ticketMessage.trim()"
                >
                  <span v-if="submittingTicket" class="submit-spinner" aria-hidden="true"></span>
                  <span v-else class="material-symbols-outlined text-[18px]">send</span>
                  <span>{{ submittingTicket ? t('common.loading') : t('help.createTicket') }}</span>
                </button>
              </form>
            </div>

            <!-- Unauthenticated: Guest Prompt Card -->
            <div v-else class="ticket-guest-card">
              <div class="guest-card-icon">
                <span class="material-symbols-outlined">lock_open</span>
              </div>
              <h3 class="guest-card-title">{{ t('help.guestTitle') }}</h3>
              <p class="guest-card-desc">{{ t('help.guestDesc') }}</p>
              <div class="guest-card-actions">
                <router-link
                  :to="{ path: '/auth/login', query: { redirect: '/help' } }"
                  class="btn btn-primary"
                >
                  <span class="material-symbols-outlined text-[18px]">login</span>
                  <span>{{ t('nav.login') }}</span>
                </router-link>
                <router-link
                  to="/auth/register"
                  class="btn btn-ghost"
                >
                  <span>{{ t('nav.register') }}</span>
                </router-link>
              </div>
              <p class="guest-card-subnote">{{ t('help.guestSubnote') }}</p>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.help-nav-bar {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.help-crumb {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 11px;
  color: var(--wl-muted);
}

.help-crumb a {
  color: var(--wl-muted);
  text-decoration: none;
  transition: color 0.15s ease;
}

.help-crumb a:hover {
  color: var(--wl-teal);
}

.crumb-sep {
  color: var(--wl-border);
}

.crumb-current {
  color: var(--wl-ink-strong);
  font-weight: 700;
}

/* Enhanced Hero Section with Diagnostics Graphics */
.help-hero {
  padding: 2.5rem 2rem;
  border: 1px solid var(--wl-border);
  background: var(--wl-surface);
  border-radius: 16px;
  box-shadow: var(--wl-shadow-card);
  position: relative;
  overflow: hidden;
  margin-bottom: 2rem;
}

.help-hero::before {
  content: '';
  position: absolute;
  top: 0;
  inset-inline: 0;
  height: 2px;
  background: linear-gradient(90deg, #4F46E5, var(--wl-teal), #6366F1);
  opacity: 0.95;
}

.help-hero__grid {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 2.5rem;
  align-items: center;
}

.help-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 10.5px;
  color: #4F46E5;
  font-weight: 700;
  letter-spacing: 0.08em;
  margin-bottom: 0.5rem;
}

.live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--wl-success);
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
}

.help-title {
  font-family: var(--wl-font-display);
  font-size: clamp(1.85rem, 3.2vw, 2.5rem);
  font-weight: 800;
  letter-spacing: -0.025em;
  color: var(--wl-ink-strong);
  line-height: 1.12;
  margin: 0 0 0.65rem;
}

.help-desc {
  font-size: 0.95rem;
  color: var(--wl-ink-soft);
  line-height: 1.55;
  margin: 0 0 1.5rem;
  max-width: 580px;
}

/* 48px VIP Search Control */
.help-search-box {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.help-search-input-wrap {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 12px;
  height: 48px;
  padding: 0 1rem;
  box-shadow: var(--shadow-xs);
  transition: border-color 0.22s var(--wl-ease-spring), box-shadow 0.22s var(--wl-ease-spring), transform 0.16s ease;
  max-width: 540px;
}

.help-search-input-wrap:focus-within {
  border-color: var(--wl-teal);
  box-shadow: var(--wl-focus-ring);
  transform: translateY(-0.5px);
}

.search-icon {
  font-size: 20px;
  color: var(--wl-muted);
}

.help-search-field {
  border: none;
  background: transparent;
  outline: none;
  font-size: 0.95rem;
  font-family: var(--wl-font-body);
  color: var(--wl-ink-strong);
  width: 100%;
}

.help-search-field::placeholder {
  color: var(--wl-muted);
  opacity: 0.85;
}

.search-clear-btn {
  background: none;
  border: none;
  color: var(--wl-muted);
  cursor: pointer;
  display: grid;
  place-items: center;
  padding: 0.2rem;
  border-radius: 50%;
  transition: color 0.15s ease;
}

.search-clear-btn:hover {
  color: var(--wl-ink-strong);
}

.search-kbd {
  font-size: 9.5px;
  color: var(--wl-muted);
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  padding: 0.15rem 0.4rem;
  border-radius: 5px;
  letter-spacing: 0.04em;
}

.quick-tags-wrap {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.quick-tags-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--wl-muted);
  letter-spacing: 0.06em;
}

.quick-tag-btn {
  font-size: 11px;
  color: var(--wl-ink-soft);
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  padding: 0.25rem 0.6rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.quick-tag-btn:hover {
  background: rgba(79, 70, 229, 0.08);
  border-color: rgba(79, 70, 229, 0.3);
  color: #4F46E5;
  transform: translateY(-0.5px);
}

/* Right Side: Surgical Telemetry & Graphic */
.telemetry-card {
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: 14px;
  padding: 1.35rem 1.4rem;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.telemetry-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.telemetry-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--wl-ink-strong);
}

.pulse-ring {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--wl-teal);
  box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.2);
}

.telemetry-sla {
  font-size: 11px;
  font-weight: 700;
  color: #059669;
  background: rgba(16, 185, 129, 0.1);
  padding: 0.18rem 0.55rem;
  border-radius: 9999px;
  border: 1px solid rgba(16, 185, 129, 0.25);
}

.schematic-container {
  width: 100%;
  height: 155px;
}

.schematic-svg {
  width: 100%;
  height: 100%;
}

.laser-line {
  stroke: var(--wl-border);
  stroke-width: 1.5;
  stroke-dasharray: 3 3;
}

.node-center-outer {
  fill: var(--wl-surface);
  stroke: #4F46E5;
  stroke-width: 2;
  box-shadow: 0 0 10px rgba(79, 70, 229, 0.4);
}

.node-center-inner {
  fill: rgba(79, 70, 229, 0.12);
}

.node-center-text {
  font-size: 8px;
  font-weight: 800;
  fill: #4F46E5;
  letter-spacing: 0.05em;
}

.node-center-sub {
  font-size: 6.5px;
  font-weight: 700;
  fill: var(--wl-muted);
  letter-spacing: 0.06em;
}

.sat-circle {
  fill: var(--wl-surface);
  stroke: var(--wl-border);
  stroke-width: 1.5;
  transition: all 0.2s ease;
}

.sat-title {
  font-size: 6.5px;
  font-weight: 800;
  fill: var(--wl-ink-strong);
  letter-spacing: 0.03em;
}

.sat-desc {
  font-size: 5.5px;
  font-weight: 600;
  fill: var(--wl-muted);
  letter-spacing: 0.05em;
}

.sat-node--teal .sat-circle { stroke: var(--wl-teal); }
.sat-node--indigo .sat-circle { stroke: #6366F1; }
.sat-node--amber .sat-circle { stroke: #F59E0B; }
.sat-node--emerald .sat-circle { stroke: #10B981; }

.telemetry-metrics {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px dashed var(--wl-border);
  padding-top: 0.75rem;
}

.telemetry-metric {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  flex: 1;
}

.metric-val {
  font-size: 12.5px;
  font-weight: 800;
  color: var(--wl-ink-strong);
}

.metric-lbl {
  font-size: 8.5px;
  color: var(--wl-muted);
  font-weight: 600;
  letter-spacing: 0.04em;
}

.telemetry-metric-sep {
  width: 1px;
  height: 20px;
  background: var(--wl-border);
}

/* Guides Grid & Cards (No 'view all' link) */
.guides-section {
  margin-bottom: 2.5rem;
}

.help-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.25rem;
}

.help-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 14px;
  padding: 1.35rem 1.4rem;
  box-shadow: var(--wl-shadow-card);
  cursor: pointer;
  transition: transform 0.2s var(--wl-ease-spring), border-color 0.2s ease, box-shadow 0.2s ease;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.help-card__accent {
  position: absolute;
  top: 0;
  inset-inline: 0;
  height: 2.5px;
  opacity: 0.85;
}

.help-card:hover {
  transform: translateY(-3px);
  border-color: rgba(79, 70, 229, 0.3);
  box-shadow: var(--shadow-md);
}

.help-card__top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.95rem;
}

.hc-icon-wrapper {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.hc-icon {
  font-size: 20px;
}

.hc-thumb-img {
  width: 22px;
  height: 22px;
  object-fit: cover;
  border-radius: 6px;
  display: block;
}

.help-card__tag {
  font-size: 9.5px;
  font-weight: 700;
  color: var(--wl-muted);
  letter-spacing: 0.06em;
}

.help-card__title {
  font-family: var(--wl-font-display);
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: -0.015em;
  color: var(--wl-ink-strong);
  margin: 0 0 0.45rem;
  line-height: 1.25;
}

.help-card__desc {
  font-size: 0.88rem;
  color: var(--wl-ink-soft);
  line-height: 1.55;
  margin: 0 0 1.25rem;
  flex: 1;
}

/* Card footer without 'view all' text link */
.help-card__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid var(--wl-surface-soft);
  padding-top: 0.75rem;
  margin-top: auto;
}

.help-card__count {
  font-size: 11px;
  font-weight: 600;
  color: var(--wl-muted);
}

.card-arrow {
  font-size: 16px;
  color: var(--wl-muted);
  transition: transform 0.15s ease, color 0.15s ease;
}

.help-card:hover .card-arrow {
  color: var(--wl-teal);
  transform: translateX(3px);
}

/* Section Common Headers */
.section-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 1rem;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
}

.section-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 10.5px;
  color: #4F46E5;
  font-weight: 700;
  letter-spacing: 0.08em;
  margin-bottom: 0.25rem;
}

.section-title {
  font-family: var(--wl-font-display);
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--wl-ink-strong);
  margin: 0;
}

.article-counter {
  font-size: 11.5px;
  color: var(--wl-muted);
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  padding: 0.3rem 0.75rem;
  border-radius: 9999px;
  font-weight: 600;
}

/* Topic Tabs */
.cat-pills {
  display: flex;
  gap: 0.55rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 0.95rem;
  border-radius: 9999px;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  font-size: 12.5px;
  font-weight: 600;
  color: var(--wl-ink-soft);
  cursor: pointer;
  transition: all 0.15s ease;
}

.pill:hover {
  background: var(--wl-surface-soft);
  color: var(--wl-ink-strong);
}

.pill--active {
  background: var(--wl-teal) !important;
  border-color: var(--wl-teal) !important;
  color: #ffffff !important;
  box-shadow: 0 2px 8px -2px rgba(13, 148, 136, 0.4);
}

.pill-img {
  width: 16px;
  height: 16px;
  object-fit: cover;
  border-radius: 3px;
}

.pill__count {
  font-size: 10px;
  padding: 0.1rem 0.4rem;
  border-radius: 9999px;
  background: rgba(0, 0, 0, 0.08);
}

.pill--active .pill__count {
  background: rgba(255, 255, 255, 0.25);
  color: #ffffff;
}

/* Article Grid */
.article-section {
  margin-bottom: 2.5rem;
}

.article-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.article-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 12px;
  padding: 1.25rem 1.4rem;
  box-shadow: var(--shadow-xs);
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  transition: border-color 0.15s ease, transform 0.15s ease;
}

.article-card:hover {
  border-color: var(--wl-border-strong);
  transform: translateY(-1px);
}

.article-card__meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex: 1;
  min-width: 0;
  gap: 0.5rem;
}

.article-card__head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.article-thumb {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  color: var(--wl-teal);
  overflow: hidden;
  font-size: 20px;
}

.article-thumb__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.article-cat {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--wl-teal);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.article-read-time {
  font-size: 10px;
  color: var(--wl-muted);
}

.article-card__title {
  font-size: 0.98rem;
  font-weight: 700;
  color: var(--wl-ink-strong);
  margin: 0;
  line-height: 1.35;
}

.article-card__body {
  font-size: 0.88rem;
  color: var(--wl-ink-soft);
  line-height: 1.55;
  margin: 0;
}

/* FAQ Accordion */
.faq-section {
  margin-bottom: 2.5rem;
}

.faq-accordion-box {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 14px;
  box-shadow: var(--wl-shadow-card);
  overflow: hidden;
}

.faq-item {
  border-bottom: 1px solid var(--wl-border);
}

.faq-item:last-child {
  border-bottom: none;
}

.faq-item__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 1.15rem 1.4rem;
  background: none;
  border: none;
  cursor: pointer;
  text-align: start;
  gap: 1rem;
  transition: background-color 0.12s ease;
}

.faq-item__header:hover {
  background: var(--wl-surface-soft);
}

.faq-item__left {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  flex: 1;
}

.faq-index {
  font-size: 11.5px;
  font-weight: 800;
  color: var(--wl-teal);
  background: rgba(13, 148, 136, 0.08);
  border: 1px solid rgba(13, 148, 136, 0.2);
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.faq-item__q {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--wl-ink-strong);
  line-height: 1.35;
}

.faq-item__chev {
  font-size: 22px;
  color: var(--wl-muted);
  transition: transform 0.2s var(--wl-ease-spring);
  flex-shrink: 0;
}

.faq-item.open .faq-item__chev {
  transform: rotate(180deg);
  color: var(--wl-teal);
}

.faq-item__body {
  padding: 0 1.4rem 1.15rem 3.65rem;
}

.faq-item__a {
  font-size: 0.9rem;
  color: var(--wl-ink-soft);
  line-height: 1.6;
  margin: 0;
}

/* Help Role Card */
.help-role-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1.5rem;
  flex-wrap: wrap;
  padding: 1.5rem 1.75rem;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 14px;
  box-shadow: var(--shadow-xs);
  margin-bottom: 2rem;
}

.role-card__left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.role-card__icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: rgba(79, 70, 229, 0.08);
  color: #4F46E5;
  display: grid;
  place-items: center;
  font-size: 24px;
  flex-shrink: 0;
}

.role-card__title {
  font-family: var(--wl-font-display);
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--wl-ink-strong);
  margin: 0 0 0.25rem;
}

.role-card__desc {
  font-size: 0.88rem;
  color: var(--wl-ink-soft);
  margin: 0;
}

.role-card__actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

/* Contact Escalation Banner & Ticket Desk */
.help-contact-banner {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  margin-top: 3.5rem;
  margin-bottom: 3rem;
  padding: 2.75rem 2.25rem;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 20px;
  box-shadow: 0 4px 24px -6px rgba(0, 0, 0, 0.06);
  position: relative;
  overflow: hidden;
}

.help-contact-banner::before {
  content: '';
  position: absolute;
  top: 0;
  inset-inline: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--wl-teal) 0%, #6366F1 50%, #8B5CF6 100%);
}

.contact-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.contact-copy {
  flex: 1;
  min-width: 280px;
}

.contact-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 11px;
  color: var(--wl-teal);
  font-weight: 700;
  letter-spacing: 0.08em;
  margin-bottom: 0.4rem;
}

.contact-title {
  font-family: var(--wl-font-display);
  font-size: 1.65rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--wl-ink-strong);
  margin: 0 0 0.5rem;
}

.contact-desc {
  font-size: 0.94rem;
  color: var(--wl-ink-soft);
  margin: 0;
  max-width: 680px;
  line-height: 1.6;
}

.my-tickets-badge-link {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 1.15rem;
  border-radius: 9999px;
  background: var(--wl-primary-soft);
  border: 1px solid rgba(var(--wl-primary-rgb), 0.22);
  color: var(--wl-primary);
  font-size: 0.84rem;
  font-weight: 700;
  text-decoration: none;
  transition: all 0.2s ease;
}

.my-tickets-badge-link:hover {
  background: var(--wl-primary);
  color: #fff;
  transform: translateY(-1px);
}

.tickets-count-pill {
  padding: 0.15rem 0.55rem;
  border-radius: 9999px;
  font-size: 0.72rem;
  background: var(--wl-primary);
  color: #fff;
  font-weight: 800;
  transition: all 0.2s ease;
}

.my-tickets-badge-link:hover .tickets-count-pill {
  background: var(--wl-surface);
  color: var(--wl-primary);
}
:root.dark .my-tickets-badge-link:hover .tickets-count-pill,
:root[data-theme='dark'] .my-tickets-badge-link:hover .tickets-count-pill {
  background: var(--wl-surface);
  color: var(--wl-primary);
}

/* 2-Column Escalation Grid */
.escalation-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr);
  gap: 2.25rem;
  align-items: stretch;
}

.escalation-channels {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.channel-group-header {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.channel-group-title {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.07em;
  color: var(--wl-teal);
}

.channel-group-desc {
  font-size: 0.86rem;
  color: var(--wl-ink-soft);
  margin: 0;
  line-height: 1.5;
}

.channel-cards-list {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.channel-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.1rem 1.2rem;
  border-radius: 12px;
  background: var(--wl-surface-raised, rgba(0, 0, 0, 0.02));
  border: 1px solid var(--wl-border);
  text-decoration: none;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.channel-card:hover {
  border-color: var(--wl-teal);
  transform: translateY(-2px);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.05);
}

.channel-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  font-size: 22px;
}

.channel-icon--email {
  background: rgba(13, 148, 136, 0.12);
  color: var(--wl-teal);
}

.channel-icon--whatsapp {
  background: rgba(16, 185, 129, 0.12);
  color: #10B981;
}

.channel-icon--phone {
  background: rgba(99, 102, 241, 0.12);
  color: #6366F1;
}

.channel-info {
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
  flex: 1;
  min-width: 0;
}

.channel-type {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--wl-muted);
}

.channel-value {
  font-size: 0.94rem;
  font-weight: 700;
  color: var(--wl-ink-strong);
  word-break: break-all;
}

.channel-note {
  font-size: 0.78rem;
  color: var(--wl-ink-soft);
}

.channel-arrow {
  font-size: 18px;
  color: var(--wl-muted);
  flex-shrink: 0;
  transition: transform 0.2s ease, color 0.2s ease;
}

.channel-card:hover .channel-arrow {
  color: var(--wl-teal);
  transform: translateX(2px);
}

[dir="rtl"] .channel-card:hover .channel-arrow {
  transform: translateX(-2px);
}

.escalation-sla-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.7rem 0.95rem;
  border-radius: 10px;
  background: rgba(13, 148, 136, 0.06);
  border: 1px solid rgba(13, 148, 136, 0.18);
  font-size: 0.76rem;
  color: var(--wl-ink-soft);
  margin-top: auto;
  font-weight: 600;
}

/* Escalation Ticket Form Panel */
.escalation-form-panel {
  background: var(--wl-surface-raised, rgba(0, 0, 0, 0.015));
  border: 1px solid var(--wl-border);
  border-radius: 16px;
  padding: 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-panel-header {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.panel-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.8rem;
  font-weight: 800;
  color: #4F46E5;
  letter-spacing: 0.05em;
}

.panel-subtitle {
  font-size: 0.86rem;
  color: var(--wl-ink-soft);
  margin: 0;
  line-height: 1.5;
}

.ticket-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.form-label {
  display: flex;
  align-items: center;
  font-size: 0.74rem;
  font-weight: 700;
  color: var(--wl-ink-soft);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.required-star {
  color: #EF4444;
  margin-inline-start: 0.25rem;
}

.form-input,
.form-textarea {
  width: 100%;
  border: 1px solid var(--wl-border);
  border-radius: 10px;
  padding: 0.75rem 0.95rem;
  font-size: 0.92rem;
  background: var(--wl-surface);
  color: var(--wl-ink-strong);
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  min-height: 48px;
  box-sizing: border-box;
}

.form-input:focus,
.form-textarea:focus {
  border-color: var(--wl-teal);
  box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.15);
}

.form-textarea {
  resize: vertical;
  min-height: 110px;
  line-height: 1.5;
}

.ticket-error-alert {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.7rem 0.9rem;
  border-radius: 8px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.25);
  color: #DC2626;
  font-size: 0.85rem;
}

.btn-submit-ticket {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.85rem 1.5rem;
  font-size: 0.88rem;
  font-weight: 700;
  border-radius: 10px;
  cursor: pointer;
  min-height: 48px;
  transition: all 0.2s ease;
  width: 100%;
}

.btn-submit-ticket:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.submit-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: ticket-spin 0.8s linear infinite;
}

@keyframes ticket-spin {
  to {
    transform: rotate(360deg);
  }
}

/* Ticket Success State */
.ticket-success-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 1.5rem 1rem;
  gap: 0.75rem;
}

.success-icon-wrap {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: rgba(16, 185, 129, 0.12);
  color: #10B981;
  display: grid;
  place-items: center;
}

.success-title {
  font-family: var(--wl-font-display);
  font-size: 1.3rem;
  font-weight: 800;
  color: var(--wl-ink-strong);
  margin: 0;
}

.success-desc {
  font-size: 0.9rem;
  color: var(--wl-ink-soft);
  margin: 0;
  max-width: 380px;
  line-height: 1.55;
}

.ticket-id-tag {
  font-size: 0.76rem;
  font-weight: 800;
  background: rgba(13, 148, 136, 0.08);
  border: 1px solid rgba(13, 148, 136, 0.22);
  color: var(--wl-teal);
  padding: 0.4rem 0.85rem;
  border-radius: 8px;
  letter-spacing: 0.06em;
}

.success-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.75rem;
  flex-wrap: wrap;
  justify-content: center;
  width: 100%;
}

/* Unauthenticated Guest Card */
.ticket-guest-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 1.5rem 1rem;
  gap: 0.75rem;
}

.guest-card-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: rgba(79, 70, 229, 0.08);
  color: #4F46E5;
  display: grid;
  place-items: center;
  font-size: 26px;
}

.guest-card-title {
  font-family: var(--wl-font-display);
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--wl-ink-strong);
  margin: 0;
}

.guest-card-desc {
  font-size: 0.88rem;
  color: var(--wl-ink-soft);
  margin: 0;
  max-width: 400px;
  line-height: 1.55;
}

.guest-card-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
  width: 100%;
}

.guest-card-subnote {
  font-size: 0.78rem;
  color: var(--wl-muted);
  margin: 0.5rem 0 0;
  max-width: 360px;
  line-height: 1.5;
}

@media (max-width: 900px) {
  .help-hero__grid {
    grid-template-columns: 1fr;
  }
  .help-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .article-grid {
    grid-template-columns: 1fr;
  }
  .escalation-grid {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
}

@media (max-width: 600px) {
  .help-grid {
    grid-template-columns: 1fr;
  }
  .help-contact-banner {
    padding: 1.5rem 1.15rem;
    margin-top: 2.25rem;
    margin-bottom: 2rem;
    gap: 1.5rem;
    padding-inline-start: max(1.15rem, env(safe-area-inset-left));
    padding-inline-end: max(1.15rem, env(safe-area-inset-right));
  }
  .contact-title {
    font-size: 1.35rem;
  }
  .contact-header {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }
  .my-tickets-badge-link {
    justify-content: center;
    width: 100%;
  }
  .channel-card {
    padding: 0.95rem 1rem;
  }
  .escalation-form-panel {
    padding: 1.25rem 1rem;
  }
  .success-actions .btn,
  .guest-card-actions .btn {
    width: 100%;
  }
  .faq-item__body {
    padding-inline-start: 1.4rem;
  }
}
</style>
