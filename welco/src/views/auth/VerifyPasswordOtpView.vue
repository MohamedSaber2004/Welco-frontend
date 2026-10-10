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

onMounted(() => {
  if (!email.value) {
    try {
      const s = sessionStorage.getItem('welco-forgot-email')
      if (s) email.value = s
    } catch {}
  }
  startTimer()
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})

const handleVerify = async () => {
  error.value = ''
  if (!otpCode.value.trim()) {
    error.value = t('auth.errInvalidOtp')
    return
  }
  if (!email.value.trim()) {
    error.value = t('auth.errEmailRequired')
    return
  }
  loading.value = true
  let res: Awaited<ReturnType<typeof authService.verifyPasswordOtp>>
  try {
    res = await authService.verifyPasswordOtp({
      email: email.value.trim(),
      otpCode: otpCode.value.trim(),
    })
  } finally {
    loading.value = false
  }
  if (res.ok) {
    try {
      sessionStorage.setItem('welco-forgot-email', email.value.trim())
      sessionStorage.setItem('welco-forgot-token', otpCode.value.trim())
    } catch {}
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
  let res: Awaited<ReturnType<typeof authService.forgotPassword>>
  try {
    res = await authService.forgotPassword({ email: email.value.trim() })
  } finally {
    resending.value = false
  }
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

      <div class="email-notice-card">
        <span class="material-symbols-outlined notice-icon">mark_email_read</span>
        <div>
          <strong class="notice-title">{{ t('auth.verifyNoticeTitle') }}</strong>
          <p class="notice-sub">
            {{ t('auth.verifyNoticeDesc') }}
            <span class="mono email-highlight">{{ email || t('auth.verifyFallbackEmail') }}</span>.
          </p>
        </div>
      </div>

      <form class="auth-form-body" @submit.prevent="handleVerify" novalidate>
        <div class="form-group">
          <div class="label-row">
            <label class="form-label mono" for="otp-code">{{ t('auth.otpCode') }}</label>
            <span class="mono text-xs text-muted">{{ t('auth.otpLengthHint') }}</span>
          </div>
          <input
            id="otp-code"
            v-model="otpCode"
            type="text"
            inputmode="numeric"
            maxlength="8"
            required
            autofocus
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
            :disabled="secondsLeft > 0 || resending || !email.trim()"
            @click="handleResend"
          >
            <span v-if="secondsLeft > 0">{{ t('auth.resendTimer', { seconds: secondsLeft }) }}</span>
            <span v-else-if="resending">{{ t('common.loading') }}</span>
            <span v-else>{{ t('auth.resend') }}</span>
          </button>
        </div>

        <div class="auth-switch mono">
          <router-link to="/auth/forgot-password" class="switch-link">
            {{ t('auth.changeEmail') }}
          </router-link>
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
  color: var(--wl-muted);
  font-weight: 600;
}

.step-pill--done {
  color: var(--wl-success);
}

.step-pill--done .step-num {
  background: var(--wl-success);
  color: var(--wl-on-primary);
}

.step-pill--active {
  color: var(--wl-primary);
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
  background: var(--wl-primary);
  color: var(--wl-on-primary);
}

.step-sep {
  color: var(--wl-border);
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
  color: var(--wl-ink-soft);
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
  height: 44px;
  padding: 0 14px;
  background: var(--wl-surface);
  border: 1px solid var(--border, #D9E2EC);
  border-radius: var(--radius-md);
  font-size: 14px;
  font-family: var(--wl-font-body, system-ui);
  color: var(--wl-ink-strong);
  box-shadow: var(--shadow-xs);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  outline: none;
}

.vip-input:focus {
  border-color: var(--wl-primary);
  box-shadow: var(--wl-focus-ring);
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
  background: var(--wl-danger-soft);
  border: 1px solid var(--wl-border);
  border-radius: 10px;
  color: var(--wl-danger);
  font-size: 13px;
  font-weight: 500;
}

.vip-submit-btn {
  height: 44px;
  width: 100%;
  background: var(--wl-primary);
  color: var(--wl-on-primary);
  border: none;
  border-radius: var(--radius-md);
  font-family: var(--wl-font-body, system-ui);
  font-size: 14.5px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  cursor: pointer;
  box-shadow: 0 4px 12px -2px rgba(105, 169, 255, 0.35);
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.vip-submit-btn:hover:not(:disabled) {
  background: var(--wl-primary-hover);
  transform: translateY(-1px);
  box-shadow: 0 6px 16px -2px rgba(105, 169, 255, 0.45);
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
  color: var(--wl-primary);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
}

.resend-btn:hover:not(:disabled) {
  text-decoration: underline;
}

.email-notice-card {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
  background: var(--wl-success-soft);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: 1rem 1.15rem;
}

.notice-icon {
  font-size: 24px;
  color: var(--wl-success);
  flex-shrink: 0;
  margin-top: 1px;
}

.notice-title {
  display: block;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--wl-ink-strong);
  margin-bottom: 0.2rem;
}

.notice-sub {
  font-size: 12.5px;
  color: var(--wl-ink-soft);
  margin: 0;
  line-height: 1.45;
}

.email-highlight {
  font-weight: 700;
  color: var(--wl-ink-strong);
  background: var(--wl-surface);
  padding: 1px 5px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--wl-border);
}

.resend-btn:disabled {
  color: var(--wl-muted);
  cursor: not-allowed;
  text-decoration: none;
}

.auth-switch {
  display: flex;
  justify-content: center;
  margin-top: 0.25rem;
}

.switch-link {
  color: var(--wl-primary);
  font-weight: 600;
  text-decoration: none;
  font-size: 12.5px;
}

.switch-link:hover {
  text-decoration: underline;
}
</style>

