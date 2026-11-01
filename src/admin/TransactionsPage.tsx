import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Paperclip, Plus, RefreshCw, Search } from 'lucide-react'

import { supabase } from '../lib/supabase'
import { TransactionPanel } from './TransactionPanel'
import {
  downloadText,
  fyLabel,
  fyMonths,
  fyRange,
  fyStartYear,
  formatMoney,
  monthLabel,
  normaliseTxn,
  transactionsToCsv,
  type Transaction,
  type TxnKind,
} from './financeTypes'
import { formatDate, formatINR, todayISO } from './types'
import { FilterTabs, Notice, Pill, primaryButton, secondaryButton } from './ui'

type KindFilter = 'all' | TxnKind | 'pending' | 'needs_inr'
type Editing = { kind: 'new'; start: TxnKind } | { kind: 'edit'; id: string } | null

export function TransactionsPage() {
  const currentFy = fyStartYear(todayISO())
  const [fy, setFy] = useState(currentFy)
  const [month, setMonth] = useState<string>('all')
  const [filter, setFilter] = useState<KindFilter>('all')
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Editing>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { from, to } = fyRange(fy)
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .gte('txn_date', from)
      .lte('txn_date', to)
      .order('txn_date', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else {
      setError('')
      setRows(((data ?? []) as Transaction[]).map(normaliseTxn))
    }
    setLoading(false)
  }, [fy])

  useEffect(() => {
    load()
  }, [load])

  const inMonth = useMemo(() => (month === 'all' ? rows : rows.filter((r) => r.txn_date.startsWith(month))), [rows, month])

  const counts = useMemo(() => {
    const c: Record<KindFilter, number> = { all: inMonth.length, income: 0, expense: 0, pending: 0, needs_inr: 0 }
    for (const r of inMonth) {
      c[r.kind]++
      if (r.status === 'pending') c.pending++
      if (r.amount_inr === null) c.needs_inr++
    }
    return c
  }, [inMonth])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return inMonth.filter((r) => {
      if (filter === 'income' || filter === 'expense') {
        if (r.kind !== filter) return false
      } else if (filter === 'pending' && r.status !== 'pending') return false
      else if (filter === 'needs_inr' && r.amount_inr !== null) return false
      if (!q) return true
      return [r.party, r.description, r.category, r.invoice_number, r.notes].some((v) => v?.toLowerCase().includes(q))
    })
  }, [inMonth, filter, query])

  const totals = useMemo(() => {
    let income = 0
    let expense = 0
    for (const r of visible) {
      if (r.amount_inr === null) continue
      if (r.kind === 'income') income += r.amount_inr
      else expense += r.amount_inr
    }
    return { income, expense }
  }, [visible])

  const tabs: { value: KindFilter; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: counts.all },
    { value: 'income', label: 'Money in', count: counts.income },
    { value: 'expense', label: 'Money out', count: counts.expense },
    { value: 'pending', label: 'Not yet paid', count: counts.pending },
    { value: 'needs_inr', label: 'Needs ₹ amount', count: counts.needs_inr },
  ]

  const exportCsv = () => {
    const suffix = month === 'all' ? fyLabel(fy).replace(' ', '-') : month
    downloadText(`imagenie-transactions-${suffix}.csv`, transactionsToCsv([...visible].reverse()))
  }

  const fyOptions = [currentFy + 1, currentFy, currentFy - 1, currentFy - 2]
  const editingTxn = editing?.kind === 'edit' ? rows.find((r) => r.id === editing.id) ?? null : null

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-5xl font-black leading-none">Transactions</h1>
          <p className="mt-2 text-sm text-ink-soft">Every rupee in and out. Upload a receipt and the form fills itself.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setEditing({ kind: 'new', start: 'income' })} className={`${secondaryButton} inline-flex items-center gap-1.5`}>
            <Plus className="h-4 w-4" aria-hidden /> Money in
          </button>
          <button onClick={() => setEditing({ kind: 'new', start: 'expense' })} className={`${primaryButton} inline-flex items-center gap-1.5`}>
            <Paperclip className="h-4 w-4" aria-hidden /> Add expense or receipt
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <label>
          <span className="sr-only">Financial year</span>
          <select
            value={fy}
            onChange={(e) => {
              setFy(Number(e.target.value))
              setMonth('all')
            }}
            className="rounded-full border-2 border-line bg-white px-4 py-2 text-sm font-bold outline-none focus:border-ink"
          >
            {fyOptions.map((y) => (
              <option key={y} value={y}>
                {fyLabel(y)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Month</span>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-full border-2 border-line bg-white px-4 py-2 text-sm outline-none focus:border-ink"
          >
            <option value="all">All months</option>
            {fyMonths(fy).map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </label>
        <button onClick={load} disabled={loading} className={`${secondaryButton} inline-flex items-center gap-1.5`}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden /> Refresh
        </button>
        <button onClick={exportCsv} disabled={visible.length === 0} className={`${secondaryButton} inline-flex items-center gap-1.5`}>
          <Download className="h-4 w-4" aria-hidden /> Export CSV
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <FilterTabs label="Filter transactions" options={tabs} value={filter} onChange={setFilter} />
        <label className="relative block lg:w-72">
          <span className="sr-only">Search transactions</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search party, description, invoice"
            className="w-full rounded-full border-2 border-line bg-white py-2 pl-9 pr-4 text-sm outline-none transition-colors duration-150 focus:border-ink"
          />
        </label>
      </div>

      <div className="mt-6">
        {error ? (
          <Notice tone="error">Transactions couldn't be loaded: {error}. Check your connection and press Refresh.</Notice>
        ) : loading && rows.length === 0 ? (
          <Notice>Loading transactions…</Notice>
        ) : rows.length === 0 ? (
          <Notice>
            Nothing recorded in {fyLabel(fy)} yet. Press "Add expense or receipt" and drop in a receipt to start, or mark a bill or
            subscription as paid.
          </Notice>
        ) : visible.length === 0 ? (
          <Notice>No transactions match this filter.</Notice>
        ) : (
          <div className="overflow-hidden rounded-[4px] bg-white shadow-[0_1px_0_rgba(15,42,46,0.06),0_20px_40px_-32px_rgba(15,42,46,0.5)]">
            <div className="hidden grid-cols-[0.8fr_1.6fr_1.1fr_1fr_0.7fr] gap-4 border-b-2 border-dashed border-line px-5 py-3 text-xs font-bold text-ink-soft md:grid">
              <span>Date</span>
              <span>Party</span>
              <span>Category</span>
              <span className="text-right">Amount</span>
              <span className="text-right">GST</span>
            </div>
            <ul>
              {visible.map((r) => (
                <li key={r.id} className="border-b border-dashed border-line last:border-0">
                  <button
                    onClick={() => setEditing({ kind: 'edit', id: r.id })}
                    className="grid w-full grid-cols-2 gap-x-4 gap-y-1 px-5 py-3.5 text-left transition-colors duration-150 hover:bg-paper md:grid-cols-[0.8fr_1.6fr_1.1fr_1fr_0.7fr] md:items-center"
                  >
                    <span className="text-sm text-ink-soft">{formatDate(r.txn_date)}</span>
                    <span className="col-span-2 min-w-0 md:col-span-1 md:row-auto">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-bold">{r.party}</span>
                        {r.receipt_path && <Paperclip className="h-3.5 w-3.5 shrink-0 text-ink-faint" aria-label="Receipt attached" />}
                        {r.status === 'pending' && <Pill tone="pink">{r.kind === 'income' ? 'Awaiting' : 'To pay'}</Pill>}
                      </span>
                      {r.description && <span className="block truncate text-xs text-ink-soft">{r.description}</span>}
                    </span>
                    <span className="text-sm text-ink-soft">{r.category}</span>
                    <span className={`text-right text-sm font-bold ${r.kind === 'income' ? 'text-good' : 'text-ink'}`}>
                      {r.kind === 'income' ? '+' : '−'}
                      {r.amount_inr !== null ? formatINR(r.amount_inr) : formatMoney(r.amount, r.currency)}
                      {r.amount_inr === null && <span className="block text-xs font-normal text-accent-deep">needs ₹ amount</span>}
                      {r.currency !== 'INR' && r.amount_inr !== null && (
                        <span className="block text-xs font-normal text-ink-faint">{formatMoney(r.amount, r.currency)}</span>
                      )}
                    </span>
                    <span className="text-right text-sm text-ink-soft">{r.tax_amount > 0 ? formatMoney(r.tax_amount, r.currency) : '—'}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap justify-end gap-x-8 gap-y-1 border-t-2 border-dashed border-line bg-paper px-5 py-3 text-sm">
              <span>
                In: <span className="font-bold text-good">{formatINR(totals.income)}</span>
              </span>
              <span>
                Out: <span className="font-bold">{formatINR(totals.expense)}</span>
              </span>
              <span>
                Net: <span className="font-bold">{formatINR(totals.income - totals.expense)}</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {editing && (
        <TransactionPanel
          key={editing.kind === 'edit' ? editing.id : `new-${editing.start}`}
          transaction={editingTxn}
          startKind={editing.kind === 'new' ? editing.start : undefined}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setRows((list) => {
              const others = list.filter((x) => x.id !== saved.id)
              const { from, to } = fyRange(fy)
              const inFy = saved.txn_date >= from && saved.txn_date <= to
              return (inFy ? [saved, ...others] : others).sort((a, b) => (a.txn_date < b.txn_date ? 1 : a.txn_date > b.txn_date ? -1 : 0))
            })
            setEditing(null)
          }}
          onDeleted={(id) => {
            setRows((list) => list.filter((x) => x.id !== id))
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
