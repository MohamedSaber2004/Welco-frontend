<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { t } from '../../i18n'
import { contentService } from '../../di/container'
import AdminLayout from '../../components/layout/AdminLayout.vue'
import AppPagination from '../../components/ui/AppPagination.vue'
import BaseModal from '../../components/ui/BaseModal.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import { confirmService } from '../../infrastructure/feedback/confirm.service'
import { toastService } from '../../infrastructure/feedback/toast.service'
import { resolveFileUrl, isStoredFileName, PLACEHOLDER } from '../../utils/file-url'
import type { FaqItemDto, HelpArticleDto, HelpCategoryDto } from '../../domain/models/content'

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

const slugify = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')

// --- Category Add / Edit / Delete / Details ---
const showCategoryModal = ref(false)
const editingCategory = ref<HelpCategoryDto | null>(null)
const categoryForm = ref({ name: '', icon: '' })
const categoryFormLoading = ref(false)
const categoryFormError = ref('')
const categoryPendingId = ref<string | null>(null)

const openCreateCategory = () => {
  editingCategory.value = null
  categoryForm.value = { name: '', icon: '' }
  categoryFormError.value = ''
  showCategoryModal.value = true
}

const openEditCategory = (c: HelpCategoryDto) => {
  editingCategory.value = c
  categoryForm.value = { name: c.name ?? '', icon: c.icon ?? '' }
  categoryFormError.value = ''
  showCategoryModal.value = true
}

const closeCategoryForm = () => {
  showCategoryModal.value = false
  categoryFormError.value = ''
}

const submitCategoryForm = async () => {
  if (!categoryForm.value.name.trim()) {
    categoryFormError.value = t('help.categoryName')
    return
  }
  categoryFormLoading.value = true
  categoryFormError.value = ''
  try {
    if (editingCategory.value) {
      await contentService.updateHelpCategory(
        editingCategory.value.id,
        categoryForm.value.name.trim(),
        categoryForm.value.icon.trim() || undefined,
      )
      toastService.success(t('admin.helpCategoryUpdated'))
    } else {
      await contentService.createHelpCategory(
        categoryForm.value.name.trim(),
        categoryForm.value.icon.trim() || undefined,
      )
      toastService.success(t('admin.helpCategoryCreated'))
    }
    closeCategoryForm()
  } catch (e) {
    categoryFormError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    categoryFormLoading.value = false
  }
}

const confirmDeleteCategory = async (c: HelpCategoryDto) => {
  const ok = await confirmService.confirmDelete(
    `${t('admin.deleteHelpCategoryConfirm')}\n${c.name}`,
    t('common.delete'),
  )
  if (!ok) return
  categoryPendingId.value = c.id
  try {
    await contentService.deleteHelpCategory(c.id)
    toastService.success(t('admin.helpCategoryDeleted'))
  } catch (e) {
    toastService.error(e instanceof Error ? e.message : t('common.error'))
  } finally {
    categoryPendingId.value = null
  }
}

const showCategoryDetails = ref(false)
const selectedCategory = ref<HelpCategoryDto | null>(null)

const openCategoryDetails = (c: HelpCategoryDto) => {
  selectedCategory.value = c
  showCategoryDetails.value = true
}

const closeCategoryDetails = () => {
  showCategoryDetails.value = false
  selectedCategory.value = null
}

// --- Article Add / Edit / Delete / Details ---
const showArticleModal = ref(false)
const editingArticle = ref<HelpArticleDto | null>(null)
const articleForm = ref({ categoryId: '', title: '', slug: '', body: '' })
const articleSlugTouched = ref(false)
const articleFormLoading = ref(false)
const articleFormError = ref('')
const articlePendingId = ref<string | null>(null)

const onArticleTitleInput = () => {
  if (!articleSlugTouched.value) articleForm.value.slug = slugify(articleForm.value.title)
}

const openCreateArticle = () => {
  editingArticle.value = null
  articleForm.value = { categoryId: '', title: '', slug: '', body: '' }
  articleSlugTouched.value = false
  articleFormError.value = ''
  showArticleModal.value = true
}

const openEditArticle = (a: HelpArticleDto) => {
  editingArticle.value = a
  articleForm.value = {
    categoryId: a.categoryId ?? '',
    title: a.title ?? '',
    slug: a.slug ?? '',
    body: a.body ?? '',
  }
  articleSlugTouched.value = true
  articleFormError.value = ''
  showArticleModal.value = true
}

const closeArticleForm = () => {
  showArticleModal.value = false
  articleFormError.value = ''
}

const articleCategoryName = (categoryId?: string | null): string => {
  if (!categoryId) return t('help.generalCategory')
  return categories.value.find((c) => c.id === categoryId)?.name || t('help.generalCategory')
}

const submitArticleForm = async () => {
  const f = articleForm.value
  if (!f.title.trim() || !f.body.trim()) {
    articleFormError.value = t('help.articleBody')
    return
  }
  if (!f.categoryId) {
    articleFormError.value = t('help.categories')
    return
  }
  if (!f.slug.trim()) {
    articleFormError.value = t('admin.pageSlug')
    return
  }
  articleFormLoading.value = true
  articleFormError.value = ''
  try {
    const payload = {
      categoryId: f.categoryId,
      title: f.title.trim(),
      body: f.body.trim(),
      slug: slugify(f.slug),
    }
    if (editingArticle.value) {
      await contentService.updateHelpArticle(editingArticle.value.id, payload)
      toastService.success(t('admin.helpArticleUpdated'))
    } else {
      await contentService.createHelpArticle(payload)
      toastService.success(t('admin.helpArticleCreated'))
    }
    closeArticleForm()
  } catch (e) {
    articleFormError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    articleFormLoading.value = false
  }
}

const confirmDeleteArticle = async (a: HelpArticleDto) => {
  const ok = await confirmService.confirmDelete(
    `${t('admin.deleteHelpArticleConfirm')}\n${a.title}`,
    t('common.delete'),
  )
  if (!ok) return
  articlePendingId.value = a.id
  try {
    await contentService.deleteHelpArticle(a.id)
    toastService.success(t('admin.helpArticleDeleted'))
  } catch (e) {
    toastService.error(e instanceof Error ? e.message : t('common.error'))
  } finally {
    articlePendingId.value = null
  }
}

const showArticleDetails = ref(false)
const selectedArticle = ref<HelpArticleDto | null>(null)

const openArticleDetails = (a: HelpArticleDto) => {
  selectedArticle.value = a
  showArticleDetails.value = true
}

const closeArticleDetails = () => {
  showArticleDetails.value = false
  selectedArticle.value = null
}

// --- FAQ Add / Edit / Delete / Details ---
const showFaqModal = ref(false)
const editingFaq = ref<FaqItemDto | null>(null)
const faqForm = ref({ question: '', answer: '' })
const faqFormLoading = ref(false)
const faqFormError = ref('')
const faqPendingId = ref<string | null>(null)

const openCreateFaq = () => {
  editingFaq.value = null
  faqForm.value = { question: '', answer: '' }
  faqFormError.value = ''
  showFaqModal.value = true
}

const openEditFaq = (f: FaqItemDto) => {
  editingFaq.value = f
  faqForm.value = { question: f.question ?? '', answer: f.answer ?? '' }
  faqFormError.value = ''
  showFaqModal.value = true
}

const closeFaqForm = () => {
  showFaqModal.value = false
  faqFormError.value = ''
}

const submitFaqForm = async () => {
  if (!faqForm.value.question.trim() || !faqForm.value.answer.trim()) {
    faqFormError.value = t('help.faqQuestion')
    return
  }
  faqFormLoading.value = true
  faqFormError.value = ''
  try {
    if (editingFaq.value) {
      await contentService.updateFaq(editingFaq.value.id, faqForm.value.question.trim(), faqForm.value.answer.trim())
      toastService.success(t('admin.faqUpdated'))
    } else {
      await contentService.createFaq(faqForm.value.question.trim(), faqForm.value.answer.trim())
      toastService.success(t('admin.faqCreated'))
    }
    closeFaqForm()
  } catch (e) {
    faqFormError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    faqFormLoading.value = false
  }
}

const confirmDeleteFaq = async (f: FaqItemDto) => {
  const ok = await confirmService.confirmDelete(
    `${t('admin.deleteFaqConfirm')}\n${f.question}`,
    t('common.delete'),
  )
  if (!ok) return
  faqPendingId.value = f.id
  try {
    await contentService.deleteFaq(f.id)
    toastService.success(t('admin.faqDeleted'))
  } catch (e) {
    toastService.error(e instanceof Error ? e.message : t('common.error'))
  } finally {
    faqPendingId.value = null
  }
}

const showFaqDetails = ref(false)
const selectedFaq = ref<FaqItemDto | null>(null)

const openFaqDetails = (f: FaqItemDto) => {
  selectedFaq.value = f
  showFaqDetails.value = true
}

const closeFaqDetails = () => {
  showFaqDetails.value = false
  selectedFaq.value = null
}
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
            <BaseButton variant="primary" @click="openCreateCategory">
              <span class="material-symbols-outlined text-[18px]">add</span>
              <span>{{ t('help.addCategory') }}</span>
            </BaseButton>
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
                    <th class="text-end">{{ t('common.actions') }}</th>
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
                    <td>
                      <div class="row-actions">
                        <button
                          type="button"
                          class="row-action-btn"
                          :title="t('admin.viewDetails')"
                          :aria-label="t('admin.viewDetails')"
                          @click="openCategoryDetails(c)"
                        >
                          <span class="material-symbols-outlined text-[18px]">visibility</span>
                        </button>
                        <button
                          type="button"
                          class="row-action-btn"
                          :title="t('common.edit')"
                          :aria-label="t('common.edit')"
                          @click="openEditCategory(c)"
                        >
                          <span class="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button
                          type="button"
                          class="row-action-btn row-action-btn--danger"
                          :title="t('common.delete')"
                          :aria-label="t('common.delete')"
                          :disabled="categoryPendingId === c.id"
                          @click="confirmDeleteCategory(c)"
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
            <BaseButton variant="primary" @click="openCreateArticle">
              <span class="material-symbols-outlined text-[18px]">add</span>
              <span>{{ t('help.addArticle') }}</span>
            </BaseButton>
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
                    <th class="text-end">{{ t('common.actions') }}</th>
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
                    <td>
                      <div class="row-actions">
                        <button
                          type="button"
                          class="row-action-btn"
                          :title="t('admin.viewDetails')"
                          :aria-label="t('admin.viewDetails')"
                          @click="openArticleDetails(a)"
                        >
                          <span class="material-symbols-outlined text-[18px]">visibility</span>
                        </button>
                        <button
                          type="button"
                          class="row-action-btn"
                          :title="t('common.edit')"
                          :aria-label="t('common.edit')"
                          @click="openEditArticle(a)"
                        >
                          <span class="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button
                          type="button"
                          class="row-action-btn row-action-btn--danger"
                          :title="t('common.delete')"
                          :aria-label="t('common.delete')"
                          :disabled="articlePendingId === a.id"
                          @click="confirmDeleteArticle(a)"
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
            <BaseButton variant="primary" @click="openCreateFaq">
              <span class="material-symbols-outlined text-[18px]">add</span>
              <span>{{ t('help.addFaq') }}</span>
            </BaseButton>
          </div>

          <!-- FAQ Cards Stack -->
          <div class="faq-cards-stack">
            <article v-for="f in paginatedFaqs" :key="f.id" class="card faq-item-card">
              <div class="faq-item-head">
                <div class="faq-q-line">
                  <span class="material-symbols-outlined text-[18px] text-indigo-600">help</span>
                  <strong class="faq-q-text">{{ f.question }}</strong>
                </div>
                <div class="row-actions">
                  <button
                    type="button"
                    class="row-action-btn"
                    :title="t('admin.viewDetails')"
                    :aria-label="t('admin.viewDetails')"
                    @click="openFaqDetails(f)"
                  >
                    <span class="material-symbols-outlined text-[18px]">visibility</span>
                  </button>
                  <button
                    type="button"
                    class="row-action-btn"
                    :title="t('common.edit')"
                    :aria-label="t('common.edit')"
                    @click="openEditFaq(f)"
                  >
                    <span class="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                  <button
                    type="button"
                    class="row-action-btn row-action-btn--danger"
                    :title="t('common.delete')"
                    :aria-label="t('common.delete')"
                    :disabled="faqPendingId === f.id"
                    @click="confirmDeleteFaq(f)"
                  >
                    <span class="material-symbols-outlined text-[18px]">delete</span>
                  </button>
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

      <!-- Category Add / Edit Modal -->
      <BaseModal
        v-model="showCategoryModal"
        :title="editingCategory ? t('help.editCategory') : t('help.addCategory')"
        max-width="520px"
        @close="closeCategoryForm"
      >
        <form class="admin-modal-form" @submit.prevent="submitCategoryForm">
          <div class="form-field">
            <label class="field-label" for="help-cat-name">{{ t('help.categoryName') }} *</label>
            <input id="help-cat-name" v-model="categoryForm.name" type="text" class="field-input" required />
          </div>
          <div class="form-field">
            <label class="field-label" for="help-cat-icon">{{ t('admin.helpCategoryIcon') }}</label>
            <input
              id="help-cat-icon"
              v-model="categoryForm.icon"
              type="text"
              class="field-input mono"
              placeholder="menu_book"
            />
          </div>

          <p v-if="categoryFormError" class="form-error" role="alert">{{ categoryFormError }}</p>

          <div class="modal-foot">
            <BaseButton variant="secondary" type="button" @click="closeCategoryForm">
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
        v-model="showCategoryDetails"
        :title="t('admin.helpCategoryDetails')"
        max-width="480px"
        @close="closeCategoryDetails"
      >
        <div v-if="selectedCategory" class="admin-details">
          <div class="details-grid">
            <div class="detail-item">
              <span class="detail-k mono">{{ t('help.categoryName') }}</span>
              <strong class="detail-v">{{ selectedCategory.name }}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-k mono">{{ t('admin.helpCategoryIcon') }}</span>
              <strong class="detail-v mono">{{ selectedCategory.icon || '—' }}</strong>
            </div>
          </div>
          <div class="modal-foot">
            <BaseButton variant="secondary" @click="selectedCategory && openEditCategory(selectedCategory)">
              {{ t('common.edit') }}
            </BaseButton>
            <BaseButton variant="secondary" @click="closeCategoryDetails">
              {{ t('common.close') }}
            </BaseButton>
          </div>
        </div>
      </BaseModal>

      <!-- Article Add / Edit Modal -->
      <BaseModal
        v-model="showArticleModal"
        :title="editingArticle ? t('help.editArticle') : t('help.addArticle')"
        max-width="640px"
        @close="closeArticleForm"
      >
        <form class="admin-modal-form" @submit.prevent="submitArticleForm">
          <div class="form-field">
            <label class="field-label" for="help-article-title">{{ t('help.colArticleTitle') }} *</label>
            <input
              id="help-article-title"
              v-model="articleForm.title"
              type="text"
              class="field-input"
              required
              @input="onArticleTitleInput"
            />
          </div>
          <div class="form-row two-cols">
            <div class="form-field">
              <label class="field-label" for="help-article-category">{{ t('help.colCategory') }} *</label>
              <select id="help-article-category" v-model="articleForm.categoryId" class="field-select" required>
                <option value="" disabled>{{ t('help.colCategory') }}</option>
                <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </div>
            <div class="form-field">
              <label class="field-label" for="help-article-slug">{{ t('help.colSlug') }} *</label>
              <input
                id="help-article-slug"
                v-model="articleForm.slug"
                type="text"
                class="field-input mono"
                required
                @input="articleSlugTouched = true"
              />
            </div>
          </div>
          <div class="form-field">
            <label class="field-label" for="help-article-body">{{ t('help.articleBody') }} *</label>
            <textarea id="help-article-body" v-model="articleForm.body" class="field-textarea" rows="5" required></textarea>
          </div>

          <p v-if="articleFormError" class="form-error" role="alert">{{ articleFormError }}</p>

          <div class="modal-foot">
            <BaseButton variant="secondary" type="button" @click="closeArticleForm">
              {{ t('common.cancel') }}
            </BaseButton>
            <BaseButton variant="primary" type="submit" :loading="articleFormLoading">
              {{ t('common.save') }}
            </BaseButton>
          </div>
        </form>
      </BaseModal>

      <!-- Article Details Modal -->
      <BaseModal
        v-model="showArticleDetails"
        :title="t('admin.helpArticleDetails')"
        max-width="600px"
        @close="closeArticleDetails"
      >
        <div v-if="selectedArticle" class="admin-details">
          <div class="details-grid">
            <div class="detail-item">
              <span class="detail-k mono">{{ t('help.colArticleTitle') }}</span>
              <strong class="detail-v">{{ selectedArticle.title }}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-k mono">{{ t('help.colCategory') }}</span>
              <strong class="detail-v">{{ articleCategoryName(selectedArticle.categoryId) }}</strong>
            </div>
          </div>
          <div class="detail-item">
            <span class="detail-k mono">{{ t('help.colSlug') }}</span>
            <strong class="detail-v mono">/{{ selectedArticle.slug }}</strong>
          </div>
          <div class="detail-item">
            <span class="detail-k mono">{{ t('help.articleBody') }}</span>
            <p class="detail-v detail-v--pre">{{ selectedArticle.body }}</p>
          </div>
          <div class="modal-foot">
            <BaseButton variant="secondary" @click="selectedArticle && openEditArticle(selectedArticle)">
              {{ t('common.edit') }}
            </BaseButton>
            <BaseButton variant="secondary" @click="closeArticleDetails">
              {{ t('common.close') }}
            </BaseButton>
          </div>
        </div>
      </BaseModal>

      <!-- FAQ Add / Edit Modal -->
      <BaseModal
        v-model="showFaqModal"
        :title="editingFaq ? t('help.editFaq') : t('help.addFaq')"
        max-width="560px"
        @close="closeFaqForm"
      >
        <form class="admin-modal-form" @submit.prevent="submitFaqForm">
          <div class="form-field">
            <label class="field-label" for="help-faq-q">{{ t('help.faqQuestion') }} *</label>
            <input id="help-faq-q" v-model="faqForm.question" type="text" class="field-input" required />
          </div>
          <div class="form-field">
            <label class="field-label" for="help-faq-a">{{ t('help.faqAnswer') }} *</label>
            <textarea id="help-faq-a" v-model="faqForm.answer" class="field-textarea" rows="4" required></textarea>
          </div>

          <p v-if="faqFormError" class="form-error" role="alert">{{ faqFormError }}</p>

          <div class="modal-foot">
            <BaseButton variant="secondary" type="button" @click="closeFaqForm">
              {{ t('common.cancel') }}
            </BaseButton>
            <BaseButton variant="primary" type="submit" :loading="faqFormLoading">
              {{ t('common.save') }}
            </BaseButton>
          </div>
        </form>
      </BaseModal>

      <!-- FAQ Details Modal -->
      <BaseModal
        v-model="showFaqDetails"
        :title="t('admin.faqDetails')"
        max-width="560px"
        @close="closeFaqDetails"
      >
        <div v-if="selectedFaq" class="admin-details">
          <div class="detail-item">
            <span class="detail-k mono">{{ t('help.faqQuestion') }}</span>
            <strong class="detail-v">{{ selectedFaq.question }}</strong>
          </div>
          <div class="detail-item">
            <span class="detail-k mono">{{ t('help.faqAnswer') }}</span>
            <p class="detail-v detail-v--pre">{{ selectedFaq.answer }}</p>
          </div>
          <div class="modal-foot">
            <BaseButton variant="secondary" @click="selectedFaq && openEditFaq(selectedFaq)">
              {{ t('common.edit') }}
            </BaseButton>
            <BaseButton variant="secondary" @click="closeFaqDetails">
              {{ t('common.close') }}
            </BaseButton>
          </div>
        </div>
      </BaseModal>
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
