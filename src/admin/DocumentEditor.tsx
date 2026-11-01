import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, FileText, Plus, Trash2 } from 'lucide-react'

import { supabase } from '../lib/supabase'
import type { BusinessSettings } from './financeTypes'
import { incomeCategories, paymentMethods } from './financeTypes'
import {
  amountInWords,
  docKindLabel,
  docStatusLabel,
  docTotals,
  indianStates,
  isSameState,
  lineAmount,
  normaliseDoc,
  normaliseItem,
  type Doc,
  type DocItem,
  type DocKind,
  type DocPrefill,
} from './docTypes'
import { addDaysISO, formatDate, formatINR, todayISO } from './types'
import { Notice, Pill, TextArea, TextInput, dangerLink, primaryButton, secondaryButton, type PillTone } from './ui'

type ItemDraft = { key: string; description: string; hsn_sac: string; quantity: string; unit: string; unit_price: string; gst_rate: string }
type CustomerSuggestion = { name: string; email: string | null; phone: string | null; address: string | null; gstin: string | null; state: string | null }

const statusTone: Record<string, PillTone> = { draft: 'muted', sent: 'yellow', accepted: 'green', declined: 'pink', paid: 'green', cancelled: 'muted' }

const blankItem = (rate: string): ItemDraft => ({
  key: crypto.randomUUID(),
  description: '',
  hsn_sac: '',
  quantity: '1',
  unit: '',
  unit_price: '',
  gst_rate: rate,
})

const toNum = (s: string) => (s.trim() === '' ? NaN : Number(s))

export function DocumentEditor() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()

  const [settings, setSettings] = useState<BusinessSettings | null>(null)
  const [doc, setDoc] = useState<Doc | null>(null)
  const [kind, setKind] = useState<DocKind>(params.get('kind') === 'quotation' ? 'quotation' : 'invoice')
  const [loadError, setLoadError] = useState('')
  const [ready, setReady] = useState(false)

  // Form state
  const [customer, setCustomer] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [gstin, setGstin] = useState('')
  const [state, setState] = useState('Kerala')
  const [issueDate, setIssueDate] = useState(todayISO())
  const [dueDate, setDueDate] = useState('')
  const [items, setItems] = useState<ItemDraft[]>([])
  const [notes, setNotes] = useState('')
  const [terms, setTerms] = useState('')
  const [links, setLinks] = useState<{ lead_id?: string; subscription_id?: string }>({})
  const [suggestions, setSuggestions] = useState<CustomerSuggestion[]>([])

  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [flash, setFlash] = useState('')

  const registered = !!settings?.gstin
  const defaultRate = registered ? '18' : '0'

  // Load settings, the document (if editing) and customer suggestions.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [s, prevDocs, subs] = await Promise.all([
        supabase.from('business_settings').select('*').maybeSingle(),
        supabase.from('documents').select('customer_name, customer_email, customer_phone, customer_address, customer_gstin, customer_state').order('created_at', { ascending: false }).limit(200),
        supabase.from('subscriptions').select('customer, contact_email, contact_phone').limit(200),
      ])
      if (cancelled) return
      if (s.error || !s.data) {
        setLoadError(s.error?.message ?? 'Business settings are missing.')
        return
      }
      const bs = s.data as BusinessSettings
      setSettings(bs)

      const seen = new Map<string, CustomerSuggestion>()
      for (const d of (prevDocs.data ?? []) as { customer_name: string; customer_email: string | null; customer_phone: string | null; customer_address: string | null; customer_gstin: string | null; customer_state: string | null }[]) {
        if (!seen.has(d.customer_name)) seen.set(d.customer_name, { name: d.customer_name, email: d.customer_email, phone: d.customer_phone, address: d.customer_address, gstin: d.customer_gstin, state: d.customer_state })
      }
      for (const x of (subs.data ?? []) as { customer: string; contact_email: string | null; contact_phone: string | null }[]) {
        if (!seen.has(x.customer)) seen.set(x.customer, { name: x.customer, email: x.contact_email, phone: x.contact_phone, address: null, gstin: null, state: null })
      }
      setSuggestions([...seen.values()])

      if (isNew) {
        const k: DocKind = params.get('kind') === 'quotation' ? 'quotation' : 'invoice'
        const prefill = (location.state as { prefill?: DocPrefill } | null)?.prefill
        setKind(k)
        setState(bs.state)
        setTerms((k === 'invoice' ? bs.invoice_terms : bs.quotation_terms) ?? '')
        setDueDate(addDaysISO(todayISO(), k === 'invoice' ? 15 : 30))
        const rate = bs.gstin ? '18' : '0'
        if (prefill) {
          setCustomer(prefill.customer_name ?? '')
          setEmail(prefill.customer_email ?? '')
          setPhone(prefill.customer_phone ?? '')
          setLinks({ lead_id: prefill.lead_id, subscription_id: prefill.subscription_id })
          setItems(
            prefill.items?.length
              ? prefill.items.map((i) => ({ ...blankItem(rate), description: i.description, quantity: String(i.quantity), unit_price: String(i.unit_price) }))
              : [blankItem(rate)],
          )
        } else {
          setItems([blankItem(rate)])
        }
        setReady(true)
        return
      }

      const [d, it] = await Promise.all([
        supabase.from('documents').select('*').eq('id', id).maybeSingle(),
        supabase.from('document_items').select('*').eq('document_id', id).order('position'),
      ])
      if (cancelled) return
      if (d.error || !d.data) {
        setLoadError(d.error?.message ?? 'This document was not found. It may have been deleted.')
        return
      }
      fillFrom(normaliseDoc(d.data as Doc), ((it.data ?? []) as DocItem[]).map(normaliseItem))
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const fillFrom = (d: Doc, its: DocItem[]) => {
    setDoc(d)
    setKind(d.kind)
    setCustomer(d.customer_name)
    setEmail(d.customer_email ?? '')
    setPhone(d.customer_phone ?? '')
    setAddress(d.customer_address ?? '')
    setGstin(d.customer_gstin ?? '')
    setState(d.customer_state ?? 'Kerala')
    setIssueDate(d.issue_date)
    setDueDate(d.due_date ?? '')
    setNotes(d.notes ?? '')
    setTerms(d.terms ?? '')
    setLinks({ lead_id: d.lead_id ?? undefined, subscription_id: d.subscription_id ?? undefined })
    setItems(
      its.map((i) => ({
        key: i.id ?? crypto.randomUUID(),
        description: i.description,
        hsn_sac: i.hsn_sac ?? '',
        quantity: String(i.quantity),
        unit: i.unit ?? '',
        unit_price: String(i.unit_price),
        gst_rate: String(i.gst_rate),
      })),
    )
  }

  // Editing rules: drafts are editable; quotations stay editable while sent; issued invoices are locked.
  const editable = isNew || (doc?.status === 'draft') || (doc?.kind === 'quotation' && doc.status === 'sent')

  const parsed = items.map((i) => ({
    description: i.description.trim(),
    hsn_sac: i.hsn_sac.trim() || null,
    quantity: toNum(i.quantity),
    unit: i.unit.trim() || null,
    unit_price: toNum(i.unit_price),
    gst_rate: registered ? toNum(i.gst_rate) : 0,
  }))
  const itemsValid =
    parsed.length > 0 &&
    parsed.every((p) => p.description && Number.isFinite(p.quantity) && p.quantity > 0 && Number.isFinite(p.unit_price) && p.unit_price >= 0 && Number.isFinite(p.gst_rate) && p.gst_rate >= 0 && p.gst_rate <= 28)
  const gstinOk = gstin.trim() === '' || /^[0-9]{2}[A-Z0-9]{13}$/.test(gstin.trim().toUpperCase())
  const canSave = editable && customer.trim() !== '' && itemsValid && gstinOk && busy === null

  const sameState = isSameState(settings?.state ?? 'Kerala', state)
  const totals = useMemo(
    () => docTotals(parsed.map((p) => ({ quantity: p.quantity || 0, unit_price: p.unit_price || 0, gst_rate: p.gst_rate || 0 })), sameState),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, sameState, registered],
  )

  const setItem = (key: string, patch: Partial<ItemDraft>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)))

  const pickCustomer = (name: string) => {
    setCustomer(name)
    const s = suggestions.find((x) => x.name === name)
    if (!s) return
    if (!email && s.email) setEmail(s.email)
    if (!phone && s.phone) setPhone(s.phone)
    if (!address && s.address) setAddress(s.address)
    if (!gstin && s.gstin) setGstin(s.gstin)
    if (s.state) setState(s.state)
  }

  /** Saves the form. Returns the document id, or null on failure. */
  const save = async (openAfter = true): Promise<string | null> => {
    if (!canSave) return doc?.id ?? null
    setBusy('saving')
    setError('')
    const row = {
      kind,
      issue_date: issueDate || todayISO(),
      due_date: dueDate || null,
      customer_name: customer.trim(),
      customer_email: email.trim() || null,
      customer_phone: phone.trim() || null,
      customer_address: address.trim() || null,
      customer_gstin: gstin.trim().toUpperCase() || null,
      customer_state: state || null,
      notes: notes.trim() || null,
      terms: terms.trim() || null,
      lead_id: links.lead_id ?? null,
      subscription_id: links.subscription_id ?? null,
    }
    let docId = doc?.id ?? null
    if (docId) {
      const { error } = await supabase.from('documents').update(row).eq('id', docId)
      if (error) return fail(`The ${docKindLabel[kind].one.toLowerCase()} wasn't saved: ${error.message}`)
      const { error: delErr } = await supabase.from('document_items').delete().eq('document_id', docId)
      if (delErr) return fail(`Line items weren't saved: ${delErr.message}`)
    } else {
      const { data, error } = await supabase.from('documents').insert(row).select('id').single()
      if (error || !data) return fail(`The ${docKindLabel[kind].one.toLowerCase()} wasn't saved: ${error?.message}`)
      docId = (data as { id: string }).id
    }
    const { error: itemErr } = await supabase
      .from('document_items')
      .insert(parsed.map((p, position) => ({ ...p, position, document_id: docId })))
    if (itemErr) return fail(`Line items weren't saved: ${itemErr.message}`)

    await reload(docId)
    setBusy(null)
    if (isNew && openAfter) navigate(`/admin/documents/${docId}`, { replace: true })
    return docId
  }

  const fail = (msg: string) => {
    setBusy(null)
    setError(msg)
    return null
  }

  const reload = async (docId: string) => {
    const [d, it] = await Promise.all([
      supabase.from('documents').select('*').eq('id', docId).single(),
      supabase.from('document_items').select('*').eq('document_id', docId).order('position'),
    ])
    if (d.data) fillFrom(normaliseDoc(d.data as Doc), ((it.data ?? []) as DocItem[]).map(normaliseItem))
  }

  const setStatus = async (status: Doc['status'], confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return
    const docId = editable ? await save(false) : doc?.id
    if (!docId) return
    setBusy('status')
    const { error } = await supabase.from('documents').update({ status }).eq('id', docId)
    if (error) return fail(`The status wasn't changed: ${error.message}`)
    setBusy(null)
    if (isNew) {
      navigate(`/admin/documents/${docId}`, { replace: true })
      return
    }
    await reload(docId)
    setFlash(status === 'sent' ? 'Issued and numbered. Open Print / PDF to save it and send it to the customer.' : `Marked ${docStatusLabel[status].toLowerCase()}.`)
  }

  const convert = async () => {
    if (!doc) return
    setBusy('convert')
    const { data, error } = await supabase.rpc('convert_quotation_to_invoice', { p_quotation_id: doc.id })
    setBusy(null)
    if (error) return fail(`The invoice wasn't created: ${error.message}`)
    navigate(`/admin/documents/${data as string}`)
  }

  const [payMethod, setPayMethod] = useState<string>('UPI')
  const [payCategory, setPayCategory] = useState<string>('Product subscription')
  const [showPay, setShowPay] = useState(false)
  const markPaid = async () => {
    if (!doc) return
    if (doc.status === 'draft') {
      const id2 = await save(false)
      if (!id2) return
    }
    setBusy('paying')
    const { error } = await supabase.rpc('mark_invoice_paid', {
      p_invoice_id: doc.id,
      p_paid_on: todayISO(),
      p_payment_method: payMethod || null,
      p_category: payCategory,
    })
    if (error) return fail(`The payment wasn't recorded: ${error.message}`)
    await reload(doc.id)
    setBusy(null)
    setShowPay(false)
    setFlash('Marked paid and added to income in Transactions.')
  }

  const remove = async () => {
    if (!doc || !window.confirm('Delete this draft? This can\'t be undone.')) return
    setBusy('deleting')
    const { error } = await supabase.from('documents').delete().eq('id', doc.id)
    if (error) return fail(`It wasn't deleted: ${error.message}`)
    navigate(`/admin/documents?kind=${doc.kind}`)
  }

  if (loadError) return <Notice tone="error">{loadError}</Notice>
  if (!ready || !settings) return <Notice>Loading…</Notice>

  const label = docKindLabel[kind].one
  const status = doc?.status ?? 'draft'
  const overdue = kind === 'invoice' && status === 'sent' && !!doc?.due_date && doc.due_date < todayISO()

  return (
    <div>
      <Link to={`/admin/documents?kind=${kind}`} className="inline-flex items-center gap-1.5 text-sm font-bold text-ink-soft hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> All {docKindLabel[kind].many.toLowerCase()}
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-5xl font-black leading-none">
            {isNew ? `New ${label.toLowerCase()}` : doc?.number ?? `Draft ${label.toLowerCase()}`}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
            {!isNew && <Pill tone={overdue ? 'red' : statusTone[status]}>{overdue ? 'Overdue' : docStatusLabel[status]}</Pill>}
            {!isNew && doc && <span>{customer}</span>}
            {!editable && <span>Issued invoices can't be edited. Cancel it and create a new one to change it.</span>}
          </div>
        </div>
        {!isNew && doc && (
          <Link to={`/admin/documents/${doc.id}/print`} className={`${secondaryButton} inline-flex items-center gap-1.5`}>
            <FileText className="h-4 w-4" aria-hidden /> Print / PDF
          </Link>
        )}
      </div>

      {!registered && (
        <p className="mt-4 rounded-[4px] bg-slip-yellow px-4 py-3 text-sm">
          Not GST-registered yet, so documents carry no GST and print as "{label}", not "Tax Invoice". Add your GSTIN in{' '}
          <Link to="/admin/settings" className="font-bold underline underline-offset-4">
            Settings
          </Link>{' '}
          when it arrives.
        </p>
      )}
      {flash && (
        <p role="status" className="mt-4 rounded-[4px] bg-slip-green px-4 py-3 text-sm">
          {flash}
        </p>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {/* Customer */}
          <section className="rounded-[4px] bg-white p-6">
            <h2 className="font-display text-2xl font-extrabold">Customer</h2>
            <fieldset disabled={!editable} className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-sm font-bold">Customer or organisation</span>
                <input
                  list="customer-suggestions"
                  value={customer}
                  onChange={(e) => pickCustomer(e.target.value)}
                  required
                  className="mt-1.5 w-full rounded-[4px] border-2 border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink disabled:bg-paper"
                />
                <datalist id="customer-suggestions">
                  {suggestions.map((s) => (
                    <option key={s.name} value={s.name} />
                  ))}
                </datalist>
              </label>
              <TextInput label="Email" type="email" value={email} onChange={setEmail} />
              <TextInput label="Phone" type="tel" value={phone} onChange={setPhone} />
              <div className="sm:col-span-2">
                <TextArea label="Billing address" value={address} onChange={setAddress} rows={2} />
              </div>
              <div>
                <TextInput label="Customer GSTIN (if any)" value={gstin} onChange={(v) => setGstin(v.toUpperCase())} />
                {!gstinOk && <p className="mt-1 text-xs text-accent-deep">15 characters: 2 digits, then 13 letters or digits.</p>}
              </div>
              <label className="block">
                <span className="text-sm font-bold">State (place of supply)</span>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="mt-1.5 w-full rounded-[4px] border-2 border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink disabled:bg-paper"
                >
                  {indianStates.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
          </section>

          {/* Items */}
          <section className="rounded-[4px] bg-white p-6">
            <h2 className="font-display text-2xl font-extrabold">Items</h2>
            <div className="mt-4 space-y-4">
              {items.map((i, idx) => (
                <fieldset key={i.key} disabled={!editable} className="rounded-[4px] border-2 border-dashed border-line p-4">
                  <legend className="sr-only">Item {idx + 1}</legend>
                  <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                    <label className="block">
                      <span className="text-xs font-bold">Description</span>
                      <input
                        value={i.description}
                        onChange={(e) => setItem(i.key, { description: e.target.value })}
                        placeholder="Qwait monthly plan, City Clinic OPD"
                        className="mt-1 w-full rounded-[4px] border-2 border-line px-3 py-2 text-sm outline-none focus:border-ink disabled:bg-paper"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold">HSN/SAC</span>
                      <input
                        value={i.hsn_sac}
                        onChange={(e) => setItem(i.key, { hsn_sac: e.target.value })}
                        className="mt-1 w-full rounded-[4px] border-2 border-line px-3 py-2 text-sm outline-none focus:border-ink disabled:bg-paper"
                      />
                    </label>
                  </div>
                  <div className={`mt-3 grid grid-cols-2 gap-3 ${registered ? 'sm:grid-cols-[90px_90px_1fr_90px_1fr_auto]' : 'sm:grid-cols-[90px_90px_1fr_1fr_auto]'} sm:items-end`}>
                    <label className="block">
                      <span className="text-xs font-bold">Qty</span>
                      <input type="number" min="0" step="any" value={i.quantity} onChange={(e) => setItem(i.key, { quantity: e.target.value })} className="mt-1 w-full rounded-[4px] border-2 border-line px-3 py-2 text-sm outline-none focus:border-ink disabled:bg-paper" />
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold">Unit</span>
                      <input value={i.unit} onChange={(e) => setItem(i.key, { unit: e.target.value })} placeholder="month" className="mt-1 w-full rounded-[4px] border-2 border-line px-3 py-2 text-sm outline-none focus:border-ink disabled:bg-paper" />
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold">Rate (₹)</span>
                      <input type="number" min="0" step="any" value={i.unit_price} onChange={(e) => setItem(i.key, { unit_price: e.target.value })} className="mt-1 w-full rounded-[4px] border-2 border-line px-3 py-2 text-sm outline-none focus:border-ink disabled:bg-paper" />
                    </label>
                    {registered && (
                      <label className="block">
                        <span className="text-xs font-bold">GST %</span>
                        <select value={i.gst_rate} onChange={(e) => setItem(i.key, { gst_rate: e.target.value })} className="mt-1 w-full rounded-[4px] border-2 border-line bg-white px-2 py-2 text-sm outline-none focus:border-ink disabled:bg-paper">
                          {['0', '5', '12', '18', '28'].map((r) => (
                            <option key={r} value={r}>
                              {r}%
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <div className="text-right text-sm">
                      <span className="block text-xs font-bold text-ink-soft">Amount</span>
                      <span className="mt-1 block py-2 font-bold">
                        {formatINR(lineAmount({ quantity: toNum(i.quantity) || 0, unit_price: toNum(i.unit_price) || 0 }))}
                      </span>
                    </div>
                    {editable && items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setItems((list) => list.filter((x) => x.key !== i.key))}
                        aria-label={`Remove item ${idx + 1}`}
                        className="justify-self-end rounded-full p-2 text-ink-soft hover:bg-accent-wash hover:text-accent-deep"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    )}
                  </div>
                </fieldset>
              ))}
              {editable && (
                <button type="button" onClick={() => setItems((list) => [...list, blankItem(defaultRate)])} className={`${secondaryButton} inline-flex items-center gap-1.5`}>
                  <Plus className="h-4 w-4" aria-hidden /> Add item
                </button>
              )}
              {!itemsValid && editable && <p className="text-sm text-ink-soft">Each item needs a description, a quantity above 0 and a rate.</p>}
            </div>
          </section>

          {/* Notes and terms */}
          <section className="grid gap-4 rounded-[4px] bg-white p-6 sm:grid-cols-2">
            <fieldset disabled={!editable} className="contents">
              <TextArea label="Notes for the customer" value={notes} onChange={setNotes} rows={3} />
              <TextArea label="Terms" value={terms} onChange={setTerms} rows={3} />
            </fieldset>
          </section>
        </div>

        {/* Summary and actions */}
        <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <div className="overflow-hidden rounded-[4px] bg-white">
            <fieldset disabled={!editable} className="grid grid-cols-2 gap-3 p-5">
              <TextInput label={`${label} date`} type="date" value={issueDate} onChange={setIssueDate} />
              <TextInput label={kind === 'invoice' ? 'Due on' : 'Valid until'} type="date" value={dueDate} onChange={setDueDate} />
            </fieldset>
            <div aria-hidden className="perf-x h-3.5 bg-paper-deep" />
            <dl className="space-y-2 bg-slip-yellow p-5 text-sm">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd>{formatINR(totals.subtotal)}</dd>
              </div>
              {registered &&
                (sameState ? (
                  <>
                    <div className="flex justify-between">
                      <dt>CGST</dt>
                      <dd>{formatINR(totals.cgst)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>SGST</dt>
                      <dd>{formatINR(totals.sgst)}</dd>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between">
                    <dt>IGST</dt>
                    <dd>{formatINR(totals.igst)}</dd>
                  </div>
                ))}
              <div className="flex items-baseline justify-between border-t-2 border-dashed border-ink/20 pt-2">
                <dt className="font-bold">Total</dt>
                <dd className="font-display text-3xl font-black">{formatINR(totals.total)}</dd>
              </div>
              <p className="text-xs text-ink/60">{amountInWords(totals.total)}</p>
            </dl>
          </div>

          {error && (
            <p role="alert" className="rounded-[4px] bg-accent-wash px-4 py-3 text-sm text-accent-deep">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2">
            {editable && (
              <button onClick={() => save(true)} disabled={!canSave} className={secondaryButton}>
                {busy === 'saving' ? 'Saving…' : isNew || status === 'draft' ? 'Save draft' : 'Save changes'}
              </button>
            )}
            {(isNew || status === 'draft') && (
              <button
                onClick={() => setStatus('sent', `Issue this ${label.toLowerCase()}? It gets its permanent number now.`)}
                disabled={!canSave}
                className={primaryButton}
              >
                Issue and number it
              </button>
            )}
            {kind === 'quotation' && doc && (status === 'sent' || status === 'accepted') && (
              <button onClick={convert} disabled={busy !== null} className={primaryButton}>
                {busy === 'convert' ? 'Creating invoice…' : 'Convert to invoice'}
              </button>
            )}
            {kind === 'quotation' && doc && status === 'sent' && (
              <div className="flex gap-2">
                <button onClick={() => setStatus('accepted')} disabled={busy !== null} className={`${secondaryButton} flex-1`}>
                  Accepted
                </button>
                <button onClick={() => setStatus('declined')} disabled={busy !== null} className={`${secondaryButton} flex-1`}>
                  Declined
                </button>
              </div>
            )}
            {kind === 'invoice' && doc && (status === 'sent' || status === 'draft') && !showPay && (
              <button onClick={() => setShowPay(true)} disabled={busy !== null || (status === 'draft' && !canSave)} className={status === 'sent' ? primaryButton : secondaryButton}>
                Mark as paid
              </button>
            )}
            {showPay && doc && (
              <div className="space-y-3 rounded-[4px] bg-slip-green p-4">
                <p className="text-sm font-bold">Record {formatINR(totals.total)} received today</p>
                <label className="block text-sm">
                  <span className="font-bold">Paid by</span>
                  <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="mt-1 w-full rounded-[4px] border-2 border-ink/20 bg-white px-2 py-1.5">
                    {paymentMethods.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="font-bold">Income category</span>
                  <select value={payCategory} onChange={(e) => setPayCategory(e.target.value)} className="mt-1 w-full rounded-[4px] border-2 border-ink/20 bg-white px-2 py-1.5">
                    {incomeCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex gap-2">
                  <button onClick={markPaid} disabled={busy !== null} className={`${primaryButton} flex-1`}>
                    {busy === 'paying' ? 'Recording…' : 'Record payment'}
                  </button>
                  <button onClick={() => setShowPay(false)} className={secondaryButton}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {kind === 'invoice' && status === 'paid' && doc?.transaction_id && (
              <Link to="/admin/transactions" className="text-center text-sm font-bold underline underline-offset-4">
                See the payment in Transactions
              </Link>
            )}
            {doc && doc.quotation_id && (
              <Link to={`/admin/documents/${doc.quotation_id}`} className="text-center text-sm text-ink-soft underline underline-offset-4">
                Made from a quotation
              </Link>
            )}
            {doc && status === 'draft' && (
              <button onClick={remove} disabled={busy !== null} className={`${dangerLink} mt-2`}>
                Delete draft
              </button>
            )}
            {doc && status !== 'draft' && status !== 'cancelled' && status !== 'paid' && (
              <button
                onClick={() => setStatus('cancelled', `Cancel ${doc.number}? It keeps its number but is marked cancelled.`)}
                disabled={busy !== null}
                className={`${dangerLink} mt-2`}
              >
                Cancel {label.toLowerCase()}
              </button>
            )}
            {doc && <p className="mt-1 text-center text-xs text-ink-faint">Created {formatDate(doc.created_at.slice(0, 10))}</p>}
          </div>
        </aside>
      </div>
    </div>
  )
}
