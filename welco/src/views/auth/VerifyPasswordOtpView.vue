<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authService } from '../../di/container'
import { toastService } from '../../infrastructure/feedback/toast.service'
import { t } from '../../i18n'
import AuthShell from '../../components/auth/AuthShell.vue'

const route = useRoute()
const router = useRouter()
const email = ref((route.query.email as string) || '')
const otpCode = ref('')
const loading = ref(false)
const resending = ref(false)
const error = ref('')
const secondsLeft = ref(60)
let timer: ReturnType<typeof setInterval> | null = null

const startTimer = () => {
  secondsLeft.value = 60
  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    secondsLeft.value -= 1
    if (secondsLeft.value <= 0 && timer) {
      clearInterval(timer)
      timer = null
    }
  }, 1000)
}

onMounted(startTimer)
onUnmounted(() => {
  if (timer) clearInterval(timer)
})

const handleVerify = async () => {
  error.value = ''
  if (!otpCode.value.trim() || !email.value.trim()) {
    error.value = t('auth.errInvalidOtp')
    return
  }
  loading.value = true
  const res = await authService.verifyPasswordOtp({
    email: email.value.trim(),
    otpCode: otpCode.value.trim(),
  })
  loading.value = false
  if (res.ok) {
    toastService.success(t('auth.codeSent'))
    await router.push({
      name: 'reset-password',
      query: { email: email.value.trim(), token: otpCode.value.trim() },
    })
  } else {
    error.value = res.error
  }
}

const handleResend = async () => {
  if (secondsLeft.value > 0 || !email.value.trim()) return
  resending.value = true
  const res = await authService.forgotPassword({ email: email.value.trim() })
  resending.value = false
  if (res.ok) {
    toastService.success(t('auth.codeSent'))
    startTimer()
  } else {
    toastService.error(res.error)
  }
}
</script>

<template>
  <AuthShell :title="t('auth.verifyTitle')" :subtitle="t('auth.verifySubtitle')">
    <div class="auth-recovery-flow">
      <nav class="recovery-steps mono" :aria-label="t('auth.recoveryProgress')">
        <div class="step-pill step-pill--done">
          <span class="step-num">✓</span>
          <span>{{ t('auth.email') }}</span>
        </div>
        <span class="step-sep icon--directional">→</span>
        <div class="step-pill step-pill--active">
          <span class="step-num">2</span>
          <span>{{ t('auth.otpCode') }}</span>
        </div>
        <span class="step-sep icon--directional">→</span>
        <div class="step-pill">
          <span class="step-num">3</span>
          <span>{{ t('auth.newPassword') }}</span>
        </div>
      </nav>

      <form class="auth-form-body" @submit.prevent="handleVerify" novalidate>
        <div class="form-group">
          <label class="form-label mono" for="otp-email">{{ t('auth.email') }}</label>
          <input
            id="otp-email"
            v-model="email"
            type="email"
            required
            :placeholder="t('auth.emailPlaceholder')"
            class="vip-input"
          />
        </div>

        <div class="form-group">
          <div class="label-row">
            <label class="form-label mono" for="otp-code">{{ t('auth.otpCode') }}</label>
            <span class="mono text-xs text-muted">{{ t('auth.otpLengthHint') }}</span>
          </div>
          <input
            id="otp-code"
            v-model="otpCode"
            type="text"
            maxlength="8"
            required
            placeholder="123456"
            class="vip-input vip-otp-input mono"
            autocomplete="one-time-code"
          />
        </div>

        <div v-if="error" class="form-error-banner" role="alert">
          <span class="material-symbols-outlined text-[18px]">error</span>
          <span>{{ error }}</span>
        </div>

        <button type="submit" :disabled="loading" class="vip-submit-btn">
          <span v-if="!loading">{{ t('auth.verify') }}</span>
          <span v-else>{{ t('auth.verifying') }}</span>
          <span class="material-symbols-outlined text-[18px] icon--directional">arrow_forward</span>
        </button>

        <div class="resend-box">
          <button
            type="button"
            class="resend-btn mono"
            :disabled="secondsLeft > 0 || resending"
            @click="handleResend"
          >
            <span v-if="secondsLeft > 0">{{ t('auth.resendTimer', { seconds: secondsLeft }) }}</span>
            <span v-else-if="resending">{{ t('common.loading') }}</span>
            <span v-else>{{ t('auth.resend') }}</span>
          </button>
        </div>
      </form>
    </div>
  </AuthShell>
</template>

<style scoped>
.auth-recovery-flow {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.recovery-steps {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: 12px;
  padding: 0.6rem 0.85rem;
  font-size: 11px;
}

.step-pill {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  color: #94A3B8;
  font-weight: 600;
}

.step-pill--done {
  color: #059669;
}

.step-pill--done .step-num {
  background: #10B981;
  color: #FFFFFF;
}

.step-pill--active {
  color: #4F46E5;
  font-weight: 700;
}

.step-num {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--wl-surface-hover);
  color: var(--wl-muted);
  display: grid;
  place-items: center;
  font-size: 10px;
  font-weight: 800;
}

.step-pill--active .step-num {
  background: #4F46E5;
  color: #FFFFFF;
}

.step-sep {
  color: #CBD5E1;
  font-size: 12px;
}

.auth-form-body {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.form-label {
  font-size: 11px;
  font-weight: 700;
  color: #475569;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.vip-input {
  width: 100%;
  height: 48px;
  padding: 0 14px;
  background: var(--wl-surface);
  border: 1.5px solid var(--wl-border);
  border-radius: 12px;
  font-size: 14px;
  font-family: var(--wl-font-body, system-ui);
  color: var(--wl-ink-strong);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  outline: none;
}

.vip-input:focus {
  border-color: #4F46E5;
  box-shadow: 0 0 0 3.5px rgba(79, 70, 229, 0.14);
  transform: translateY(-0.5px);
}

.vip-otp-input {
  text-align: center;
  font-size: 1.4rem;
  letter-spacing: 0.35em;
  font-weight: 800;
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

.resend-box {
  display: flex;
  justify-content: center;
}

.resend-btn {
  background: none;
  border: none;
  color: #4F46E5;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
}

.resend-btn:hover:not(:disabled) {
  text-decoration: underline;
}

.resend-btn:disabled {
  color: #94A3B8;
  cursor: not-allowed;
  text-decoration: none;
}
</style>
