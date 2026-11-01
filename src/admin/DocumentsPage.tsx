import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, RefreshCw, Search } from 'lucide-react'

import { supabase } from '../lib/supabase'
import { docKindLabel, docStatusLabel, docStatusesFor, normaliseDoc, type Doc, type DocKind, type DocStatus } from './docTypes'
import { fyRange, fyStartYear } from './financeTypes'
import { formatDate, formatINR, todayISO } from './types'
import { FilterTabs, Notice, Pill, primaryButton, secondaryButton, type PillTone } from './ui'

const tone: Record<DocStatus, PillTone> = { draft: 'muted', sent: 'yellow', accepted: 'green', declined: 'pink', paid: 'green', cancelled: 'muted' }
type Filter = DocStatus | 'all' | 'overdue'

export function DocumentsPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const kind: DocKind = params.get('kind') === 'quotation' ? 'quotation' : 'invoice'
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('kind', kind)
      .order('issue_date', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else {
      setError('')
      setDocs(((data ?? []) as Doc[]).map(normaliseDoc))
    }
    setLoading(false)
  }, [kind])

  useEffect(() => {
    setFilter('all')
    load()
  }, [load])

  const today = todayISO()
  const isOverdue = (d: Doc) => d.kind === 'invoice' && d.status === 'sent' && !!d.due_date && d.due_date < today

  const summary = useMemo(() => {
    const { from, to } = fyRange(fyStartYear(today))
    if (kind === 'invoice') {
      const outstanding = docs.filter((d) => d.status === 'sent')
      return [
        { label: 'Waiting for payment', value: formatINR(outstanding.reduce((s, d) => s + d.total, 0)), note: `${outstanding.length} invoice${outstanding.length === 1 ? '' : 's'}` },
        { label: 'Overdue', value: formatINR(docs.filter(isOverdue).reduce((s, d) => s + d.total, 0)), note: 'Past the due date' },
        {
          label: 'Paid this financial year',
          value: formatINR(docs.filter((d) => d.status === 'paid' && d.issue_date >= from && d.issue_date <= to).reduce((s, d) => s + d.total, 0)),
          note: 'By invoice date',
        },
      ]
    }
    const open = docs.filter((d) => d.status === 'draft' || d.status === 'sent')
    const decided = docs.filter((d) => d.status === 'accepted' || d.status === 'declined')
    const won = docs.filter((d) => d.status === 'accepted')
    return [
      { label: 'Open quotations', value: formatINR(open.reduce((s, d) => s + d.total, 0)), note: `${open.length} draft or sent` },
      { label: 'Accepted', value: formatINR(won.reduce((s, d) => s + d.total, 0)), note: `${won.length} quotation${won.length === 1 ? '' : 's'}` },
      { label: 'Win rate', value: decided.length ? `${Math.round((won.length / decided.length) * 100)}%` : '—', note: 'Accepted out of decided' },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs, kind, today])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return docs.filter((d) => {
      if (filter === 'overdue' && !isOverdue(d)) return false
      if (filter !== 'all' && filter !== 'overdue' && d.status !== filter) return false
      if (!q) return true
      return [d.number, d.customer_name, d.customer_email].some((v) => v?.toLowerCase().includes(q))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs, filter, query, today])

  const tabs: { value: Filter; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: docs.length },
    ...(kind === 'invoice' ? [{ value: 'overdue' as Filter, label: 'Overdue', count: docs.filter(isOverdue).length }] : []),
    ...docStatusesFor[kind].map((s) => ({ value: s as Filter, label: docStatusLabel[s], count: docs.filter((d) => d.status === s).length })),
  ]

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div role="tablist" aria-label="Document type" className="inline-flex rounded-full border-2 border-line bg-white p-1">
            {(['quotation', 'invoice'] as const).map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={kind === k}
                onClick={() => setParams({ kind: k })}
                className={`rounded-full px-4 py-1.5 text-sm transition-colors duration-150 ${kind === k ? 'bg-ink font-bold text-paper' : 'text-ink-soft hover:text-ink'}`}
              >
                {docKindLabel[k].many}
              </button>
            ))}
          </div>
          <h1 className="mt-4 font-display text-5xl font-black leading-none">{docKindLabel[kind].many}</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading} className={`${secondaryButton} inline-flex items-center gap-1.5`}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden /> Refresh
          </button>
          <button onClick={() => navigate(`/admin/documents/new?kind=${kind}`)} className={`${primaryButton} inline-flex items-center gap-1.5`}>
            <Plus className="h-4 w-4" aria-hidden /> New {docKindLabel[kind].one.toLowerCase()}
          </button>
        </div>
      </div>

      <dl className={`mt-6 grid grid-cols-1 overflow-hidden rounded-[4px] sm:grid-cols-3 ${kind === 'invoice' ? 'bg-slip-yellow' : 'bg-slip-green'}`}>
        {summary.map((m, i) => (
          <div key={m.label} className={`px-5 py-4 ${i > 0 ? 'border-t-2 border-dashed border-ink/15 sm:border-l-2 sm:border-t-0' : ''}`}>
            <dt className="text-xs">{m.label}</dt>
            <dd className="mt-1 font-display text-3xl font-black leading-none">{m.value}</dd>
            <dd className="mt-1 text-xs text-ink/60">{m.note}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <FilterTabs label={`Filter ${docKindLabel[kind].many.toLowerCase()}`} options={tabs} value={filter} onChange={setFilter} />
        <label className="relative block lg:w-72">
          <span className="sr-only">Search</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search number or customer"
            className="w-full rounded-full border-2 border-line bg-white py-2 pl-9 pr-4 text-sm outline-none transition-colors duration-150 focus:border-ink"
          />
        </label>
      </div>

      <div className="mt-6">
        {error ? (
          <Notice tone="error">These couldn't be loaded: {error}. Press Refresh to try again.</Notice>
        ) : loading && docs.length === 0 ? (
          <Notice>Loading…</Notice>
        ) : docs.length === 0 ? (
          <Notice>
            No {docKindLabel[kind].many.toLowerCase()} yet. Press "New {docKindLabel[kind].one.toLowerCase()}"
            {kind === 'quotation' ? ', or open a lead and choose Create quotation.' : ', convert an accepted quotation, or open a customer and choose Create invoice.'}
          </Notice>
        ) : visible.length === 0 ? (
          <Notice>Nothing matches this filter.</Notice>
        ) : (
          <div className="overflow-hidden rounded-[4px] bg-white shadow-[0_1px_0_rgba(15,42,46,0.06),0_20px_40px_-32px_rgba(15,42,46,0.5)]">
            <div className="hidden grid-cols-[1fr_1.6fr_0.9fr_0.9fr_0.8fr] gap-4 border-b-2 border-dashed border-line px-5 py-3 text-xs font-bold text-ink-soft md:grid">
              <span>Number</span>
              <span>Customer</span>
              <span>{kind === 'invoice' ? 'Due' : 'Valid until'}</span>
              <span>Status</span>
              <span className="text-right">Total</span>
            </div>
            <ul>
              {visible.map((d) => (
                <li key={d.id} className="border-b border-dashed border-line last:border-0">
                  <button
                    onClick={() => navigate(`/admin/documents/${d.id}`)}
                    className="grid w-full grid-cols-2 gap-x-4 gap-y-1 px-5 py-3.5 text-left transition-colors duration-150 hover:bg-paper md:grid-cols-[1fr_1.6fr_0.9fr_0.9fr_0.8fr] md:items-center"
                  >
                    <span className="text-sm">
                      <span className="block font-bold">{d.number ?? 'Draft'}</span>
                      <span className="text-xs text-ink-soft">{formatDate(d.issue_date)}</span>
                    </span>
                    <span className="truncate text-sm font-bold md:font-normal">{d.customer_name}</span>
                    <span className={`text-sm ${isOverdue(d) ? 'font-bold text-accent-deep' : 'text-ink-soft'}`}>{d.due_date ? formatDate(d.due_date) : '—'}</span>
                    <span>
                      <Pill tone={isOverdue(d) ? 'red' : tone[d.status]}>{isOverdue(d) ? 'Overdue' : docStatusLabel[d.status]}</Pill>
                    </span>
                    <span className="text-right text-sm font-bold">{formatINR(d.total)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
