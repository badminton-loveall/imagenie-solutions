import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Mail, Printer } from 'lucide-react'

import { supabase } from '../lib/supabase'
import type { BusinessSettings } from './financeTypes'
import {
  amountInWords,
  docTotals,
  isSameState,
  lineAmount,
  normaliseDoc,
  normaliseItem,
  type Doc,
  type DocItem,
} from './docTypes'
import { formatDate, formatINR } from './types'

/** A4 page for printing or saving as PDF. Uses the browser's own print dialog. */
export function DocumentPrint() {
  const { id } = useParams()
  const [doc, setDoc] = useState<Doc | null>(null)
  const [items, setItems] = useState<DocItem[]>([])
  const [s, setS] = useState<BusinessSettings | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      const [d, it, bs] = await Promise.all([
        supabase.from('documents').select('*').eq('id', id).maybeSingle(),
        supabase.from('document_items').select('*').eq('document_id', id).order('position'),
        supabase.from('business_settings').select('*').maybeSingle(),
      ])
      if (d.error || !d.data || bs.error || !bs.data) {
        setError(d.error?.message ?? bs.error?.message ?? 'Document not found.')
        return
      }
      const docData = normaliseDoc(d.data as Doc)
      setDoc(docData)
      setItems(((it.data ?? []) as DocItem[]).map(normaliseItem))
      setS(bs.data as BusinessSettings)
      document.title = `${docData.number ?? 'Draft'} ${docData.customer_name}`.replace(/\//g, '-')
    })()
  }, [id])

  if (error) return <p className="p-8 text-accent-deep">{error}</p>
  if (!doc || !s) return <p className="p-8 text-ink-soft">Preparing the page…</p>

  const registered = !!s.gstin
  const sameState = isSameState(s.state, doc.customer_state)
  const t = docTotals(items, sameState)
  const isInvoice = doc.kind === 'invoice'
  const title = isInvoice ? (registered ? 'Tax Invoice' : 'Invoice') : 'Quotation'
  const showGst = registered && t.tax > 0

  const mailto = doc.customer_email
    ? `mailto:${doc.customer_email}?subject=${encodeURIComponent(`${title} ${doc.number ?? ''} from ${s.legal_name}`)}&body=${encodeURIComponent(
        `Hello,\n\nPlease find attached ${title.toLowerCase()} ${doc.number ?? ''} for ${formatINR(t.total)}.${
          isInvoice && doc.due_date ? ` It is due on ${formatDate(doc.due_date)}.` : ''
        }${s.upi_id && isInvoice ? `\n\nYou can pay by UPI to ${s.upi_id}.` : ''}\n\nThank you,\n${s.legal_name}`,
      )}`
    : null

  return (
    <div className="min-h-screen bg-paper-deep py-8 print:bg-white print:py-0">
      {/* Toolbar */}
      <div className="no-print mx-auto mb-6 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4">
        <Link to={`/admin/documents/${doc.id}`} className="inline-flex items-center gap-1.5 text-sm font-bold text-ink-soft hover:text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to editing
        </Link>
        <div className="flex flex-wrap gap-2">
          {mailto && (
            <a href={mailto} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-line bg-white px-4 py-2 text-sm font-bold hover:border-ink">
              <Mail className="h-4 w-4" aria-hidden /> Email draft
            </a>
          )}
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-ink px-4 py-2 text-sm font-bold text-paper hover:bg-accent"
          >
            <Printer className="h-4 w-4" aria-hidden /> Print or save as PDF
          </button>
        </div>
        <p className="w-full text-xs text-ink-soft">
          To save a PDF, press Print and choose "Save as PDF". "Email draft" opens your email app with a message ready; attach the
          PDF before sending.
        </p>
      </div>

      {/* The page */}
      <article className="doc-page mx-auto w-full max-w-[210mm] bg-white px-[14mm] py-[14mm] text-[12px] leading-snug text-ink shadow-[0_20px_50px_-30px_rgba(15,42,46,0.5)] print:max-w-none print:p-0 print:shadow-none">
        {doc.status === 'draft' && (
          <p className="mb-4 rounded-[3px] bg-slip-pink px-3 py-1.5 text-center text-[11px] font-bold">
            Draft: not yet issued. Issue it to give it a number before sending.
          </p>
        )}
        {doc.status === 'cancelled' && (
          <p className="mb-4 rounded-[3px] bg-accent text-center text-[11px] font-bold text-white">This document has been cancelled.</p>
        )}

        <header className="flex items-start justify-between gap-8 border-b-2 border-ink pb-5">
          <div>
            <p className="font-display text-[34px] font-black leading-none">{s.legal_name}</p>
            {s.address && <p className="mt-2 max-w-[90mm] whitespace-pre-line text-ink-soft">{s.address}</p>}
            <p className="mt-1 text-ink-soft">{[s.phone, s.email].filter(Boolean).join('   ')}</p>
            {registered && <p className="mt-1 font-bold">GSTIN {s.gstin}</p>}
          </div>
          <div className="text-right">
            <p className="font-display text-[28px] font-black uppercase leading-none tracking-wide">{title}</p>
            <table className="ml-auto mt-3 text-left">
              <tbody>
                <tr>
                  <td className="pr-3 text-ink-soft">Number</td>
                  <td className="font-bold">{doc.number ?? 'Draft'}</td>
                </tr>
                <tr>
                  <td className="pr-3 text-ink-soft">Date</td>
                  <td>{formatDate(doc.issue_date)}</td>
                </tr>
                {doc.due_date && (
                  <tr>
                    <td className="pr-3 text-ink-soft">{isInvoice ? 'Due' : 'Valid until'}</td>
                    <td>{formatDate(doc.due_date)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </header>

        <section className="mt-5 grid grid-cols-2 gap-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">{isInvoice ? 'Bill to' : 'Prepared for'}</p>
            <p className="mt-1 text-[14px] font-bold">{doc.customer_name}</p>
            {doc.customer_address && <p className="whitespace-pre-line text-ink-soft">{doc.customer_address}</p>}
            {(doc.customer_phone || doc.customer_email) && (
              <p className="text-ink-soft">{[doc.customer_phone, doc.customer_email].filter(Boolean).join('   ')}</p>
            )}
            {doc.customer_gstin && <p className="mt-1">GSTIN {doc.customer_gstin}</p>}
          </div>
          {registered && (
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">Place of supply</p>
              <p className="mt-1">{doc.customer_state ?? s.state}</p>
            </div>
          )}
        </section>

        <table className="mt-6 w-full border-collapse">
          <thead>
            <tr className="border-y-2 border-ink text-left text-[10px] font-bold uppercase tracking-wide">
              <th className="w-8 py-2">#</th>
              <th className="py-2">Description</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2 text-right">Rate</th>
              {showGst && <th className="py-2 text-right">GST</th>}
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i, idx) => (
              <tr key={i.id ?? idx} className="border-b border-dashed border-line align-top">
                <td className="py-2.5 text-ink-soft">{idx + 1}</td>
                <td className="py-2.5 pr-4">
                  {i.description}
                  {i.hsn_sac && <span className="block text-[10px] text-ink-soft">HSN/SAC {i.hsn_sac}</span>}
                </td>
                <td className="whitespace-nowrap py-2.5 text-right">
                  {i.quantity} {i.unit ?? ''}
                </td>
                <td className="whitespace-nowrap py-2.5 text-right">{formatINR(i.unit_price)}</td>
                {showGst && <td className="py-2.5 text-right">{i.gst_rate}%</td>}
                <td className="whitespace-nowrap py-2.5 text-right font-bold">{formatINR(lineAmount(i))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="mt-4 flex justify-end">
          <dl className="w-[80mm]">
            <div className="flex justify-between py-1">
              <dt className="text-ink-soft">Subtotal</dt>
              <dd>{formatINR(t.subtotal)}</dd>
            </div>
            {showGst &&
              (sameState ? (
                <>
                  <div className="flex justify-between py-1">
                    <dt className="text-ink-soft">CGST</dt>
                    <dd>{formatINR(t.cgst)}</dd>
                  </div>
                  <div className="flex justify-between py-1">
                    <dt className="text-ink-soft">SGST</dt>
                    <dd>{formatINR(t.sgst)}</dd>
                  </div>
                </>
              ) : (
                <div className="flex justify-between py-1">
                  <dt className="text-ink-soft">IGST</dt>
                  <dd>{formatINR(t.igst)}</dd>
                </div>
              ))}
            <div className="mt-1 flex items-baseline justify-between rounded-[3px] bg-slip-yellow px-3 py-2 print:[print-color-adjust:exact]">
              <dt className="font-bold">Total</dt>
              <dd className="font-display text-[22px] font-black">{formatINR(t.total)}</dd>
            </div>
          </dl>
        </section>
        <p className="mt-2 text-right text-[11px] italic text-ink-soft">{amountInWords(t.total)}</p>

        {isInvoice && (s.upi_id || s.bank_account_number) && doc.status !== 'paid' && (
          <section className="mt-6 rounded-[3px] border-2 border-dashed border-line p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">How to pay</p>
            <div className="mt-2 grid grid-cols-2 gap-6">
              {s.upi_id && (
                <p>
                  UPI: <span className="font-bold">{s.upi_id}</span>
                </p>
              )}
              {s.bank_account_number && (
                <p>
                  {s.bank_account_name && <span className="block">{s.bank_account_name}</span>}
                  {s.bank_name && <span className="block">{s.bank_name}</span>}
                  <span className="block">
                    Account <span className="font-bold">{s.bank_account_number}</span>
                  </span>
                  {s.bank_ifsc && <span className="block">IFSC {s.bank_ifsc}</span>}
                </p>
              )}
            </div>
          </section>
        )}
        {isInvoice && doc.status === 'paid' && (
          <p className="mt-6 inline-block rotate-[-4deg] rounded-[4px] border-[3px] border-good px-3 py-1 font-display text-2xl font-black text-good">PAID</p>
        )}

        {(doc.notes || doc.terms) && (
          <section className="mt-6 grid grid-cols-2 gap-8 text-[11px]">
            {doc.notes && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">Notes</p>
                <p className="mt-1 whitespace-pre-line">{doc.notes}</p>
              </div>
            )}
            {doc.terms && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">Terms</p>
                <p className="mt-1 whitespace-pre-line">{doc.terms}</p>
              </div>
            )}
          </section>
        )}

        <footer className="mt-12 flex items-end justify-between gap-8">
          <p className="text-[10px] text-ink-faint">{registered ? '' : 'Not registered under GST.'}</p>
          <div className="text-right">
            <p>For {s.legal_name}</p>
            <div className="mt-10 border-t border-ink pt-1 text-[10px] text-ink-soft">Authorised signatory</div>
          </div>
        </footer>
      </article>
    </div>
  )
}
