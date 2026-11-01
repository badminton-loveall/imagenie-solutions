import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import { SiteHeader } from './SiteHeader'
import { SiteFooter } from './SiteFooter'

/** Shared page frame. Scrolls to a #section when the URL has one, otherwise to the top on each page change. */
export function Layout() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1))
      if (el) {
        el.scrollIntoView({ block: 'start' })
        return
      }
    }
    window.scrollTo({ top: 0 })
  }, [pathname, hash])

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
      >
        Skip to content
      </a>
      <SiteHeader />
      <div id="main" className="flex-1">
        <Outlet />
      </div>
      <SiteFooter />
    </div>
  )
}
