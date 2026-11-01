import { useState, type FormEvent } from 'react'

import { supabase } from '../lib/supabase'
import {
  addDaysISO,
  billingCycleLabel,
  billingCycles,
  formatDateTime,
  subscriptionProducts,
  subscriptionStatusLabel,
  subscriptionStatuses,
  todayISO,
  type BillingCycle,
  type Lead,
  type Subscription,
  type SubscriptionProduct,
  type SubscriptionStatus,
} from './types'
import { Panel, SelectInput, TextArea, TextInput, dangerLink, primaryButton, secondaryButton } from './ui'

type Props = {
  /** Existing subscription to edit, or null to add a new one. */
  subscription: Subscription | null
  /** When adding from a lead, its details prefill the form. */
  fromLead?: Lead | null
  onClose: () => void
  onSaved: (s: Subscription) => void
  onDeleted: (id: string) => void
}

const cycleDays: Record<BillingCycle, number | null> = { monthly: 30, quarterly: 91, yearly: 365, one_time: null }

function productForLead(lead: Lead): SubscriptionProduct {
  if (lead.interest === 'Video production') return 'Video production'
  if (lead.interest === 'A custom app') return 'Custom app'
  return 'Qwait'
}

export function SubscriptionPanel({ subscription: s, fromLead, onClose, onSaved, onDeleted }: Props) {
  const today = todayISO()
  const [customer, setCustomer] = useState(s?.customer ?? fromLead?.organisation ?? fromLead?.name ?? '')
  const [contactName, setContactName] = useState(s?.contact_name ?? fromLead?.name ?? '')
  const [contactEmail, setContactEmail] = useState(s?.contact_email ?? fromLead?.email ?? '')
  const [contactPhone, setContactPhone] = useState(s?.contact_phone ?? fromLead?.phone ?? '')
  const [product, setProduct] = useState<SubscriptionProduct>(s?.product ?? (fromLead ? productForLead(fromLead) : 'Qwait'))
  const [plan, setPlan] = useState(s?.plan ?? '')
  const [amount, setAmount] = useState(s ? String(s.amount_inr) : '')
  const [cycle, setCycle] = useState<BillingCycle>(s?.billing_cycle ?? 'monthly')
  const [status, setStatus] = useState<SubscriptionStatus>(s?.status ?? 'active')
  const [startDate, setStartDate] = useState(s?.start_date ?? today)
  const [renewalDate, setRenewalDate] = useState(s?.renewal_date ?? addDaysISO(today, 30))
  const [notes, setNotes] = useState(s?.notes ?? '')
  const [busy, setBusy] = useState<'saving' | 'deleting' | null>(null)
  const [error, setError] = useState('')

  const amountNumber = Number(amount)
  const amountValid = amount.trim() !== '' && Number.isFinite(amountNumber) && amountNumber >= 0
  const canSave = customer.trim() !== '' && amountValid && busy === null

  const onCycleChange = (next: BillingCycle) => {
    setCycle(next)
    // Suggest a renewal date from the start date when the cycle changes on a new subscription.
    const days = cycleDays[next]
    if (!s) setRenewalDate(days ? addDaysISO(startDate, days) : '')
  }

  const save = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!canSave) return
    setBusy('saving')
    setError('')
    const row = {
      customer: customer.trim(),
      contact_name: contactName.trim() || null,
      contact_email: contactEmail.trim() || null,
      contact_phone: contactPhone.trim() || null,
      product,
      plan: plan.trim() || null,
      amount_inr: amountNumber,
      billing_cycle: cycle,
      status,
      start_date: startDate || today,
      renewal_date: renewalDate || null,
      notes: notes.trim() || null,
      ...(s ? {} : { lead_id: fromLead?.id ?? null }),
    }
    const query = s
      ? supabase.from('subscriptions').update(row).eq('id', s.id).select().single()
      : supabase.from('subscriptions').insert(row).select().single()
    const { data, error } = await query
    setBusy(null)
    if (error) {
      setError(`The subscription wasn't saved: ${error.message}`)
      return
    }
    // A lead turned into a paying customer is won.
    if (!s && fromLead && fromLead.status !== 'won') {
      await supabase.from('leads').update({ status: 'won' }).eq('id', fromLead.id)
    }
    onSaved(data as Subscription)
  }

  const [paidNote, setPaidNote] = useState('')
  const recordPayment = async () => {
    if (!s) return
    if (!window.confirm(`Record ${s.customer}'s payment of ₹${s.amount_inr} as received today? This adds it to income and moves the renewal date on.`)) return
    setBusy('saving')
    setError('')
    const { error: rpcError } = await supabase.rpc('mark_subscription_paid', { p_subscription_id: s.id, p_paid_on: today })
    if (rpcError) {
      setBusy(null)
      setError(`The payment wasn't recorded: ${rpcError.message}`)
      return
    }
    const { data } = await supabase.from('subscriptions').select('*').eq('id', s.id).single()
    setBusy(null)
    setPaidNote('Payment recorded in Transactions.')
    if (data) onSaved(data as Subscription)
  }

  const remove = async () => {
    if (!s || !window.confirm(`Delete the ${s.product} subscription for ${s.customer}? This can't be undone.`)) return
    setBusy('deleting')
    const { error } = await supabase.from('subscriptions').delete().eq('id', s.id)
    setBusy(null)
    if (error) setError(`The subscription wasn't deleted: ${error.message}`)
    else onDeleted(s.id)
  }

  return (
    <Panel
      title={s ? s.customer : 'Add subscription'}
      subtitle={s ? `Last changed ${formatDateTime(s.updated_at)}` : fromLead ? `From ${fromLead.name}'s enquiry. The lead will be marked won.` : undefined}
      onClose={onClose}
      footer={
        <>
          {s ? (
            <button onClick={remove} disabled={busy !== null} className={dangerLink}>
              {busy === 'deleting' ? 'Deleting…' : 'Delete subscription'}
            </button>
          ) : (
            <span />
          )}
          <div className="flex flex-wrap gap-2">
            {s && s.status !== 'cancelled' && s.status !== 'expired' ? (
              <button onClick={recordPayment} disabled={busy !== null} className={secondaryButton}>
                Record payment
              </button>
            ) : (
              <button onClick={onClose} className={secondaryButton}>
                Cancel
              </button>
            )}
            <button onClick={() => save()} disabled={!canSave} className={primaryButton}>
              {busy === 'saving' ? 'Saving…' : s ? 'Save changes' : 'Add subscription'}
            </button>
          </div>
        </>
      }
    >
      <form onSubmit={save} className="space-y-8">
        <fieldset className="grid gap-5 sm:grid-cols-2">
          <legend className="mb-4 font-display text-xl font-extrabold">Customer</legend>
          <div className="sm:col-span-2">
            <TextInput label="Customer or organisation" value={customer} onChange={setCustomer} required placeholder="City Clinic" />
          </div>
          <TextInput label="Contact name" value={contactName} onChange={setContactName} />
          <TextInput label="Contact phone" type="tel" value={contactPhone} onChange={setContactPhone} />
          <div className="sm:col-span-2">
            <TextInput label="Contact email" type="email" value={contactEmail} onChange={setContactEmail} />
          </div>
        </fieldset>

        <fieldset className="grid gap-5 sm:grid-cols-2">
          <legend className="mb-4 font-display text-xl font-extrabold">Plan and billing</legend>
          <SelectInput
            label="Product"
            value={product}
            onChange={setProduct}
            options={subscriptionProducts.map((p) => ({ value: p, label: p }))}
          />
          <TextInput label="Plan" value={plan} onChange={setPlan} placeholder="Clinic Pro" />
          <TextInput label="Amount (₹)" type="number" value={amount} onChange={setAmount} required placeholder="999" />
          <SelectInput
            label="Billing"
            value={cycle}
            onChange={onCycleChange}
            options={billingCycles.map((c) => ({ value: c, label: billingCycleLabel[c] }))}
          />
          <SelectInput
            label="Status"
            value={status}
            onChange={setStatus}
            options={subscriptionStatuses.map((st) => ({ value: st, label: subscriptionStatusLabel[st] }))}
          />
          <div />
          <TextInput label="Started on" type="date" value={startDate} onChange={setStartDate} />
          <TextInput label={cycle === 'one_time' ? 'Due on (optional)' : 'Renews on'} type="date" value={renewalDate} onChange={setRenewalDate} />
        </fieldset>
        {!amountValid && amount.trim() !== '' && <p className="-mt-4 text-sm text-accent-deep">Enter the amount as a number of rupees, like 999.</p>}

        <TextArea label="Notes" value={notes} onChange={setNotes} rows={4} />

        {error && (
          <p role="alert" className="text-sm text-accent-deep">
            {error}
          </p>
        )}
        {paidNote && (
          <p role="status" className="text-sm text-good">
            {paidNote}
          </p>
        )}
        <button type="submit" className="sr-only">
          Save
        </button>
      </form>
    </Panel>
  )
}
