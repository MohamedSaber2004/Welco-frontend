<script setup lang="ts">
import { computed } from 'vue'
import { t } from '../../i18n'
import DashboardShell, { type DashboardNavSection, type DashboardNavLink } from './DashboardShell.vue'

const sections = computed<DashboardNavSection[]>(() => [
  {
    key: 'commercial',
    label: t('admin.commerce'),
    collapsible: false,
    links: [
      { to: '/provider/quotes', icon: 'request_quote', label: t('provider.quotes') },
      { to: '/provider/orders', icon: 'local_shipping', label: t('provider.orders') },
    ],
  },
  {
    key: 'catalog',
    label: t('provider.myCatalog'),
    collapsible: false,
    links: [
      { to: '/provider/catalog', icon: 'inventory_2', label: t('provider.myCatalog') },
      { to: '/provider/categories', icon: 'category', label: t('provider.categories') },
    ],
  },
  {
    key: 'support',
    label: t('provider.support'),
    collapsible: false,
    links: [
      { to: '/provider/support', icon: 'contact_support', label: t('provider.support') },
    ],
  },
  {
    key: 'account',
    label: t('nav.account'),
    collapsible: false,
    links: [
      { to: '/profile', icon: 'apartment', label: t('nav.profile') },
    ],
  },
])

const mobileLinks = computed<DashboardNavLink[]>(() => [
  { to: '/provider/quotes', label: t('provider.quotes'), icon: 'request_quote' },
  { to: '/provider/orders', label: t('provider.orders'), icon: 'local_shipping' },
  { to: '/provider/catalog', label: t('provider.myCatalog'), icon: 'inventory_2' },
  { to: '/provider/categories', label: t('provider.categories'), icon: 'category' },
  { to: '/provider/support', label: t('provider.support'), icon: 'contact_support' },
  { to: '/profile', label: t('nav.profile'), icon: 'apartment' },
])
</script>

<template>
  <DashboardShell
    storage-key="welco-provider-rail-collapsed"
    :brand-text="t('provider.dashboard')"
    :sections="sections"
    :status-text="t('admin.systemLive')"
    :mobile-links="mobileLinks"
  >
    <slot />
  </DashboardShell>
</template>
