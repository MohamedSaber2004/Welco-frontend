import { ref, computed, onMounted, onUnmounted, type Ref } from 'vue'

/* ═══════════════════════════════════════════════════════════════════════
 * WELCO ANIMATION SYSTEM — Clinical Precision Motion
 * Provides consistent, performant animations across the entire platform.
 * Respects prefers-reduced-motion and provides stagger utilities.
 * ═══════════════════════════════════════════════════════════════════════ */

export const useAnimation = () => {
  const prefersReducedMotion = ref(false)
  const isClient = ref(false)

  onMounted(() => {
    isClient.value = true
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    prefersReducedMotion.value = mql.matches
    const handler = (e: MediaQueryListEvent) => { prefersReducedMotion.value = e.matches }
    mql.addEventListener?.('change', handler)
    onUnmounted(() => mql.removeEventListener?.('change', handler))
  })

  const duration = {
    fast: prefersReducedMotion.value ? 0 : 120,
    base: prefersReducedMotion.value ? 0 : 180,
    slow: prefersReducedMotion.value ? 0 : 280,
  }

  const easing = {
    out: 'cubic-bezier(0.16, 1, 0.3, 1)',
    inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  }

  const stagger = (index: number, baseDelay = 40, maxItems = 16) => {
    if (prefersReducedMotion.value) return 0
    return Math.min(index % maxItems, maxItems - 1) * baseDelay
  }

  const transition = (props: string[] = ['transform', 'opacity', 'box-shadow', 'border-color']) => {
    if (prefersReducedMotion.value) return 'none'
    return props.map(p => `${p} ${duration.base}ms ${easing.out}`).join(', ')
  }

  return {
    prefersReducedMotion,
    isClient,
    duration,
    easing,
    stagger,
    transition,
    classes: {
      fadeIn: 'anim-fade-in',
      fadeInUp: 'anim-fade-in-up',
      scaleIn: 'anim-scale-in',
      cardHover: 'anim-card-hover',
      interactiveLift: 'interactive-lift',
      reveal: 'reveal-pending',
      move: 'anim-move',
      btnPress: 'btn-press',
      glowBrand: 'glow-brand',
    },
  }
}

export const useStagger = (count: number, baseDelay = 40) => {
  return computed(() => Array.from({ length: count }, (_, i) => i * baseDelay))
}

export const useReveal = (elementRef: Ref<HTMLElement | null>, options?: IntersectionObserverInit) => {
  const isVisible = ref(false)

  onMounted(() => {
    if (!elementRef.value) return
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry && entry.isIntersecting) {
          isVisible.value = true
          observer.unobserve(entry.target)
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px', ...options }
    )
    observer.observe(elementRef.value)
    onUnmounted(() => observer.disconnect())
  })

  return isVisible
}

export const usePageTransition = (name = 'page') => {
  return {
    enterActiveClass: `${name}-enter-active`,
    leaveActiveClass: `${name}-leave-active`,
    enterFromClass: `${name}-enter-from`,
    leaveToClass: `${name}-leave-to`,
    mode: 'out-in' as const,
  }
}

export const animationStyles = {
  getCardHover: (lift = -2) => ({
    transition: `transform var(--duration-fast, 160ms) var(--ease-out), box-shadow var(--duration-fast, 160ms) var(--ease-out), border-color var(--duration-fast, 160ms) var(--ease-out)`,
  } as Record<string, string>),
  getInteractiveLift: (lift = -1) => ({
    transition: `transform var(--duration-fast, 120ms) var(--ease-out), box-shadow var(--duration-fast, 120ms) var(--ease-out)`,
  } as Record<string, string>),
  getStaggerDelay: (index: number, base = 40, max = 16) => ({
    animationDelay: `${-((index % max) * base)}ms`,
  } as Record<string, string>),
}