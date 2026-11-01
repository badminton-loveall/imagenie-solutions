export type DocKind = 'quotation' | 'invoice'
export type DocStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'paid' | 'cancelled'

export const docStatusesFor: Record<DocKind, DocStatus[]> = {
  quotation: ['draft', 'sent', 'accepted', 'declined', 'cancelled'],
  invoice: ['draft', 'sent', 'paid', 'cancelled'],
}

export const docStatusLabel: Record<DocStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  declined: 'Declined',
  paid: 'Paid',
  cancelled: 'Cancelled',
}

export const docKindLabel: Record<DocKind, { one: string; many: string }> = {
  quotation: { one: 'Quotation', many: 'Quotations' },
  invoice: { one: 'Invoice', many: 'Invoices' },
}

export type Doc = {
  id: string
  created_at: string
  updated_at: string
  kind: DocKind
  number: string | null
  status: DocStatus
  issue_date: string
  due_date: string | null
  customer_name: string
  customer_address: string | null
  customer_email: string | null
  customer_phone: string | null
  customer_gstin: string | null
  customer_state: string | null
  subtotal: number
  tax_total: number
  total: number
  notes: string | null
  terms: string | null
  quotation_id: string | null
  subscription_id: string | null
  lead_id: string | null
  transaction_id: string | null
}

export type DocItem = {
  id?: string
  document_id?: string
  position: number
  description: string
  hsn_sac: string | null
  quantity: number
  unit: string | null
  unit_price: number
  gst_rate: number
}

/** What a new document can be started from (a lead or a customer subscription). */
export type DocPrefill = {
  customer_name?: string
  customer_email?: string | null
  customer_phone?: string | null
  lead_id?: string
  subscription_id?: string
  items?: Pick<DocItem, 'description' | 'quantity' | 'unit_price'>[]
}

export function normaliseDoc(d: Doc): Doc {
  return { ...d, subtotal: Number(d.subtotal), tax_total: Number(d.tax_total), total: Number(d.total) }
}
export function normaliseItem(i: DocItem): DocItem {
  return { ...i, quantity: Number(i.quantity), unit_price: Number(i.unit_price), gst_rate: Number(i.gst_rate) }
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export function lineAmount(i: Pick<DocItem, 'quantity' | 'unit_price'>): number {
  return round2(i.quantity * i.unit_price)
}
export function lineTax(i: Pick<DocItem, 'quantity' | 'unit_price' | 'gst_rate'>): number {
  return round2((i.quantity * i.unit_price * i.gst_rate) / 100)
}

/**
 * Totals with the GST split the way it prints: CGST + SGST when the customer is in
 * the same state as Imagenie, IGST otherwise. Matches the database's own total.
 */
export function docTotals(items: Pick<DocItem, 'quantity' | 'unit_price' | 'gst_rate'>[], sameState: boolean) {
  const subtotal = round2(items.reduce((s, i) => s + i.quantity * i.unit_price, 0))
  const tax = round2(items.reduce((s, i) => s + lineTax(i), 0))
  const half = round2(tax / 2)
  return {
    subtotal,
    tax,
    total: round2(subtotal + tax),
    cgst: sameState ? half : 0,
    sgst: sameState ? round2(tax - half) : 0,
    igst: sameState ? 0 : tax,
  }
}

export function isSameState(businessState: string, customerState: string | null): boolean {
  if (!customerState) return true
  return businessState.trim().toLowerCase() === customerState.trim().toLowerCase()
}

/* ---------- Amount in words, Indian numbering (lakh, crore) ---------- */

const ones = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen',
  'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
]
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function belowHundred(n: number): string {
  if (n < 20) return ones[n]
  return [tens[Math.floor(n / 10)], ones[n % 10]].filter(Boolean).join(' ')
}
function belowThousand(n: number): string {
  const h = Math.floor(n / 100)
  const rest = n % 100
  return [h ? `${ones[h]} Hundred` : '', rest ? belowHundred(rest) : ''].filter(Boolean).join(' ')
}
function wholeInWords(n: number): string {
  if (n === 0) return 'Zero'
  const crore = Math.floor(n / 10000000)
  const lakh = Math.floor((n % 10000000) / 100000)
  const thousand = Math.floor((n % 100000) / 1000)
  const rest = n % 1000
  return [
    crore ? `${wholeInWords(crore)} Crore` : '',
    lakh ? `${belowHundred(lakh)} Lakh` : '',
    thousand ? `${belowHundred(thousand)} Thousand` : '',
    rest ? belowThousand(rest) : '',
  ]
    .filter(Boolean)
    .join(' ')
}

export function amountInWords(amount: number): string {
  const rupees = Math.floor(amount)
  const paise = Math.round((amount - rupees) * 100)
  return `Rupees ${wholeInWords(rupees)}${paise ? ` and ${belowHundred(paise)} Paise` : ''} Only`
}

export const indianStates = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Outside India',
]
