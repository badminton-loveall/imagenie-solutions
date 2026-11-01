import { useEffect, useState, type ReactNode } from 'react'

import { supabase } from '../lib/supabase'
import type { BusinessSettings } from './financeTypes'
import { indianStates } from './docTypes'
import { formatDateTime } from './types'
import { Notice, TextArea, TextInput, primaryButton } from './ui'

const gstinPattern = /^[0-9]{2}[A-Z0-9]{13}$/
const ifscPattern = /^[A-Z]{4}0[A-Z0-9]{6}$/

type Form = {
  legal_name: string
  gstin: string
  state: string
  address: string
  email: string
  phone: string
  bank_name: string
  bank_account_name: string
  bank_account_number: string
  bank_ifsc: string
  upi_id: string
  invoice_terms: string
  quotation_terms: string
}

const toForm = (s: BusinessSettings): Form => ({
  legal_name: s.legal_name,
  gstin: s.gstin ?? '',
  state: s.state,
  address: s.address ?? '',
  email: s.email ?? '',
  phone: s.phone ?? '',
  bank_name: s.bank_name ?? '',
  bank_account_name: s.bank_account_name ?? '',
  bank_account_number: s.bank_account_number ?? '',
  bank_ifsc: s.bank_ifsc ?? '',
  upi_id: s.upi_id ?? '',
  invoice_terms: s.invoice_terms ?? '',
  quotation_terms: s.quotation_terms ?? '',
})

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-[4px] bg-white p-6">
      <h2 className="font-display text-2xl font-extrabold">{title}</h2>
      {hint && <p className="mt-1 text-sm text-ink-soft">{hint}</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  )
}

export function SettingsPage() {
  const [settings, setSettings] = useState<BusinessSettings | null>(null)
  const [f, setF] = useState<Form | null>(null)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    supabase
      .from('business_settings')
      .select('*')
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          setLoadError(error?.message ?? 'No settings found.')
          return
        }
        setSettings(data as BusinessSettings)
        setF(toForm(data as BusinessSettings))
      })
  }, [])

  if (loadError) return <Notice tone="error">Settings couldn't be loaded: {loadError}</Notice>
  if (!settings || !f) return <Notice>Loading settings…</Notice>

  const set = (key: keyof Form) => (v: string) => {
    setF({ ...f, [key]: v })
    setMessage(null)
  }

  const cleanGstin = f.gstin.replace(/\s/g, '').toUpperCase()
  const cleanIfsc = f.bank_ifsc.replace(/\s/g, '').toUpperCase()
  const gstinOk = cleanGstin === '' || gstinPattern.test(cleanGstin)
  const ifscOk = cleanIfsc === '' || ifscPattern.test(cleanIfsc)
  const canSave = !saving && gstinOk && ifscOk && f.legal_name.trim() !== ''

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    const blank = (v: string) => v.trim() || null
    const { data, error } = await supabase
      .from('business_settings')
      .update({
        legal_name: f.legal_name.trim(),
        gstin: cleanGstin || null,
        state: f.state || 'Kerala',
        address: blank(f.address),
        email: blank(f.email),
        phone: blank(f.phone),
        bank_name: blank(f.bank_name),
        bank_account_name: blank(f.bank_account_name),
        bank_account_number: blank(f.bank_account_number.replace(/\s/g, '')),
        bank_ifsc: cleanIfsc || null,
        upi_id: blank(f.upi_id),
        invoice_terms: blank(f.invoice_terms),
        quotation_terms: blank(f.quotation_terms),
      })
      .eq('id', true)
      .select()
      .single()
    setSaving(false)
    if (error) setMessage({ tone: 'error', text: `Settings weren't saved: ${error.message}` })
    else {
      setSettings(data as BusinessSettings)
      setF(toForm(data as BusinessSettings))
      setMessage({ tone: 'ok', text: 'Saved.' })
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-5xl font-black leading-none">Settings</h1>
        <p className="mt-2 text-sm text-ink-soft">These details print on your quotations and invoices.</p>
      </div>

      <Section title="Business">
        <div className="sm:col-span-2">
          <TextInput label="Business name" value={f.legal_name} onChange={set('legal_name')} required />
        </div>
        <div className="sm:col-span-2">
          <TextArea label="Address" value={f.address} onChange={set('address')} rows={2} />
        </div>
        <TextInput label="Email" type="email" value={f.email} onChange={set('email')} />
        <TextInput label="Phone" type="tel" value={f.phone} onChange={set('phone')} />
        <label className="block">
          <span className="text-sm font-bold">State</span>
          <select
            value={f.state}
            onChange={(e) => set('state')(e.target.value)}
            className="mt-1.5 w-full rounded-[4px] border-2 border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink"
          >
            {indianStates.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </Section>

      <Section
        title="GST"
        hint="Leave empty until you're registered. Once added, invoices print as Tax Invoices with GST, split into CGST and SGST for Kerala customers and IGST for other states."
      >
        <div className="sm:col-span-2">
          <TextInput label="GSTIN" value={f.gstin} onChange={(v) => set('gstin')(v.toUpperCase())} placeholder="32XXXXXXXXXXXXX" />
          {!gstinOk && <p className="mt-1.5 text-sm text-accent-deep">A GSTIN is 15 characters: 2 digits for the state, then 13 letters or digits.</p>}
        </div>
      </Section>

      <Section title="Getting paid" hint="Shown on unpaid invoices under How to pay.">
        <TextInput label="UPI ID" value={f.upi_id} onChange={set('upi_id')} placeholder="imagenie@okaxis" />
        <TextInput label="Bank name" value={f.bank_name} onChange={set('bank_name')} />
        <TextInput label="Account holder name" value={f.bank_account_name} onChange={set('bank_account_name')} />
        <TextInput label="Account number" value={f.bank_account_number} onChange={set('bank_account_number')} />
        <div>
          <TextInput label="IFSC" value={f.bank_ifsc} onChange={(v) => set('bank_ifsc')(v.toUpperCase())} />
          {!ifscOk && <p className="mt-1.5 text-sm text-accent-deep">An IFSC is 11 characters, like SBIN0001234.</p>}
        </div>
      </Section>

      <Section title="Default terms" hint="Added to each new document. You can change them on any document.">
        <TextArea label="Invoice terms" value={f.invoice_terms} onChange={set('invoice_terms')} rows={3} />
        <TextArea label="Quotation terms" value={f.quotation_terms} onChange={set('quotation_terms')} rows={3} />
      </Section>

      <div className="flex items-center gap-4">
        <button onClick={save} disabled={!canSave} className={primaryButton}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>
        {message && (
          <span role={message.tone === 'error' ? 'alert' : 'status'} className={`text-sm ${message.tone === 'error' ? 'text-accent-deep' : 'text-good'}`}>
            {message.text}
          </span>
        )}
        <span className="ml-auto text-xs text-ink-faint">Last changed {formatDateTime(settings.updated_at)}</span>
      </div>
    </div>
  )
}
