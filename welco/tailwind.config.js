import forms from '@tailwindcss/forms'
import containerQueries from '@tailwindcss/container-queries'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        // Clinical Precision brand — Deep Medical Navy & Steel Teal
        primary: 'var(--brand)',
        'primary-hover': 'var(--brand-hover)',
        'primary-container': 'var(--brand-soft)',
        'on-primary': 'var(--fg-on-brand)',
        'primary-fixed': '#C8E6FF',
        'primary-fixed-dim': '#A3CBEA',
        secondary: 'var(--secondary)',
        'secondary-container': '#EDF4FF',
        'on-secondary-container': '#00687B',
        tertiary: 'var(--tertiary)',
        'tertiary-container': '#E6FAF8',
        'on-tertiary-container': '#00413E',
        gold: 'var(--fg-warning)',
        'gold-soft': 'var(--color-warning-100)',
        'gold-faint': 'var(--color-warning-100)',
        admin: 'var(--brand)',
        'admin-soft': 'var(--brand-soft)',
        error: 'var(--fg-danger)',
        'on-error': 'var(--fg-on-brand)',
        'error-container': 'var(--color-danger-100)',
        surface: 'var(--bg-surface)',
        'surface-dim': '#C1DDFB',
        'surface-bright': 'var(--bg-surface)',
        'surface-container-lowest': '#FFFFFF',
        'surface-container-low': '#EDF4FF',
        'surface-container': '#E3EFFF',
        'surface-container-high': '#D8EAFF',
        'surface-container-highest': '#CEE5FF',
        'surface-variant': '#CEE5FF',
        'on-surface': 'var(--fg-body)',
        'on-surface-variant': 'var(--fg-muted)',
        outline: 'var(--fg-subtle)',
        'outline-variant': 'var(--border)',
        'inverse-surface': '#16334A',
        'inverse-on-surface': '#E8F2FF',
        'inverse-primary': '#A3CBEA',
        background: 'var(--bg-app)',
        'on-background': 'var(--fg-heading)',
      },
      borderRadius: {
        sm: '0.125rem',   // 2px
        DEFAULT: '0.25rem', // 4px (Base Radius)
        md: '0.375rem',  // 6px
        lg: '0.5rem',    // 8px (Container Radius)
        xl: '0.75rem',   // 12px (Outer Container Radius)
        full: '9999px',
      },
      spacing: {
        'input-sm': '36px',
        'input-md': '40px',
        'input-lg': '48px',
        'gutter': '1.75rem',
      },
      fontFamily: {
        display: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        label: ['Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'Consolas', 'Liberation Mono', 'Menlo', 'monospace'],
      },
      fontSize: {
        '2xs': 'var(--text-2xs)',
        xs: 'var(--text-xs)',
        sm: 'var(--text-sm)',
        md: 'var(--text-md)',
        base: 'var(--text-base)',
        lg: 'var(--text-lg)',
        xl: 'var(--text-xl)',
        '2xl': 'var(--text-2xl)',
        '3xl': 'var(--text-3xl)',
        '4xl': 'var(--text-4xl)',
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        glow: 'var(--ring-focus)',
        'glow-danger': '0 0 0 2px #FFFFFF, 0 0 0 4px #DC3545',
        brand: 'var(--shadow-brand)',
      },
    },
  },
  plugins: [forms, containerQueries],
}
