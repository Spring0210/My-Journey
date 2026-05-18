import { useEffect, useRef } from 'react'

// IntersectionObserver hook — adds 'is-visible' class when the element
// enters the viewport. Triggers once, then unobserves. Pairs with the
// .fade-up CSS class declared in LandingPage.css.
//
// Usage:
//   const ref = useFadeInOnScroll<HTMLDivElement>(150) // delay in ms
//   <div ref={ref} className="fade-up">...</div>
export function useFadeInOnScroll<T extends HTMLElement>(delayMs = 0) {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (delayMs > 0) {
            setTimeout(() => el.classList.add('is-visible'), delayMs)
          } else {
            el.classList.add('is-visible')
          }
          observer.unobserve(el)
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [delayMs])

  return ref
}
