<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { t, locale } from '../../i18n'
import { contentService } from '../../di/container'
import AdminLayout from '../../components/layout/AdminLayout.vue'
import SkeletonLoader from '../../components/ui/SkeletonLoader.vue'
import AppPagination from '../../components/ui/AppPagination.vue'

const tickets = contentService.tickets
const loading = ref(true)
const replyMap = ref<Record<string, string>>({})
const filter = ref<string>('')
const searchQuery = ref<string>('')
const page = ref(1)
const pageSize = 10
let searchTimer: ReturnType<typeof setTimeout> | null = null

const filteredTickets = computed(() => {
  const rawList = Array.isArray(tickets.value) ? tickets.value : []
  let list = rawList
  if (filter.value) {
    list = list.filter((t) => t && String(t.status || '').toLowerCase() === String(filter.value).toLowerCase())
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter((t) => {
      if (!t) return false
      const matchId = t.id ? String(t.id).toLowerCase().includes(q) : false
      const matchSub = t.subject ? String(t.subject).toLowerCase().includes(q) : false
      const matchMsg = t.message ? String(t.message).toLowerCase().includes(q) : false
      const matchUser = t.userId ? String(t.userId).toLowerCase().includes(q) : false
      return matchId || matchSub || matchMsg || matchUser
    })
  }
  return list
})

const paginatedTickets = computed(() => {
  const start = (page.value - 1) * pageSize
  return filteredTickets.value.slice(start, start + pageSize)
})
const totalPages = computed(() => Math.max(1, Math.ceil(filteredTickets.value.length / pageSize)))

onMounted(async () => {
  await contentService.loadTickets()
  loading.value = false
})

async function reply(id: string) {
  const text = replyMap.value[id]?.trim()
  if (!text) return
  await contentService.replyTicket(id, text)
  replyMap.value[id] = ''
}

async function closeTicket(id: string) {
  await contentService.closeTicket(id)
}

async function refresh() {
  loading.value = true
  await contentService.loadTickets()
  page.value = 1
  loading.value = false
}

function onSearch() {
  page.value = 1
}

function clearFilters() {
  searchQuery.value = ''
  filter.value = ''
  page.value = 1
}
</script>

<template>
  <AdminLayout>
    <div class="tickets-admin-view">
      <header class="tickets-head">
        <div>
          <div class="head-chip mono">
            <span class="pulse-dot"></span>
            <span>{{ t('admin.ticketsEyebrow') }}</span>
          </div>
          <h1 class="head-title">{{ t('help.staffQueue') }}</h1>
          <p class="head-subtitle">{{ t('admin.ticketsSubtitle') }}</p>
        </div>

        <div class="head-actions">
          <button type="button" class="btn-refresh" @click="refresh">
            <span class="material-symbols-outlined text-[18px]">refresh</span>
            <span>{{ t('common.retry') }}</span>
          </button>
        </div>
      </header>

      <div class="search-filter-bar">
        <div class="search-wrap">
          <span class="material-symbols-outlined search-icon">search</span>
          <input
            v-model="searchQuery"
            type="text"
            class="search-input mono"
            :placeholder="t('common.searchPlaceholder') + ' — ' + t('help.subject')"
            @input="onSearch"
          />
          <button v-if="searchQuery" type="button" class="clear-btn" @click="searchQuery = ''; onSearch()">
            <span class="material-symbols-outlined text-[14px]">close</span>
          </button>
        </div>
        <select v-model="filter" class="filter-select mono" @change="onSearch">
          <option value="">{{ t('help.allStatuses') }}</option>
          <option value="Open">{{ t('help.open') }}</option>
          <option value="Answered">{{ t('help.answered') }}</option>
          <option value="Closed">{{ t('help.closed') }}</option>
        </select>
        <button v-if="searchQuery || filter" type="button" class="clear-filters-btn mono" @click="clearFilters">
          <span class="material-symbols-outlined text-[14px]">filter_alt_off</span>
          {{ t('common.clearFilters') }}
        </button>
      </div>

      <div v-if="loading">
        <SkeletonLoader type="list" :count="4" />
      </div>

      <div v-else-if="!filteredTickets.length" class="empty-tray-card">
        <div class="empty-icon-circle">
          <span class="material-symbols-outlined text-[28px]">mark_email_read</span>
        </div>
        <h3 class="empty-title">{{ searchQuery || filter ? t('common.noResults') : t('help.noTickets') }}</h3>
        <p class="empty-desc">{{ t('help.noTicketsDesc') }}</p>
      </div>

      <div v-else class="ticket-stack">
        <article v-for="tk in paginatedTickets" :key="tk.id" class="ticket-card">
          <div class="ticket-card-header">
            <div class="ticket-info">
              <div class="ticket-subject-line">
                <span class="material-symbols-outlined ticket-icon">chat</span>
                <strong class="ticket-subject">{{ tk.subject }}</strong>
              </div>
              <div class="mono ticket-meta">
                <span>{{ t('help.ticketRef') }} {{ tk.id }}</span>
                <span>•</span>
                <span>{{ new Date(tk.createdAt).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US') }}</span>
              </div>
            </div>

            <div class="ticket-badge-zone">
              <span
                class="status-pill mono"
                :class="{
                  'status-pill--open': tk.status === 'Open',
                  'status-pill--answered': tk.status === 'Answered',
                  'status-pill--closed': tk.status === 'Closed',
                }"
              >
                <span class="dot"></span>
                <span>{{ tk.status === 'Open' ? t('help.open') : tk.status === 'Answered' ? t('help.answered') : tk.status === 'Closed' ? t('help.closed') : tk.status }}</span>
              </span>

              <button
                v-if="tk.status !== 'Closed'"
                type="button"
                class="btn-close-ticket mono"
                @click="closeTicket(tk.id)"
              >
                {{ t('help.closeTicket') }}
              </button>
            </div>
          </div>

          <p class="ticket-message">{{ tk.message }}</p>

          <div v-if="tk.reply" class="reply-thread-box">
            <div class="reply-header mono">
              <span class="material-symbols-outlined text-[15px]">support_agent</span>
              <span>{{ t('help.supportResponseTitle') }}</span>
              <span v-if="tk.repliedAt" class="reply-time">• {{ new Date(tk.repliedAt).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US') }}</span>
            </div>
            <p class="reply-content">{{ tk.reply }}</p>
          </div>

          <div v-if="tk.status !== 'Closed'" class="reply-input-bar">
            <input
              v-model="replyMap[tk.id]"
              class="reply-field"
              :placeholder="t('help.reply') + '...'"
              @keyup.enter="reply(tk.id)"
            />
            <button type="button" class="btn-send-reply" @click="reply(tk.id)">
              <span class="material-symbols-outlined text-[16px]">reply</span>
              <span>{{ t('help.reply') }}</span>
            </button>
          </div>
        </article>

        <AppPagination
          v-model:page="page"
          :total-pages="totalPages"
          :total-items="tickets.length"
          :page-size="pageSize"
          variant="table"
        />
      </div>
    </div>
  </AdminLayout>
</template>

<style scoped>
.tickets-admin-view {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.search-filter-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
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

.filter-select {
  height: 38px;
  padding: 0 0.85rem;
  border: 1px solid #E2E8F0;
  border-radius: 10px;
  font-size: 12.5px;
  color: #475569;
  background: #F8FAFC;
  outline: none;
  cursor: pointer;
  transition: border-color 0.15s;
}

.filter-select:focus { border-color: #6366F1; }

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

.tickets-head {
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

.head-actions {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  flex-wrap: wrap;
}

.filter-select {
  height: 44px;
  padding: 0 14px;
  background: #FFFFFF;
  border: 1.5px solid #E2E8F0;
  border-radius: 10px;
  font-size: 13px;
  color: #0F172A;
  outline: none;
  cursor: pointer;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.filter-select:focus {
  border-color: #4F46E5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12);
}

.btn-refresh {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  height: 44px;
  padding: 0 1rem;
  background: #FFFFFF;
  border: 1.5px solid #E2E8F0;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-refresh:hover {
  border-color: #4F46E5;
  color: #4F46E5;
  background: #EEF2FF;
}

.empty-tray-card {
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 16px;
  padding: 3.5rem 1.5rem;
  text-align: center;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
}

.empty-icon-circle {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #F1F5F9;
  color: #94A3B8;
  display: grid;
  place-items: center;
  margin: 0 auto 1rem;
}

.empty-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: #0F172A;
  margin: 0 0 0.4rem;
}

.empty-desc {
  font-size: 13.5px;
  color: #64748B;
  margin: 0;
}

.ticket-stack {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.ticket-card {
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 16px;
  padding: 1.25rem 1.5rem;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  transition: all 0.18s ease;
}

.ticket-card:hover {
  border-color: #CBD5E1;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
}

.ticket-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
}

.ticket-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.ticket-subject-line {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.ticket-icon {
  font-size: 18px;
  color: #4F46E5;
}

.ticket-subject {
  font-size: 14.5px;
  color: #0F172A;
}

.ticket-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 11px;
  color: #64748B;
}

.ticket-badge-zone {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 11px;
  font-weight: 700;
  padding: 0.2rem 0.6rem;
  border-radius: 9999px;
}

.status-pill .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-pill--open {
  background: #FEF3C7;
  color: #92400E;
}
.status-pill--open .dot { background: #F59E0B; }

.status-pill--answered {
  background: #ECFDF5;
  color: #059669;
}
.status-pill--answered .dot { background: #10B981; }

.status-pill--closed {
  background: #F1F5F9;
  color: #64748B;
}
.status-pill--closed .dot { background: #94A3B8; }

.btn-close-ticket {
  border: 1px solid #E2E8F0;
  background: #FFFFFF;
  color: #64748B;
  padding: 0.25rem 0.6rem;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-close-ticket:hover {
  background: #FFF1F2;
  border-color: #FECDD3;
  color: #E11D48;
}

.ticket-message {
  font-size: 13.5px;
  color: #334155;
  line-height: 1.6;
  white-space: pre-wrap;
  margin: 0;
}

.reply-thread-box {
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  border-radius: 12px;
  padding: 0.9rem 1.15rem;
}

.reply-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 11.5px;
  font-weight: 700;
  color: #4F46E5;
  margin-bottom: 0.35rem;
}

.reply-time {
  font-weight: 400;
  color: #94A3B8;
}

.reply-content {
  font-size: 13px;
  color: #1E293B;
  line-height: 1.55;
  white-space: pre-wrap;
  margin: 0;
}

.reply-input-bar {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.reply-field {
  flex: 1;
  height: 44px;
  padding: 0 14px;
  background: #F8FAFC;
  border: 1.5px solid #E2E8F0;
  border-radius: 10px;
  font-size: 13px;
  color: #0F172A;
  outline: none;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.reply-field:focus {
  background: #FFFFFF;
  border-color: #4F46E5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12);
}

.btn-send-reply {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  height: 44px;
  padding: 0 1.15rem;
  background: #4F46E5;
  color: #FFFFFF;
  border: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-send-reply:hover {
  background: #4338CA;
}
</style>
