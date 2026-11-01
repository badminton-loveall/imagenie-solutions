import { useEffect, useRef, useState, type RefObject } from 'react'

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/**
 * True while the element is on screen. With `once`, it stays true after the first time,
 * otherwise it flips back so things can slide out again as they leave.
 */
export function useInView<T extends Element>(options: { once?: boolean; threshold?: number; rootMargin?: string } = {}) {
  const { once = false, threshold = 0.2, rootMargin = '0px 0px -8% 0px' } = options
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(() => prefersReducedMotion())

  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          if (once) io.disconnect()
        } else if (!once) {
          setInView(false)
        }
      },
      { threshold, rootMargin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [once, threshold, rootMargin])

  return [ref, inView] as const
}

/**
 * Writes how far the page has scrolled past the element, 0 at the top of the page to 1 when
 * the element has scrolled out, into the CSS variable `--scroll` on that element. Runs once
 * per frame and never re-renders React.
 */
export function useScrollProgress<T extends HTMLElement>(): RefObject<T> {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return
    let frame = 0
    const update = () => {
      frame = 0
      const rect = el.getBoundingClientRect()
      const travel = rect.height + Math.max(rect.top + window.scrollY, 0)
      const progress = Math.min(Math.max(window.scrollY / Math.max(travel, 1), 0), 1)
      el.style.setProperty('--scroll', progress.toFixed(4))
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return ref as RefObject<T>
}
