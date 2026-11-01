import type { BillingCycle } from './types'

export const currencies = ['INR', 'USD', 'EUR', 'GBP'] as const
export type Currency = (typeof currencies)[number]

export const paymentMethods = ['UPI', 'Card', 'Bank transfer', 'Cash', 'Other'] as const
export type PaymentMethod = (typeof paymentMethods)[number]

export const expenseCategories = [
  'Software and subscriptions',
  'Hosting and domains',
  'Equipment',
  'Travel',
  'Marketing',
  'Salaries and contractors',
  'Rent and utilities',
  'Professional fees',
  'Bank charges',
  'Other expense',
] as const
export const incomeCategories = ['Product subscription', 'Custom app project', 'Video production', 'Other income'] as const

export type TxnKind = 'income' | 'expense'
export type TxnStatus = 'paid' | 'pending'

export type Transaction = {
  id: string
  created_at: string
  updated_at: string
  kind: TxnKind
  txn_date: string
  party: string
  description: string | null
  category: string
  amount: number
  tax_amount: number
  currency: Currency
  amount_inr: number | null
  invoice_number: string | null
  payment_method: PaymentMethod | null
  status: TxnStatus
  subscription_id: string | null
  recurring_expense_id: string | null
  receipt_path: string | null
  notes: string | null
}

export type BillStatus = 'active' | 'paused' | 'cancelled'

export type RecurringExpense = {
  id: string
  created_at: string
  updated_at: string
  vendor: string
  plan: string | null
  category: string
  amount: number
  currency: Currency
  amount_inr: number | null
  gst_rate: number
  billing_cycle: BillingCycle
  next_due_date: string | null
  status: BillStatus
  payment_method: PaymentMethod | null
  notes: string | null
}

export type BusinessSettings = {
  legal_name: string
  gstin: string | null
  state: string
  address: string | null
  email: string | null
  phone: string | null
  bank_name: string | null
  bank_account_name: string | null
  bank_account_number: string | null
  bank_ifsc: string | null
  upi_id: string | null
  invoice_terms: string | null
  quotation_terms: string | null
  updated_at: string
}

/** Fields the receipt reader returns. */
export type ReceiptFields = {
  kind: TxnKind
  party: string
  description: string
  category: string
  txn_date: string
  currency: Currency
  amount: number
  tax_amount: number
  tax_rate: number
  invoice_number?: string
  payment_method?: PaymentMethod | ''
  status: TxnStatus
  is_recurring: boolean
  billing_cycle: BillingCycle
  next_due_date?: string
  plan?: string
}

/** Numeric columns arrive from Postgres as strings; make them numbers. */
export function normaliseTxn(t: Transaction): Transaction {
  return {
    ...t,
    amount: Number(t.amount),
    tax_amount: Number(t.tax_amount),
    amount_inr: t.amount_inr === null ? null : Number(t.amount_inr),
  }
}
export function normaliseBill(b: RecurringExpense): RecurringExpense {
  return {
    ...b,
    amount: Number(b.amount),
    gst_rate: Number(b.gst_rate),
    amount_inr: b.amount_inr === null ? null : Number(b.amount_inr),
  }
}

/** GST part of a transaction in rupees, or null when the rupee amount isn't known yet. */
export function gstInr(t: Pick<Transaction, 'currency' | 'tax_amount' | 'amount' | 'amount_inr'>): number | null {
  if (t.currency === 'INR') return t.tax_amount
  if (t.amount_inr === null || t.amount === 0) return null
  return Math.round(((t.tax_amount * t.amount_inr) / t.amount) * 100) / 100
}

/* ---------- Indian financial year (April to March) ---------- */

/** The year the financial year starts in, e.g. 2026 for FY 2026-27. */
export function fyStartYear(iso: string): number {
  const [y, m] = iso.split('-').map(Number)
  return m >= 4 ? y : y - 1
}
export function fyLabel(startYear: number): string {
  return `FY ${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`
}
export function fyRange(startYear: number): { from: string; to: string } {
  return { from: `${startYear}-04-01`, to: `${startYear + 1}-03-31` }
}
/** The twelve months of a financial year as YYYY-MM, April first. */
export function fyMonths(startYear: number): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    const m = ((3 + i) % 12) + 1
    const y = m >= 4 ? startYear : startYear + 1
    return `${y}-${String(m).padStart(2, '0')}`
  })
}
const monthFmt = new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' })
export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return monthFmt.format(new Date(y, m - 1, 1))
}

/* ---------- CSV export for the accountant ---------- */

export function transactionsToCsv(rows: Transaction[]): string {
  const header = [
    'Date', 'Type', 'Party', 'Description', 'Category', 'Invoice number', 'Currency', 'Amount', 'GST', 'Amount INR', 'GST INR', 'Status', 'Payment method', 'Notes',
  ]
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = rows.map((t) =>
    [
      t.txn_date, t.kind, t.party, t.description, t.category, t.invoice_number, t.currency, t.amount.toFixed(2), t.tax_amount.toFixed(2),
      t.amount_inr?.toFixed(2) ?? '', gstInr(t)?.toFixed(2) ?? '', t.status, t.payment_method, t.notes,
    ]
      .map(esc)
      .join(','),
  )
  return [header.join(','), ...lines].join('\n')
}

export function downloadText(filename: string, text: string, type = 'text/csv') {
  const blob = new Blob(['﻿', text], { type: `${type};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const money = new Map<string, Intl.NumberFormat>()
export function formatMoney(amount: number, currency: Currency): string {
  if (!money.has(currency)) {
    money.set(currency, new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2, minimumFractionDigits: 0 }))
  }
  return money.get(currency)!.format(amount)
}
