import type { Directive } from 'vue'

export const REVEAL_PENDING = 'reveal-pending'
export const REVEAL_DONE = 'is-revealed'
export const STAGGER_PROP = '--stagger-i'

let observer: IntersectionObserver | null = null

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function getObserver(): IntersectionObserver {
  if (observer) return observer
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const el = entry.target as HTMLElement
        el.classList.add(REVEAL_DONE)
        observer?.unobserve(el)
      }
    },
    { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
  )
  return observer
}

export const vReveal: Directive<HTMLElement, number | undefined> = {
  mounted(el, binding) {
    if (prefersReducedMotion()) return
    el.classList.add(REVEAL_PENDING)
    const index = binding.value ?? 0
    if (index > 0) el.style.setProperty(STAGGER_PROP, String(index))
    getObserver().observe(el)
  },
  unmounted(el) {
    observer?.unobserve(el)
  },
}

/** Test seam: inject or clear the shared observer. */
export function __setObserver(next: IntersectionObserver | null): void {
  observer = next
}
