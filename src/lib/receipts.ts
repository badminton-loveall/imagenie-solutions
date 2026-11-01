import { supabase } from './supabase'
import type { ReceiptFields } from '../admin/financeTypes'

const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf']

/** Uploads a receipt to the private `receipts` bucket and returns its storage path. */
export async function uploadReceipt(file: File): Promise<string> {
  if (!allowed.includes(file.type)) throw new Error('Upload a PNG, JPG, WebP or PDF file.')
  if (file.size > 10 * 1024 * 1024) throw new Error('That file is over 10 MB. Upload a smaller copy.')
  const ext = (file.name.split('.').pop() || (file.type === 'application/pdf' ? 'pdf' : 'png')).toLowerCase()
  const now = new Date()
  const path = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('receipts').upload(path, file, { contentType: file.type })
  if (error) throw new Error(`The receipt didn't upload: ${error.message}`)
  return path
}

/** Asks the receipt reader (Supabase function using Claude) to read an uploaded receipt. */
export async function readReceipt(path: string): Promise<ReceiptFields> {
  const { data, error } = await supabase.functions.invoke('extract-receipt', { body: { path } })
  if (error) {
    // The function returns a readable message in its JSON body.
    let message = error.message
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      try {
        message = (await ctx.json()).error ?? message
      } catch {
        /* keep the generic message */
      }
    }
    throw new Error(message)
  }
  return (data as { fields: ReceiptFields }).fields
}

/** A short-lived link to view a stored receipt. */
export async function receiptLink(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 60 * 10)
  if (error || !data) throw new Error(`The receipt couldn't be opened: ${error?.message ?? 'unknown error'}`)
  return data.signedUrl
}
