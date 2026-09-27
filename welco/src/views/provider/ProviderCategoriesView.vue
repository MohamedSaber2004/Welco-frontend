<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import ProviderLayout from '../../components/layout/ProviderLayout.vue'
import DataState from '../../components/ui/DataState.vue'
import BaseModal from '../../components/ui/BaseModal.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import FileUpload from '../../components/ui/FileUpload.vue'
import AppImage from '../../components/ui/AppImage.vue'
import { ATTACHMENT_PLACE, MEDIA_TYPE } from '../../config/api.config'
import { services, companyService, authService } from '../../di/container'
import { toastService } from '../../infrastructure/feedback/toast.service'
import { t, locale } from '../../i18n'
import type { CategoryDto, CreateCategoryPayload } from '../../domain/models/marketplace'

const router = useRouter()
const localized = (en?: string, ar?: string) => (locale.value === 'ar' ? ar || en || '' : en || ar || '')
const myCompanyId = computed(() => companyService.myCompany.value?.id || authService.user.value?.companyId || null)

const categories = ref<CategoryDto[]>([])
const loading = ref(true)
const fetchError = ref('')
const search = ref('')
const statusFilter = ref<'all' | 'active' | 'inactive'>('all')
const hierarchyFilter = ref<'all' | 'root' | 'sub'>('all')
const viewMode = ref<'grid' | 'table'>('grid')

// KPI metrics
const totalCount = computed(() => categories.value.length)
const activeCount = computed(() => categories.value.filter((c) => (c.isActive ?? true)).length)
const rootCount = computed(() => categories.value.filter((c) => !c.parentCategoryId).length)
const totalProductsLinked = computed(() => categories.value.reduce((sum, c) => sum + (c.productCount ?? 0), 0))

const filtered = computed(() => {
  const list = Array.isArray(categories.value) ? categories.value : []
  const q = search.value.trim().toLowerCase()

  return list.filter((c) => {
    if (!c) return false

    // Status filter
    const isActive = c.isActive ?? true
    if (statusFilter.value === 'active' && !isActive) return false
    if (statusFilter.value === 'inactive' && isActive) return false

    // Hierarchy filter
    if (hierarchyFilter.value === 'root' && c.parentCategoryId) return false
    if (hierarchyFilter.value === 'sub' && !c.parentCategoryId) return false

    // Search query
    if (!q) return true
    return [c.nameEn, c.nameAr, c.id, c.slug, c.descriptionEn, c.descriptionAr]
      .some((v) => (v ? String(v).toLowerCase().includes(q) : false))
  })
})

const getParentName = (parentCategoryId?: string | null): string => {
  if (!parentCategoryId) return '—'
  const parent = categories.value.find((c) => c.id === parentCategoryId)
  return parent ? localized(parent.nameEn, parent.nameAr) : parentCategoryId
}

const loadAll = async () => {
  loading.value = true
  fetchError.value = ''
  try {
    await companyService.loadMyCompany().catch(() => null)
    categories.value = await services.marketplaceRepository.getCategories()
  } catch (e) {
    fetchError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    loading.value = false
  }
}

/* ── Category Details Modal ── */
const showDetailsModal = ref(false)
const selectedCategory = ref<CategoryDto | null>(null)

const openDetails = (c: CategoryDto) => {
  selectedCategory.value = c
  showDetailsModal.value = true
}

const closeDetails = () => {
  showDetailsModal.value = false
  selectedCategory.value = null
}

const navigateToCatalogCategory = (catId: string) => {
  closeDetails()
  void router.push({ path: '/provider/catalog', query: { category: catId } })
}

/* ── Add New Category Modal ── */
const showModal = ref(false)
const formLoading = ref(false)
const formError = ref('')
const existsHint = ref(false)

const emptyForm = () => ({
  nameEn: '',
  nameAr: '',
  description: '',
  imageName: '',
  parentCategoryId: '' as string,
})
const form = ref(emptyForm())

const openCreate = () => {
  form.value = emptyForm()
  formError.value = ''
  existsHint.value = false
  showModal.value = true
}
const closeModal = () => {
  showModal.value = false
  formError.value = ''
  existsHint.value = false
}

const duplicateOf = (nameEn: string, nameAr: string): CategoryDto | null => {
  const en = nameEn.trim().toLowerCase()
  const ar = nameAr.trim().toLowerCase()
  if (!en && !ar) return null
  return (
    categories.value.find((c) => {
      if (!c) return false
      const cen = (c.nameEn || '').trim().toLowerCase()
      const car = (c.nameAr || '').trim().toLowerCase()
      return (en && (cen === en || car === en)) || (ar && (cen === ar || car === ar))
    }) ?? null
  )
}

const submit = async () => {
  const f = form.value
  if (!f.nameEn.trim() || !f.nameAr.trim()) {
    formError.value = t('admin.errBothNames')
    return
  }
  if (duplicateOf(f.nameEn, f.nameAr)) {
    existsHint.value = true
    return
  }
  existsHint.value = false
  formLoading.value = true
  formError.value = ''
  try {
    const payload: CreateCategoryPayload = {
      nameEn: f.nameEn.trim(),
      nameAr: f.nameAr.trim(),
      description: f.description.trim() || undefined,
      imageName: f.imageName.trim() || null,
      parentCategoryId: f.parentCategoryId || null,
    }
    await services.marketplaceRepository.createCategory(payload)
    toastService.success(t('admin.categoryCreated'))
    closeModal()
    await loadAll()
  } catch (e) {
    formError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    formLoading.value = false
  }
}

const copyId = async (id: string) => {
  try {
    await navigator.clipboard.writeText(id)
    toastService.success(locale.value === 'ar' ? 'تم النسخ إلى الحافظة' : 'Copied to clipboard')
  } catch {
    toastService.info(id)
  }
}

onMounted(() => { void loadAll() })
</script>

<template>
  <ProviderLayout>
    <div class="provider-categories-view">
      <!-- Header -->
      <header class="view-header">
        <div class="view-header__info">
          <span class="eyebrow mono">{{ t('provider.dashboard') }} · {{ t('provider.categories') }}</span>
          <h1 class="view-title">{{ t('provider.categories') }}</h1>
          <p class="view-desc">{{ t('provider.categoriesDesc') }}</p>
        </div>
        <div class="header-actions">
          <BaseButton variant="ghost" icon="refresh" :loading="loading" @click="loadAll">
            {{ t('common.refresh') }}
          </BaseButton>
          <BaseButton variant="primary" icon="add" @click="openCreate">
            {{ t('provider.newCategory') }}
          </BaseButton>
        </div>
      </header>

      <!-- KPI Summary Cards — first three double as filters -->
      <section class="kpi-grid" role="group" :aria-label="t('provider.categories')">
        <button
          type="button"
          class="kpi-card"
          :aria-pressed="statusFilter === 'all' && hierarchyFilter === 'all'"
          :class="{ 'is-active': statusFilter === 'all' && hierarchyFilter === 'all' }"
          @click="statusFilter = 'all'; hierarchyFilter = 'all'"
        >
          <div class="kpi-icon-box bg-primary-soft">
            <span class="material-symbols-outlined text-primary" aria-hidden="true">category</span>
          </div>
          <div class="kpi-info">
            <span class="kpi-label mono">{{ t('provider.categories') }}</span>
            <strong class="kpi-value mono">{{ totalCount }}</strong>
          </div>
        </button>

        <button
          type="button"
          class="kpi-card"
          :aria-pressed="statusFilter === 'active'"
          :class="{ 'is-active': statusFilter === 'active' }"
          @click="statusFilter = statusFilter === 'active' ? 'all' : 'active'"
        >
          <div class="kpi-icon-box bg-emerald-soft">
            <span class="material-symbols-outlined text-emerald-600" aria-hidden="true">check_circle</span>
          </div>
          <div class="kpi-info">
            <span class="kpi-label mono">{{ t('admin.active') }}</span>
            <strong class="kpi-value mono text-emerald-600">{{ activeCount }}</strong>
          </div>
        </button>

        <button
          type="button"
          class="kpi-card"
          :aria-pressed="hierarchyFilter === 'root'"
          :class="{ 'is-active': hierarchyFilter === 'root' }"
          @click="hierarchyFilter = hierarchyFilter === 'root' ? 'all' : 'root'"
        >
          <div class="kpi-icon-box bg-indigo-soft">
            <span class="material-symbols-outlined text-indigo-600" aria-hidden="true">account_tree</span>
          </div>
          <div class="kpi-info">
            <span class="kpi-label mono">{{ t('marketplace.mainCategory') }}</span>
            <strong class="kpi-value mono text-indigo-600">{{ rootCount }}</strong>
          </div>
        </button>

        <div class="kpi-card kpi-card--stat">
          <div class="kpi-icon-box bg-amber-soft">
            <span class="material-symbols-outlined text-amber-600" aria-hidden="true">inventory_2</span>
          </div>
          <div class="kpi-info">
            <span class="kpi-label mono">{{ t('admin.productsTitle') }}</span>
            <strong class="kpi-value mono text-amber-600">{{ totalProductsLinked }}</strong>
          </div>
        </div>
      </section>

      <!-- Unlinked Company Alert Banner (non-blocking) -->
      <div v-if="!myCompanyId && !loading" class="company-notice-card" role="alert">
        <span class="material-symbols-outlined text-amber-600 notice-icon">info</span>
        <div class="notice-body">
          <strong class="notice-title">{{ t('provider.noCompanyTitle') }}</strong>
          <p class="notice-text">{{ t('provider.noCompanyDesc') }}</p>
        </div>
        <router-link to="/profile" class="notice-btn mono">
          {{ t('provider.linkCompany') }} →
        </router-link>
      </div>

      <!-- Search & Filters Toolbar -->
      <div class="toolbar">
        <div class="toolbar__search">
          <span class="material-symbols-outlined search-icon" aria-hidden="true">search</span>
          <label class="sr-only" for="pc-search">{{ t('provider.searchCategoriesPlaceholder') }}</label>
          <input
            id="pc-search"
            v-model="search"
            type="search"
            class="search-input"
            :placeholder="t('provider.searchCategoriesPlaceholder')"
          />
          <button v-if="search" type="button" class="search-clear-btn" @click="search = ''" :aria-label="t('common.clearInput')">
            <span class="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </div>

        <div class="toolbar__filters">
          <select v-model="statusFilter" class="filter-select mono" :aria-label="t('admin.status')">
            <option value="all">{{ t('common.all') }} ({{ t('admin.status') }})</option>
            <option value="active">{{ t('admin.active') }}</option>
            <option value="inactive">{{ t('admin.inactive') }}</option>
          </select>

          <select v-model="hierarchyFilter" class="filter-select mono" :aria-label="t('provider.level')">
            <option value="all">{{ t('provider.allLevels') }}</option>
            <option value="root">{{ t('marketplace.mainCategory') }}</option>
            <option value="sub">{{ t('marketplace.subcategories') }}</option>
          </select>

          <!-- View Mode Toggle -->
          <div class="view-toggle-group" role="radiogroup" :aria-label="t('provider.viewMode')">
            <button
              type="button"
              class="view-toggle-btn"
              :class="{ 'is-active': viewMode === 'grid' }"
              role="radio"
              :aria-checked="viewMode === 'grid'"
              :title="t('provider.gridView')"
              :aria-label="t('provider.gridView')"
              @click="viewMode = 'grid'"
            >
              <span class="material-symbols-outlined" aria-hidden="true">grid_view</span>
            </button>
            <button
              type="button"
              class="view-toggle-btn"
              :class="{ 'is-active': viewMode === 'table' }"
              role="radio"
              :aria-checked="viewMode === 'table'"
              :title="t('provider.tableView')"
              :aria-label="t('provider.tableView')"
              @click="viewMode = 'table'"
            >
              <span class="material-symbols-outlined" aria-hidden="true">view_list</span>
            </button>
          </div>
        </div>

        <p class="toolbar__count mono" role="status" aria-live="polite">
          {{ t('provider.categoriesFound', { shown: filtered.length, total: totalCount }) }}
        </p>
      </div>

      <!-- Main Data View -->
      <DataState
        :loading="loading"
        :error="fetchError"
        skeleton-type="table"
        :skeleton-count="6"
        :empty="!filtered.length && !loading"
        :empty-title="t('provider.noCategories')"
        :empty-description="t('provider.noCategoriesDesc')"
        @retry="loadAll"
      >
        <!-- GRID VIEW -->
        <div v-if="viewMode === 'grid'" class="categories-grid">
          <article
            v-for="c in filtered"
            :key="c.id"
            class="category-card"
            @click="openDetails(c)"
          >
            <!-- Card Media -->
            <div class="category-card__media">
              <AppImage
                :src="c.imageName"
                placeholder-type="category"
                :alt="localized(c.nameEn, c.nameAr)"
                class="category-card__img"
              />
              <div class="category-card__badges-overlay">
                <span
                  class="status-pill"
                  :class="(c.isActive ?? true) ? 'status-pill--active' : 'status-pill--inactive'"
                >
                  <span class="status-dot"></span>
                  <span>{{ (c.isActive ?? true) ? t('admin.active') : t('admin.inactive') }}</span>
                </span>

                <span class="product-count-chip mono">
                  <span class="material-symbols-outlined text-[13px]">inventory_2</span>
                  <span>{{ c.productCount ?? 0 }} {{ t('marketplace.products') }}</span>
                </span>
              </div>
            </div>

            <!-- Card Body -->
            <div class="category-card__body">
              <div class="category-card__names">
                <h3 class="category-card__title">{{ localized(c.nameEn, c.nameAr) }}</h3>
                <span class="category-card__alt-title" :dir="locale === 'ar' ? 'ltr' : 'rtl'">
                  {{ locale === 'ar' ? c.nameEn : c.nameAr }}
                </span>
              </div>

              <div v-if="c.parentCategoryId" class="parent-chip mono">
                <span class="material-symbols-outlined text-[13px]">subdirectory_arrow_right</span>
                <span>{{ getParentName(c.parentCategoryId) }}</span>
              </div>
              <div v-else class="root-chip mono">
                <span class="material-symbols-outlined text-[13px]">folder</span>
                <span>{{ locale === 'ar' ? 'فئة رئيسية' : 'Main Category' }}</span>
              </div>

              <p class="category-card__desc">
                {{ c.descriptionEn || c.descriptionAr || t('provider.categoriesDesc') }}
              </p>

              <!-- Card Actions -->
              <div class="category-card__footer" @click.stop>
                <button
                  type="button"
                  class="action-link-btn"
                  @click="openDetails(c)"
                >
                  <span class="material-symbols-outlined text-[16px]">visibility</span>
                  <span>{{ t('common.details') }}</span>
                </button>

                <button
                  type="button"
                  class="action-cta-btn mono"
                  @click="navigateToCatalogCategory(c.id)"
                >
                  <span>{{ t('marketplace.products') }}</span>
                  <span class="material-symbols-outlined icon--directional text-[14px]">arrow_forward</span>
                </button>
              </div>
            </div>
          </article>
        </div>

        <!-- TABLE VIEW -->
        <div v-else class="table-card">
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>{{ t('admin.category') }}</th>
                  <th>{{ t('admin.categoryNameEn') }}</th>
                  <th>{{ t('admin.categoryNameAr') }}</th>
                  <th>{{ t('admin.parentCategory') }}</th>
                  <th class="num">{{ t('admin.productsTitle') }}</th>
                  <th>{{ t('admin.status') }}</th>
                  <th class="text-end">{{ t('common.actions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="c in filtered"
                  :key="c.id"
                  class="table-row-clickable"
                  @click="openDetails(c)"
                >
                  <td>
                    <div class="cell-media">
                      <div class="cell-thumb">
                        <AppImage :src="c.imageName" placeholder-type="category" :alt="c.nameEn" width="38" height="38" />
                      </div>
                      <div class="cell-title-box">
                        <strong class="table__name">{{ localized(c.nameEn, c.nameAr) }}</strong>
                        <span class="cell-id mono text-xs text-muted" @click.stop="copyId(c.id)" :title="locale === 'ar' ? 'نسخ' : 'Copy'">
                          ID: {{ c.id.slice(0, 8) }}…
                        </span>
                      </div>
                    </div>
                  </td>
                  <td><span class="mono">{{ c.nameEn }}</span></td>
                  <td><span>{{ c.nameAr }}</span></td>
                  <td>
                    <span class="mono text-sm text-muted">
                      {{ getParentName(c.parentCategoryId) }}
                    </span>
                  </td>
                  <td class="num mono-num">
                    <span class="table-badge mono">{{ c.productCount ?? 0 }}</span>
                  </td>
                  <td>
                    <span class="status-dot-badge" :class="(c.isActive ?? true) ? 'status-dot-badge--active' : 'status-dot-badge--inactive'">
                      <span class="dot"></span>
                      <span>{{ (c.isActive ?? true) ? t('admin.active') : t('admin.inactive') }}</span>
                    </span>
                  </td>
                  <td class="text-end" @click.stop>
                    <div class="table-action-btns">
                      <button
                        type="button"
                        class="tbl-btn"
                        :title="t('common.details')"
                        @click="openDetails(c)"
                      >
                        <span class="material-symbols-outlined text-[16px]">visibility</span>
                      </button>
                      <button
                        type="button"
                        class="tbl-btn tbl-btn--primary"
                        :title="t('marketplace.products')"
                        @click="navigateToCatalogCategory(c.id)"
                      >
                        <span class="material-symbols-outlined text-[16px]">inventory_2</span>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </DataState>

      <!-- Category Details Modal -->
      <BaseModal
        v-model="showDetailsModal"
        :title="`${t('common.details')} · ${selectedCategory ? localized(selectedCategory.nameEn, selectedCategory.nameAr) : ''}`"
        size="md"
        @close="closeDetails"
      >
        <div v-if="selectedCategory" class="cat-details-modal">
          <!-- Banner Image -->
          <div class="cat-details-hero">
            <AppImage
              :src="selectedCategory.imageName"
              placeholder-type="category"
              :alt="localized(selectedCategory.nameEn, selectedCategory.nameAr)"
              class="cat-details-img"
            />
            <div class="cat-details-hero-badge">
              <span
                class="status-pill"
                :class="(selectedCategory.isActive ?? true) ? 'status-pill--active' : 'status-pill--inactive'"
              >
                <span class="status-dot"></span>
                <span>{{ (selectedCategory.isActive ?? true) ? t('admin.active') : t('admin.inactive') }}</span>
              </span>
            </div>
          </div>

          <!-- Metadata Grid -->
          <div class="cat-meta-grid">
            <div class="cat-meta-item">
              <span class="meta-label mono">{{ t('admin.categoryNameEn') }}</span>
              <strong class="meta-value mono">{{ selectedCategory.nameEn }}</strong>
            </div>

            <div class="cat-meta-item">
              <span class="meta-label mono">{{ t('admin.categoryNameAr') }}</span>
              <strong class="meta-value">{{ selectedCategory.nameAr }}</strong>
            </div>

            <div class="cat-meta-item">
              <span class="meta-label mono">{{ t('admin.parentCategory') }}</span>
              <strong class="meta-value mono">{{ getParentName(selectedCategory.parentCategoryId) }}</strong>
            </div>

            <div class="cat-meta-item">
              <span class="meta-label mono">{{ t('admin.productsTitle') }}</span>
              <strong class="meta-value mono text-primary">{{ selectedCategory.productCount ?? 0 }} {{ t('marketplace.products') }}</strong>
            </div>

            <div class="cat-meta-item cat-meta-item--full">
              <span class="meta-label mono">ID</span>
              <div class="copy-box mono" @click="copyId(selectedCategory.id)">
                <span>{{ selectedCategory.id }}</span>
                <span class="material-symbols-outlined text-[15px]">content_copy</span>
              </div>
            </div>
          </div>

          <!-- Description if exists -->
          <div v-if="selectedCategory.descriptionEn || selectedCategory.descriptionAr" class="cat-desc-box">
            <span class="meta-label mono">{{ t('admin.description') }}</span>
            <p class="cat-desc-text">
              {{ localized(selectedCategory.descriptionEn, selectedCategory.descriptionAr) }}
            </p>
          </div>

          <!-- Modal Actions -->
          <div class="cat-modal-actions">
            <BaseButton variant="secondary" @click="closeDetails">
              {{ t('common.close') }}
            </BaseButton>
            <BaseButton variant="primary" icon="inventory_2" @click="navigateToCatalogCategory(selectedCategory.id)">
              {{ t('marketplace.products') }}
            </BaseButton>
          </div>
        </div>
      </BaseModal>

      <!-- Add Category Modal -->
      <BaseModal
        v-model="showModal"
        :title="t('provider.newCategory')"
        size="md"
        @close="closeModal"
      >
        <form class="category-form" @submit.prevent="submit">
          <div class="form-row two-cols">
            <div class="form-field">
              <label class="field-label mono" for="pc-name-en">{{ t('admin.categoryNameEn') }} *</label>
              <input
                id="pc-name-en"
                v-model="form.nameEn"
                type="text"
                class="field-input"
                placeholder="e.g. Surgical Instruments"
                required
              />
            </div>
            <div class="form-field">
              <label class="field-label mono" for="pc-name-ar">{{ t('admin.categoryNameAr') }} *</label>
              <input
                id="pc-name-ar"
                v-model="form.nameAr"
                type="text"
                dir="rtl"
                class="field-input"
                placeholder="مثال: أدوات جراحية"
                required
              />
            </div>
          </div>

          <div class="form-field">
            <label class="field-label mono" for="pc-desc">{{ t('admin.description') }}</label>
            <textarea
              id="pc-desc"
              v-model="form.description"
              class="field-textarea"
              rows="3"
              placeholder="Detailed classification notes..."
            ></textarea>
          </div>

          <div class="form-field">
            <FileUpload
              :model-value="form.imageName || null"
              :place="ATTACHMENT_PLACE.PROVIDERS"
              :file-type="MEDIA_TYPE.IMAGE"
              accept="image/*"
              :label="t('admin.categoryImage')"
              :hint="t('attachment.dropHint')"
              @update:modelValue="form.imageName = $event ?? ''"
            />
          </div>

          <div class="form-field">
            <label class="field-label mono" for="pc-parent">{{ t('admin.parentCategory') }}</label>
            <select id="pc-parent" v-model="form.parentCategoryId" class="field-select mono">
              <option value="">{{ t('admin.noParentCategory') }}</option>
              <option v-for="c in categories" :key="c.id" :value="c.id">
                {{ localized(c.nameEn, c.nameAr) }}
              </option>
            </select>
          </div>

          <!-- Duplicate warning -->
          <div v-if="existsHint" class="form-warning-banner" role="alert">
            <span class="material-symbols-outlined text-amber-600">warning</span>
            <span>{{ t('provider.categoryExistsHint') }}</span>
          </div>
          <div v-else-if="formError" class="form-error-banner" role="alert">
            <span class="material-symbols-outlined text-rose-600">error</span>
            <span>{{ formError }}</span>
          </div>

          <div class="modal-footer-btns">
            <BaseButton variant="secondary" type="button" @click="closeModal">
              {{ t('common.cancel') }}
            </BaseButton>
            <BaseButton variant="primary" type="submit" :loading="formLoading">
              {{ t('common.save') }}
            </BaseButton>
          </div>
        </form>
      </BaseModal>
    </div>
  </ProviderLayout>
</template>

<style scoped>
.provider-categories-view {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

/* Header */
.view-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.eyebrow {
  font-size: var(--step--1);
  color: var(--wl-primary);
  font-weight: 700;
  letter-spacing: 0.05em;
  display: block;
}

.view-title {
  font-family: var(--wl-font-display);
  font-size: clamp(1.4rem, 2.5vw, 1.85rem);
  font-weight: 800;
  color: var(--wl-ink-strong);
  margin: var(--space-1) 0;
}

.view-desc {
  font-size: var(--step-0);
  color: var(--wl-muted);
  max-width: 640px;
  line-height: 1.5;
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

/* KPI Grid */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
  gap: var(--space-4);
}

.kpi-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--wl-surface);
  border: 1.5px solid var(--wl-border);
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
.bg-indigo-soft { background: #e0e7ff; }
.bg-amber-soft { background: #fef3c7; }

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

/* Company Notice */
.company-notice-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  flex-wrap: wrap;
}

.notice-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.notice-body {
  flex: 1;
  min-width: 200px;
}

.notice-title {
  display: block;
  font-size: var(--step-0);
  color: #92400e;
}

.notice-text {
  font-size: var(--step--1);
  color: #b45309;
  margin: 2px 0 0;
}

.notice-btn {
  font-size: var(--step--1);
  font-weight: 700;
  color: #92400e;
  text-decoration: none;
  padding: 6px 12px;
  border: 1px solid #fcd34d;
  border-radius: var(--radius-sm);
  background: #ffffff;
  transition: all 0.15s ease;
}

.notice-btn:hover {
  background: #fef3c7;
}

/* Toolbar */
.toolbar {
  display: flex;
  /* base.css sets .toolbar to column; this toolbar is an inline row */
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.toolbar__search {
  position: relative;
  flex: 1 1 240px;
  min-width: min(100%, 200px);
}

.search-icon {
  position: absolute;
  inset-inline-start: var(--space-3);
  top: 50%;
  transform: translateY(-50%);
  font-size: 18px;
  color: var(--wl-muted);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 9px var(--space-8);
  padding-inline-start: var(--space-9);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  background: var(--wl-surface);
  color: var(--wl-ink-strong);
  font-size: var(--step-0);
  outline: none;
  transition: border-color 0.15s ease;
}

.search-input:focus {
  border-color: var(--wl-primary);
  box-shadow: var(--wl-focus-ring);
}

.search-clear-btn {
  position: absolute;
  inset-inline-end: var(--space-2);
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: var(--wl-muted);
  cursor: pointer;
  display: grid;
  place-items: center;
  font-size: 16px;
  padding: 4px;
}

.toolbar__filters {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.toolbar__count {
  font-size: var(--step--1);
  color: var(--wl-muted);
  white-space: nowrap;
  flex: 0 0 auto;
}

.filter-select {
  padding: 8px 12px;
  min-height: 40px;
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  background: var(--wl-surface);
  color: var(--wl-ink-strong);
  font-size: var(--step--1);
  outline: none;
  cursor: pointer;
}

.filter-select:focus {
  border-color: var(--wl-primary);
  box-shadow: var(--wl-focus-ring);
}

.view-toggle-group {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  background: var(--wl-surface);
  padding: 2px;
}

.view-toggle-btn {
  width: 40px;
  height: 40px;
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

.view-toggle-btn:focus-visible {
  outline: 2px solid var(--wl-primary);
  outline-offset: -2px;
}

.view-toggle-btn.is-active {
  background: var(--wl-primary-soft, #eef2ff);
  color: var(--wl-primary);
  font-weight: 700;
}

/* Grid Cards */
.categories-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-4);
}

.category-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.category-card:hover {
  transform: translateY(-3px);
  border-color: var(--wl-primary);
  box-shadow: var(--shadow-md);
}

.category-card__media {
  position: relative;
  aspect-ratio: 16 / 9;
  background: var(--wl-surface-soft);
  overflow: hidden;
}

.category-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.4s ease;
}

.category-card:hover .category-card__img {
  transform: scale(1.05);
}

.category-card__badges-overlay {
  position: absolute;
  top: var(--space-2);
  inset-inline: var(--space-2);
  display: flex;
  align-items: center;
  justify-content: space-between;
  pointer-events: none;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: 700;
  backdrop-filter: blur(8px);
}

.status-pill--active {
  background: rgba(220, 252, 231, 0.92);
  color: #166534;
  border: 1px solid rgba(187, 247, 208, 0.8);
}

.status-pill--inactive {
  background: rgba(243, 244, 246, 0.92);
  color: #6b7280;
  border: 1px solid rgba(229, 231, 235, 0.8);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.product-count-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: 700;
  background: rgba(15, 23, 42, 0.75);
  color: #ffffff;
  backdrop-filter: blur(8px);
}

.category-card__body {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: var(--space-2);
}

.category-card__names {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.category-card__title {
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--wl-ink-strong);
  margin: 0;
  line-height: 1.3;
}

.category-card__alt-title {
  font-size: var(--step--1);
  color: var(--wl-muted);
}

.parent-chip,
.root-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 2px 7px;
  border-radius: var(--radius-xs);
  width: fit-content;
}

.parent-chip {
  background: var(--wl-primary-soft, #eef2ff);
  color: var(--wl-primary);
  border: 1px solid var(--wl-border);
}

.root-chip {
  background: var(--wl-surface-soft);
  color: var(--wl-muted);
  border: 1px solid var(--wl-border);
}

.category-card__desc {
  font-size: var(--step--1);
  color: var(--wl-muted);
  margin: var(--space-1) 0 0;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  flex: 1;
}

.category-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--wl-border);
}

.action-link-btn {
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

.action-link-btn:hover {
  color: var(--wl-ink-strong);
  background: var(--wl-surface-soft);
}

.action-cta-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--wl-primary-soft, #eef2ff);
  color: var(--wl-primary);
  border: 1px solid var(--wl-border);
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-cta-btn:hover {
  background: var(--wl-primary);
  color: #ffffff;
}

/* Table Card */
.table-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.table-wrap {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.table {
  width: 100%;
  /* 7 columns (incl. both name languages) must scroll, not crush, on mobile */
  min-width: 860px;
  border-collapse: collapse;
  text-align: start;
}

.table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
}

.table th {
  padding: 12px 16px;
  background: var(--wl-surface-soft);
  color: var(--wl-muted);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid var(--wl-border);
}

.table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--wl-border);
  vertical-align: middle;
}

.table-row-clickable {
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.table-row-clickable:hover {
  background: var(--wl-surface-soft);
}

.cell-media {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.cell-thumb {
  width: 38px;
  height: 38px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  flex-shrink: 0;
}

.cell-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cell-title-box {
  display: flex;
  flex-direction: column;
}

.table__name {
  font-size: var(--step-0);
  color: var(--wl-ink-strong);
}

.cell-id {
  font-size: 11px;
  cursor: pointer;
}
.cell-id:hover {
  text-decoration: underline;
}

.table-badge {
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-size: 12px;
  font-weight: 700;
}

.status-dot-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
}

.status-dot-badge--active { color: #166534; }
.status-dot-badge--inactive { color: #6b7280; }

.status-dot-badge .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.table-action-btns {
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

.tbl-btn--primary:hover {
  background: var(--wl-primary);
  border-color: var(--wl-primary);
  color: #ffffff;
}

/* Category Details Modal */
.cat-details-modal {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.cat-details-hero {
  position: relative;
  aspect-ratio: 16 / 7;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
}

.cat-details-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cat-details-hero-badge {
  position: absolute;
  top: var(--space-3);
  inset-inline-end: var(--space-3);
}

.cat-meta-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-3);
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
}

.cat-meta-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cat-meta-item--full {
  grid-column: 1 / -1;
}

.meta-label {
  font-size: 11px;
  color: var(--wl-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 700;
}

.meta-value {
  font-size: var(--step-0);
  color: var(--wl-ink-strong);
}

.copy-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--wl-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.copy-box:hover {
  color: var(--wl-ink-strong);
  border-color: var(--wl-primary);
}

.cat-desc-box {
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.cat-desc-text {
  margin: 0;
  font-size: var(--step--1);
  color: var(--wl-ink-strong);
  line-height: 1.5;
  white-space: pre-wrap;
}

.cat-modal-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

/* Category Form */
.category-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.form-row {
  display: grid;
  gap: var(--space-3);
}

.two-cols {
  grid-template-columns: repeat(2, 1fr);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  font-size: var(--step--1);
  font-weight: 700;
  color: var(--wl-ink-strong);
}

.field-input,
.field-select,
.field-textarea {
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: 8px 12px;
  background: var(--wl-surface);
  color: var(--wl-ink-strong);
  font-size: var(--step-0);
  outline: none;
  transition: border-color 0.15s ease;
}

.field-input:focus,
.field-select:focus,
.field-textarea:focus {
  border-color: var(--wl-primary);
  box-shadow: var(--wl-focus-ring);
}

.form-warning-banner,
.form-error-banner {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--step--1);
}

.form-warning-banner {
  background: #fffbeb;
  border: 1px solid #fde68a;
  color: #92400e;
}

.form-error-banner {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
}

.modal-footer-btns {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

@media (max-width: 768px) {
  .view-header {
    flex-direction: column;
  }
  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  .toolbar__filters {
    justify-content: space-between;
  }
  /* Each control gets its own row so nothing is crushed on small screens */
  .toolbar__filters .filter-select {
    flex: 1 1 100%;
    width: 100%;
  }
  .toolbar__filters .view-toggle-group {
    justify-content: center;
  }
  .toolbar__count {
    text-align: start;
  }
  .two-cols {
    grid-template-columns: 1fr;
  }
}
</style>
