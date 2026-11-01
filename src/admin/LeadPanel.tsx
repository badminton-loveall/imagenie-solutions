import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, MessageCircle, Phone } from 'lucide-react'

import { supabase } from '../lib/supabase'
import { useAdminAuth } from './AdminAuth'
import {
  formatDateTime,
  leadStatusLabel,
  leadStatuses,
  type Lead,
  type LeadStatus,
} from './types'
import { Panel, SelectInput, TextArea, TextInput, dangerLink, primaryButton, secondaryButton } from './ui'

type Props = {
  lead: Lead
  onClose: () => void
  onSaved: (lead: Lead) => void
  onDeleted: (id: string) => void
}

export function LeadPanel({ lead, onClose, onSaved, onDeleted }: Props) {
  const auth = useAdminAuth()
  const navigate = useNavigate()
  const admins = auth.status === 'admin' ? auth.admins : []

  const [status, setStatus] = useState<LeadStatus>(lead.status)
  const [assignedTo, setAssignedTo] = useState(lead.assigned_to ?? '')
  const [followUp, setFollowUp] = useState(lead.follow_up_on ?? '')
  const [notes, setNotes] = useState(lead.notes ?? '')
  const [busy, setBusy] = useState<'saving' | 'deleting' | null>(null)
  const [error, setError] = useState('')

  const dirty =
    status !== lead.status ||
    assignedTo !== (lead.assigned_to ?? '') ||
    followUp !== (lead.follow_up_on ?? '') ||
    notes !== (lead.notes ?? '')

  const save = async () => {
    setBusy('saving')
    setError('')
    const { data, error } = await supabase
      .from('leads')
      .update({
        status,
        assigned_to: assignedTo || null,
        follow_up_on: followUp || null,
        notes: notes.trim() || null,
      })
      .eq('id', lead.id)
      .select()
      .single()
    setBusy(null)
    if (error) setError(`Changes weren't saved: ${error.message}`)
    else onSaved(data as Lead)
  }

  const remove = async () => {
    if (!window.confirm(`Delete the enquiry from ${lead.name}? This can't be undone.`)) return
    setBusy('deleting')
    const { error } = await supabase.from('leads').delete().eq('id', lead.id)
    setBusy(null)
    if (error) setError(`The lead wasn't deleted: ${error.message}`)
    else onDeleted(lead.id)
  }

  const phoneDigits = (lead.phone ?? '').replace(/[^\d]/g, '')
  const waNumber = phoneDigits.length === 10 ? `91${phoneDigits}` : phoneDigits

  return (
    <Panel
      title={lead.name}
      subtitle={[lead.organisation, `received ${formatDateTime(lead.created_at)}`].filter(Boolean).join(', ')}
      onClose={onClose}
      footer={
        <>
          <button onClick={remove} disabled={busy !== null} className={dangerLink}>
            {busy === 'deleting' ? 'Deleting…' : 'Delete lead'}
          </button>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() =>
                navigate('/admin/documents/new?kind=quotation', {
                  state: {
                    prefill: {
                      customer_name: lead.organisation || lead.name,
                      customer_email: lead.email,
                      customer_phone: lead.phone,
                      lead_id: lead.id,
                    },
                  },
                })
              }
              className={secondaryButton}
            >
              Create quotation
            </button>
            <button
              onClick={() => navigate('/admin/subscriptions', { state: { fromLead: lead } })}
              className={secondaryButton}
            >
              Add as subscription
            </button>
            <button onClick={save} disabled={!dirty || busy !== null} className={primaryButton}>
              {busy === 'saving' ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </>
      }
    >
      {/* Contact */}
      <div className="flex flex-wrap gap-2">
        <a href={`mailto:${lead.email}`} className={`${secondaryButton} inline-flex items-center gap-1.5`}>
          <Mail className="h-4 w-4" aria-hidden /> {lead.email}
        </a>
        {lead.phone && (
          <a href={`tel:${lead.phone}`} className={`${secondaryButton} inline-flex items-center gap-1.5`}>
            <Phone className="h-4 w-4" aria-hidden /> {lead.phone}
          </a>
        )}
        {waNumber && (
          <a
            href={`https://wa.me/${waNumber}`}
            target="_blank"
            rel="noreferrer"
            className={`${secondaryButton} inline-flex items-center gap-1.5`}
          >
            <MessageCircle className="h-4 w-4" aria-hidden /> WhatsApp
          </a>
        )}
      </div>

      {/* What they asked */}
      <div className="mt-6 rounded-[4px] bg-white p-5 shadow-[0_1px_0_rgba(15,42,46,0.06)]">
        <p className="text-sm font-bold">Interested in: {lead.interest}</p>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
          {lead.message || 'No message, just contact details.'}
        </p>
      </div>

      {/* Team fields */}
      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <SelectInput
          label="Status"
          value={status}
          onChange={setStatus}
          options={leadStatuses.map((s) => ({ value: s, label: leadStatusLabel[s] }))}
        />
        <SelectInput
          label="Assigned to"
          value={assignedTo}
          onChange={setAssignedTo}
          options={[{ value: '', label: 'Nobody yet' }, ...admins.map((a) => ({ value: a.name ?? a.email, label: a.name ?? a.email }))]}
        />
        <TextInput label="Follow up on" type="date" value={followUp} onChange={setFollowUp} />
      </div>
      <div className="mt-5">
        <TextArea label="Notes" value={notes} onChange={setNotes} rows={6} />
      </div>
      <p className="mt-2 text-xs text-ink-faint">Last changed {formatDateTime(lead.updated_at)}</p>

      {error && (
        <p role="alert" className="mt-4 text-sm text-accent-deep">
          {error}
        </p>
      )}
    </Panel>
  )
}
