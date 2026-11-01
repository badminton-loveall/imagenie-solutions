import { useState } from 'react'

const PHOTO = 'https://cdn.magicpatterns.com/patterns/generated-images/3d541b85-d27e-46a9-beef-e18cbdeb4484.jpg'

const frames = ['Brand film', 'Product demo', 'Interview', 'Event']

/**
 * The Studios photo. If it can't load (offline, blocked, moved), a film-strip slip in the
 * site's own style takes its place, so the section never shows an empty box.
 */
export function StudioVisual() {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div
        role="img"
        aria-label="A film strip with four frames: brand film, product demo, interview and event"
        className="relative aspect-[4/3] w-full overflow-hidden rounded-[4px] bg-ink p-[6%] text-paper"
      >
        <div aria-hidden className="absolute inset-x-0 top-0 h-[7%] bg-[radial-gradient(circle,var(--color-paper)_28%,transparent_32%)] bg-[length:28px_100%] bg-repeat-x opacity-80" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[7%] bg-[radial-gradient(circle,var(--color-paper)_28%,transparent_32%)] bg-[length:28px_100%] bg-repeat-x opacity-80" />
        <div className="grid h-full grid-cols-2 gap-[4%] py-[3%]">
          {frames.map((f, i) => (
            <div
              key={f}
              className={`flex items-end rounded-[3px] p-3 ${['bg-slip-yellow', 'bg-slip-pink', 'bg-slip-green', 'bg-paper'][i]} text-ink`}
            >
              <span className="font-display text-xl font-black leading-none sm:text-2xl">{f}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <img
      src={PHOTO}
      alt="Imagenie Studios crew filming an interview in a carpentry workshop"
      width={1200}
      height={900}
      decoding="async"
      onError={() => setFailed(true)}
      className="aspect-[4/3] w-full rounded-[4px] bg-paper-deep object-cover"
    />
  )
}
