import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { supabase } from '../lib/supabase'
import {
  fyLabel,
  fyMonths,
  fyRange,
  fyStartYear,
  gstInr,
  monthLabel,
  normaliseBill,
  normaliseTxn,
  type BusinessSettings,
  type RecurringExpense,
  type Transaction,
} from './financeTypes'
import { addDaysISO, formatDate, formatINR, todayISO, type Subscription } from './types'
import { Notice } from './ui'

type Upcoming = { id: string; date: string; label: string; detail: string; kind: 'in' | 'out'; to: string }

export function OverviewPage() {
  const today = todayISO()
  const currentFy = fyStartYear(today)
  const [fy, setFy] = useState(currentFy)
  const [txns, setTxns] = useState<Transaction[]>([])
  const [settings, setSettings] = useState<BusinessSettings | null>(null)
  const [upcoming, setUpcoming] = useState<Upcoming[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { from, to } = fyRange(fy)
    const in30 = addDaysISO(today, 30)
    const [t, s, bills, subs] = await Promise.all([
      supabase.from('transactions').select('*').gte('txn_date', from).lte('txn_date', to),
      supabase.from('business_settings').select('*').maybeSingle(),
      supabase.from('recurring_expenses').select('*').eq('status', 'active').lte('next_due_date', in30),
      supabase.from('subscriptions').select('*').in('status', ['active', 'trial', 'past_due']).lte('renewal_date', in30),
    ])
    const firstError = t.error ?? s.error ?? bills.error ?? subs.error
    if (firstError) {
      setError(firstError.message)
      setLoading(false)
      return
    }
    setError('')
    setTxns(((t.data ?? []) as Transaction[]).map(normaliseTxn))
    setSettings(s.data as BusinessSettings | null)
    const items: Upcoming[] = [
      ...((bills.data ?? []) as RecurringExpense[]).map(normaliseBill).map((b) => ({
        id: `b-${b.id}`,
        date: b.next_due_date!,
        label: b.vendor + (b.plan ? `, ${b.plan}` : ''),
        detail: b.currency === 'INR' ? formatINR(b.amount) : `${b.currency} ${b.amount}`,
        kind: 'out' as const,
        to: '/admin/bills',
      })),
      ...((subs.data ?? []) as Subscription[]).map((x) => ({
        id: `s-${x.id}`,
        date: x.renewal_date!,
        label: `${x.customer}, ${x.product}`,
        detail: formatINR(Number(x.amount_inr)),
        kind: 'in' as const,
        to: '/admin/subscriptions',
      })),
    ].sort((a, b) => (a.date < b.date ? -1 : 1))
    setUpcoming(items)
    setLoading(false)
  }, [fy, today])

  useEffect(() => {
    load()
  }, [load])

  const stats = useMemo(() => {
    const paid = txns.filter((t) => t.status === 'paid')
    let income = 0
    let expense = 0
    let gstOut = 0 // collected on sales
    let gstIn = 0 // paid on purchases
    let missingInr = 0
    for (const t of paid) {
      if (t.amount_inr === null) {
        missingInr++
        continue
      }
      const g = gstInr(t) ?? 0
      if (t.kind === 'income') {
        income += t.amount_inr
        gstOut += g
      } else {
        expense += t.amount_inr
        gstIn += g
      }
    }
    const pendingIn = txns.filter((t) => t.status === 'pending' && t.kind === 'income').reduce((s, t) => s + (t.amount_inr ?? 0), 0)
    const pendingOut = txns.filter((t) => t.status === 'pending' && t.kind === 'expense').reduce((s, t) => s + (t.amount_inr ?? 0), 0)

    const months = fyMonths(fy).map((m) => {
      let inc = 0
      let exp = 0
      for (const t of paid) {
        if (!t.txn_date.startsWith(m) || t.amount_inr === null) continue
        if (t.kind === 'income') inc += t.amount_inr
        else exp += t.amount_inr
      }
      return { month: m, income: inc, expense: exp }
    })

    const byCategory = new Map<string, number>()
    for (const t of paid) {
      if (t.kind !== 'expense' || t.amount_inr === null) continue
      byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount_inr)
    }
    const categories = [...byCategory.entries()].sort((a, b) => b[1] - a[1])

    return { income, expense, gstOut, gstIn, missingInr, pendingIn, pendingOut, months, categories }
  }, [txns, fy])

  const registered = !!settings?.gstin
  const fyOptions = [currentFy + 1, currentFy, currentFy - 1, currentFy - 2]
  const thisMonth = today.slice(0, 7)

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-5xl font-black leading-none">Overview</h1>
          <p className="mt-2 text-sm text-ink-soft">Income, spending and GST for the financial year (April to March).</p>
        </div>
        <label>
          <span className="sr-only">Financial year</span>
          <select
            value={fy}
            onChange={(e) => setFy(Number(e.target.value))}
            className="rounded-full border-2 border-line bg-white px-4 py-2 text-sm font-bold outline-none focus:border-ink"
          >
            {fyOptions.map((y) => (
              <option key={y} value={y}>
                {fyLabel(y)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <div className="mt-6">
          <Notice tone="error">The overview couldn't be loaded: {error}.</Notice>
        </div>
      ) : (
        <>
          {/* Headline numbers */}
          <dl className="mt-6 grid grid-cols-1 overflow-hidden rounded-[4px] bg-white shadow-[0_1px_0_rgba(15,42,46,0.06),0_20px_40px_-32px_rgba(15,42,46,0.5)] sm:grid-cols-3">
            <div className="bg-slip-green px-6 py-5">
              <dt className="text-sm">Money in</dt>
              <dd className="mt-1 font-display text-5xl font-black leading-none">{formatINR(stats.income)}</dd>
              <dd className="mt-2 text-xs text-ink/60">
                {stats.pendingIn > 0 ? `${formatINR(stats.pendingIn)} more awaiting payment` : 'Received this financial year'}
              </dd>
            </div>
            <div className="bg-slip-pink px-6 py-5">
              <dt className="text-sm">Money out</dt>
              <dd className="mt-1 font-display text-5xl font-black leading-none">{formatINR(stats.expense)}</dd>
              <dd className="mt-2 text-xs text-ink/60">{stats.pendingOut > 0 ? `${formatINR(stats.pendingOut)} more still to pay` : 'Paid this financial year'}</dd>
            </div>
            <div className="bg-slip-yellow px-6 py-5">
              <dt className="text-sm">{stats.income - stats.expense >= 0 ? 'Profit' : 'Loss'}</dt>
              <dd className="mt-1 font-display text-5xl font-black leading-none">{formatINR(Math.abs(stats.income - stats.expense))}</dd>
              <dd className="mt-2 text-xs text-ink/60">Money in minus money out, before income tax</dd>
            </div>
          </dl>

          {stats.missingInr > 0 && (
            <p className="mt-3 text-sm text-accent-deep">
              {stats.missingInr} foreign-currency payment{stats.missingInr > 1 ? 's are' : ' is'} left out until you add the rupee amount.{' '}
              <Link to="/admin/transactions" className="font-bold underline underline-offset-4">
                Fix in Transactions
              </Link>
            </p>
          )}

          <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
            {/* Month by month */}
            <section>
              <h2 className="font-display text-3xl font-extrabold">Month by month</h2>
              <div className="mt-4 overflow-x-auto rounded-[4px] bg-white">
                <table className="w-full min-w-[420px] text-sm">
                  <thead>
                    <tr className="border-b-2 border-dashed border-line text-left text-xs text-ink-soft">
                      <th className="px-4 py-2.5 font-bold">Month</th>
                      <th className="px-4 py-2.5 text-right font-bold">In</th>
                      <th className="px-4 py-2.5 text-right font-bold">Out</th>
                      <th className="px-4 py-2.5 text-right font-bold">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.months.map((m) => {
                      const future = m.month > thisMonth
                      const net = m.income - m.expense
                      return (
                        <tr key={m.month} className={`border-b border-dashed border-line last:border-0 ${future ? 'text-ink-faint' : ''} ${m.month === thisMonth ? 'bg-paper' : ''}`}>
                          <td className="px-4 py-2.5">{monthLabel(m.month)}</td>
                          <td className="px-4 py-2.5 text-right">{m.income ? formatINR(m.income) : '—'}</td>
                          <td className="px-4 py-2.5 text-right">{m.expense ? formatINR(m.expense) : '—'}</td>
                          <td className={`px-4 py-2.5 text-right font-bold ${!future && net < 0 ? 'text-accent-deep' : ''}`}>
                            {m.income || m.expense ? formatINR(net) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="space-y-8">
              {/* GST */}
              <section>
                <h2 className="font-display text-3xl font-extrabold">GST</h2>
                <div className="mt-4 rounded-[4px] bg-white p-5 text-sm">
                  <div className="flex justify-between border-b border-dashed border-line pb-2.5">
                    <span>Paid on purchases</span>
                    <span className="font-bold">{formatINR(stats.gstIn)}</span>
                  </div>
                  <div className="flex justify-between border-b border-dashed border-line py-2.5">
                    <span>Collected on sales</span>
                    <span className="font-bold">{formatINR(stats.gstOut)}</span>
                  </div>
                  {registered ? (
                    <div className="flex justify-between pt-2.5">
                      <span>{stats.gstOut - stats.gstIn >= 0 ? 'Payable (collected minus paid)' : 'Credit to carry forward'}</span>
                      <span className="font-bold">{formatINR(Math.abs(stats.gstOut - stats.gstIn))}</span>
                    </div>
                  ) : (
                    <p className="pt-2.5 leading-relaxed text-ink-soft">
                      Not GST-registered yet, so no GST is charged on sales. When your GSTIN arrives,{' '}
                      <Link to="/admin/settings" className="font-bold text-ink underline underline-offset-4">
                        add it in Settings
                      </Link>{' '}
                      to see what's payable. Ask your accountant which purchase GST you can claim.
                    </p>
                  )}
                </div>
              </section>

              {/* Coming up */}
              <section>
                <h2 className="font-display text-3xl font-extrabold">Next 30 days</h2>
                <div className="mt-4 rounded-[4px] bg-white">
                  {loading && upcoming.length === 0 ? (
                    <p className="p-5 text-sm text-ink-soft">Loading…</p>
                  ) : upcoming.length === 0 ? (
                    <p className="p-5 text-sm text-ink-soft">No bills or customer renewals due.</p>
                  ) : (
                    <ul>
                      {upcoming.map((u) => (
                        <li key={u.id} className="border-b border-dashed border-line last:border-0">
                          <Link to={u.to} className="flex items-baseline justify-between gap-4 px-5 py-3 text-sm hover:bg-paper">
                            <span className="min-w-0">
                              <span className={`block truncate font-bold ${u.date < today ? 'text-accent-deep' : ''}`}>{u.label}</span>
                              <span className="text-xs text-ink-soft">
                                {u.kind === 'in' ? 'Customer renews' : 'Bill due'} {formatDate(u.date)}
                                {u.date < today ? ', overdue' : ''}
                              </span>
                            </span>
                            <span className={`whitespace-nowrap font-bold ${u.kind === 'in' ? 'text-good' : ''}`}>
                              {u.kind === 'in' ? '+' : '−'}
                              {u.detail}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>

              {/* Spending by category */}
              {stats.categories.length > 0 && (
                <section>
                  <h2 className="font-display text-3xl font-extrabold">Where money went</h2>
                  <ul className="mt-4 rounded-[4px] bg-white p-5 text-sm">
                    {stats.categories.map(([cat, amt]) => (
                      <li key={cat} className="flex justify-between border-b border-dashed border-line py-2 first:pt-0 last:border-0 last:pb-0">
                        <span>{cat}</span>
                        <span className="font-bold">{formatINR(amt)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
