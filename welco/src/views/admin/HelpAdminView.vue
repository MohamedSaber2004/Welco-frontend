<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { t } from '../../i18n'
import { contentService } from '../../di/container'
import AdminLayout from '../../components/layout/AdminLayout.vue'
import AppPagination from '../../components/ui/AppPagination.vue'
import { resolveFileUrl, isStoredFileName, PLACEHOLDER } from '../../utils/file-url'

const activeTab = ref<'categories' | 'articles' | 'faqs'>('categories')
const loading = ref(true)
const pageSize = 10
const categoryPage = ref(1)
const articlePage = ref(1)
const faqPage = ref(1)

const categories = contentService.helpCategories
const articles = contentService.helpArticles
const faqs = contentService.faqs

const categorySearch = ref('')
const articleSearch = ref('')
const faqSearch = ref('')

const filteredCategories = computed(() => {
  const rawList = Array.isArray(categories.value) ? categories.value : []
  if (!categorySearch.value.trim()) return rawList
  const q = categorySearch.value.trim().toLowerCase()
  return rawList.filter((c) => {
    if (!c) return false
    const matchName = c.name ? String(c.name).toLowerCase().includes(q) : false
    const matchId = c.id ? String(c.id).toLowerCase().includes(q) : false
    return matchName || matchId
  })
})
const paginatedCategories = computed(() => {
  const start = (categoryPage.value - 1) * pageSize
  return filteredCategories.value.slice(start, start + pageSize)
})
const categoryTotalPages = computed(() => Math.max(1, Math.ceil(filteredCategories.value.length / pageSize)))

const filteredArticles = computed(() => {
  const rawList = Array.isArray(articles.value) ? articles.value : []
  if (!articleSearch.value.trim()) return rawList
  const q = articleSearch.value.trim().toLowerCase()
  return rawList.filter((a) => {
    if (!a) return false
    const matchTitle = a.title ? String(a.title).toLowerCase().includes(q) : false
    const matchBody = a.body ? String(a.body).toLowerCase().includes(q) : false
    const matchSlug = a.slug ? String(a.slug).toLowerCase().includes(q) : false
    const matchId = a.id ? String(a.id).toLowerCase().includes(q) : false
    return matchTitle || matchBody || matchSlug || matchId
  })
})
const paginatedArticles = computed(() => {
  const start = (articlePage.value - 1) * pageSize
  return filteredArticles.value.slice(start, start + pageSize)
})
const articleTotalPages = computed(() => Math.max(1, Math.ceil(filteredArticles.value.length / pageSize)))

const filteredFaqs = computed(() => {
  const rawList = Array.isArray(faqs.value) ? faqs.value : []
  if (!faqSearch.value.trim()) return rawList
  const q = faqSearch.value.trim().toLowerCase()
  return rawList.filter((f) => {
    if (!f) return false
    const matchQ = f.question ? String(f.question).toLowerCase().includes(q) : false
    const matchA = f.answer ? String(f.answer).toLowerCase().includes(q) : false
    const matchId = f.id ? String(f.id).toLowerCase().includes(q) : false
    return matchQ || matchA || matchId
  })
})
const paginatedFaqs = computed(() => {
  const start = (faqPage.value - 1) * pageSize
  return filteredFaqs.value.slice(start, start + pageSize)
})
const faqTotalPages = computed(() => Math.max(1, Math.ceil(filteredFaqs.value.length / pageSize)))

onMounted(async () => {
  await contentService.loadSupport()
  loading.value = false
})
</script>

<template>
  <AdminLayout>
    <div class="help-admin-view">
      <!-- Executive Header -->
      <header class="admin-head">
        <div>
          <div class="head-chip mono">
            <span class="pulse-dot"></span>
            <span>{{ t('admin.helpEyebrow') }}</span>
          </div>
          <h1 class="head-title">{{ t('help.manageHelp') }}</h1>
          <p class="head-subtitle">{{ t('help.subtitle') }}</p>
        </div>
      </header>

      <!-- Segmented Navigation Ribbon -->
      <div class="tab-ribbon">
        <button
          type="button"
          class="tab-btn mono"
          :class="{ 'is-active': activeTab === 'categories' }"
          @click="activeTab = 'categories'"
        >
          <span class="material-symbols-outlined text-[18px]">folder_special</span>
          <span>{{ t('help.categories') }}</span>
          <span class="tab-chip">{{ categories.length }}</span>
        </button>

        <button
          type="button"
          class="tab-btn mono"
          :class="{ 'is-active': activeTab === 'articles' }"
          @click="activeTab = 'articles'"
        >
          <span class="material-symbols-outlined text-[18px]">article</span>
          <span>{{ t('help.articles') }}</span>
          <span class="tab-chip">{{ articles.length }}</span>
        </button>

        <button
          type="button"
          class="tab-btn mono"
          :class="{ 'is-active': activeTab === 'faqs' }"
          @click="activeTab = 'faqs'"
        >
          <span class="material-symbols-outlined text-[18px]">quiz</span>
          <span>{{ t('help.faq') }}</span>
          <span class="tab-chip">{{ faqs.length }}</span>
        </button>
      </div>

      <div v-if="loading" class="empty-tray-card mono">{{ t('common.loading') }}</div>

      <template v-else>
        <!-- TAB 1: HELP CATEGORIES -->
        <section v-if="activeTab === 'categories'" class="tab-content-stack">
          <!-- Categories Search Bar -->
          <div class="search-filter-bar">
            <div class="search-wrap">
              <span class="material-symbols-outlined search-icon">search</span>
              <input
                v-model="categorySearch"
                type="text"
                class="search-input mono"
                :placeholder="t('common.searchPlaceholder') + ' — ' + t('help.categoryName')"
                @input="categoryPage = 1"
              />
              <button v-if="categorySearch" type="button" class="clear-btn" @click="categorySearch = ''; categoryPage = 1">
                <span class="material-symbols-outlined text-[14px]">close</span>
              </button>
            </div>
            <button v-if="categorySearch" type="button" class="clear-filters-btn mono" @click="categorySearch = ''; categoryPage = 1">
              <span class="material-symbols-outlined text-[14px]">filter_alt_off</span>
              {{ t('common.clearFilters') }}
            </button>
          </div>

          <!-- Categories List -->
          <div class="table-card">
            <div class="table-wrap">
              <table class="exec-table">
                <thead>
                  <tr>
                    <th>{{ t('help.colIcon') }}</th>
                    <th>{{ t('help.colCategoryTitle') }}</th>
                    <th>{{ t('help.colArticleCount') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in paginatedCategories" :key="c.id" class="exec-row">
                    <td class="w-12">
                      <div class="cat-icon-frame">
                        <img
                          v-if="c.icon && isStoredFileName(c.icon)"
                          :src="resolveFileUrl(c.icon, '')"
                          :alt="c.name"
                          class="cat-img"
                          @error="(e) => (((e.target as HTMLElement).style.display = 'none'))"
                        />
                        <span v-else-if="c.icon && !isStoredFileName(c.icon)" class="mono text-xs">{{ c.icon }}</span>
                        <img v-else :src="PLACEHOLDER" alt="placeholder" class="cat-img opacity-60" />
                      </div>
                    </td>
                    <td>
                      <strong class="cat-name-text">{{ c.name }}</strong>
                    </td>
                    <td>
                      <span class="mono count-pill">{{ t('help.articleCount', { count: c.articleCount ?? 0 }) }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <AppPagination
              v-model:page="categoryPage"
              :total-pages="categoryTotalPages"
              :total-items="categories.length"
              :page-size="pageSize"
              variant="table"
            />
          </div>
        </section>

        <!-- TAB 2: HELP ARTICLES -->
        <section v-if="activeTab === 'articles'" class="tab-content-stack">
          <!-- Articles Search Bar -->
          <div class="search-filter-bar">
            <div class="search-wrap">
              <span class="material-symbols-outlined search-icon">search</span>
              <input
                v-model="articleSearch"
                type="text"
                class="search-input mono"
                :placeholder="t('common.searchPlaceholder') + ' — ' + t('help.colArticleTitle')"
                @input="articlePage = 1"
              />
              <button v-if="articleSearch" type="button" class="clear-btn" @click="articleSearch = ''; articlePage = 1">
                <span class="material-symbols-outlined text-[14px]">close</span>
              </button>
            </div>
            <button v-if="articleSearch" type="button" class="clear-filters-btn mono" @click="articleSearch = ''; articlePage = 1">
              <span class="material-symbols-outlined text-[14px]">filter_alt_off</span>
              {{ t('common.clearFilters') }}
            </button>
          </div>

          <!-- Articles Table -->
          <div class="table-card">
            <div class="table-wrap">
              <table class="exec-table">
                <thead>
                  <tr>
                    <th>{{ t('help.colArticleTitle') }}</th>
                    <th>{{ t('help.colCategory') }}</th>
                    <th>{{ t('help.colSlug') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="a in paginatedArticles" :key="a.id" class="exec-row">
                    <td>
                      <strong class="article-title-text">{{ a.title }}</strong>
                    </td>
                    <td>
                      <span class="mono category-badge">{{ categories.find((c) => c.id === a.categoryId)?.name || t('help.generalCategory') }}</span>
                    </td>
                    <td>
                      <span class="mono slug-badge">/{{ a.slug }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <AppPagination
              v-model:page="articlePage"
              :total-pages="articleTotalPages"
              :total-items="articles.length"
              :page-size="pageSize"
              variant="table"
            />
          </div>
        </section>

        <!-- TAB 3: FAQ -->
        <section v-if="activeTab === 'faqs'" class="tab-content-stack">
          <!-- FAQ Search Bar -->
          <div class="search-filter-bar">
            <div class="search-wrap">
              <span class="material-symbols-outlined search-icon">search</span>
              <input
                v-model="faqSearch"
                type="text"
                class="search-input mono"
                :placeholder="t('common.searchPlaceholder') + ' — ' + t('help.faqQuestion')"
                @input="faqPage = 1"
              />
              <button v-if="faqSearch" type="button" class="clear-btn" @click="faqSearch = ''; faqPage = 1">
                <span class="material-symbols-outlined text-[14px]">close</span>
              </button>
            </div>
            <button v-if="faqSearch" type="button" class="clear-filters-btn mono" @click="faqSearch = ''; faqPage = 1">
              <span class="material-symbols-outlined text-[14px]">filter_alt_off</span>
              {{ t('common.clearFilters') }}
            </button>
          </div>

          <!-- FAQ Cards Stack -->
          <div class="faq-cards-stack">
            <article v-for="f in paginatedFaqs" :key="f.id" class="card faq-item-card">
              <div class="faq-item-head">
                <div class="faq-q-line">
                  <span class="material-symbols-outlined text-[18px] text-indigo-600">help</span>
                  <strong class="faq-q-text">{{ f.question }}</strong>
                </div>
              </div>

              <p class="faq-a-text">{{ f.answer }}</p>
            </article>

            <AppPagination
              v-model:page="faqPage"
              :total-pages="faqTotalPages"
              :total-items="faqs.length"
              :page-size="pageSize"
              variant="table"
            />
          </div>
        </section>
      </template>
    </div>
  </AdminLayout>
</template>

<style scoped>
.help-admin-view {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* ── Search & Filter Bar ── */
.search-filter-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 0.25rem;
}

.search-wrap {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 200px;
  max-width: 420px;
}

.search-icon {
  position: absolute;
  inset-inline-start: 0.75rem;
  font-size: 18px;
  color: #94A3B8;
  pointer-events: none;
}

.search-input {
  width: 100%;
  height: 38px;
  padding: 0 2.2rem 0 2.5rem;
  border: 1px solid #E2E8F0;
  border-radius: 10px;
  font-size: 12.5px;
  color: #0F172A;
  background: #F8FAFC;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.search-input:focus {
  border-color: #6366F1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
  background: #fff;
}

.clear-btn {
  position: absolute;
  inset-inline-end: 0.5rem;
  background: none;
  border: none;
  cursor: pointer;
  color: #94A3B8;
  display: flex;
  align-items: center;
  padding: 0.2rem;
  border-radius: 4px;
}

.clear-btn:hover { color: #4F46E5; }

.clear-filters-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  height: 38px;
  padding: 0 0.85rem;
  border: 1px solid #FCA5A5;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 700;
  color: #DC2626;
  background: #FEF2F2;
  cursor: pointer;
  transition: all 0.15s;
}

.clear-filters-btn:hover { background: #FEE2E2; }

.admin-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.head-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 10px;
  font-weight: 700;
  color: #4F46E5;
  background: #EEF2FF;
  border: 1px solid #C7D2FE;
  padding: 0.2rem 0.6rem;
  border-radius: 9999px;
  letter-spacing: 0.06em;
  margin-bottom: 0.5rem;
}

.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #4F46E5;
}

.head-title {
  font-family: var(--wl-font-display, system-ui);
  font-size: 1.68rem;
  font-weight: 800;
  letter-spacing: -0.025em;
  color: #0F172A;
  margin: 0;
  line-height: 1.1;
}

.head-subtitle {
  font-size: 13.5px;
  color: #64748B;
  margin: 0.25rem 0 0;
}

/* Tabs */
.tab-ribbon {
  display: flex;
  gap: 0.5rem;
  border-bottom: 1.5px solid var(--wl-border, #E2E8F0);
}

.tab-btn {
  padding: 0.75rem 1.25rem;
  border: none;
  background: transparent;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--wl-muted, #64748B);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1.5px;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  transition: all 0.18s ease;
}

.tab-btn:hover {
  color: var(--wl-ink-strong, #0F172A);
}

.tab-btn.is-active {
  color: var(--wl-primary, #4F46E5);
  border-bottom-color: var(--wl-primary, #4F46E5);
}

.tab-chip {
  font-size: 10px;
  font-weight: 700;
  background: #F1F5F9;
  color: #475569;
  padding: 0.1rem 0.45rem;
  border-radius: 9999px;
}

.empty-tray-card {
  padding: 3rem;
  text-align: center;
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 16px;
  color: #94A3B8;
  font-size: 13px;
}

.tab-content-stack {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* Executive Table */
.table-card {
  background: var(--wl-surface, #FFFFFF);
  border: 1px solid var(--wl-border, #E2E8F0);
  border-radius: var(--wl-radius-card, 16px);
  overflow: hidden;
  box-shadow: var(--wl-shadow-card, 0 1px 3px rgba(15, 23, 42, 0.05));
}

.table-wrap {
  overflow-x: auto;
}

.exec-table {
  width: 100%;
  border-collapse: collapse;
  text-align: start;
}

.exec-table thead th {
  background: #F8FAFC;
  border-bottom: 1px solid #E2E8F0;
  padding: 0.85rem 1.25rem;
  font-family: var(--wl-font-mono, monospace);
  font-size: 11px;
  font-weight: 700;
  color: #64748B;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.exec-row {
  height: 56px;
  border-bottom: 1px solid #F1F5F9;
  transition: background 0.15s ease;
}

.exec-row:hover {
  background: #F8FAFC;
}

.exec-row td {
  padding: 0.65rem 1.25rem;
  vertical-align: middle;
}

.cat-icon-frame {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  display: grid;
  place-items: center;
  overflow: hidden;
}

.cat-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cat-name-text {
  font-size: 13.5px;
  color: #0F172A;
}

.count-pill {
  font-size: 11.5px;
  font-weight: 700;
  color: #4F46E5;
  background: #EEF2FF;
  border: 1px solid #C7D2FE;
  padding: 0.2rem 0.6rem;
  border-radius: 6px;
}

.article-title-text {
  font-size: 13.5px;
  color: #0F172A;
}

.category-badge {
  font-size: 11.5px;
  color: #475569;
  background: #F1F5F9;
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
}

.slug-badge {
  font-size: 11px;
  color: #64748B;
}

/* FAQ Cards Stack */
.faq-cards-stack {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.faq-item-card {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.faq-item-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.faq-q-line {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.faq-q-text {
  font-size: 14px;
  color: #0F172A;
}

.faq-a-text {
  font-size: 13px;
  color: #475569;
  line-height: 1.5;
  margin: 0;
  white-space: pre-line;
}
</style>
