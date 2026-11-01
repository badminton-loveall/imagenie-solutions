import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, Search } from 'lucide-react'

import { supabase } from '../lib/supabase'
import { LeadPanel } from './LeadPanel'
import { formatDate, formatDateTime, leadStatusLabel, leadStatuses, todayISO, type Lead, type LeadStatus } from './types'
import { FilterTabs, Notice, Pill, type PillTone } from './ui'

const statusTone: Record<LeadStatus, PillTone> = {
  new: 'yellow',
  contacted: 'pink',
  qualified: 'ink',
  won: 'green',
  lost: 'muted',
}

type Filter = LeadStatus | 'all' | 'due'

export function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false })
    if (error) setError(error.message)
    else {
      setError('')
      setLeads((data ?? []) as Lead[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const today = todayISO()
  const isDue = (l: Lead) => !!l.follow_up_on && l.follow_up_on <= today && l.status !== 'won' && l.status !== 'lost'

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: leads.length, due: 0, new: 0, contacted: 0, qualified: 0, won: 0, lost: 0 }
    for (const l of leads) {
      c[l.status]++
      if (isDue(l)) c.due++
    }
    return c
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, today])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return leads.filter((l) => {
      if (filter === 'due' && !isDue(l)) return false
      if (filter !== 'all' && filter !== 'due' && l.status !== filter) return false
      if (!q) return true
      return [l.name, l.organisation, l.email, l.phone, l.message].some((v) => v?.toLowerCase().includes(q))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, filter, query, today])

  const open = leads.find((l) => l.id === openId) ?? null

  const tabs: { value: Filter; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: counts.all },
    { value: 'due', label: 'Follow-up due', count: counts.due },
    ...leadStatuses.map((s) => ({ value: s as Filter, label: leadStatusLabel[s], count: counts[s] })),
  ]

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-5xl font-black leading-none">Leads</h1>
          <p className="mt-2 text-sm text-ink-soft">Enquiries from the website contact form, newest first.</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-line px-3 py-1.5 text-sm font-bold transition-colors duration-150 hover:border-ink disabled:opacity-40"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden /> Refresh
        </button>
      </div>

      <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <FilterTabs label="Filter leads" options={tabs} value={filter} onChange={setFilter} />
        <label className="relative block lg:w-72">
          <span className="sr-only">Search leads</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, organisation, email"
            className="w-full rounded-full border-2 border-line bg-white py-2 pl-9 pr-4 text-sm outline-none transition-colors duration-150 focus:border-ink"
          />
        </label>
      </div>

      <div className="mt-6">
        {error ? (
          <Notice tone="error">Leads couldn't be loaded: {error}. Check your connection and press Refresh.</Notice>
        ) : loading && leads.length === 0 ? (
          <Notice>Loading leads…</Notice>
        ) : leads.length === 0 ? (
          <Notice>No enquiries yet. When someone sends the contact form on the website, it appears here.</Notice>
        ) : visible.length === 0 ? (
          <Notice>No leads match this filter{query ? ' and search' : ''}.</Notice>
        ) : (
          <div className="overflow-hidden rounded-[4px] bg-white shadow-[0_1px_0_rgba(15,42,46,0.06),0_20px_40px_-32px_rgba(15,42,46,0.5)]">
            <div className="hidden grid-cols-[1.6fr_1fr_0.8fr_0.9fr_0.8fr] gap-4 border-b-2 border-dashed border-line px-5 py-3 text-xs font-bold text-ink-soft md:grid">
              <span>Lead</span>
              <span>Interested in</span>
              <span>Status</span>
              <span>Follow up</span>
              <span>Assigned</span>
            </div>
            <ul>
              {visible.map((l) => (
                <li key={l.id} className="border-b border-dashed border-line last:border-0">
                  <button
                    onClick={() => setOpenId(l.id)}
                    className="grid w-full gap-x-4 gap-y-1.5 px-5 py-4 text-left transition-colors duration-150 hover:bg-paper md:grid-cols-[1.6fr_1fr_0.8fr_0.9fr_0.8fr] md:items-center"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{l.name}</span>
                      <span className="block truncate text-xs text-ink-soft">
                        {[l.organisation, formatDateTime(l.created_at)].filter(Boolean).join(', ')}
                      </span>
                    </span>
                    <span className="text-sm text-ink-soft">{l.interest}</span>
                    <span>
                      <Pill tone={statusTone[l.status]}>{leadStatusLabel[l.status]}</Pill>
                    </span>
                    <span className={`text-sm ${isDue(l) ? 'font-bold text-accent-deep' : 'text-ink-soft'}`}>
                      {l.follow_up_on ? `${isDue(l) ? 'Due ' : ''}${formatDate(l.follow_up_on)}` : <span className="text-ink-faint">None</span>}
                    </span>
                    <span className="text-sm text-ink-soft">{l.assigned_to ?? <span className="text-ink-faint">Nobody</span>}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {open && (
        <LeadPanel
          key={open.id}
          lead={open}
          onClose={() => setOpenId(null)}
          onSaved={(updated) => {
            setLeads((ls) => ls.map((l) => (l.id === updated.id ? updated : l)))
            setOpenId(null)
          }}
          onDeleted={(id) => {
            setLeads((ls) => ls.filter((l) => l.id !== id))
            setOpenId(null)
          }}
        />
      )}
    </div>
  )
}
