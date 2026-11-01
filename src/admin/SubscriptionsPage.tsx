import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus, RefreshCw, Search } from 'lucide-react'

import { supabase } from '../lib/supabase'
import { SubscriptionPanel } from './SubscriptionPanel'
import {
  addDaysISO,
  billingCycleLabel,
  formatDate,
  formatINR,
  monthlyValue,
  subscriptionProducts,
  subscriptionStatusLabel,
  subscriptionStatuses,
  todayISO,
  type Lead,
  type Subscription,
  type SubscriptionProduct,
  type SubscriptionStatus,
} from './types'
import { FilterTabs, Notice, Pill, primaryButton, type PillTone } from './ui'

const statusTone: Record<SubscriptionStatus, PillTone> = {
  trial: 'yellow',
  active: 'green',
  past_due: 'red',
  cancelled: 'muted',
  expired: 'muted',
}

type Filter = SubscriptionStatus | 'all' | 'renewing'
type Editing = { kind: 'new'; fromLead: Lead | null } | { kind: 'edit'; id: string } | null

export function SubscriptionsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [subs, setSubs] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [product, setProduct] = useState<SubscriptionProduct | 'all'>('all')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Editing>(null)

  // Arriving from a lead's "Add as subscription" opens the form prefilled.
  useEffect(() => {
    const fromLead = (location.state as { fromLead?: Lead } | null)?.fromLead
    if (fromLead) {
      setEditing({ kind: 'new', fromLead })
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location, navigate])

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('subscriptions').select('*').order('renewal_date', { ascending: true, nullsFirst: false })
    if (error) setError(error.message)
    else {
      setError('')
      setSubs(((data ?? []) as Subscription[]).map((s) => ({ ...s, amount_inr: Number(s.amount_inr) })))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const today = todayISO()
  const in30 = addDaysISO(today, 30)
  const isLive = (s: Subscription) => s.status === 'active' || s.status === 'trial' || s.status === 'past_due'
  const renewsSoon = (s: Subscription) => isLive(s) && !!s.renewal_date && s.renewal_date <= in30
  const isOverdue = (s: Subscription) => isLive(s) && !!s.renewal_date && s.renewal_date < today

  const summary = useMemo(() => {
    const active = subs.filter((s) => s.status === 'active')
    return {
      mrr: active.reduce((sum, s) => sum + monthlyValue(s), 0),
      active: active.length,
      trials: subs.filter((s) => s.status === 'trial').length,
      renewing: subs.filter(renewsSoon).length,
      pastDue: subs.filter((s) => s.status === 'past_due').length,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subs, today])

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: subs.length, renewing: 0, trial: 0, active: 0, past_due: 0, cancelled: 0, expired: 0 }
    for (const s of subs) {
      c[s.status]++
      if (renewsSoon(s)) c.renewing++
    }
    return c
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subs, today])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return subs.filter((s) => {
      if (filter === 'renewing' && !renewsSoon(s)) return false
      if (filter !== 'all' && filter !== 'renewing' && s.status !== filter) return false
      if (product !== 'all' && s.product !== product) return false
      if (!q) return true
      return [s.customer, s.contact_name, s.contact_email, s.plan].some((v) => v?.toLowerCase().includes(q))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subs, filter, product, query, today])

  const tabs: { value: Filter; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: counts.all },
    { value: 'renewing', label: 'Renewing in 30 days', count: counts.renewing },
    ...subscriptionStatuses.map((s) => ({ value: s as Filter, label: subscriptionStatusLabel[s], count: counts[s] })),
  ]

  const editingSub = editing?.kind === 'edit' ? subs.find((s) => s.id === editing.id) ?? null : null

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-5xl font-black leading-none">Subscriptions</h1>
          <p className="mt-2 text-sm text-ink-soft">Who pays for what, and when it renews.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-line px-3 py-1.5 text-sm font-bold transition-colors duration-150 hover:border-ink disabled:opacity-40"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden /> Refresh
          </button>
          <button onClick={() => setEditing({ kind: 'new', fromLead: null })} className={`${primaryButton} inline-flex items-center gap-1.5`}>
            <Plus className="h-4 w-4" aria-hidden /> Add subscription
          </button>
        </div>
      </div>

      {/* Summary as a receipt strip */}
      <dl className="mt-6 grid grid-cols-2 overflow-hidden rounded-[4px] bg-slip-yellow sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: 'Monthly recurring revenue', value: formatINR(summary.mrr), note: 'Active plans, per month' },
          { label: 'Active', value: String(summary.active), note: 'Paying customers' },
          { label: 'On trial', value: String(summary.trials), note: 'Not paying yet' },
          { label: 'Renewing in 30 days', value: String(summary.renewing), note: 'Including overdue' },
          { label: 'Past due', value: String(summary.pastDue), note: 'Payment missed' },
        ].map((m, i) => (
          <div key={m.label} className={`px-5 py-4 ${i > 0 ? 'border-l-2 border-dashed border-ink/15' : ''}`}>
            <dt className="text-xs">{m.label}</dt>
            <dd className="mt-1 font-display text-3xl font-black leading-none">{m.value}</dd>
            <dd className="mt-1 text-xs text-ink/60">{m.note}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <FilterTabs label="Filter subscriptions" options={tabs} value={filter} onChange={setFilter} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="block">
            <span className="sr-only">Product</span>
            <select
              value={product}
              onChange={(e) => setProduct(e.target.value as SubscriptionProduct | 'all')}
              className="w-full rounded-full border-2 border-line bg-white px-4 py-2 text-sm outline-none focus:border-ink"
            >
              <option value="all">All products</option>
              {subscriptionProducts.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="relative block sm:w-64">
            <span className="sr-only">Search subscriptions</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search customer, contact, plan"
              className="w-full rounded-full border-2 border-line bg-white py-2 pl-9 pr-4 text-sm outline-none transition-colors duration-150 focus:border-ink"
            />
          </label>
        </div>
      </div>

      <div className="mt-6">
        {error ? (
          <Notice tone="error">Subscriptions couldn't be loaded: {error}. Check your connection and press Refresh.</Notice>
        ) : loading && subs.length === 0 ? (
          <Notice>Loading subscriptions…</Notice>
        ) : subs.length === 0 ? (
          <Notice>
            No subscriptions yet. Press Add subscription, or open a lead and choose Add as subscription when they sign up.
          </Notice>
        ) : visible.length === 0 ? (
          <Notice>No subscriptions match this filter.</Notice>
        ) : (
          <div className="overflow-hidden rounded-[4px] bg-white shadow-[0_1px_0_rgba(15,42,46,0.06),0_20px_40px_-32px_rgba(15,42,46,0.5)]">
            <div className="hidden grid-cols-[1.5fr_1.1fr_1fr_0.8fr_1fr] gap-4 border-b-2 border-dashed border-line px-5 py-3 text-xs font-bold text-ink-soft md:grid">
              <span>Customer</span>
              <span>Product</span>
              <span>Amount</span>
              <span>Status</span>
              <span>Renews</span>
            </div>
            <ul>
              {visible.map((s) => (
                <li key={s.id} className="border-b border-dashed border-line last:border-0">
                  <button
                    onClick={() => setEditing({ kind: 'edit', id: s.id })}
                    className="grid w-full gap-x-4 gap-y-1.5 px-5 py-4 text-left transition-colors duration-150 hover:bg-paper md:grid-cols-[1.5fr_1.1fr_1fr_0.8fr_1fr] md:items-center"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{s.customer}</span>
                      <span className="block truncate text-xs text-ink-soft">{s.contact_name ?? s.contact_email ?? 'No contact saved'}</span>
                    </span>
                    <span className="text-sm">
                      {s.product}
                      {s.plan && <span className="text-ink-soft">, {s.plan}</span>}
                    </span>
                    <span className="text-sm">
                      {formatINR(s.amount_inr)} <span className="text-ink-soft">{billingCycleLabel[s.billing_cycle].toLowerCase()}</span>
                    </span>
                    <span>
                      <Pill tone={statusTone[s.status]}>{subscriptionStatusLabel[s.status]}</Pill>
                    </span>
                    <span
                      className={`text-sm ${isOverdue(s) ? 'font-bold text-accent-deep' : renewsSoon(s) ? 'font-bold text-ink' : 'text-ink-soft'}`}
                    >
                      {s.renewal_date ? `${isOverdue(s) ? 'Overdue, ' : ''}${formatDate(s.renewal_date)}` : <span className="text-ink-faint">No date</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {editing && (
        <SubscriptionPanel
          key={editing.kind === 'edit' ? editing.id : 'new'}
          subscription={editingSub}
          fromLead={editing.kind === 'new' ? editing.fromLead : null}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            const row = { ...saved, amount_inr: Number(saved.amount_inr) }
            setSubs((list) => (list.some((x) => x.id === row.id) ? list.map((x) => (x.id === row.id ? row : x)) : [row, ...list]))
            setEditing(null)
          }}
          onDeleted={(id) => {
            setSubs((list) => list.filter((x) => x.id !== id))
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
