<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BackButton from '../../components/ui/BackButton.vue'
import DataState from '../../components/ui/DataState.vue'
import AppPagination from '../../components/ui/AppPagination.vue'
import AppImage from '../../components/ui/AppImage.vue'
import { services } from '../../di/container'
import { t, locale } from '../../i18n'
import type { CompanyDto } from '../../domain/models/company'
import type { CategoryDto } from '../../domain/models/marketplace'

const route = useRoute()
const router = useRouter()
const categoryId = computed(() => String(route.params.id || ''))

const localized = (en?: string | null, ar?: string | null) =>
  locale.value === 'ar' ? ar || en || '' : en || ar || ''

const category = ref<CategoryDto | null>(null)
const categoryLoading = ref(true)

const providers = ref<CompanyDto[]>([])
const totalCount = ref(0)
const loading = ref(true)
const fetchError = ref('')
const page = ref(1)
const pageSize = 9
const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / pageSize)))

const loadCategory = async () => {
  categoryLoading.value = true
  try {
    category.value = await services.marketplaceRepository.getCategoryById(categoryId.value)
  } catch {
    category.value = null
  } finally {
    categoryLoading.value = false
  }
}

const loadProviders = async () => {
  loading.value = true
  fetchError.value = ''
  try {
    const res = await services.marketplaceRepository.getCategoryProviders(categoryId.value, {
      page: page.value,
      pageSize,
    })
    providers.value = Array.isArray(res?.data) ? res.data : []
    totalCount.value = res?.totalCount ?? providers.value.length
  } catch (e) {
    fetchError.value = e instanceof Error ? e.message : t('common.error')
    providers.value = []
    totalCount.value = 0
  } finally {
    loading.value = false
  }
}

const onPageChange = (p: number) => {
  page.value = p
  void loadProviders()
}

const reloadAll = () => {
  page.value = 1
  void loadCategory()
  void loadProviders()
}

onMounted(reloadAll)
watch(
  () => route.params.id,
  () => { reloadAll() },
)

const openStorefront = (id: string) => {
  void router.push({ name: 'provider-storefront', params: { id }, query: { category: categoryId.value } })
}
</script>

<template>
  <div class="page-shell cat-providers">
    <BackButton fallback="/categories" variant="minimal" class="mb-3" />

    <DataState
      :loading="categoryLoading"
      :empty="!category && !categoryLoading"
      :empty-title="t('marketplace.categoriesTitle')"
      skeleton-type="store-hero"
    >
      <div v-if="category" class="cat-hero card">
        <AppImage
          :src="category.imageName"
          placeholder-type="category"
          :placeholder-text="localized(category.nameEn, category.nameAr)"
          :alt="localized(category.nameEn, category.nameAr)"
          fit="cover"
          class="cat-hero__img"
        />
        <div class="cat-hero__info">
          <div class="mono cat-hero__eyebrow">{{ t('provider.categoryProviders') }}</div>
          <h1 class="cat-hero__name" dir="auto">{{ localized(category.nameEn, category.nameAr) }}</h1>
          <p v-if="category.descriptionEn || category.descriptionAr" class="cat-hero__desc" dir="auto">
            {{ localized(category.descriptionEn, category.descriptionAr) }}
          </p>
          <div class="cat-hero__counts">
            <span class="count-chip mono">
              <span class="material-symbols-outlined text-[15px]">apartment</span>
              <span>{{ totalCount }} · {{ t('provider.providersInCategory') }}</span>
            </span>
            <span v-if="category.productCount != null" class="count-chip mono">
              <span class="material-symbols-outlined text-[15px]">inventory_2</span>
              <span>{{ category.productCount }} · {{ t('provider.providerProducts') }}</span>
            </span>
          </div>
        </div>
      </div>
    </DataState>

    <DataState
      :loading="loading"
      :error="fetchError"
      skeleton-type="provider-cards"
      :skeleton-count="6"
      :empty="!providers.length && !loading"
      :empty-title="t('provider.noProvidersHere')"
      :empty-description="t('provider.noProvidersHereDesc')"
      @retry="loadProviders"
    >
      <div class="prov-grid">
        <article v-for="c in providers" :key="c.id" class="prov-card">
          <div class="prov-card__top">
            <AppImage
              :src="c.imageName"
              placeholder-type="company"
              :placeholder-text="c.name"
              :alt="c.name"
              fit="contain"
              class="prov-card__logo"
            />
            <span class="badge badge--green badge--pill">
              <span class="material-symbols-outlined text-[14px]">verified</span>
              <span>{{ t('home.verifiedSupplier') }}</span>
            </span>
          </div>
          <h2 class="prov-card__name" dir="auto">{{ c.name }}</h2>
          <div v-if="c.countryNameEn || c.countryNameAr" class="prov-card__country mono">
            <span class="material-symbols-outlined text-[14px]">public</span>
            <span>{{ localized(c.countryNameEn, c.countryNameAr) }}</span>
          </div>
          <button type="button" class="btn btn--secondary btn--sm btn--block prov-card__cta" @click="openStorefront(c.id)">
            <span>{{ t('provider.viewCatalog') }}</span>
            <span class="icon--directional">→</span>
          </button>
        </article>
      </div>
      <AppPagination
        v-if="totalPages > 1"
        :page="page"
        :total-pages="totalPages"
        :total-items="totalCount"
        :page-size="pageSize"
        @change="onPageChange"
      />
    </DataState>
  </div>
</template>

<style scoped>
.cat-providers { display: flex; flex-direction: column; gap: var(--space-5); }
.cat-hero {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: var(--space-6);
  padding: var(--space-6);
  align-items: center;
  overflow: hidden;
}
.cat-hero__img {
  width: 100%;
  height: 160px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
}
.cat-hero__info { display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; }
.cat-hero__eyebrow {
  font-size: var(--text-xs);
  letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
  color: var(--brand);
}
.cat-hero__name {
  margin: 0;
  font-size: var(--text-3xl);
  font-weight: var(--weight-bold);
  letter-spacing: var(--tracking-tight);
  color: var(--fg-heading);
  line-height: var(--leading-tight);
}
.cat-hero__desc {
  margin: 0;
  font-size: var(--text-base);
  color: var(--fg-muted);
  line-height: var(--leading-normal);
  max-width: 60ch;
}
.cat-hero__counts { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-1); }
.count-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--fg-muted);
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  padding: var(--space-1) var(--space-3);
}

.prov-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4);
}
.prov-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-5);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  min-width: 0;
  transition: border-color var(--duration-base) var(--ease-out), box-shadow var(--duration-base) var(--ease-out);
}
.prov-card:hover { border-color: var(--border-strong); box-shadow: var(--shadow-md); }
.prov-card__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
}
.prov-card__logo {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--bg-subtle);
}
.prov-card__name {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--fg-heading);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.prov-card__country {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--fg-subtle);
}
.prov-card__cta { margin-top: auto; }

@media (max-width: 1024px) {
  .prov-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 640px) {
  .cat-hero { grid-template-columns: minmax(0, 1fr); padding: var(--space-5); }
  .cat-hero__img { height: 140px; }
  .cat-hero__name { font-size: var(--text-2xl); }
  .prov-grid { grid-template-columns: minmax(0, 1fr); }
}
</style>
