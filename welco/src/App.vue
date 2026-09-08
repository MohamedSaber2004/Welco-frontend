<script setup lang="ts">
import { computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from './components/layout/AppHeader.vue'
import AppFooter from './components/layout/AppFooter.vue'
import AppMobileNav from './components/layout/AppMobileNav.vue'
import LoadingBar from './components/ui/LoadingBar.vue'
import ToastContainer from './components/ui/ToastContainer.vue'
import ResultModal from './components/ui/ResultModal.vue'
import ConfirmDialog from './components/ui/ConfirmDialog.vue'
import WhatsAppFab from './components/ui/WhatsAppFab.vue'
import { services } from './di/container'
import { t, locale } from './i18n'
import type { MessageKey } from './i18n'

const route = useRoute()

onMounted(() => {
  void services.contentService.loadSupportContact()
})

watch(locale, () => {
  const k = route.meta.titleKey as MessageKey | undefined
  document.title = k ? `${t(k)} · Welco` : 'Welco'
})

// Footer appears ONLY on landing pages, and NEVER in any dashboards or account views
const showFooter = computed(() => {
  if (route.meta?.isLandingPage) return true
  if (route.meta?.hideFooter) return false

  const path = route.path || ''
  const name = String(route.name || '')

  // Never show on any dashboard, admin, staff, account, profile or auth route
  if (
    path.startsWith('/admin') ||
    path.startsWith('/account') ||
    path === '/profile' ||
    path === '/addresses' ||
    path === '/locations' ||
    path === '/help/my-tickets' ||
    Boolean(route.meta?.requiresAdmin) ||
    Boolean(route.meta?.requiresAuth)
  ) {
    return false
  }

  return (
    name === 'home' ||
    path === '/' ||
    name === 'landing-page' ||
    path.startsWith('/catalog/') ||
    name === 'oem' ||
    path === '/oem' ||
    name === 'certifications' ||
    path === '/certifications' ||
    name === 'about' ||
    path === '/about'
  )
})

// Show call us fixed button only on the home page
const showWhatsApp = computed(() => route.name === 'home' || route.path === '/')

const whatsAppOffset = computed(() => '')
</script>

<template>
  <a href="#main-content" class="visually-hidden">{{ t('common.skipToMain') }}</a>
  <LoadingBar />
  <AppHeader />
  <ToastContainer />
  <ResultModal />
  <ConfirmDialog />
  <main id="main-content" tabindex="-1">
    <RouterView v-slot="{ Component }">
      <Transition name="page" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
  </main>
  <AppFooter v-if="showFooter" />
  <AppMobileNav />
  <WhatsAppFab
    v-if="showWhatsApp"
    :phone="services.contentService.supportContact.value.whatsAppNumber"
    :bottom-offset="whatsAppOffset"
  />
</template>

<style>
/* global page transition already in main.css */</style>
