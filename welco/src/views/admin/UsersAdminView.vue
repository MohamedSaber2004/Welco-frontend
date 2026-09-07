<script setup lang="ts">
import { onMounted } from 'vue'
import AdminLayout from '../../components/layout/AdminLayout.vue'
import DataState from '../../components/ui/DataState.vue'
import AppPagination from '../../components/ui/AppPagination.vue'
import { useUsers } from '../../composables/useUsers'
import { t } from '../../i18n'
import { UserType, USER_TYPE_ROLE_KEY } from '../../domain/models/user'
import { locationService } from '../../di/container'
import { resolveFileUrl, PLACEHOLDER } from '../../utils/file-url'
import { resolvePhoneDetails } from '../../utils/phone'

const {
  users,
  loading,
  search,
  page,
  totalPages,
  totalCount,
  error,
  load,
  onSearch,
} = useUsers()

const getAvatarColor = (name?: string): string => {
  const colors = ['#4F46E5', '#0D9488', '#0284C7', '#7C3AED', '#D97706', '#E11D48']
  if (!name) return '#4F46E5'
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length] ?? '#4F46E5'
}

onMounted(() => {
  if (!locationService.countries.value.length) {
    void locationService.loadCountries().catch(() => {})
  }
})

const getUserPhoneDetails = (phone?: string | null, explicitCode?: string | null) => {
  if (!phone) return null
  return resolvePhoneDetails(phone, locationService.countries.value, 'en', null, explicitCode)
}
</script>

<template>
  <AdminLayout>
    <div class="users-view">
      <!-- Executive Header -->
      <header class="users-head">
        <div>
          <div class="head-chip mono">
            <span class="pulse-dot"></span>
            <span>IDENTITY &amp; ACCESS CONTROL</span>
          </div>
          <h1 class="head-title">{{ t('admin.users') }}</h1>
          <p class="head-subtitle">{{ t('admin.usersDesc') }}</p>
        </div>
      </header>

      <!-- 44px Search & Counts Toolbar -->
      <div class="toolbar-card">
        <div class="search-input-wrap">
          <span class="material-symbols-outlined search-icon">search</span>
          <input
            v-model="search"
            :placeholder="t('admin.searchPlaceholder')"
            :aria-label="t('common.searchPlaceholder')"
            class="toolbar-search-input"
            @input="onSearch"
          />
        </div>
        <span class="mono counter-text">{{ t('admin.accountsCount', { count: totalCount }) }}</span>
      </div>

      <!-- Executive Data Table -->
      <DataState
        :loading="loading && !users.length"
        :error="error && !users.length ? error : null"
        :empty="!users.length && !loading && !error"
        :empty-title="t('admin.noResults')"
        :empty-description="t('admin.emptyUsersDesc')"
        skeleton-type="table"
        :skeleton-count="5"
        min-height="320px"
        @retry="load"
      >
        <div class="table-card">
          <div class="table-wrap">
            <table class="exec-table">
              <thead>
                <tr>
                  <th>{{ t('admin.users') }}</th>
                  <th>{{ t('admin.email') }}</th>
                  <th>{{ t('admin.userType') }}</th>
                  <th>{{ t('commerce.status') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="u in users" :key="u.id" class="exec-row">
                  <td>
                    <div class="user-cell">
                      <div class="user-avatar-wrap">
                        <img
                          v-if="u.profilePictureName"
                          :src="resolveFileUrl(u.profilePictureName, PLACEHOLDER)"
                          :alt="u.fullName"
                          class="user-avatar-img"
                        />
                        <div
                          v-else
                          class="user-avatar-fallback mono"
                          :style="{ backgroundColor: getAvatarColor(u.fullName) }"
                        >
                          {{ (u.fullName || 'U').slice(0, 2).toUpperCase() }}
                        </div>
                      </div>
                      <div class="user-info">
                        <strong class="user-name">{{ u.fullName }}</strong>
                        <div v-if="u.phoneNumber" class="user-phone-line mono">
                          <template v-if="getUserPhoneDetails(u.phoneNumber, u.phoneCode)">
                            <span
                              v-if="getUserPhoneDetails(u.phoneNumber, u.phoneCode)!.flag"
                              class="flag-icon"
                              :title="getUserPhoneDetails(u.phoneNumber, u.phoneCode)!.countryName"
                            >
                              {{ getUserPhoneDetails(u.phoneNumber, u.phoneCode)!.flag }}
                            </span>
                            <span class="phone-dial-code">
                              {{ getUserPhoneDetails(u.phoneNumber, u.phoneCode)!.dialCode }}
                            </span>
                            <span class="phone-number">
                              {{ getUserPhoneDetails(u.phoneNumber, u.phoneCode)!.nationalNumber }}
                            </span>
                          </template>
                          <span v-else class="user-phone">{{ u.phoneNumber }}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td class="mono text-xs text-slate-600">{{ u.email }}</td>
                  <td>
                    <span
                      class="role-pill mono"
                      :class="{
                        'role-pill--admin': u.userType === UserType.Admin,
                        'role-pill--staff': u.userType === UserType.WelcoStaff,
                        'role-pill--org': u.userType === UserType.OrganizationUser,
                      }"
                    >
                      {{ t(`admin.${USER_TYPE_ROLE_KEY(u.userType)}`) }}
                    </span>
                  </td>
                  <td>
                    <span
                      class="status-dot-badge mono"
                      :class="u.isActive ? 'status-dot-badge--active' : 'status-dot-badge--inactive'"
                    >
                      <span class="dot"></span>
                      <span>{{ u.isActive ? t('admin.active') : t('admin.inactive') }}</span>
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Integrated Pagination -->
          <AppPagination
            v-model:page="page"
            :total-pages="totalPages"
            :total-items="totalCount"
            :page-size="10"
            variant="table"
          />
        </div>
      </DataState>
    </div>
  </AdminLayout>
</template>

<style scoped>
.users-view {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.users-head {
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

/* Toolbar */
.toolbar-card {
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 14px;
  padding: 0.85rem 1.25rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  flex-wrap: wrap;
}

.search-input-wrap {
  position: relative;
  width: 320px;
  max-width: 100%;
}

.search-icon {
  position: absolute;
  inset-inline-start: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 18px;
  color: #94A3B8;
  pointer-events: none;
}

.toolbar-search-input {
  width: 100%;
  height: 44px;
  padding: 0 14px;
  padding-inline-start: 38px;
  background: #FFFFFF;
  border: 1.5px solid #E2E8F0;
  border-radius: 10px;
  font-size: 13.5px;
  color: #0F172A;
  outline: none;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.toolbar-search-input:focus {
  border-color: #4F46E5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12);
}

.counter-text {
  font-size: 12px;
  font-weight: 700;
  color: #64748B;
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

.user-cell {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.user-avatar-wrap {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: #E2E8F0;
}

.user-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-avatar-fallback {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  color: #FFFFFF;
  font-size: 12px;
  font-weight: 800;
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.user-name {
  font-size: 13.5px;
  color: #0F172A;
}

.user-phone-line {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 11.5px;
  color: #64748B;
}

.flag-icon {
  font-size: 13px;
  line-height: 1;
}

.phone-dial-code {
  font-weight: 700;
  color: #4F46E5;
}

.phone-number {
  color: #334155;
}

.user-phone {
  font-size: 11.5px;
  color: #64748B;
}

.role-pill {
  display: inline-flex;
  font-size: 11px;
  font-weight: 700;
  padding: 0.2rem 0.6rem;
  border-radius: 6px;
  letter-spacing: 0.03em;
}

.role-pill--admin {
  background: #EEF2FF;
  color: #4F46E5;
  border: 1px solid #C7D2FE;
}

.role-pill--staff {
  background: #F0FDF4;
  color: #16A34A;
  border: 1px solid #BBF7D0;
}

.role-pill--org {
  background: #F8FAFC;
  color: #475569;
  border: 1px solid #E2E8F0;
}

.status-dot-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 11px;
  font-weight: 700;
  padding: 0.2rem 0.55rem;
  border-radius: 9999px;
}

.status-dot-badge .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-dot-badge--active {
  background: #ECFDF5;
  color: #059669;
}
.status-dot-badge--active .dot { background: #10B981; }

.status-dot-badge--inactive {
  background: #F1F5F9;
  color: #64748B;
}
.status-dot-badge--inactive .dot { background: #94A3B8; }
</style>
