import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createApp, h, nextTick, withDirectives, type App } from 'vue'
import { vReveal, REVEAL_PENDING, REVEAL_DONE, __setObserver } from '../reveal'

class StubObserver {
  readonly root = null
  readonly rootMargin = ''
  readonly thresholds: readonly number[] = []
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  takeRecords = () => [] as IntersectionObserverEntry[]
  private callback: IntersectionObserverCallback
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
  }
  /** Fire a synthetic intersection for the given element. */
  enter(el: Element) {
    this.callback(
      [{ isIntersecting: true, target: el } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    )
  }
}

let reduced = false
let app: App | null = null
let host: HTMLDivElement | null = null
let observer: StubObserver | null = null

/**
 * Records the observers the directive actually constructs. The callback that adds
 * REVEAL_DONE lives inside the directive's getObserver() closure, so an injected
 * stand-in can never carry it — the intersection test must drive the real
 * instance the directive built via the global stub.
 */
const created: StubObserver[] = []

class RecordingObserver extends StubObserver {
  constructor(callback: IntersectionObserverCallback) {
    super(callback)
    created.push(this)
  }
}

const mountReveal = async (value?: number): Promise<HTMLElement> => {
  host = document.createElement('div')
  document.body.appendChild(host)
  app = createApp({
    // Directives must be applied with withDirectives(); a 'v-reveal' prop in a
    // render function is silently ignored and would make every test pass vacuously.
    render: () => withDirectives(h('div', { class: 'target' }, 'content'), [[vReveal, value]]),
  })
  app.mount(host)
  await nextTick()
  observer = created[created.length - 1] ?? null
  return host.querySelector('.target') as HTMLElement
}

beforeEach(() => {
  reduced = false
  created.length = 0
  vi.stubGlobal('IntersectionObserver', RecordingObserver)
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: reduced,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
})

afterEach(() => {
  app?.unmount()
  host?.remove()
  __setObserver(null)
  app = null
  host = null
  vi.unstubAllGlobals()
})

describe('vReveal', () => {
  it('adds the pending class on mount', async () => {
    const el = await mountReveal()
    expect(el.classList.contains(REVEAL_PENDING)).toBe(true)
  })

  it('does NOT add the pending class when reduced motion is preferred', async () => {
    reduced = true
    const el = await mountReveal()
    expect(el.classList.contains(REVEAL_PENDING)).toBe(false)
  })

  it('adds the revealed class and unobserves on first intersection', async () => {
    const el = await mountReveal()
    expect(el.classList.contains(REVEAL_DONE)).toBe(false)
    observer!.enter(el)
    expect(el.classList.contains(REVEAL_DONE)).toBe(true)
    expect(observer!.unobserve).toHaveBeenCalledWith(el)
  })

  it('sets the stagger custom property from the binding value', async () => {
    const el = await mountReveal(3)
    expect(el.style.getPropertyValue('--stagger-i')).toBe('3')
  })

  it('omits the stagger custom property when the value is zero', async () => {
    const el = await mountReveal(0)
    expect(el.style.getPropertyValue('--stagger-i')).toBe('')
  })
})
