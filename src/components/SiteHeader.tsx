import { Link, NavLink } from 'react-router-dom'

const links = [
  { label: 'Products', anchor: 'products' },
  { label: 'Custom apps', anchor: 'custom' },
  { label: 'Studios', anchor: 'studios' },
]

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b-2 border-dashed border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link to="/" className="flex items-baseline gap-2 whitespace-nowrap" aria-label="Imagenie Solutions home">
          <span className="font-display text-3xl font-black leading-none text-ink">Imagenie</span>
          <span className="hidden text-sm text-ink-faint sm:inline">Solutions</span>
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
          {links.map((l) => (
            <Link
              key={l.anchor}
              to={`/#${l.anchor}`}
              className="hidden whitespace-nowrap rounded-md px-3 py-2 text-sm text-ink-soft transition-colors duration-150 hover:text-ink md:inline-block"
            >
              {l.label}
            </Link>
          ))}
          <NavLink
            to="/contact"
            className={({ isActive }) =>
              `ml-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition-colors duration-150 ${
                isActive ? 'bg-ink text-paper' : 'bg-slip-yellow text-ink hover:bg-ink hover:text-paper'
              }`
            }
          >
            Talk to us
          </NavLink>
        </nav>
      </div>
    </header>
  )
}
