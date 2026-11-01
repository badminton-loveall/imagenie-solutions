import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
      <p className="text-sm text-ink-soft">Page not found</p>
      <h1 className="mt-3 font-display text-7xl font-black leading-[0.88] sm:text-8xl">This token isn't in the queue.</h1>
      <p className="mt-5 max-w-md text-lg text-ink-soft">The page may have moved. Head back to the home page to find what you need.</p>
      <Link
        to="/"
        className="mt-8 inline-flex whitespace-nowrap rounded-full bg-ink px-5 py-3 text-sm font-bold text-paper transition-colors duration-150 hover:bg-accent"
      >
        Go to the home page
      </Link>
    </main>
  )
}
