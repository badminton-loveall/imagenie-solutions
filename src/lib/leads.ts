import type { Interest } from '../data/company'

/**
 * Saves a website enquiry to the `leads` table in the Imagenie Supabase project.
 *
 * The publishable key only lets visitors INSERT the form fields: row-level security
 * blocks reading, editing or deleting leads, and blocks the team-only CRM columns.
 * So this posts with `Prefer: return=minimal` and expects no row back.
 */

export type NewLead = {
  interest: Interest
  name: string
  organisation?: string
  email: string
  phone?: string
  message?: string
}

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export async function submitLead(lead: NewLead): Promise<void> {
  if (!url || !key) throw new Error('Supabase is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.')

  const blankToNull = (v?: string) => (v && v.trim() ? v.trim() : null)

  const res = await fetch(`${url}/rest/v1/leads`, {
    method: 'POST',
    headers: {
      apikey: key,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      interest: lead.interest,
      name: lead.name.trim(),
      organisation: blankToNull(lead.organisation),
      email: lead.email.trim(),
      phone: blankToNull(lead.phone),
      message: blankToNull(lead.message),
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Saving the enquiry failed (${res.status}). ${detail}`)
  }
}
