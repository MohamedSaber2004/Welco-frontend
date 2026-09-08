<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AdminLayout from '../../components/layout/AdminLayout.vue'
import DataState from '../../components/ui/DataState.vue'
import AppPagination from '../../components/ui/AppPagination.vue'
import BaseModal from '../../components/ui/BaseModal.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import FileUpload from '../../components/ui/FileUpload.vue'
import { useUsers } from '../../composables/useUsers'
import { t } from '../../i18n'
import { UserType, USER_TYPE_ROLE_KEY } from '../../domain/models/user'
import type { UserDto } from '../../domain/models/user'
import { authService, locationService, userRepository } from '../../di/container'
import { confirmService } from '../../infrastructure/feedback/confirm.service'
import { ATTACHMENT_PLACE, MEDIA_TYPE } from '../../config/api.config'
import { toastService } from '../../infrastructure/feedback/toast.service'
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
  showForm,
  editing,
  form,
  formLoading,
  formError,
  openCreate,
  openEdit,
  closeForm,
  handleSubmit,
  handleDelete,
} = useUsers()

// --- Details modal ---
const showDetailsModal = ref(false)
const selectedUser = ref<UserDto | null>(null)

const openDetails = (u: UserDto) => {
  selectedUser.value = u
  showDetailsModal.value = true
}

const closeDetails = () => {
  showDetailsModal.value = false
  selectedUser.value = null
}

// --- Activate / Deactivate (never yourself — backend rejects self-deactivation) ---
const togglePendingId = ref<string | null>(null)
const isSelf = (u: UserDto): boolean => authService.user.value?.id === u.id

const toggleActive = async (u: UserDto) => {
  if (isSelf(u)) return
  const nextActive = !u.isActive
  const ok = await confirmService.confirmAction(
    nextActive ? t('admin.confirmActivate') : t('admin.confirmDeactivate'),
    {
      title: nextActive ? t('admin.activate') : t('admin.deactivate'),
      variant: nextActive ? 'primary' : 'warning',
      icon: nextActive ? 'check_circle' : 'block',
      confirmText: nextActive ? t('admin.activate') : t('admin.deactivate'),
      cancelText: t('common.cancel'),
    },
  )
  if (!ok) return
  togglePendingId.value = u.id
  try {
    await userRepository.updateUser(u.id, { isActive: nextActive })
    toastService.success(nextActive ? t('admin.activated') : t('admin.deactivated'))
    await load()
  } catch (e) {
    toastService.error(e instanceof Error ? e.message : t('common.error'))
  } finally {
    togglePendingId.value = null
  }
}

// --- Change password modal ---
const showPasswordModal = ref(false)
const passwordTarget = ref<UserDto | null>(null)
const newPassword = ref('')
const confirmPassword = ref('')
const passwordError = ref('')
const passwordLoading = ref(false)

const openPasswordModal = (u: UserDto) => {
  passwordTarget.value = u
  newPassword.value = ''
  confirmPassword.value = ''
  passwordError.value = ''
  showPasswordModal.value = true
}

const closePasswordModal = () => {
  showPasswordModal.value = false
  passwordTarget.value = null
  passwordError.value = ''
}

const submitPassword = async () => {
  if (!passwordTarget.value) return
  if (newPassword.value.length < 8) {
    passwordError.value = t('auth.errPasswordMin')
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = t('auth.errPasswordMismatch')
    return
  }
  passwordLoading.value = true
  passwordError.value = ''
  try {
    await userRepository.changePassword(passwordTarget.value.id, newPassword.value)
    toastService.success(t('admin.updateSuccess'))
    closePasswordModal()
  } catch (e) {
    passwordError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    passwordLoading.value = false
  }
}

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
        <BaseButton variant="primary" @click="openCreate">
          <span class="material-symbols-outlined text-[18px]">add</span>
          <span>{{ t('admin.createUser') }}</span>
        </BaseButton>
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
                  <th class="text-end">{{ t('common.actions') }}</th>
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
                  <td>
                    <div class="row-actions">
                      <button
                        type="button"
                        class="row-action-btn"
                        :title="t('admin.viewDetails')"
                        :aria-label="t('admin.viewDetails')"
                        @click="openDetails(u)"
                      >
                        <span class="material-symbols-outlined text-[18px]">visibility</span>
                      </button>
                      <button
                        type="button"
                        class="row-action-btn"
                        :title="t('common.edit')"
                        :aria-label="t('common.edit')"
                        @click="openEdit(u)"
                      >
                        <span class="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      <button
                        type="button"
                        class="row-action-btn"
                        :class="u.isActive ? 'row-action-btn--deactivate' : 'row-action-btn--activate'"
                        :title="u.isActive ? t('admin.deactivate') : t('admin.activate')"
                        :aria-label="u.isActive ? t('admin.deactivate') : t('admin.activate')"
                        :disabled="togglePendingId === u.id || isSelf(u)"
                        @click="toggleActive(u)"
                      >
                        <span class="material-symbols-outlined text-[18px]">{{
                          u.isActive ? 'block' : 'check_circle'
                        }}</span>
                      </button>
                      <button
                        type="button"
                        class="row-action-btn row-action-btn--danger"
                        :title="t('common.delete')"
                        :aria-label="t('common.delete')"
                        @click="handleDelete(u)"
                      >
                        <span class="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
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

      <!-- Add / Edit Modal -->
      <BaseModal
        v-model="showForm"
        :title="editing ? t('admin.editUser') : t('admin.createUser')"
        max-width="600px"
        @close="closeForm"
      >
        <form class="admin-modal-form" @submit.prevent="handleSubmit">
          <div class="form-field">
            <FileUpload
              :model-value="form.profilePictureName"
              :place="ATTACHMENT_PLACE.USERS"
              :file-type="MEDIA_TYPE.IMAGE"
              accept="image/*"
              :label="t('admin.userAvatar')"
              @update:modelValue="form.profilePictureName = $event"
            />
          </div>
          <div class="form-row two-cols">
            <div class="form-field">
              <label class="field-label" for="user-fullname">{{ t('admin.userFullName') }} *</label>
              <input id="user-fullname" v-model="form.fullName" type="text" class="field-input" required />
            </div>
            <div class="form-field">
              <label class="field-label" for="user-email">{{ t('admin.email') }} *</label>
              <input
                id="user-email"
                v-model="form.email"
                type="email"
                class="field-input mono"
                required
                :disabled="!!editing"
              />
            </div>
          </div>
          <div class="form-row two-cols">
            <div class="form-field">
              <label class="field-label" for="user-phone">{{ t('admin.phone') }}</label>
              <input id="user-phone" v-model="form.phoneNumber" type="tel" class="field-input mono" />
            </div>
            <div class="form-field">
              <label class="field-label" for="user-role">{{ t('admin.userType') }} *</label>
              <select id="user-role" v-model="form.userType" class="field-select">
                <option :value="UserType.Admin">{{ t('admin.roleAdmin') }}</option>
                <option :value="UserType.WelcoStaff">{{ t('admin.roleWelcoStaff') }}</option>
                <option :value="UserType.OrganizationUser">{{ t('admin.roleOrganizationUser') }}</option>
              </select>
            </div>
          </div>
          <div v-if="!editing" class="form-field">
            <label class="field-label" for="user-password">{{ t('admin.userPassword') }} *</label>
            <input
              id="user-password"
              v-model="form.password"
              type="password"
              class="field-input mono"
              minlength="8"
              autocomplete="new-password"
            />
          </div>
          <div class="form-field">
            <label class="toggle-label">
              <input v-model="form.isActive" type="checkbox" />
              <span>{{ t('admin.active') }}</span>
            </label>
          </div>

          <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>

          <div class="modal-foot">
            <BaseButton variant="secondary" type="button" @click="closeForm">
              {{ t('common.cancel') }}
            </BaseButton>
            <BaseButton variant="primary" type="submit" :loading="formLoading">
              {{ t('common.save') }}
            </BaseButton>
          </div>
        </form>
      </BaseModal>

      <!-- Details Modal -->
      <BaseModal
        v-model="showDetailsModal"
        :title="t('admin.userDetails')"
        max-width="560px"
        @close="closeDetails"
      >
        <div v-if="selectedUser" class="admin-details">
          <div class="user-details-hero">
            <div class="user-avatar-wrap user-avatar-wrap--lg">
              <img
                v-if="selectedUser.profilePictureName"
                :src="resolveFileUrl(selectedUser.profilePictureName, PLACEHOLDER)"
                :alt="selectedUser.fullName"
                class="user-avatar-img"
              />
              <div
                v-else
                class="user-avatar-fallback mono"
                :style="{ backgroundColor: getAvatarColor(selectedUser.fullName) }"
              >
                {{ (selectedUser.fullName || 'U').slice(0, 2).toUpperCase() }}
              </div>
            </div>
            <div>
              <strong class="user-details-name">{{ selectedUser.fullName }}</strong>
              <div class="mono text-xs text-slate-600">{{ selectedUser.email }}</div>
              <div class="user-details-badges">
                <span
                  class="role-pill mono"
                  :class="{
                    'role-pill--admin': selectedUser.userType === UserType.Admin,
                    'role-pill--staff': selectedUser.userType === UserType.WelcoStaff,
                    'role-pill--org': selectedUser.userType === UserType.OrganizationUser,
                  }"
                >
                  {{ t(`admin.${USER_TYPE_ROLE_KEY(selectedUser.userType)}`) }}
                </span>
                <span
                  class="status-dot-badge mono"
                  :class="selectedUser.isActive ? 'status-dot-badge--active' : 'status-dot-badge--inactive'"
                >
                  <span class="dot"></span>
                  <span>{{ selectedUser.isActive ? t('admin.active') : t('admin.inactive') }}</span>
                </span>
              </div>
            </div>
          </div>
          <div class="details-grid">
            <div class="detail-item">
              <span class="detail-k mono">{{ t('admin.phone') }}</span>
              <strong class="detail-v mono">{{ selectedUser.phoneNumber || '—' }}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-k mono">{{ t('admin.email') }}</span>
              <strong class="detail-v mono">{{ selectedUser.isEmailConfirmed ? t('common.verified') : t('common.pending') }}</strong>
            </div>
          </div>
          <div class="modal-foot modal-foot--split">
            <BaseButton variant="secondary" @click="selectedUser && openPasswordModal(selectedUser)">
              <span class="material-symbols-outlined text-[16px]">key</span>
              <span>{{ t('admin.changeUserPassword') }}</span>
            </BaseButton>
            <div class="modal-foot__group">
              <BaseButton variant="secondary" @click="selectedUser && openEdit(selectedUser)">
                {{ t('common.edit') }}
              </BaseButton>
              <BaseButton variant="secondary" @click="closeDetails">
                {{ t('common.close') }}
              </BaseButton>
            </div>
          </div>
        </div>
      </BaseModal>

      <!-- Change Password Modal -->
      <BaseModal
        v-model="showPasswordModal"
        :title="t('admin.changeUserPassword')"
        max-width="440px"
        @close="closePasswordModal"
      >
        <form class="admin-modal-form" @submit.prevent="submitPassword">
          <div class="form-field">
            <label class="field-label" for="new-password">{{ t('admin.userPassword') }} *</label>
            <input
              id="new-password"
              v-model="newPassword"
              type="password"
              class="field-input mono"
              minlength="8"
              autocomplete="new-password"
              required
            />
          </div>
          <div class="form-field">
            <label class="field-label" for="confirm-password">{{ t('auth.confirmNewPassword') }}</label>
            <input
              id="confirm-password"
              v-model="confirmPassword"
              type="password"
              class="field-input mono"
              autocomplete="new-password"
              required
            />
          </div>

          <p v-if="passwordError" class="form-error" role="alert">{{ passwordError }}</p>

          <div class="modal-foot">
            <BaseButton variant="secondary" type="button" @click="closePasswordModal">
              {{ t('common.cancel') }}
            </BaseButton>
            <BaseButton variant="primary" type="submit" :loading="passwordLoading">
              {{ t('common.save') }}
            </BaseButton>
          </div>
        </form>
      </BaseModal>
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

.user-details-hero {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.user-avatar-wrap--lg {
  width: 64px;
  height: 64px;
}

.user-details-name {
  font-size: 1.1rem;
  color: #0F172A;
}

.user-details-badges {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.4rem;
}

.modal-foot--split {
  justify-content: space-between;
}

.modal-foot__group {
  display: flex;
  gap: 0.75rem;
}
</style>
