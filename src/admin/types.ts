import type { Interest } from '../data/company'

export const leadStatuses = ['new', 'contacted', 'qualified', 'won', 'lost'] as const
export type LeadStatus = (typeof leadStatuses)[number]

export const leadStatusLabel: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  won: 'Won',
  lost: 'Lost',
}

export type Lead = {
  id: string
  created_at: string
  updated_at: string
  interest: Interest
  name: string
  organisation: string | null
  email: string
  phone: string | null
  message: string | null
  source: string
  status: LeadStatus
  assigned_to: string | null
  follow_up_on: string | null
  notes: string | null
}

export const subscriptionStatuses = ['trial', 'active', 'past_due', 'cancelled', 'expired'] as const
export type SubscriptionStatus = (typeof subscriptionStatuses)[number]

export const subscriptionStatusLabel: Record<SubscriptionStatus, string> = {
  trial: 'Trial',
  active: 'Active',
  past_due: 'Past due',
  cancelled: 'Cancelled',
  expired: 'Expired',
}

export const billingCycles = ['monthly', 'quarterly', 'yearly', 'one_time'] as const
export type BillingCycle = (typeof billingCycles)[number]

export const billingCycleLabel: Record<BillingCycle, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
  one_time: 'One-time',
}

export const subscriptionProducts = ['Qwait', 'Smrithi', 'LoveAll', 'Custom app', 'Video production'] as const
export type SubscriptionProduct = (typeof subscriptionProducts)[number]

export type Subscription = {
  id: string
  created_at: string
  updated_at: string
  customer: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  product: SubscriptionProduct
  plan: string | null
  amount_inr: number
  billing_cycle: BillingCycle
  status: SubscriptionStatus
  start_date: string
  renewal_date: string | null
  lead_id: string | null
  notes: string | null
}

export type AdminUser = { email: string; name: string | null }

/** Today's date as YYYY-MM-DD in the browser's time zone, to compare with Postgres `date` columns. */
export function todayISO(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
const dateTimeFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

/** Formats a Postgres `date` (YYYY-MM-DD) without time-zone shifting. */
export function formatDate(iso: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return dateFmt.format(new Date(y, m - 1, d))
}

export function formatDateTime(ts: string): string {
  return dateTimeFmt.format(new Date(ts))
}

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
export function formatINR(n: number): string {
  return inr.format(n)
}

/** What a subscription is worth per month. One-time payments are not recurring, so 0. */
export function monthlyValue(s: Pick<Subscription, 'amount_inr' | 'billing_cycle'>): number {
  const amount = Number(s.amount_inr) || 0
  if (s.billing_cycle === 'monthly') return amount
  if (s.billing_cycle === 'quarterly') return amount / 3
  if (s.billing_cycle === 'yearly') return amount / 12
  return 0
}
