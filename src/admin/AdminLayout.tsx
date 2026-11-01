import { useEffect, type ReactNode } from 'react'
import { Navigate, NavLink, Outlet } from 'react-router-dom'
import { LogOut } from 'lucide-react'

import { signOut, useAdminAuth } from './AdminAuth'

const nav = [
  { to: '/admin/overview', label: 'Overview' },
  { to: '/admin/leads', label: 'Leads' },
  { to: '/admin/subscriptions', label: 'Customers' },
  { to: '/admin/documents', label: 'Quotes and invoices' },
  { to: '/admin/bills', label: 'Bills' },
  { to: '/admin/transactions', label: 'Transactions' },
  { to: '/admin/settings', label: 'Settings' },
]

/** Keeps search engines out of the admin area. */
function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    const prevTitle = document.title
    document.title = 'Imagenie admin'
    return () => {
      meta.remove()
      document.title = prevTitle
    }
  }, [])
}

/** Guards a page that draws without the admin header, such as the print view. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const auth = useAdminAuth()
  useNoIndex()
  if (auth.status === 'loading') return <p className="p-8 text-ink-soft">Checking your sign-in…</p>
  if (auth.status !== 'admin') return <Navigate to="/admin/login" replace />
  return <>{children}</>
}

export function AdminLayout() {
  const auth = useAdminAuth()
  useNoIndex()

  if (auth.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper text-ink-soft" role="status">
        Checking your sign-in…
      </div>
    )
  }
  if (auth.status !== 'admin') return <Navigate to="/admin/login" replace />

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-20 border-b-2 border-dashed border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-6">
            <span className="font-display text-2xl font-black leading-none">Imagenie</span>
            <nav aria-label="Admin" className="-my-1 flex gap-1 overflow-x-auto py-1">
              {nav.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  className={({ isActive }) =>
                    `whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm transition-colors duration-150 ${
                      isActive ? 'bg-ink font-bold text-paper' : 'text-ink-soft hover:bg-paper-deep hover:text-ink'
                    }`
                  }
                >
                  {n.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-ink-soft sm:inline">{auth.me.name ?? auth.me.email}</span>
            <button
              onClick={signOut}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-line px-3 py-1.5 text-sm font-bold transition-colors duration-150 hover:border-ink"
            >
              <LogOut className="h-4 w-4" aria-hidden /> Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
