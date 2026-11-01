import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { MailCheck } from 'lucide-react'

import { supabase } from '../lib/supabase'
import { signOut, useAdminAuth } from './AdminAuth'

export function AdminLogin() {
  const auth = useAdminAuth()
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')

  if (auth.status === 'admin') return <Navigate to="/admin/overview" replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setState('sending')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/admin/leads` },
    })
    if (error) {
      setError(
        error.status === 429
          ? 'Too many sign-in emails were sent. Wait a few minutes, then try again.'
          : `The sign-in email didn't send: ${error.message}`,
      )
      setState('error')
    } else {
      setState('sent')
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-5 py-12 text-ink">
      <div className="w-full max-w-md">
        <p className="font-display text-3xl font-black leading-none">Imagenie</p>
        <p className="mt-1 text-sm text-ink-soft">Leads and subscriptions</p>

        <div className="mt-8 overflow-hidden rounded-[4px] bg-white shadow-[0_20px_40px_-28px_rgba(15,42,46,0.5)]">
          <div className="bg-slip-yellow px-6 py-5">
            <h1 className="font-display text-4xl font-black leading-none">Sign in</h1>
          </div>
          <div aria-hidden className="perf-x h-3.5 bg-paper-deep" />

          <div className="p-6">
            {auth.status === 'not_admin' ? (
              <div role="alert">
                <p className="font-bold">{auth.session.user.email} doesn't have admin access.</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  Only approved Imagenie team emails can open this area. Ask an existing admin to add you, or sign in with a
                  different email.
                </p>
                <button
                  onClick={signOut}
                  className="mt-5 whitespace-nowrap rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-paper transition-colors duration-150 hover:bg-accent"
                >
                  Sign out
                </button>
              </div>
            ) : state === 'sent' ? (
              <div role="status">
                <MailCheck className="h-8 w-8 text-good" aria-hidden />
                <p className="mt-3 font-bold">Check your email.</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  We sent a sign-in link to {email.trim().toLowerCase()}. Open it on this device to continue. The link
                  works once and expires after an hour.
                </p>
                <button
                  onClick={() => setState('idle')}
                  className="mt-5 text-sm font-bold underline underline-offset-4 hover:text-accent-deep"
                >
                  Use a different email
                </button>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-5">
                <label className="block">
                  <span className="text-sm font-bold">Work email</span>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    autoFocus
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (state === 'error') setState('idle')
                    }}
                    className="mt-2 w-full rounded-[4px] border-2 border-line bg-white px-4 py-3 text-base outline-none transition-colors duration-150 focus:border-ink"
                  />
                </label>
                {state === 'error' && (
                  <p role="alert" className="text-sm text-accent-deep">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={state === 'sending' || !email.trim()}
                  className="w-full whitespace-nowrap rounded-full bg-ink px-5 py-3 text-sm font-bold text-paper transition-colors duration-150 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {state === 'sending' ? 'Sending link…' : 'Email me a sign-in link'}
                </button>
                <p className="text-xs leading-relaxed text-ink-faint">No password needed. We'll email you a one-time link.</p>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
