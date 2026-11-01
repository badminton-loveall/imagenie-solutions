import { useState } from 'react'

import { supabase } from '../lib/supabase'
import {
  currencies,
  expenseCategories,
  normaliseBill,
  paymentMethods,
  type BillStatus,
  type Currency,
  type RecurringExpense,
} from './financeTypes'
import { addDaysISO, billingCycleLabel, billingCycles, formatDateTime, todayISO, type BillingCycle } from './types'
import { Panel, SelectInput, TextArea, TextInput, dangerLink, primaryButton, secondaryButton } from './ui'

type Props = {
  bill: RecurringExpense | null
  onClose: () => void
  onSaved: (b: RecurringExpense) => void
  onDeleted: (id: string) => void
}

export function BillPanel({ bill: b, onClose, onSaved, onDeleted }: Props) {
  const [vendor, setVendor] = useState(b?.vendor ?? '')
  const [plan, setPlan] = useState(b?.plan ?? '')
  const [category, setCategory] = useState(b?.category ?? expenseCategories[0])
  const [currency, setCurrency] = useState<Currency>(b?.currency ?? 'INR')
  const [amount, setAmount] = useState(b ? String(b.amount) : '')
  const [amountInr, setAmountInr] = useState(b?.amount_inr != null && b.currency !== 'INR' ? String(b.amount_inr) : '')
  const [gstRate, setGstRate] = useState(b ? String(b.gst_rate) : '18')
  const [cycle, setCycle] = useState<BillingCycle>(b?.billing_cycle ?? 'monthly')
  const [nextDue, setNextDue] = useState(b?.next_due_date ?? addDaysISO(todayISO(), 30))
  const [status, setStatus] = useState<BillStatus>(b?.status ?? 'active')
  const [method, setMethod] = useState<string>(b?.payment_method ?? '')
  const [notes, setNotes] = useState(b?.notes ?? '')
  const [busy, setBusy] = useState<'saving' | 'deleting' | null>(null)
  const [error, setError] = useState('')

  const amountN = Number(amount)
  const rateN = Number(gstRate)
  const amountOk = amount.trim() !== '' && Number.isFinite(amountN) && amountN >= 0
  const rateOk = gstRate.trim() !== '' && Number.isFinite(rateN) && rateN >= 0 && rateN <= 28
  const canSave = vendor.trim() !== '' && amountOk && rateOk && busy === null

  const save = async () => {
    if (!canSave) return
    setBusy('saving')
    setError('')
    const row = {
      vendor: vendor.trim(),
      plan: plan.trim() || null,
      category,
      currency,
      amount: amountN,
      amount_inr: currency === 'INR' ? null : amountInr.trim() === '' ? null : Number(amountInr),
      gst_rate: rateN,
      billing_cycle: cycle,
      next_due_date: nextDue || null,
      status,
      payment_method: method || null,
      notes: notes.trim() || null,
    }
    const query = b
      ? supabase.from('recurring_expenses').update(row).eq('id', b.id).select().single()
      : supabase.from('recurring_expenses').insert(row).select().single()
    const { data, error } = await query
    setBusy(null)
    if (error) setError(`The bill wasn't saved: ${error.message}`)
    else onSaved(normaliseBill(data as RecurringExpense))
  }

  const remove = async () => {
    if (!b || !window.confirm(`Delete the ${b.vendor} bill? Payments already recorded stay in Transactions.`)) return
    setBusy('deleting')
    const { error } = await supabase.from('recurring_expenses').delete().eq('id', b.id)
    setBusy(null)
    if (error) setError(`The bill wasn't deleted: ${error.message}`)
    else onDeleted(b.id)
  }

  return (
    <Panel
      title={b ? b.vendor : 'Add bill'}
      subtitle={b ? `Last changed ${formatDateTime(b.updated_at)}` : 'Something Imagenie pays for on a schedule.'}
      onClose={onClose}
      footer={
        <>
          {b ? (
            <button onClick={remove} disabled={busy !== null} className={dangerLink}>
              {busy === 'deleting' ? 'Deleting…' : 'Delete bill'}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className={secondaryButton}>
              Cancel
            </button>
            <button onClick={save} disabled={!canSave} className={primaryButton}>
              {busy === 'saving' ? 'Saving…' : b ? 'Save changes' : 'Add bill'}
            </button>
          </div>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <TextInput label="Vendor" value={vendor} onChange={setVendor} required placeholder="Anthropic" />
        <TextInput label="Plan" value={plan} onChange={setPlan} placeholder="Claude Pro" />
        <SelectInput label="Category" value={category} onChange={setCategory} options={expenseCategories.map((c) => ({ value: c, label: c }))} />
        <SelectInput
          label="Renews"
          value={cycle}
          onChange={setCycle}
          options={billingCycles.map((c) => ({ value: c, label: billingCycleLabel[c] }))}
        />
        <SelectInput label="Currency" value={currency} onChange={setCurrency} options={currencies.map((c) => ({ value: c, label: c }))} />
        <TextInput label="Amount, including GST" type="number" value={amount} onChange={setAmount} required />
        <TextInput label="GST rate (%)" type="number" value={gstRate} onChange={setGstRate} />
        {currency !== 'INR' ? (
          <TextInput label="Usual charge in ₹" type="number" value={amountInr} onChange={setAmountInr} />
        ) : (
          <div />
        )}
        <TextInput label="Next due" type="date" value={nextDue} onChange={setNextDue} />
        <SelectInput
          label="Paid by"
          value={method}
          onChange={setMethod}
          options={[{ value: '', label: 'Not recorded' }, ...paymentMethods.map((m) => ({ value: m, label: m }))]}
        />
        <SelectInput
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'paused', label: 'Paused' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
        />
      </div>
      {!rateOk && <p className="mt-3 text-sm text-accent-deep">GST rate must be between 0 and 28.</p>}
      <div className="mt-5">
        <TextArea label="Notes" value={notes} onChange={setNotes} rows={3} />
      </div>
      {error && (
        <p role="alert" className="mt-4 text-sm text-accent-deep">
          {error}
        </p>
      )}
    </Panel>
  )
}
