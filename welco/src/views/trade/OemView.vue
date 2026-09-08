<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { t, locale } from '../../i18n'
import { companyService } from '../../di/container'
import type { OemService } from '../../domain/models/company'
import BackButton from '../../components/ui/BackButton.vue'

const services = ref<OemService[]>([])
const form = ref({ fullName: '', email: '', companyName: '', serviceType: '', message: '' })
const submitting = ref(false)
const submitted = ref(false)
const error = ref<string | null>(null)

const ICONS: Record<string, string> = {
  label: 'qr_code_2',
  ruler: 'square_foot',
  scan: 'biotech',
  package: 'inventory_2',
  flag: 'policy',
}

onMounted(async () => {
  try {
    await companyService.loadOemServices()
  } catch {}
  services.value = companyService.oemServices.value
})

async function submit() {
  if (
    !form.value.fullName ||
    !form.value.email ||
    !form.value.companyName ||
    !form.value.serviceType ||
    !form.value.message
  ) {
    error.value = t('common.error')
    return
  }
  submitting.value = true
  error.value = null
  try {
    const res = await companyService.submitOemInquiry(form.value)
    if (res.ok) {
      submitted.value = true
    } else {
      error.value = res.error || t('common.error')
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="page-shell oem-view">
    <BackButton fallback="/" variant="minimal" class="mb-3" />

    <nav class="crumb-bar mono" :aria-label="t('common.breadcrumb')">
      <router-link to="/">{{ t('nav.home') }}</router-link>
      <span class="crumb-sep icon--directional">/</span>
      <span class="crumb-active">{{ t('oem.title') }}</span>
    </nav>

    <header class="oem-hero">
      <div class="hero-grid">
        <div class="hero-copy">
          <div class="head-chip mono">
            <span class="pulse-dot"></span>
            <span>{{ t('oem.heroEyebrow') }}</span>
          </div>
          <h1 class="hero-title">{{ t('oem.heroTitle') }}</h1>
          <p class="hero-desc">{{ t('oem.heroBody') }}</p>

          <div class="hero-credentials mono">
            <span class="material-symbols-outlined text-[16px] text-emerald-600">verified</span>
            <span>{{ t('oem.builtOn') }}</span>
          </div>
        </div>

        <div class="hud-card" aria-hidden="true">
          <div class="hud-top">
            <div class="hud-badge mono">
              <span class="hud-pulse"></span>
              <span>PRODUCTION CELL #04</span>
            </div>
            <span class="mono hud-est">EST. 1994</span>
          </div>

          <div class="hud-specs">
            <div class="hud-item">
              <span class="hud-key mono">STEEL GRADE:</span>
              <span class="hud-val mono">AISI 410 / 420 Martensitic</span>
            </div>
            <div class="hud-item">
              <span class="hud-key mono">INSERTS:</span>
              <span class="hud-val mono">Tungsten Carbide (HRC 70+)</span>
            </div>
            <div class="hud-item">
              <span class="hud-key mono">PASSIVATION:</span>
              <span class="hud-val mono">ASTM A967 Citric / Nitric</span>
            </div>
            <div class="hud-item">
              <span class="hud-key mono">TRACEABILITY:</span>
              <span class="hud-val mono">GS1-128 / UDI Micro-Laser</span>
            </div>
          </div>

          <div class="hud-meter">
            <div class="meter-track">
              <div class="meter-fill" style="width: 88%"></div>
            </div>
            <div class="meter-meta mono">
              <span>Annual Capacity: 1.2M+ Surgical Units</span>
              <span>88% Utilized</span>
            </div>
          </div>
        </div>
      </div>
    </header>

    <section v-if="services.length > 0" class="oem-section">
      <div class="section-head">
        <div class="head-chip mono">
          <span class="pulse-dot"></span>
          <span>{{ t('oem.serviceEyebrow') }}</span>
        </div>
        <h2 class="section-title">{{ t('oem.serviceTitle') }}</h2>
        <p class="section-subtitle">{{ t('oem.serviceSubtitle') }}</p>
      </div>

      <div class="services-grid">
        <article v-for="(s, idx) in services" :key="s.id" class="service-card">
          <div class="service-card-top">
            <div class="service-icon-box">
              <span class="material-symbols-outlined text-[24px]">
                {{ ICONS[s.icon] || 'precision_manufacturing' }}
              </span>
            </div>
            <span class="mono service-line-pill">LINE {{ String(idx + 1).padStart(2, '0') }}</span>
          </div>

          <h3 class="service-name">{{ locale === 'ar' && s.titleAr ? s.titleAr : s.title }}</h3>
          <p class="service-desc">{{ locale === 'ar' && s.descriptionAr ? s.descriptionAr : s.description }}</p>

          <div class="service-foot mono">
            <span class="material-symbols-outlined text-[15px] text-emerald-600">check_circle</span>
            <span>ISO 13485 Lot-Validated</span>
          </div>
        </article>
      </div>
    </section>

    <section class="oem-section">
      <div class="inquiry-grid">
        <div class="inquiry-copy">
          <div class="head-chip mono">
            <span class="pulse-dot"></span>
            <span>{{ t('oem.inquiryEyebrow') }}</span>
          </div>
          <h2 class="inquiry-title">{{ t('oem.inquiryTitle') }}</h2>
          <p class="inquiry-desc">
            {{ t('oem.inquirySubtitle') }} {{ t('oem.inquiryDesc2') }}
          </p>

          <div class="perks-stack">
            <div class="perk-card">
              <span class="material-symbols-outlined perk-icon">lock</span>
              <div>
                <strong class="perk-heading mono">{{ t('oem.perkNdaTitle') }}</strong>
                <p class="perk-text">{{ t('oem.perkNdaDesc') }}</p>
              </div>
            </div>

            <div class="perk-card">
              <span class="material-symbols-outlined perk-icon">token</span>
              <div>
                <strong class="perk-heading mono">{{ t('oem.perkProtoTitle') }}</strong>
                <p class="perk-text">{{ t('oem.perkProtoDesc') }}</p>
              </div>
            </div>
          </div>
        </div>

        <div class="inquiry-form-card">
          <div v-if="submitted" class="success-box">
            <div class="success-icon-circle">
              <span class="material-symbols-outlined text-[32px]">check</span>
            </div>
            <h3 class="success-title mono">{{ t('common.success') }}</h3>
            <p class="success-desc">{{ t('oem.inquirySubmitted') }}</p>
          </div>

          <form v-else class="form-stack" @submit.prevent="submit">
            <div class="fields-2col">
              <div class="field-item">
                <label for="oem-fullname" class="vip-field-label mono">{{ t('oem.fullName') }} *</label>
                <input id="oem-fullname" v-model="form.fullName" class="vip-48-input" required />
              </div>

              <div class="field-item">
                <label for="oem-email" class="vip-field-label mono">{{ t('oem.email') }} *</label>
                <input id="oem-email" v-model="form.email" type="email" class="vip-48-input" required />
              </div>
            </div>

            <div class="fields-2col">
              <div class="field-item">
                <label for="oem-company" class="vip-field-label mono">{{ t('oem.companyName') }} *</label>
                <input id="oem-company" v-model="form.companyName" class="vip-48-input" required />
              </div>

              <div class="field-item">
                <label for="oem-service" class="vip-field-label mono">{{ t('oem.serviceType') }} *</label>
                <select id="oem-service" v-model="form.serviceType" class="vip-select" required>
                  <option value="" disabled>{{ t('oem.selectService') }}</option>
                  <option v-for="s in services" :key="s.id" :value="s.title">{{ s.title }}</option>
                  <option value="Full Custom Solution">Full Custom Solution</option>
                </select>
              </div>
            </div>

            <div class="field-item">
              <label for="oem-message" class="vip-field-label mono">{{ t('oem.message') }} *</label>
              <textarea
                id="oem-message"
                v-model="form.message"
                class="vip-textarea"
                rows="4"
                :placeholder="t('oem.messagePlaceholder')"
                required
              ></textarea>
            </div>

            <p v-if="error" class="modal-error-banner">{{ error }}</p>

            <button type="submit" :disabled="submitting" class="btn-submit-inquiry mono">
              <span class="material-symbols-outlined text-[18px]">send</span>
              <span>{{ submitting ? t('common.loading') : t('oem.submit') }}</span>
            </button>
          </form>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.oem-view {
  width: 100%;
  gap: 2.5rem;
}

.crumb-bar {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 11px;
  color: #64748B;
}

.crumb-bar a {
  color: #64748B;
  text-decoration: none;
  transition: color 0.15s ease;
}

.crumb-bar a:hover {
  color: #4F46E5;
}

.crumb-sep {
  color: #CBD5E1;
}

.crumb-active {
  color: var(--wl-ink-strong);
  font-weight: 700;
}

.head-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 10px;
  font-weight: 700;
  color: var(--wl-primary);
  background: var(--wl-primary-soft);
  border: 1px solid rgba(var(--wl-primary-rgb), 0.3);
  padding: 0.2rem 0.6rem;
  border-radius: 9999px;
  letter-spacing: 0.06em;
  width: fit-content;
  margin-bottom: 0.5rem;
}

.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #4F46E5;
}

.oem-hero {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 20px;
  padding: 2.5rem;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
}

.hero-grid {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 2rem;
  align-items: center;
}

.hero-copy {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.hero-title {
  font-family: var(--wl-font-display, system-ui);
  font-size: clamp(1.85rem, 3.5vw, 2.5rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--wl-ink-strong);
  margin: 0;
  line-height: 1.1;
}

.hero-desc {
  font-size: 15px;
  color: #64748B;
  line-height: 1.6;
  margin: 0.5rem 0 0;
}

.hero-credentials {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 12px;
  font-weight: 700;
  color: #059669;
  margin-top: 0.75rem;
}

.hud-card {
  background: #090D16;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 1.5rem;
  color: #FFFFFF;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  box-shadow: 0 12px 36px -8px rgba(0, 0, 0, 0.4);
}

.hud-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.hud-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 10px;
  font-weight: 700;
  color: #818CF8;
  background: rgba(79, 70, 229, 0.15);
  border: 1px solid rgba(99, 102, 241, 0.3);
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
}

.hud-pulse {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #818CF8;
}

.hud-est {
  font-size: 10.5px;
  color: #94A3B8;
}

.hud-specs {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.hud-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  padding-bottom: 0.4rem;
}

.hud-key {
  color: #64748B;
  font-weight: 700;
}

.hud-val {
  color: #F1F5F9;
}

.hud-meter {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.meter-track {
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 9999px;
  overflow: hidden;
}

.meter-fill {
  height: 100%;
  background: linear-gradient(90deg, #4F46E5, #818CF8);
  border-radius: 9999px;
}

.meter-meta {
  display: flex;
  justify-content: space-between;
  font-size: 10.5px;
  color: #94A3B8;
}

.oem-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.section-title {
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: -0.025em;
  color: var(--wl-ink-strong);
  margin: 0.2rem 0 0;
}

.section-subtitle {
  font-size: 14px;
  color: #64748B;
  margin: 0.25rem 0 0;
}

.services-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.25rem;
}

.service-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 16px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.service-card:hover {
  border-color: #CBD5E1;
  transform: translateY(-2px);
  box-shadow: 0 8px 24px -4px rgba(15, 23, 42, 0.08);
}

.service-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.service-icon-box {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--wl-primary-soft);
  color: var(--wl-primary);
  display: grid;
  place-items: center;
}

.service-line-pill {
  font-size: 10px;
  font-weight: 800;
  color: var(--wl-ink-soft);
  background: var(--wl-surface-soft);
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
}

.service-name {
  font-size: 15px;
  font-weight: 800;
  color: var(--wl-ink-strong);
  margin: 0;
}

.service-desc {
  font-size: 13px;
  color: #64748B;
  line-height: 1.55;
  margin: 0;
  flex: 1;
}

.service-foot {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 11px;
  font-weight: 700;
  color: #059669;
  padding-top: 0.75rem;
  border-top: 1px solid #F1F5F9;
}

.inquiry-grid {
  display: grid;
  grid-template-columns: 1fr 1.25fr;
  gap: 2rem;
  align-items: start;
}

.inquiry-copy {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.inquiry-title {
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--wl-ink-strong);
  margin: 0.2rem 0 0;
}

.inquiry-desc {
  font-size: 14px;
  color: #64748B;
  line-height: 1.6;
  margin: 0.25rem 0 1rem;
}

.perks-stack {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.perk-card {
  display: flex;
  gap: 0.85rem;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 12px;
  padding: 1rem;
}

.perk-icon {
  font-size: 20px;
  color: #4F46E5;
  flex-shrink: 0;
}

.perk-heading {
  font-size: 12.5px;
  color: var(--wl-ink-strong);
  display: block;
}

.perk-text {
  font-size: 12px;
  color: #64748B;
  line-height: 1.45;
}

.inquiry-form-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 20px;
  padding: 2rem;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
}

.form-stack {
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

.field-item {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.vip-field-label {
  font-size: 10.5px;
  font-weight: 700;
  color: #475569;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.vip-48-input,
.vip-select {
  width: 100%;
  height: 48px;
  padding: 0 14px;
  background: var(--wl-surface-soft);
  border: 1.5px solid var(--wl-border);
  border-radius: 10px;
  font-size: 14px;
  color: var(--wl-ink-strong);
  outline: none;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.vip-textarea {
  width: 100%;
  padding: 12px 14px;
  background: var(--wl-surface-soft);
  border: 1.5px solid var(--wl-border);
  border-radius: 10px;
  font-size: 13.5px;
  color: var(--wl-ink-strong);
  outline: none;
  resize: vertical;
  line-height: 1.55;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.vip-48-input:focus,
.vip-select:focus,
.vip-textarea:focus {
  background: var(--wl-surface);
  border-color: #4F46E5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12);
}

.fields-2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.btn-submit-inquiry {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  height: 48px;
  background: #4F46E5;
  color: #FFFFFF;
  border: none;
  border-radius: 10px;
  font-size: 13.5px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 12px -2px rgba(79, 70, 229, 0.35);
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.btn-submit-inquiry:hover:not(:disabled) {
  background: #4338CA;
  transform: translateY(-1px);
}

.modal-error-banner {
  background: #FFF1F2;
  border: 1px solid #FECDD3;
  color: #E11D48;
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  font-size: 12.5px;
}

.success-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 2rem 1rem;
}

.success-icon-circle {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: #ECFDF5;
  border: 2px solid #A7F3D0;
  color: #059669;
  display: grid;
  place-items: center;
  margin-bottom: 1rem;
}

.success-title {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--wl-ink-strong);
  margin: 0 0 0.4rem;
}

.success-desc {
  font-size: 13.5px;
  color: #64748B;
  line-height: 1.6;
  margin: 0;
  max-width: 420px;
}

@media (max-width: 900px) {
  .hero-grid,
  .inquiry-grid {
    grid-template-columns: 1fr;
  }
  .fields-2col {
    grid-template-columns: 1fr;
  }
}
</style>
