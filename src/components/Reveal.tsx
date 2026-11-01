import type { CSSProperties, ReactNode } from 'react'

import { useInView } from '../lib/motion'

type From = 'up' | 'left' | 'right' | 'wipe' | 'print'

type Props = {
  children: ReactNode
  /** Direction the element arrives from. */
  from?: From
  /** Delay in ms, for staggering siblings. */
  delay?: number
  /** Stay shown after the first reveal instead of sliding out again on leave. */
  once?: boolean
  as?: 'div' | 'li' | 'section'
  className?: string
}

/** Slides its content in as it scrolls into view, and out again as it leaves. */
export function Reveal({ children, from = 'up', delay = 0, once = false, as = 'div', className = '' }: Props) {
  const [ref, inView] = useInView<HTMLElement>({ once })
  const Tag = as
  return (
    <Tag
      ref={ref as never}
      data-reveal={from}
      data-in={inView}
      className={`reveal ${className}`}
      style={{ '--reveal-delay': `${delay}ms` } as CSSProperties}
    >
      {children}
    </Tag>
  )
}
