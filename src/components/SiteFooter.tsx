import { company, products } from '../data/company'

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-paper-deep">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="font-display text-3xl font-black">Imagenie Solutions</p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-soft">
            Simple software and honest video, designed and built in India.
          </p>
        </div>
        <div>
          <p className="text-sm font-bold text-ink">Our products</p>
          <ul className="mt-3 space-y-2 text-sm text-ink-soft">
            {products.map((p) => (
              <li key={p.name}>
                <a href={p.url} target="_blank" rel="noreferrer" className="transition-colors duration-150 hover:text-ink">
                  {p.name} <span className="text-ink-faint">{p.domain}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-sm font-bold text-ink">Reach us</p>
          <ul className="mt-3 space-y-2 text-sm text-ink-soft">
            <li>
              <a href={`mailto:${company.email}`} className="transition-colors duration-150 hover:text-ink">
                {company.email}
              </a>
            </li>
            <li>
              <a href={company.phoneHref} className="transition-colors duration-150 hover:text-ink">
                {company.phone}
              </a>
            </li>
            <li className="pt-1 leading-relaxed text-ink-faint">
              <address className="not-italic">
                {company.addressLines.map((l) => (
                  <span key={l} className="block">
                    {l}
                  </span>
                ))}
              </address>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-5 py-5 text-xs text-ink-faint sm:px-8">
          <span>© {new Date().getFullYear()} Imagenie Solutions</span>
          <span>Made in India</span>
        </div>
      </div>
    </footer>
  )
}
