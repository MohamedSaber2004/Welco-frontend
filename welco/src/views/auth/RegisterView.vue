<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { authService, locationService } from '../../di/container'
import { t, locale } from '../../i18n'
import { toastService } from '../../infrastructure/feedback/toast.service'
import AuthShell from '../../components/auth/AuthShell.vue'
import PhoneInput from '../../components/ui/PhoneInput.vue'
import { AppLanguage, UserType } from '../../domain/models/user'
import type { CountryDto } from '../../domain/models/location'
import { setPendingOrg, clearPendingOrg } from '../../utils/pending-org-marker'

const router = useRouter()
const accountType = ref<'customer' | 'organization'>('customer')
const isOrg = computed(() => accountType.value === 'organization')
const fullName = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const phoneNumber = ref('')
const companyName = ref('')
const companyEmail = ref('')
const distributorCountryId = ref('')
const salesVolumeBand = ref('')
const website = ref('')
const loading = ref(false)
const error = ref('')
const showPassword = ref(false)
const countries = ref<CountryDto[]>([])
const loadingCountries = ref(false)

onMounted(async () => {
  loadingCountries.value = true
  try {
    await locationService.loadCountries()
    countries.value = [...locationService.countries.value]
  } finally {
    loadingCountries.value = false
  }
})

const localized = (en: string, ar: string) => (locale.value === 'ar' ? ar : en)
const phoneCountry = computed(() => {
  if (!phoneNumber.value) return null
  return locationService.findCountryByPhone(phoneNumber.value) ?? null
})
const phoneCountryLabel = computed(() => {
  const c = phoneCountry.value
  if (!c) return null
  return locale.value === 'ar' ? c.nameAr : c.nameEn
})

const emailValid = computed(() => !email.value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value))
const companyEmailValid = computed(() => !companyEmail.value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyEmail.value))
const strength = computed(() => {
  if (!password.value) return 0
  let s = 0
  if (password.value.length >= 8) s++
  if (/[A-Z]/.test(password.value)) s++
  if (/[0-9]/.test(password.value)) s++
  if (/[^A-Za-z0-9]/.test(password.value)) s++
  return s
})

const handleRegister = async () => {
  error.value = ''
  if (!fullName.value.trim()) {
    error.value = t('auth.errFullNameRequired')
    return
  }
  if (!emailValid.value || !email.value.trim()) {
    error.value = t('auth.errEmailInvalid')
    return
  }
  if (isOrg.value) {
    if (!companyName.value.trim()) {
      error.value = t('auth.errCompanyRequired')
      return
    }
    if (!distributorCountryId.value) {
      error.value = t('auth.errCountryRequired')
      return
    }
    if (!salesVolumeBand.value) {
      error.value = t('auth.errVolumeRequired')
      return
    }
  }
  if (password.value !== confirmPassword.value) {
    error.value = t('auth.errPasswordMismatch')
    return
  }
  if (password.value.length < 8) {
    error.value = t('auth.errPasswordMin')
    return
  }
  if (isOrg.value && companyEmail.value && !companyEmailValid.value) {
    error.value = t('auth.errEmailInvalid')
    return
  }
  if (isOrg.value && website.value && website.value.trim() && !/^https?:\/\/.+/i.test(website.value.trim())) {
    error.value = t('auth.errWebsiteInvalid')
    return
  }

  loading.value = true
  const phoneCountryId = phoneCountry.value?.id
  const payload = {
    fullName: fullName.value.trim(),
    email: email.value.trim(),
    password: password.value,
    confirmPassword: confirmPassword.value,
    phoneNumber: phoneNumber.value.trim() || undefined,
    phoneCountryId: phoneCountryId ?? undefined,
    phoneCountryCode: phoneCountry.value?.code ?? undefined,
    userType: isOrg.value ? UserType.OrganizationUser : UserType.Customer,
    language: locale.value === 'ar' ? AppLanguage.Ar : AppLanguage.En,
    // Company fields ride along ONLY for the Organization path — their
    // presence is what later marks this signup as "pending admin approval".
    ...(isOrg.value
      ? {
          companyName: companyName.value.trim(),
          companyEmail: companyEmail.value.trim() || undefined,
          distributorCountryId: distributorCountryId.value,
          salesVolumeBand: salesVolumeBand.value,
          website: website.value.trim() || undefined,
        }
      : {}),
  } as Parameters<typeof authService.register>[0]

  const res = await authService.register(payload)
  loading.value = false

  if (res.ok) {
    try {
      sessionStorage.setItem('welco-pending-email', payload.email)
      sessionStorage.setItem('welco-pending-register', JSON.stringify(payload))
    } catch {}
    if (isOrg.value) setPendingOrg(payload.email)
    else clearPendingOrg(payload.email)
    toastService.success(t('auth.registrationSuccess'))
    await router.push({ name: 'verify-email', query: { email: payload.email } })
  } else {
    error.value = res.error
  }
}
</script>

<template>
  <AuthShell :title="t('auth.registerTitle')" :subtitle="t('auth.registerSubtitle')">
    <form class="reg-form" @submit.prevent="handleRegister" novalidate>
      <section class="reg-card">
        <header class="reg-card-head">
          <span class="reg-card-step mono">0</span>
          <div>
            <h3 class="reg-card-title">{{ t('auth.accountType') }}</h3>
            <p class="reg-card-subtitle">{{ t('auth.registerSubtitle') }}</p>
          </div>
        </header>

        <div class="acct-type-grid" role="radiogroup" :aria-label="t('auth.accountType')">
          <button
            type="button"
            class="acct-type-opt"
            :class="{ 'is-active': accountType === 'customer' }"
            role="radio"
            :aria-checked="accountType === 'customer'"
            @click="accountType = 'customer'"
          >
            <span class="material-symbols-outlined acct-type-icon">shopping_bag</span>
            <span class="acct-type-label">{{ t('auth.registerAsCustomer') }}</span>
            <span class="acct-type-desc">{{ t('auth.registerAsCustomerDesc') }}</span>
          </button>
          <button
            type="button"
            class="acct-type-opt"
            :class="{ 'is-active': accountType === 'organization' }"
            role="radio"
            :aria-checked="accountType === 'organization'"
            @click="accountType = 'organization'"
          >
            <span class="material-symbols-outlined acct-type-icon">domain</span>
            <span class="acct-type-label">{{ t('auth.registerAsOrganization') }}</span>
            <span class="acct-type-desc">{{ t('auth.registerAsOrganizationDesc') }}</span>
          </button>
        </div>
      </section>

      <section class="reg-card">
        <header class="reg-card-head">
          <span class="reg-card-step mono">1</span>
          <div>
            <h3 class="reg-card-title">{{ t('auth.registerStep1Title') }}</h3>
            <p class="reg-card-subtitle">{{ t('auth.registerStep1Subtitle') }}</p>
          </div>
        </header>

        <div class="reg-grid">
          <div class="form-group">
            <label class="form-label mono" for="reg-fullname">
              {{ t('auth.fullName') }} <span class="req">*</span>
            </label>
            <div class="input-wrap">
              <span class="material-symbols-outlined input-icon">person</span>
              <input
                id="reg-fullname"
                v-model="fullName"
                required
                autocomplete="name"
                :placeholder="t('auth.fullNamePlaceholder')"
                class="vip-input"
              />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label mono" for="reg-email">
              {{ t('auth.email') }} <span class="req">*</span>
            </label>
            <div class="input-wrap input-wrap--ltr">
              <span class="material-symbols-outlined input-icon">mail</span>
              <input
                id="reg-email"
                v-model="email"
                type="email"
                required
                autocomplete="email"
                :placeholder="t('auth.emailPlaceholder')"
                class="vip-input"
              />
            </div>
            <p v-if="!emailValid" class="field-error-text">{{ t('auth.errEmailInvalid') }}</p>
          </div>

          <div class="form-group col-span-2">
            <PhoneInput v-model="phoneNumber" :label="t('auth.phoneNumber')" :placeholder="t('auth.phonePlaceholder')" />
            <p v-if="phoneCountryLabel" class="phone-hint mono">
              ↳ {{ t('locations.phoneCode') }} {{ phoneCountry?.phoneCode }} — {{ phoneCountryLabel }} ({{ phoneCountry?.code }})
            </p>
          </div>

          <div class="form-group">
            <label class="form-label mono" for="reg-password">
              {{ t('auth.password') }} <span class="req">*</span>
            </label>
            <div class="input-wrap">
              <span class="material-symbols-outlined input-icon">lock</span>
              <input
                id="reg-password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                required
                autocomplete="new-password"
                :placeholder="t('auth.passwordPlaceholder')"
                class="vip-input vip-input--with-toggle"
              />
              <button
                type="button"
                class="pwd-toggle-btn"
                :aria-label="showPassword ? t('auth.hidePassword') : t('auth.showPassword')"
                @click="showPassword = !showPassword"
              >
                <span class="material-symbols-outlined">{{ showPassword ? 'visibility_off' : 'visibility' }}</span>
              </button>
            </div>

            <div class="strength-bar">
              <div class="strength-segments">
                <span
                  v-for="i in 4"
                  :key="i"
                  class="seg"
                  :class="{
                    'seg--weak': i <= strength && strength === 1,
                    'seg--fair': i <= strength && strength === 2,
                    'seg--good': i <= strength && strength === 3,
                    'seg--strong': i <= strength && strength === 4,
                  }"
                ></span>
              </div>
              <span class="strength-label mono">
                {{ strength <= 1 ? t('auth.passwordWeak') : strength === 2 ? t('auth.passwordFair') : strength === 3 ? t('auth.passwordGood') : t('auth.passwordStrong') }}
              </span>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label mono" for="reg-confirm">
              {{ t('auth.confirmPassword') }} <span class="req">*</span>
            </label>
            <div class="input-wrap">
              <span class="material-symbols-outlined input-icon">lock</span>
              <input
                id="reg-confirm"
                v-model="confirmPassword"
                :type="showPassword ? 'text' : 'password'"
                required
                autocomplete="new-password"
                :placeholder="t('auth.passwordPlaceholder')"
                class="vip-input vip-input--with-toggle"
                :class="{ 'is-invalid': confirmPassword && password !== confirmPassword }"
              />
            </div>
            <p v-if="confirmPassword && password !== confirmPassword" class="field-error-text">
              {{ t('auth.errPasswordMismatch') }}
            </p>
          </div>
        </div>
      </section>

      <section v-if="isOrg" class="reg-card">
        <header class="reg-card-head">
          <span class="reg-card-step mono">2</span>
          <div>
            <h3 class="reg-card-title">{{ t('auth.registerStep2Title') }}</h3>
            <p class="reg-card-subtitle">{{ t('auth.registerStep2Subtitle') }}</p>
          </div>
        </header>

        <div class="reg-grid">
          <div class="form-group col-span-2">
            <label class="form-label mono" for="reg-company">
              {{ t('distributor.companyName') }} <span class="req">*</span>
            </label>
            <input
              id="reg-company"
              v-model="companyName"
              :placeholder="t('distributor.companyNamePlaceholder')"
              class="vip-input"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label mono" for="reg-company-email">
              {{ t('distributor.email') }}
            </label>
            <div class="input-wrap input-wrap--ltr">
              <span class="material-symbols-outlined input-icon">mail</span>
              <input
                id="reg-company-email"
                v-model="companyEmail"
                type="email"
                autocomplete="email"
                :placeholder="t('distributor.emailPh')"
                class="vip-input"
              />
            </div>
            <p v-if="companyEmail && !companyEmailValid" class="field-error-text">{{ t('auth.errEmailInvalid') }}</p>
          </div>

          <div class="form-group">
            <label class="form-label mono" for="reg-country">
              {{ t('distributor.country') }} <span class="req">*</span>
            </label>
            <select id="reg-country" v-model="distributorCountryId" required class="vip-input vip-select">
              <option value="" disabled>{{ loadingCountries ? t('common.loading') : t('distributor.country') }}</option>
              <option v-for="c in countries" :key="c.id" :value="c.id">
                {{ localized(c.nameEn, c.nameAr) }} — {{ c.code }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label mono" for="reg-volume">
              {{ t('distributor.salesVolume') }} <span class="req">*</span>
            </label>
            <select id="reg-volume" v-model="salesVolumeBand" required class="vip-input vip-select">
              <option value="" disabled>{{ t('distributor.salesVolume') }}</option>
              <option value="Under 100k USD">{{ t('distributor.volume1') }}</option>
              <option value="100k – 250k USD">{{ t('distributor.volume2') }}</option>
              <option value="250k – 500k USD">{{ t('distributor.volume3') }}</option>
              <option value="Over 500k USD">{{ t('distributor.volume4') }}</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label mono" for="reg-website">
              {{ t('distributor.website') }}
            </label>
            <input
              id="reg-website"
              v-model="website"
              type="url"
              :placeholder="t('distributor.websitePlaceholder')"
              class="vip-input"
            />
          </div>
        </div>
      </section>

      <div v-if="error" class="form-error-banner" role="alert">
        <span class="material-symbols-outlined text-[18px]">error</span>
        <span>{{ error }}</span>
      </div>

      <button type="submit" :disabled="loading" class="vip-submit-btn">
        <span v-if="!loading">{{ t('auth.register') }}</span>
        <span v-else>{{ t('auth.registering') }}</span>
        <span class="material-symbols-outlined text-[18px] icon--directional">arrow_forward</span>
      </button>

      <div class="auth-switch mono">
        <span>{{ t('auth.hasAccount') }}</span>
        <router-link to="/auth/login" class="switch-link">
          {{ t('auth.login') }}
        </router-link>
      </div>
    </form>
  </AuthShell>
</template>

<style scoped>
.reg-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.reg-card {
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  border-radius: 14px;
  padding: 1.25rem 1.4rem;
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

.reg-card-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding-bottom: 0.85rem;
  border-bottom: 1px solid #EDF2F7;
}

.reg-card-step {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #4F46E5;
  color: #FFFFFF;
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 800;
  flex-shrink: 0;
}

.reg-card-title {
  font-family: var(--wl-font-display, system-ui);
  font-size: 1.05rem;
  font-weight: 700;
  color: #0F172A;
  margin: 0;
}

.reg-card-subtitle {
  font-size: 12px;
  color: #64748B;
  margin: 0;
}

.reg-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.col-span-2 {
  grid-column: span 2;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.form-label {
  font-size: 11px;
  font-weight: 700;
  color: #475569;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.req {
  color: #EF4444;
}

.input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.input-wrap--ltr {
  direction: ltr;
}

.input-icon {
  position: absolute;
  inset-inline-start: 14px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 19px;
  color: #94A3B8;
  pointer-events: none;
  line-height: 1;
}

.vip-input {
  width: 100%;
  height: 48px;
  padding: 0 14px;
  background: #FFFFFF;
  border: 1.5px solid #E2E8F0;
  border-radius: 12px;
  font-size: 14px;
  font-family: var(--wl-font-body, system-ui);
  color: #0F172A;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  outline: none;
}

.input-wrap .vip-input {
  padding-inline-start: 42px;
}

.input-wrap .vip-input--with-toggle {
  padding-inline-end: 44px;
}

.vip-input:focus {
  border-color: #4F46E5;
  box-shadow: 0 0 0 3.5px rgba(79, 70, 229, 0.14);
  transform: translateY(-0.5px);
}

.vip-input.is-invalid {
  border-color: #EF4444;
}

.vip-select {
  cursor: pointer;
  appearance: auto;
}

.pwd-toggle-btn {
  position: absolute;
  inset-inline-end: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #94A3B8;
  cursor: pointer;
  display: grid;
  place-items: center;
  padding: 4px;
  border-radius: 6px;
  line-height: 1;
}

.pwd-toggle-btn:hover {
  color: #4F46E5;
}

.strength-bar {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin-top: 0.35rem;
}

.strength-segments {
  flex: 1;
  display: flex;
  gap: 4px;
}

.seg {
  flex: 1;
  height: 4px;
  border-radius: 9999px;
  background: #E2E8F0;
  transition: background 0.2s ease;
}

.seg--weak { background: #EF4444; }
.seg--fair { background: #F59E0B; }
.seg--good { background: #10B981; }
.seg--strong { background: #4F46E5; }

.strength-label {
  font-size: 10px;
  font-weight: 700;
  color: #64748B;
}

.field-error-text {
  font-size: 11px;
  color: #EF4444;
  margin-top: 0.2rem;
}

.phone-hint {
  font-size: 11px;
  color: #64748B;
  margin-top: 0.25rem;
}

.form-error-banner {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.75rem 1rem;
  background: #FFF1F2;
  border: 1px solid #FECDD3;
  border-radius: 10px;
  color: #E11D48;
  font-size: 13px;
  font-weight: 500;
}

.vip-submit-btn {
  height: 48px;
  width: 100%;
  background: #4F46E5;
  color: #FFFFFF;
  border: none;
  border-radius: 12px;
  font-family: var(--wl-font-body, system-ui);
  font-size: 14.5px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  cursor: pointer;
  box-shadow: 0 4px 12px -2px rgba(79, 70, 229, 0.35);
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.vip-submit-btn:hover:not(:disabled) {
  background: #4338CA;
  transform: translateY(-1px);
  box-shadow: 0 6px 16px -2px rgba(79, 70, 229, 0.45);
}

.vip-submit-btn:active:not(:disabled) {
  transform: scale(0.985);
}

.vip-submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.auth-switch {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.45rem;
  font-size: 12.5px;
  color: #64748B;
}

.switch-link {
  color: #4F46E5;
  font-weight: 700;
  text-decoration: none;
}

.switch-link:hover {
  text-decoration: underline;
}

.acct-type-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.acct-type-opt {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.3rem;
  padding: 0.9rem 1rem;
  background: #FFFFFF;
  border: 1.5px solid #E2E8F0;
  border-radius: 12px;
  cursor: pointer;
  text-align: start;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.acct-type-opt:hover {
  border-color: #A5B4FC;
  transform: translateY(-1px);
}

.acct-type-opt.is-active {
  border-color: #4F46E5;
  background: rgba(79, 70, 229, 0.05);
  box-shadow: 0 0 0 3.5px rgba(79, 70, 229, 0.12);
}

.acct-type-icon {
  font-size: 22px;
  color: #4F46E5;
}

.acct-type-label {
  font-size: 14px;
  font-weight: 700;
  color: #0F172A;
}

.acct-type-desc {
  font-size: 11.5px;
  color: #64748B;
  line-height: 1.45;
}

@media (max-width: 640px) {
  .acct-type-grid {
    grid-template-columns: 1fr;
  }
  .reg-grid {
    grid-template-columns: 1fr;
  }
  .col-span-2 {
    grid-column: span 1;
  }
}
</style>
