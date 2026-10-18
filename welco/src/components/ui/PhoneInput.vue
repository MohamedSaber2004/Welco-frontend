<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { locale, t } from '../../i18n'
import { locationService } from '../../di/container'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    phoneCode?: string | null
    label?: string
    placeholder?: string
    required?: boolean
    disabled?: boolean
    error?: string
    id?: string
    /** Optional ISO 2 (AE, EG, PK, US, etc.) to default the country/dial code */
    countryCode?: string | null
    /** Territory Country id — when set, dial auto-syncs to Country.phoneCode (backend linked) */
    countryId?: string | null
    /** If true, dial follows countryId strictly (register flow linkage) */
    syncWithCountry?: boolean
  }>(),
  {
    modelValue: '',
    phoneCode: null,
    label: '',
    placeholder: '300 1234567',
    required: false,
    disabled: false,
    error: '',
    id: undefined,
    countryCode: null,
    countryId: null,
    syncWithCountry: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:phoneCode': [value: string]
}>()

const selectedCountryCode = ref('')
const selectedDial = ref('')
const localNumber = ref('')

/** Dial codes purely from API Countries (phoneCode) — no static fallback */
const mergedDials = computed(() => locationService.mergedDials.value)

onMounted(() => {
  // Ensure countries are loaded for dial codes — pure API, no mock
  if (!locationService.countries.value.length) {
    void locationService.loadCountries().catch(() => {})
  }
})

const getFlagEmoji = (code?: string | null): string => {
  if (!code || code.length !== 2) return '🌐'
  const offset = 127397
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => c.charCodeAt(0) + offset))
}

const localizedDialName = (d: { nameEn: string; nameAr: string }) => (locale.value === 'ar' ? d.nameAr : d.nameEn)

const findByDial = (dial: string) => mergedDials.value.find((c) => c.dial === dial)
const findByCode = (code: string) => mergedDials.value.find((c) => c.code.toLowerCase() === code.toLowerCase())
const findByCountryId = (id: string) => locationService.getCountryById(id)

const setCountry = (iso: string, dial?: string) => {
  selectedCountryCode.value = iso.toUpperCase()
  if (dial) {
    selectedDial.value = dial
  } else {
    const found = findByCode(iso)
    if (found) selectedDial.value = found.dial
  }
  emit('update:phoneCode', selectedDial.value)
}

const parseModelValue = (fullVal: string) => {
  if (!fullVal) {
    localNumber.value = ''
    return
  }
  let clean = fullVal.trim()
  if (clean.startsWith('00')) {
    clean = '+' + clean.slice(2)
  }

  // Corrupted Pakistan number edge case (mistakenly prepended with +1 on 0300... e.g. +1 03000959336)
  const pkMangled = clean.replace(/\s+/g, '')
  if (/^\+103\d{9}$/.test(pkMangled)) {
    setCountry('PK', '+92')
    localNumber.value = pkMangled.slice(3)
    return
  }

  // Local Pakistani number without country code
  if (/^03\d{9}$/.test(pkMangled)) {
    setCountry('PK', '+92')
    localNumber.value = pkMangled.slice(1)
    return
  }

  // If explicit phoneCode prop is passed and matches
  if (props.phoneCode && props.phoneCode.trim()) {
    const rawDial = props.phoneCode.trim()
    const withPlus = rawDial.startsWith('+') ? rawDial : `+${rawDial}`
    const found = findByDial(withPlus)
    if (found) {
      setCountry(found.code, found.dial)
      let nat = clean
      if (clean.startsWith(withPlus)) nat = clean.slice(withPlus.length).trim()
      else if (clean.startsWith(withPlus.slice(1))) nat = clean.slice(withPlus.length - 1).trim()
      localNumber.value = nat.replace(/^0+/, '')
      return
    }
  }

  const sorted = [...mergedDials.value].sort((a, b) => b.dial.length - a.dial.length)
  for (const c of sorted) {
    if (clean.startsWith(c.dial)) {
      setCountry(c.code, c.dial)
      localNumber.value = clean.slice(c.dial.length).trim().replace(/^0+/, '')
      return
    }
  }
  const match = clean.match(/^(\+\d{1,4})(.*)$/)
  if (match && match[1] && match[2] !== undefined) {
    const d = match[1]
    const found = findByDial(d)
    if (found) {
      setCountry(found.code, found.dial)
    } else {
      selectedDial.value = d
    }
    localNumber.value = match[2].trim().replace(/^0+/, '')
  } else {
    localNumber.value = clean
  }
}

const emitCombined = () => {
  let num = localNumber.value.trim().replace(/^\+/, '').replace(/\s+/g, ' ')
  if (!num) {
    emit('update:modelValue', '')
    emit('update:phoneCode', selectedDial.value || '')
    return
  }
  // Strip trunk zero when combining with dial code
  if (selectedDial.value.startsWith('+') && num.startsWith('0')) {
    num = num.replace(/^0+/, '')
  }
  const dialToUse = selectedDial.value || (mergedDials.value[0]?.dial ?? '')
  emit('update:phoneCode', dialToUse)
  if (!dialToUse) {
    emit('update:modelValue', num)
    return
  }
  emit('update:modelValue', `${dialToUse} ${num}`.trim())
}

// When user selects a different country from dropdown
watch(selectedCountryCode, (newIso) => {
  if (!newIso) return
  const found = findByCode(newIso)
  if (found) {
    selectedDial.value = found.dial
    emit('update:phoneCode', found.dial)
    emitCombined()
  }
})

watch(localNumber, () => emitCombined())

// Smart input detection when user types or pastes in phone number field
const onInputNumber = (e: Event) => {
  const input = e.target as HTMLInputElement
  const raw = input.value.trim()

  // 1. If user typed or pasted a number with '+' or '00'
  if (raw.startsWith('+') || raw.startsWith('00')) {
    const clean = raw.startsWith('00') ? '+' + raw.slice(2) : raw
    // Check if it matches any dial in mergedDials
    const sorted = [...mergedDials.value].sort((a, b) => b.dial.length - a.dial.length)
    for (const d of sorted) {
      if (clean.startsWith(d.dial)) {
        setCountry(d.code, d.dial)
        localNumber.value = clean.slice(d.dial.length).trim().replace(/^0+/, '')
        return
      }
    }
  }

  // 2. If user pasted/typed a local Pakistani number e.g. 0300... (11 digits starting with 03)
  const digitsOnly = raw.replace(/\D/g, '')
  if (/^03\d{9}$/.test(digitsOnly)) {
    const pk = findByCode('PK')
    if (pk) {
      setCountry('PK', pk.dial)
      localNumber.value = digitsOnly.slice(1) // 300...
      return
    }
  }

  // 3. If user pasted/typed a local Egyptian number e.g. 010..., 011..., 012..., 015... (11 digits)
  if (/^01[0125]\d{8}$/.test(digitsOnly)) {
    const eg = findByCode('EG')
    if (eg) {
      setCountry('EG', eg.dial)
      localNumber.value = digitsOnly.slice(1)
      return
    }
  }
}

// Auto-select dial when API loads and nothing selected yet
watch(
  () => mergedDials.value.length,
  (len) => {
    if (len && (!selectedCountryCode.value || !selectedDial.value)) {
      if (props.countryId) {
        const c = findByCountryId(props.countryId)
        if (c?.code) {
          setCountry(c.code, c.phoneCode?.trim())
          return
        }
      }
      if (props.countryCode) {
        const found = findByCode(props.countryCode)
        if (found) {
          setCountry(found.code, found.dial)
          return
        }
      }
      if (props.phoneCode) {
        const found = findByDial(props.phoneCode.trim())
        if (found) {
          setCountry(found.code, found.dial)
          return
        }
      }
      // Fallback: prefer AE (UAE), EG (Egypt), SA (Saudi), or PK (Pakistan) before alphabetical first dial (+1 Canada)
      const defaultPref = findByCode('AE') || findByCode('EG') || findByCode('SA') || findByCode('PK') || mergedDials.value[0]
      if (defaultPref) {
        setCountry(defaultPref.code, defaultPref.dial)
      }
    }
    if (props.modelValue) parseModelValue(props.modelValue)
    if (props.countryId) {
      const country = findByCountryId(props.countryId)
      if (country?.code) setCountry(country.code, country.phoneCode?.trim())
    }
  },
)

// Sync from countryCode prop (e.g. address's country)
watch(
  () => props.countryCode,
  (code) => {
    if (!code) return
    const found = findByCode(code)
    if (found) setCountry(found.code, found.dial)
  },
  { immediate: true },
)

// Sync from territory Country id — backend-linked phoneCode
watch(
  () => props.countryId,
  (cid) => {
    if (!cid) return
    const country = findByCountryId(cid)
    if (country?.code) {
      if (props.syncWithCountry || !localNumber.value || !selectedCountryCode.value) {
        setCountry(country.code, country.phoneCode?.trim())
      }
    }
  },
  { immediate: true },
)

watch(
  () => props.modelValue,
  (val) => {
    const combinedCurrent = localNumber.value
      ? `${selectedDial.value} ${localNumber.value.trim()}`.replace(/\s+/g, '')
      : ''
    const cleanIn = (val ?? '').replace(/\s+/g, '')
    if (cleanIn !== combinedCurrent) parseModelValue(val ?? '')
  },
  { immediate: true },
)

// Initialize from props
if (props.countryCode) {
  const found = findByCode(props.countryCode)
  if (found) setCountry(found.code, found.dial)
}
if (props.countryId) {
  const c = findByCountryId(props.countryId)
  if (c?.code) setCountry(c.code, c.phoneCode?.trim())
}
if (props.modelValue) {
  parseModelValue(props.modelValue)
}
</script>

<template>
  <div class="phone-field" :class="{ 'has-error': Boolean(error), 'is-disabled': disabled }">
    <label v-if="label" :for="id" class="phone-field__label">
      {{ label }}
      <span v-if="required" class="phone-field__req" aria-hidden="true">*</span>
    </label>

    <div class="phone-field__control">
      <!-- Dial code selector — loaded purely from API Countries (phoneCode) with unique ISO codes -->
      <div class="phone-code-select-wrap">
        <select
          v-model="selectedCountryCode"
          :disabled="disabled || !mergedDials.length"
          class="phone-code-select"
          :aria-label="t('auth.phoneNumber')"
        >
          <option v-if="!mergedDials.length" value="" disabled>{{ t('common.loading') }}</option>
          <option
            v-for="d in mergedDials"
            :key="`${d.code}-${d.countryId ?? ''}`"
            :value="d.code"
            :title="`${d.dial} ${localizedDialName(d)}`"
          >
            {{ getFlagEmoji(d.code) }} {{ d.dial }}
          </option>
        </select>
        <span class="phone-code-arrow" aria-hidden="true">▾</span>
      </div>

      <span class="phone-field__divider" aria-hidden="true"></span>

      <input
        :id="id"
        v-model="localNumber"
        type="tel"
        inputmode="tel"
        autocomplete="tel-national"
        :placeholder="placeholder"
        :disabled="disabled"
        :required="required"
        class="phone-number-input"
        @input="onInputNumber"
      />
    </div>

    <span v-if="error" class="phone-field__error" role="alert">{{ error }}</span>
    <span v-if="!mergedDials.length && !locationService.loading.value" class="phone-field__error" role="alert">{{ t('auth.errNoDialCodes') }}</span>
  </div>
</template>

<style scoped>
.phone-field { display: flex; flex-direction: column; gap: 0.45rem; text-align: start; width: 100%; }
.phone-field__label { font-family: var(--wl-font-body); font-size: 12px; font-weight: 600; color: var(--wl-ink-soft); letter-spacing: 0.015em; display: flex; align-items: center; gap: 0.25rem; }
.phone-field__req { color: var(--wl-danger); font-weight: 700; margin-inline-start: 2px; }
.phone-field__control {
  display: flex;
  align-items: center;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 10px;
  box-shadow: var(--shadow-xs);
  transition: border-color 0.22s var(--wl-ease-spring),
              box-shadow 0.22s var(--wl-ease-spring),
              transform 0.15s ease,
              background-color 0.2s ease;
  overflow: hidden;
  height: 44px;
  min-height: 44px;
}
.phone-field__control:hover:not(.is-disabled) {
  border-color: var(--wl-border-strong);
  box-shadow: var(--shadow-xs);
}
.phone-field__control:focus-within {
  border-color: var(--wl-primary);
  box-shadow: var(--wl-focus-ring);
  transform: translateY(-0.5px);
  background: var(--wl-surface);
}
.phone-field.has-error .phone-field__control {
  border-color: var(--wl-danger) !important;
  box-shadow: var(--wl-focus-ring-danger) !important;
}
.phone-code-select-wrap {
  position: relative;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  height: 100%;
  background: var(--wl-surface-soft);
  transition: background-color 0.18s ease;
}
.phone-field__control:focus-within .phone-code-select-wrap {
  background: var(--wl-primary-soft);
}
.phone-code-select {
  appearance: none;
  -webkit-appearance: none;
  background: transparent;
  border: none;
  padding-inline-start: 12px;
  padding-inline-end: 24px;
  height: 100%;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--wl-ink-strong);
  cursor: pointer;
  outline: none;
  font-family: var(--wl-font-mono);
}
.phone-code-arrow {
  position: absolute;
  inset-inline-end: 8px;
  pointer-events: none;
  font-size: 9px;
  color: var(--wl-muted);
  transition: transform 0.2s ease, color 0.18s ease;
}
.phone-field__control:focus-within .phone-code-arrow {
  color: var(--wl-primary);
  transform: rotate(180deg);
}
.phone-field__divider { width: 1px; height: 55%; background: var(--wl-line); flex-shrink: 0; }
.phone-number-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: none;
  background: transparent;
  padding: 0 14px;
  font-size: 0.94rem;
  font-weight: 500;
  font-family: var(--wl-font-mono);
  color: var(--wl-ink-strong);
  outline: none;
  letter-spacing: 0.03em;
  box-shadow: none !important;
}
.phone-number-input::placeholder { color: var(--wl-muted); opacity: 0.85; }
.phone-field__error {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--wl-danger);
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 2px;
}
.phone-field__error::before { content: '●'; font-size: 6px; }
.phone-field.is-disabled { opacity: 0.55; pointer-events: none; }
</style>
