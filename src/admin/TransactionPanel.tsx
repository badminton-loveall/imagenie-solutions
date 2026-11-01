import { useState } from 'react'
import { ExternalLink } from 'lucide-react'

import { supabase } from '../lib/supabase'
import { readReceipt, receiptLink, uploadReceipt } from '../lib/receipts'
import { ReceiptDrop } from './ReceiptDrop'
import {
  currencies,
  expenseCategories,
  incomeCategories,
  normaliseTxn,
  paymentMethods,
  type Currency,
  type ReceiptFields,
  type Transaction,
  type TxnKind,
  type TxnStatus,
} from './financeTypes'
import { billingCycleLabel, billingCycles, formatDateTime, todayISO, type BillingCycle } from './types'
import { Panel, SelectInput, TextArea, TextInput, dangerLink, primaryButton, secondaryButton } from './ui'

type Props = {
  transaction: Transaction | null
  /** For a new transaction: which kind to start with. */
  startKind?: TxnKind
  /** Open straight into the file picker flow (from "Upload receipt"). */
  onClose: () => void
  onSaved: (t: Transaction) => void
  onDeleted: (id: string) => void
}

const num = (v: string) => (v.trim() === '' ? NaN : Number(v))

export function TransactionPanel({ transaction: t, startKind = 'expense', onClose, onSaved, onDeleted }: Props) {
  const [kind, setKind] = useState<TxnKind>(t?.kind ?? startKind)
  const [date, setDate] = useState(t?.txn_date ?? todayISO())
  const [party, setParty] = useState(t?.party ?? '')
  const [description, setDescription] = useState(t?.description ?? '')
  const [category, setCategory] = useState(t?.category ?? (startKind === 'income' ? incomeCategories[0] : expenseCategories[0]))
  const [currency, setCurrency] = useState<Currency>(t?.currency ?? 'INR')
  const [amount, setAmount] = useState(t ? String(t.amount) : '')
  const [tax, setTax] = useState(t ? String(t.tax_amount) : '0')
  const [amountInr, setAmountInr] = useState(t?.amount_inr != null && t.currency !== 'INR' ? String(t.amount_inr) : '')
  const [invoice, setInvoice] = useState(t?.invoice_number ?? '')
  const [method, setMethod] = useState<string>(t?.payment_method ?? '')
  const [status, setStatus] = useState<TxnStatus>(t?.status ?? 'paid')
  const [notes, setNotes] = useState(t?.notes ?? '')
  const [receiptPath, setReceiptPath] = useState<string | null>(t?.receipt_path ?? null)

  // Offer to create a bill when the receipt is a renewing subscription.
  const [suggestBill, setSuggestBill] = useState<null | { plan: string; cycle: BillingCycle; nextDue: string; rate: number }>(null)
  const [alsoBill, setAlsoBill] = useState(false)

  const [reading, setReading] = useState<{ tone: 'idle' | 'working' | 'done' | 'error'; message: string }>({
    tone: 'idle',
    message: t?.receipt_path ? 'Receipt attached. Upload another to replace it.' : 'Drop a receipt or invoice here (screenshot or PDF) and the form fills itself.',
  })
  const [busy, setBusy] = useState<'saving' | 'deleting' | null>(null)
  const [error, setError] = useState('')

  const categories = kind === 'income' ? incomeCategories : expenseCategories

  const applyFields = (f: ReceiptFields) => {
    setKind(f.kind)
    if (f.txn_date && /^\d{4}-\d{2}-\d{2}$/.test(f.txn_date)) setDate(f.txn_date)
    if (f.party) setParty(f.party)
    if (f.description) setDescription(f.description)
    const cats: readonly string[] = f.kind === 'income' ? incomeCategories : expenseCategories
    setCategory(cats.includes(f.category) ? f.category : cats[0])
    setCurrency(f.currency)
    setAmount(String(f.amount ?? ''))
    setTax(String(f.tax_amount ?? 0))
    if (f.currency === 'INR') setAmountInr('')
    if (f.invoice_number) setInvoice(f.invoice_number)
    if (f.payment_method) setMethod(f.payment_method)
    setStatus(f.status === 'pending' ? 'pending' : 'paid')
    if (!t && f.kind === 'expense' && f.is_recurring && f.billing_cycle !== 'one_time') {
      setSuggestBill({
        plan: f.plan || f.description,
        cycle: f.billing_cycle,
        nextDue: f.next_due_date && /^\d{4}-\d{2}-\d{2}$/.test(f.next_due_date) ? f.next_due_date : '',
        rate: Number(f.tax_rate) || 0,
      })
      setAlsoBill(true)
    }
  }

  const onFile = async (file: File) => {
    setError('')
    setReading({ tone: 'working', message: `Uploading ${file.name}…` })
    let path: string
    try {
      path = await uploadReceipt(file)
      setReceiptPath(path)
    } catch (e) {
      setReading({ tone: 'error', message: (e as Error).message })
      return
    }
    setReading({ tone: 'working', message: 'Reading the receipt. This takes a few seconds…' })
    try {
      const fields = await readReceipt(path)
      applyFields(fields)
      setReading({
        tone: 'done',
        message:
          fields.currency !== 'INR'
            ? `Filled in from the receipt. It's in ${fields.currency}: add the rupee amount from your card or bank statement, then check and save.`
            : 'Filled in from the receipt. Check the details, then save.',
      })
    } catch (e) {
      setReading({ tone: 'error', message: `Receipt saved, but it couldn't be read automatically: ${(e as Error).message}` })
    }
  }

  const amountN = num(amount)
  const taxN = num(tax)
  const inrN = currency === 'INR' ? amountN : num(amountInr)
  const amountOk = Number.isFinite(amountN) && amountN >= 0
  const taxOk = Number.isFinite(taxN) && taxN >= 0 && (!amountOk || taxN <= amountN)
  const inrOk = currency === 'INR' || amountInr.trim() === '' || (Number.isFinite(inrN) && inrN >= 0)
  const canSave = party.trim() !== '' && amountOk && taxOk && inrOk && busy === null && reading.tone !== 'working'

  const save = async () => {
    if (!canSave) return
    setBusy('saving')
    setError('')
    const row = {
      kind,
      txn_date: date || todayISO(),
      party: party.trim(),
      description: description.trim() || null,
      category,
      currency,
      amount: amountN,
      tax_amount: taxN,
      amount_inr: currency === 'INR' ? amountN : amountInr.trim() === '' ? null : inrN,
      invoice_number: invoice.trim() || null,
      payment_method: method || null,
      status,
      notes: notes.trim() || null,
      receipt_path: receiptPath,
    }

    let billId: string | null = null
    if (!t && alsoBill && suggestBill && kind === 'expense') {
      const { data: bill, error: billErr } = await supabase
        .from('recurring_expenses')
        .insert({
          vendor: row.party,
          plan: suggestBill.plan || null,
          category,
          amount: amountN,
          currency,
          amount_inr: row.amount_inr,
          gst_rate: suggestBill.rate,
          billing_cycle: suggestBill.cycle,
          next_due_date: suggestBill.nextDue || null,
          payment_method: row.payment_method,
        })
        .select('id')
        .single()
      if (billErr) {
        setBusy(null)
        setError(`The bill wasn't created: ${billErr.message}`)
        return
      }
      billId = (bill as { id: string }).id
    }

    const query = t
      ? supabase.from('transactions').update(row).eq('id', t.id).select().single()
      : supabase.from('transactions').insert({ ...row, recurring_expense_id: billId }).select().single()
    const { data, error } = await query
    setBusy(null)
    if (error) setError(`The transaction wasn't saved: ${error.message}`)
    else onSaved(normaliseTxn(data as Transaction))
  }

  const remove = async () => {
    if (!t || !window.confirm(`Delete this ${t.kind} from ${t.party}? This can't be undone.`)) return
    setBusy('deleting')
    const { error } = await supabase.from('transactions').delete().eq('id', t.id)
    if (!error && t.receipt_path) await supabase.storage.from('receipts').remove([t.receipt_path])
    setBusy(null)
    if (error) setError(`It wasn't deleted: ${error.message}`)
    else onDeleted(t.id)
  }

  const openReceipt = async () => {
    if (!receiptPath) return
    try {
      window.open(await receiptLink(receiptPath), '_blank', 'noopener,noreferrer')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <Panel
      title={t ? t.party : kind === 'income' ? 'Add income' : 'Add expense'}
      subtitle={t ? `Last changed ${formatDateTime(t.updated_at)}` : undefined}
      onClose={onClose}
      footer={
        <>
          {t ? (
            <button onClick={remove} disabled={busy !== null} className={dangerLink}>
              {busy === 'deleting' ? 'Deleting…' : 'Delete'}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className={secondaryButton}>
              Cancel
            </button>
            <button onClick={save} disabled={!canSave} className={primaryButton}>
              {busy === 'saving' ? 'Saving…' : t ? 'Save changes' : 'Save'}
            </button>
          </div>
        </>
      }
    >
      <ReceiptDrop busy={reading.tone === 'working'} tone={reading.tone} message={reading.message} onFile={onFile} />
      {receiptPath && (
        <button onClick={openReceipt} className="mt-2 inline-flex items-center gap-1 text-sm font-bold underline underline-offset-4 hover:text-accent-deep">
          View attached receipt <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}

      <div className="mt-6 space-y-6">
        <div role="radiogroup" aria-label="Type" className="inline-flex rounded-full border-2 border-line bg-white p-1">
          {(['expense', 'income'] as const).map((k) => (
            <button
              key={k}
              role="radio"
              aria-checked={kind === k}
              onClick={() => {
                setKind(k)
                const cats: readonly string[] = k === 'income' ? incomeCategories : expenseCategories
                if (!cats.includes(category)) setCategory(cats[0])
              }}
              className={`rounded-full px-4 py-1.5 text-sm transition-colors duration-150 ${kind === k ? 'bg-ink font-bold text-paper' : 'text-ink-soft hover:text-ink'}`}
            >
              {k === 'expense' ? 'Money out' : 'Money in'}
            </button>
          ))}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <TextInput label={kind === 'income' ? 'Customer' : 'Paid to'} value={party} onChange={setParty} required />
          </div>
          <div className="sm:col-span-2">
            <TextInput label="Description" value={description} onChange={setDescription} placeholder="What it was for" />
          </div>
          <SelectInput label="Category" value={category} onChange={setCategory} options={categories.map((c) => ({ value: c, label: c }))} />
          <TextInput label="Date" type="date" value={date} onChange={setDate} />

          <SelectInput label="Currency" value={currency} onChange={setCurrency} options={currencies.map((c) => ({ value: c, label: c }))} />
          <TextInput label="Total, including GST" type="number" value={amount} onChange={setAmount} required />
          <TextInput label={kind === 'income' ? 'GST collected' : 'GST included'} type="number" value={tax} onChange={setTax} />
          {currency !== 'INR' ? (
            <TextInput label="Charged in ₹ (from your statement)" type="number" value={amountInr} onChange={setAmountInr} />
          ) : (
            <div />
          )}

          <TextInput label="Invoice or receipt number" value={invoice} onChange={setInvoice} />
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
              { value: 'paid', label: kind === 'income' ? 'Received' : 'Paid' },
              { value: 'pending', label: kind === 'income' ? 'Awaiting payment' : 'To pay' },
            ]}
          />
        </div>

        {!taxOk && <p className="text-sm text-accent-deep">GST must be a number no larger than the total.</p>}
        {currency !== 'INR' && amountInr.trim() === '' && (
          <p className="text-sm text-ink-soft">Without the rupee amount, this entry is left out of your totals until you add it.</p>
        )}

        {suggestBill && (
          <label className="flex items-start gap-3 rounded-[4px] bg-slip-green p-4 text-sm">
            <input type="checkbox" checked={alsoBill} onChange={(e) => setAlsoBill(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#0f2a2e]" />
            <span>
              <span className="font-bold">Also add {suggestBill.plan || party} to Bills.</span> It renews{' '}
              {billingCycleLabel[suggestBill.cycle].toLowerCase()}
              {suggestBill.nextDue ? `, next on ${suggestBill.nextDue}` : ''}. Next time, one tap on Paid records it.
              <span className="mt-2 block">
                <select
                  value={suggestBill.cycle}
                  onChange={(e) => setSuggestBill({ ...suggestBill, cycle: e.target.value as BillingCycle })}
                  className="rounded-[4px] border-2 border-ink/20 bg-white px-2 py-1 text-sm"
                  aria-label="Renews"
                >
                  {billingCycles
                    .filter((c) => c !== 'one_time')
                    .map((c) => (
                      <option key={c} value={c}>
                        {billingCycleLabel[c]}
                      </option>
                    ))}
                </select>
              </span>
            </span>
          </label>
        )}

        <TextArea label="Notes" value={notes} onChange={setNotes} rows={3} />

        {error && (
          <p role="alert" className="text-sm text-accent-deep">
            {error}
          </p>
        )}
      </div>
    </Panel>
  )
}
