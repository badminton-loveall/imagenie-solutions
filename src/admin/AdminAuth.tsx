import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'

import { supabase } from '../lib/supabase'
import type { AdminUser } from './types'

type AuthState =
  | { status: 'loading' }
  | { status: 'signed_out' }
  | { status: 'not_admin'; session: Session }
  | { status: 'admin'; session: Session; admins: AdminUser[]; me: AdminUser }

const AuthContext = createContext<AuthState>({ status: 'loading' })

export function useAdminAuth() {
  return useContext(AuthContext)
}

export async function signOut() {
  await supabase.auth.signOut()
}

/**
 * Tracks the Supabase session and whether its email is on the admin list.
 * The admin list is only readable by admins (row-level security), so an empty
 * result means "signed in, but not an admin".
 */
export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    const resolve = async (session: Session | null) => {
      if (!session) {
        if (!cancelled) setState({ status: 'signed_out' })
        return
      }
      const { data, error } = await supabase.from('admin_users').select('email, name').order('name')
      if (cancelled) return
      const admins = (data ?? []) as AdminUser[]
      const email = (session.user.email ?? '').toLowerCase()
      const me = admins.find((a) => a.email === email)
      if (error || !me) setState({ status: 'not_admin', session })
      else setState({ status: 'admin', session, admins, me })
    }

    supabase.auth.getSession().then(({ data }) => resolve(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      // Defer so Supabase finishes its own state update before we query.
      setTimeout(() => resolve(session), 0)
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}
