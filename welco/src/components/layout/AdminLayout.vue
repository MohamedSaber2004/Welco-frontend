<script setup lang="ts">
import { computed } from 'vue'
import { t } from '../../i18n'
import { authService } from '../../di/container'
import DashboardShell, { type DashboardNavLink, type DashboardNavSection } from './DashboardShell.vue'

const isAdmin = computed(() => authService.isAdmin.value)
const canManageTerritory = computed(() => isAdmin.value)
const canManageUsers = computed(() => isAdmin.value)
const canManageCompanies = computed(() => isAdmin.value)
const canManageCertifications = computed(() => isAdmin.value)

const sections = computed<DashboardNavSection[]>(() => [
  {
    key: 'home',
    label: '',
    collapsible: false,
    links: [
      { to: '/admin', icon: 'dashboard', label: t('admin.dashboard'), exact: true },
    ],
  },
  {
    key: 'territory',
    label: t('admin.territory'),
    collapsible: true,
    visible: canManageTerritory.value,
    links: [
      { to: '/admin/countries', icon: 'public', label: t('admin.countries') },
      { to: '/admin/cities', icon: 'location_city', label: t('admin.cities') },
      { to: '/admin/zones', icon: 'my_location', label: t('admin.zones') },
    ],
  },
  {
    key: 'sales',
    label: t('admin.commerce'),
    collapsible: true,
    links: [
      { to: '/admin/sales', icon: 'request_quote', label: t('admin.sales') },
      { to: '/admin/orders', icon: 'local_shipping', label: t('admin.orders') },
      { to: '/admin/companies', icon: 'apartment', label: t('admin.companies'), visible: canManageCompanies.value },
    ],
  },
  {
    key: 'catalog',
    label: t('admin.catalog'),
    collapsible: true,
    links: [
      { to: '/admin/categories', icon: 'category', label: t('admin.categoriesTitle'), visible: isAdmin.value },
      { to: '/admin/certifications', icon: 'verified', label: t('certifications.title'), visible: canManageCertifications.value },
      { to: '/admin/pages', icon: 'web', label: t('admin.pages') },
    ],
  },
  {
    key: 'support',
    label: t('admin.system'),
    collapsible: true,
    links: [
      { to: '/admin/users', icon: 'group', label: t('admin.users'), visible: canManageUsers.value },
      { to: '/admin/help', icon: 'help', label: t('nav.help') },
      { to: '/admin/tickets', icon: 'support_agent', label: t('admin.supportTickets') },
      { to: '/admin/audit-logs', icon: 'history', label: t('admin.auditLogs'), visible: isAdmin.value },
    ],
  },
])

const mobileLinks = computed<DashboardNavLink[]>(() => [
  { to: '/admin', label: t('admin.dashboard'), icon: 'dashboard', exact: true },
  { to: '/admin/sales', label: t('admin.sales'), icon: 'request_quote' },
  { to: '/admin/orders', label: t('admin.orders'), icon: 'local_shipping' },
  { to: '/admin/categories', label: t('admin.categoriesTitle'), icon: 'category', visible: isAdmin.value },
  { to: '/admin/pages', label: t('admin.pages'), icon: 'web' },
  { to: '/admin/companies', label: t('admin.companies'), icon: 'apartment', visible: canManageCompanies.value },
  { to: '/admin/countries', label: t('admin.countries'), icon: 'public', visible: canManageTerritory.value },
  { to: '/admin/users', label: t('admin.users'), icon: 'group', visible: canManageUsers.value },
  { to: '/admin/tickets', label: t('admin.supportTickets'), icon: 'support_agent' },
  { to: '/admin/audit-logs', label: t('admin.auditLogs'), icon: 'history', visible: isAdmin.value },
])
</script>

<template>
  <DashboardShell
    storage-key="welco-admin-rail-collapsed"
    :brand-text="t('admin.console')"
    :sections="sections"
    :status-text="t('admin.systemLive')"
    :mobile-links="mobileLinks"
  >
    <slot />
  </DashboardShell>
</template>
