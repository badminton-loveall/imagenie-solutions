import type { CSSProperties, ReactNode } from 'react'
import { ScanFace } from 'lucide-react'

type SlipProps = {
  className: string
  rotate: string
  from: string
  delay: string
  children: ReactNode
}

function Slip({ className, rotate, from, delay, children }: SlipProps) {
  const style = { '--r': rotate, '--r-from': from, animationDelay: delay } as CSSProperties
  return (
    <div
      className={`slip-drop relative overflow-hidden rounded-[3px] text-ink shadow-[0_1px_0_rgba(15,42,46,0.08),0_18px_30px_-18px_rgba(15,42,46,0.45)] ${className}`}
      style={style}
    >
      {children}
    </div>
  )
}

function Perf() {
  return <div aria-hidden className="perf-x h-3.5 w-full bg-ink/10" />
}

const thumbs = ['#c9a98d', '#a98a70', '#e2cdb5', '#8f7560', '#d6bb9f', '#efe0cc', '#b49477', '#cbb197']

/** Three printed slips, one per product, stacked as they would land on a counter. Decorative. */
export function HeroSlips() {
  return (
    <div
      role="img"
      aria-label="A Qwait token A-23, a Smrithi photo slip showing 38 photos found, and a LoveAll fee receipt stamped paid"
      className="relative mx-auto h-[460px] w-full max-w-[440px] sm:h-[500px]"
    >
      {/* Qwait token */}
      <Slip className="absolute left-0 top-0 w-[68%] bg-slip-yellow" rotate="-4deg" from="-9deg" delay="80ms">
        <div className="px-5 pb-3 pt-4">
          <p className="text-xs">City Clinic, OPD with Dr. Menon</p>
          <p className="mt-1 text-xs text-ink/60">Morning session</p>
        </div>
        <Perf />
        <div className="px-5 pb-5 pt-3">
          <p className="text-xs">Your token</p>
          <p className="font-display text-[5.5rem] font-black leading-[0.85] tracking-tight">A-23</p>
          <div className="mt-3 flex justify-between text-sm">
            <span>Now serving A-19</span>
            <span className="font-bold">4 ahead</span>
          </div>
          <p className="mt-3 border-t border-dashed border-ink/30 pt-2 text-[11px] text-ink/60">qwait.in</p>
        </div>
      </Slip>

      {/* Smrithi photo slip */}
      <Slip className="absolute right-0 top-[22%] w-[62%] bg-slip-pink" rotate="5deg" from="12deg" delay="240ms">
        <div className="flex items-center justify-between px-4 pb-3 pt-4">
          <p className="text-xs font-bold">Meera &amp; Arjun's wedding</p>
          <ScanFace className="h-4 w-4" aria-hidden />
        </div>
        <Perf />
        <div className="px-4 pb-4 pt-3">
          <p className="font-display text-4xl font-extrabold leading-none">38 of you</p>
          <p className="mt-1 text-xs text-ink/70">found in 3,104 photos from one selfie</p>
          <div className="mt-3 grid grid-cols-4 gap-1">
            {thumbs.map((c) => (
              <div key={c} className="aspect-square rounded-[2px]" style={{ background: c }} />
            ))}
          </div>
          <p className="mt-3 border-t border-dashed border-ink/30 pt-2 text-[11px] text-ink/60">smrithi.in</p>
        </div>
      </Slip>

      {/* LoveAll fee receipt with a PAID stamp */}
      <Slip className="absolute bottom-0 left-[10%] w-[64%] bg-slip-green" rotate="-1.5deg" from="4deg" delay="400ms">
        <div className="px-5 pb-3 pt-4">
          <p className="text-xs font-bold">Smash Point Academy</p>
          <p className="text-xs text-ink/60">Fee receipt, November batch</p>
        </div>
        <Perf />
        <div className="relative px-5 pb-5 pt-3 text-sm">
          <div className="flex justify-between">
            <span>Aditya K., U-13</span>
            <span>8 sessions</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span>Paid by UPI</span>
            <span className="font-bold">₹2,500</span>
          </div>
          <p className="mt-3 border-t border-dashed border-ink/30 pt-2 text-[11px] text-ink/60">loveall.co.in</p>
          <span
            aria-hidden
            className="absolute right-4 top-1 rotate-[-14deg] rounded-[4px] border-[3px] border-accent px-2 font-display text-3xl font-black leading-tight text-accent opacity-90 mix-blend-multiply"
          >
            PAID
          </span>
        </div>
      </Slip>
    </div>
  )
}
