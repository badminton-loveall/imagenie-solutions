import { ArrowUpRight } from 'lucide-react'

import type { Product } from '../data/company'
import { useInView } from '../lib/motion'

const tint: Record<Product['name'], string> = {
  Qwait: 'bg-slip-yellow',
  Smrithi: 'bg-slip-pink',
  LoveAll: 'bg-slip-green',
}

/** A product shown as a wide counterfoil ticket: coloured stub, tear line, body. */
export function ProductTicket({ product }: { product: Product }) {
  // Assembles as it scrolls in (stub from the left, body from the right) and comes apart as it leaves.
  const [ref, inView] = useInView<HTMLElement>({ threshold: 0.25 })
  return (
    <article
      ref={ref}
      data-in={inView}
      className="ticket-form grid drop-shadow-[0_18px_22px_rgba(15,42,46,0.14)] md:grid-cols-[minmax(220px,0.8fr)_14px_2fr]"
    >
      <div className={`ticket-stub ${tint[product.name]} flex flex-col justify-between gap-8 rounded-t-[4px] p-6 sm:p-8 md:rounded-l-[4px] md:rounded-tr-none`}>
        <div className="flex items-start justify-between gap-4 text-xs">
          <span>Imagenie Labs</span>
          <span>{product.domain}</span>
        </div>
        <div>
          <h3 className="font-display text-6xl font-black leading-[0.9] tracking-tight sm:text-7xl">{product.name}</h3>
          <p className="mt-3 text-sm leading-snug">{product.line}</p>
        </div>
      </div>

      <div aria-hidden className="ticket-perf perf-y hidden origin-center bg-paper-deep md:block" />
      <div aria-hidden className="ticket-perf perf-x h-3.5 origin-center bg-paper-deep md:hidden" />

      <div className="ticket-body grid gap-8 rounded-b-[4px] bg-white p-6 sm:p-8 md:rounded-r-[4px] md:rounded-bl-none lg:grid-cols-[1.3fr_1fr]">
        <div>
          <p className="text-lg leading-relaxed">{product.pitch}</p>
          <p className="mt-5 text-sm text-ink-soft">
            <span className="font-bold text-ink">Used by </span>
            {product.forWho.toLowerCase()}.
          </p>
        </div>
        <div className="flex flex-col justify-between gap-6">
          <ul className="space-y-3 text-sm">
            {product.features.map((f) => (
              <li key={f} className="flex gap-3 border-b border-dashed border-line pb-3 last:border-0">
                <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
                {f}
              </li>
            ))}
          </ul>
          <a
            href={product.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full bg-ink px-4 py-2.5 text-sm font-bold text-paper transition-colors duration-150 hover:bg-accent"
          >
            Open {product.domain} <ArrowUpRight className="h-4 w-4" aria-hidden />
          </a>
        </div>
      </div>
    </article>
  )
}
