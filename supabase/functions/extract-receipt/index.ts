// Reads an uploaded receipt or invoice (image or PDF) from the private `receipts` bucket
// and returns its details using Claude, so the admin form can fill itself in.
//
// Needs the secret ANTHROPIC_API_KEY (Supabase dashboard → Edge Functions → Secrets).
// Only signed-in admins can use it: the receipt is downloaded with the caller's own
// session, so row-level security on storage refuses everyone else.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { encodeBase64 } from 'jsr:@std/encoding@1/base64'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const EXPENSE_CATEGORIES = [
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
]
const INCOME_CATEGORIES = ['Product subscription', 'Custom app project', 'Video production', 'Other income']

const recordTool = {
  name: 'record_receipt',
  description: 'Record the details read from one receipt or invoice.',
  input_schema: {
    type: 'object',
    properties: {
      kind: {
        type: 'string',
        enum: ['expense', 'income'],
        description: 'expense if Imagenie (the bill-to party) paid someone; income if Imagenie issued it to a customer.',
      },
      party: { type: 'string', description: 'The other business: the seller/vendor for an expense, the customer for income. Not Imagenie.' },
      description: { type: 'string', description: 'Short line describing what was bought or sold, e.g. "Claude Pro, Oct 27 to Nov 27".' },
      category: { type: 'string', enum: [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES] },
      txn_date: { type: 'string', description: 'Date paid (or issued, if unpaid) as YYYY-MM-DD.' },
      currency: { type: 'string', enum: ['INR', 'USD', 'EUR', 'GBP'] },
      amount: { type: 'number', description: 'Grand total including tax, in the receipt currency.' },
      tax_amount: { type: 'number', description: 'GST/VAT/tax included in the total, in the receipt currency. 0 if none.' },
      tax_rate: { type: 'number', description: 'Tax percentage, e.g. 18. 0 if none.' },
      invoice_number: { type: 'string', description: 'Invoice or receipt number, or empty string.' },
      payment_method: { type: 'string', enum: ['UPI', 'Card', 'Bank transfer', 'Cash', 'Other', ''], description: 'How it was paid, if shown.' },
      status: { type: 'string', enum: ['paid', 'pending'], description: 'paid if the document shows payment made, pending if it is an unpaid invoice.' },
      is_recurring: { type: 'boolean', description: 'True for a subscription or plan that renews.' },
      billing_cycle: { type: 'string', enum: ['monthly', 'quarterly', 'yearly', 'one_time'] },
      next_due_date: { type: 'string', description: 'If recurring and the service period end is shown, that end date as YYYY-MM-DD; otherwise empty string.' },
      plan: { type: 'string', description: 'Plan or product name if recurring, e.g. "Claude Pro"; otherwise empty string.' },
    },
    required: ['kind', 'party', 'description', 'category', 'txn_date', 'currency', 'amount', 'tax_amount', 'tax_rate', 'status', 'is_recurring', 'billing_cycle'],
  },
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405)

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    return json({ error: 'Receipt reading is not set up yet: add the ANTHROPIC_API_KEY secret in Supabase → Edge Functions → Secrets.' }, 503)
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })

  // Admin check: the allowlist is only readable by admins.
  const { data: admins } = await supabase.from('admin_users').select('email').limit(1)
  if (!admins || admins.length === 0) return json({ error: 'Only Imagenie admins can read receipts.' }, 403)

  let path = ''
  try {
    path = String((await req.json()).path ?? '')
  } catch {
    return json({ error: 'Send JSON with the receipt path.' }, 400)
  }
  if (!path) return json({ error: 'Missing receipt path.' }, 400)

  const { data: file, error: dlError } = await supabase.storage.from('receipts').download(path)
  if (dlError || !file) return json({ error: `Couldn't open the receipt: ${dlError?.message ?? 'not found'}` }, 404)

  const bytes = new Uint8Array(await file.arrayBuffer())
  const lower = path.toLowerCase()
  const mediaType =
    file.type && file.type !== 'application/octet-stream'
      ? file.type
      : lower.endsWith('.pdf')
        ? 'application/pdf'
        : lower.endsWith('.png')
          ? 'image/png'
          : lower.endsWith('.webp')
            ? 'image/webp'
            : 'image/jpeg'

  const isPdf = mediaType === 'application/pdf'
  if (!isPdf && bytes.length > 5 * 1024 * 1024) {
    return json({ error: 'That image is over 5 MB. Upload a smaller screenshot, or the PDF.' }, 413)
  }

  const fileBlock = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: encodeBase64(bytes) } }
    : { type: 'image', source: { type: 'base64', media_type: mediaType, data: encodeBase64(bytes) } }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-5-5',
      max_tokens: 1024,
      tools: [recordTool],
      tool_choice: { type: 'tool', name: 'record_receipt' },
      messages: [
        {
          role: 'user',
          content: [
            fileBlock,
            {
              type: 'text',
              text:
                'This is a receipt or invoice for Imagenie Solutions, a software and video company in Thrissur, India. ' +
                'Read it and call record_receipt with its details. Copy numbers exactly as printed; do not convert currencies. ' +
                'The bill-to section describes Imagenie, so the party is the other business.',
            },
          ],
        },
      ],
    }),
  })

  if (!res.ok) {
    const detail = await res.text()
    console.error('Anthropic API error', res.status, detail)
    return json({ error: `The receipt reader failed (${res.status}). Fill the form in by hand, or try again.` }, 502)
  }

  const message = await res.json()
  const toolUse = (message.content ?? []).find((b: { type: string }) => b.type === 'tool_use')
  if (!toolUse) return json({ error: "The receipt couldn't be read. Fill the form in by hand." }, 422)

  return json({ fields: toolUse.input })
})
