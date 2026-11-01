import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Plus, RefreshCw } from 'lucide-react'

import { supabase } from '../lib/supabase'
import { BillPanel } from './BillPanel'
import { formatMoney, normaliseBill, type RecurringExpense } from './financeTypes'
import { addDaysISO, billingCycleLabel, formatDate, formatINR, todayISO } from './types'
import { Notice, Pill, primaryButton, secondaryButton } from './ui'

type Editing = { kind: 'new' } | { kind: 'edit'; id: string } | null

/** Monthly cost in rupees, for the summary. Null when a foreign-currency bill has no rupee amount yet. */
function monthlyInr(b: RecurringExpense): number | null {
  const inr = b.currency === 'INR' ? b.amount : b.amount_inr
  if (inr === null) return null
  if (b.billing_cycle === 'monthly') return inr
  if (b.billing_cycle === 'quarterly') return inr / 3
  if (b.billing_cycle === 'yearly') return inr / 12
  return 0
}

export function BillsPage() {
  const [bills, setBills] = useState<RecurringExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Editing>(null)
  const [paying, setPaying] = useState<string | null>(null)
  const [flash, setFlash] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('recurring_expenses').select('*').order('next_due_date', { ascending: true, nullsFirst: false })
    if (error) setError(error.message)
    else {
      setError('')
      setBills(((data ?? []) as RecurringExpense[]).map(normaliseBill))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const today = todayISO()
  const in7 = addDaysISO(today, 7)

  const active = bills.filter((b) => b.status === 'active')
  const visible = showInactive ? bills : active
  const summary = useMemo(() => {
    let monthly = 0
    let missing = 0
    for (const b of active) {
      const m = monthlyInr(b)
      if (m === null) missing++
      else monthly += m
    }
    return { monthly, missing, dueWeek: active.filter((b) => b.next_due_date && b.next_due_date <= in7).length }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bills, today])

  const markPaid = async (b: RecurringExpense) => {
    let inr: number | null = null
    if (b.currency !== 'INR') {
      const answer = window.prompt(
        `${b.vendor} bills in ${b.currency} (${formatMoney(b.amount, b.currency)}). How many rupees did your card or bank charge?`,
        b.amount_inr != null ? String(b.amount_inr) : '',
      )
      if (answer === null) return
      const n = Number(answer.replace(/[₹,\s]/g, ''))
      if (!Number.isFinite(n) || n < 0) {
        setFlash('Enter the rupee amount as a number, like 1780.')
        return
      }
      inr = n
    }
    setPaying(b.id)
    setFlash('')
    const { error } = await supabase.rpc('mark_bill_paid', {
      p_bill_id: b.id,
      p_paid_on: today,
      ...(inr !== null ? { p_amount_inr: inr } : {}),
    })
    setPaying(null)
    if (error) {
      setFlash(`The payment wasn't recorded: ${error.message}`)
      return
    }
    setFlash(`Recorded ${b.vendor} as paid today and moved the next due date on. It's in Transactions.`)
    load()
  }

  const editingBill = editing?.kind === 'edit' ? bills.find((b) => b.id === editing.id) ?? null : null

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-5xl font-black leading-none">Bills</h1>
          <p className="mt-2 text-sm text-ink-soft">Subscriptions and services Imagenie pays for. Press Paid when one renews.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading} className={`${secondaryButton} inline-flex items-center gap-1.5`}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden /> Refresh
          </button>
          <button onClick={() => setEditing({ kind: 'new' })} className={`${primaryButton} inline-flex items-center gap-1.5`}>
            <Plus className="h-4 w-4" aria-hidden /> Add bill
          </button>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-1 overflow-hidden rounded-[4px] bg-slip-pink sm:grid-cols-3">
        <div className="px-5 py-4">
          <dt className="text-xs">Spend per month</dt>
          <dd className="mt-1 font-display text-3xl font-black leading-none">{formatINR(summary.monthly)}</dd>
          <dd className="mt-1 text-xs text-ink/60">
            {summary.missing > 0 ? `${summary.missing} foreign-currency bill${summary.missing > 1 ? 's' : ''} not counted yet` : 'Active bills, yearly ones spread per month'}
          </dd>
        </div>
        <div className="border-t-2 border-dashed border-ink/15 px-5 py-4 sm:border-l-2 sm:border-t-0">
          <dt className="text-xs">Active bills</dt>
          <dd className="mt-1 font-display text-3xl font-black leading-none">{active.length}</dd>
        </div>
        <div className="border-t-2 border-dashed border-ink/15 px-5 py-4 sm:border-l-2 sm:border-t-0">
          <dt className="text-xs">Due within 7 days</dt>
          <dd className="mt-1 font-display text-3xl font-black leading-none">{summary.dueWeek}</dd>
        </div>
      </dl>

      {flash && (
        <p role="status" className="mt-4 rounded-[4px] bg-slip-green px-4 py-3 text-sm">
          {flash}
        </p>
      )}

      <div className="mt-6">
        {error ? (
          <Notice tone="error">Bills couldn't be loaded: {error}. Check your connection and press Refresh.</Notice>
        ) : loading && bills.length === 0 ? (
          <Notice>Loading bills…</Notice>
        ) : bills.length === 0 ? (
          <Notice>No bills yet. Add one, or upload a subscription receipt in Transactions and tick "Also add to Bills".</Notice>
        ) : (
          <div className="overflow-hidden rounded-[4px] bg-white shadow-[0_1px_0_rgba(15,42,46,0.06),0_20px_40px_-32px_rgba(15,42,46,0.5)]">
            <ul>
              {visible.map((b) => {
                const overdue = b.status === 'active' && !!b.next_due_date && b.next_due_date < today
                const soon = b.status === 'active' && !!b.next_due_date && b.next_due_date <= in7
                return (
                  <li key={b.id} className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-dashed border-line px-5 py-4 last:border-0">
                    <button onClick={() => setEditing({ kind: 'edit', id: b.id })} className="min-w-0 flex-1 text-left hover:underline hover:underline-offset-4">
                      <span className="block truncate font-bold">
                        {b.vendor}
                        {b.plan && <span className="font-normal text-ink-soft">, {b.plan}</span>}
                      </span>
                      <span className="block text-xs text-ink-soft">
                        {formatMoney(b.amount, b.currency)} {billingCycleLabel[b.billing_cycle].toLowerCase()}
                        {b.currency !== 'INR' && b.amount_inr !== null && ` (about ${formatINR(b.amount_inr)})`}
                        {b.gst_rate > 0 && `, includes ${b.gst_rate}% GST`}
                      </span>
                    </button>
                    <span className={`w-36 text-sm ${overdue ? 'font-bold text-accent-deep' : soon ? 'font-bold' : 'text-ink-soft'}`}>
                      {b.status !== 'active' ? (
                        <Pill tone="muted">{b.status === 'paused' ? 'Paused' : 'Cancelled'}</Pill>
                      ) : b.next_due_date ? (
                        `${overdue ? 'Overdue, ' : 'Due '}${formatDate(b.next_due_date)}`
                      ) : (
                        'No due date'
                      )}
                    </span>
                    {b.status === 'active' && (
                      <button
                        onClick={() => markPaid(b)}
                        disabled={paying !== null}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-ink px-4 py-2 text-sm font-bold text-paper transition-colors duration-150 hover:bg-good disabled:opacity-40"
                      >
                        <Check className="h-4 w-4" aria-hidden /> {paying === b.id ? 'Recording…' : 'Paid'}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}
        {bills.length > active.length && (
          <button onClick={() => setShowInactive((v) => !v)} className="mt-3 text-sm font-bold underline underline-offset-4 hover:text-accent-deep">
            {showInactive ? 'Hide paused and cancelled bills' : `Show ${bills.length - active.length} paused or cancelled`}
          </button>
        )}
      </div>

      {editing && (
        <BillPanel
          key={editing.kind === 'edit' ? editing.id : 'new'}
          bill={editingBill}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setBills((list) => (list.some((x) => x.id === saved.id) ? list.map((x) => (x.id === saved.id ? saved : x)) : [...list, saved]))
            setEditing(null)
          }}
          onDeleted={(id) => {
            setBills((list) => list.filter((x) => x.id !== id))
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
