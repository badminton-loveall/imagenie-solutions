import { useEffect, useState } from 'react'

import { supabase } from '../lib/supabase'
import type { BusinessSettings } from './financeTypes'
import { formatDateTime } from './types'
import { Notice, TextArea, TextInput, primaryButton } from './ui'

const gstinPattern = /^[0-9]{2}[A-Z0-9]{13}$/

export function SettingsPage() {
  const [settings, setSettings] = useState<BusinessSettings | null>(null)
  const [name, setName] = useState('')
  const [gstin, setGstin] = useState('')
  const [state, setState] = useState('')
  const [address, setAddress] = useState('')
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
        const s = data as BusinessSettings
        setSettings(s)
        setName(s.legal_name)
        setGstin(s.gstin ?? '')
        setState(s.state)
        setAddress(s.address ?? '')
      })
  }, [])

  const cleanGstin = gstin.replace(/\s/g, '').toUpperCase()
  const gstinOk = cleanGstin === '' || gstinPattern.test(cleanGstin)

  const save = async () => {
    if (!gstinOk || !name.trim()) return
    setSaving(true)
    setMessage(null)
    const { data, error } = await supabase
      .from('business_settings')
      .update({ legal_name: name.trim(), gstin: cleanGstin || null, state: state.trim() || 'Kerala', address: address.trim() || null })
      .eq('id', true)
      .select()
      .single()
    setSaving(false)
    if (error) setMessage({ tone: 'error', text: `Settings weren't saved: ${error.message}` })
    else {
      setSettings(data as BusinessSettings)
      setGstin(cleanGstin)
      setMessage({ tone: 'ok', text: 'Saved.' })
    }
  }

  if (loadError) return <Notice tone="error">Settings couldn't be loaded: {loadError}</Notice>
  if (!settings) return <Notice>Loading settings…</Notice>

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-5xl font-black leading-none">Settings</h1>
      <p className="mt-2 text-sm text-ink-soft">Business details used across the finance pages.</p>

      <div className="mt-8 space-y-5 rounded-[4px] bg-white p-6">
        <TextInput label="Business name" value={name} onChange={setName} required />
        <div>
          <TextInput label="GSTIN" value={gstin} onChange={setGstin} placeholder="Leave empty until you're registered" />
          {!gstinOk ? (
            <p className="mt-1.5 text-sm text-accent-deep">A GSTIN is 15 characters: 2 digits for the state, then 13 letters or digits.</p>
          ) : (
            <p className="mt-1.5 text-xs text-ink-faint">Once added, the Overview shows GST payable: GST collected on sales minus GST paid on purchases.</p>
          )}
        </div>
        <TextInput label="State" value={state} onChange={setState} />
        <TextArea label="Registered address" value={address} onChange={setAddress} rows={3} />

        <div className="flex items-center gap-4">
          <button onClick={save} disabled={saving || !gstinOk || !name.trim()} className={primaryButton}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
          {message && (
            <span role={message.tone === 'error' ? 'alert' : 'status'} className={`text-sm ${message.tone === 'error' ? 'text-accent-deep' : 'text-good'}`}>
              {message.text}
            </span>
          )}
        </div>
        <p className="text-xs text-ink-faint">Last changed {formatDateTime(settings.updated_at)}</p>
      </div>
    </div>
  )
}
