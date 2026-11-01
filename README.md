# Imagenie Solutions website

The company website for Imagenie Solutions, Thrissur: Imagenie Labs products (Qwait, Smrithi, LoveAll), custom applications, and Imagenie Studios video production.

Built with Vite, React 18, TypeScript, Tailwind CSS v4 and React Router.

## Run it

```bash
npm install
npm run dev        # local dev server at http://localhost:5173
npm run build      # type-check and build to dist/
npm run preview    # serve the built site locally
```

## Pages

| Route      | File                     |
| ---------- | ------------------------ |
| `/`        | `src/pages/Home.tsx`     |
| `/contact` | `src/pages/Contact.tsx`  |
| other      | `src/pages/NotFound.tsx` |

Home sections can be linked directly: `/#products`, `/#custom`, `/#studios`. The contact page accepts `?interest=product`, `custom` or `video` to preselect the enquiry type.

## Where to change things

- **Company details and products** (email, phone, address, product copy and links): `src/data/company.ts`
- **Colours and fonts**: the `@theme` block in `src/index.css`. Fonts load from Google Fonts in `index.html`.
- **Header and footer**: `src/components/SiteHeader.tsx`, `src/components/SiteFooter.tsx`

## Visual direction: Ticket Stub

Each product is shown as the paper it prints: a Qwait token, a Smrithi photo slip, a LoveAll fee receipt.

- Base: cool chalk `#f1f4f2`, peacock ink `#0f2a2e`
- Slip tints: yellow `#f6e283`, pink `#f5c2cf`, green `#c3e5c7`; stamp red `#d3305f`
- Type: Big Shoulders Display (headlines, token numbers), Atkinson Hyperlegible (body)
- One motion moment: the hero slips drop in on load, switched off for people who reduce motion

The design source lives in the Imagenie Magic Patterns workspace.

## Admin: leads and subscriptions (`/admin`)

Sign in at `/admin` with an approved email. There's no password: you get a one-time sign-in link by email.

- **Leads** (`/admin/leads`): every website enquiry, filterable by status and by follow-ups that are due, with search. Open one to call, email or WhatsApp them, set status, assign it, pick a follow-up date and keep notes. "Add as subscription" turns a lead into a customer and marks it won.
- **Subscriptions** (`/admin/subscriptions`): customers, product, plan, amount, billing cycle, status and renewal date. The strip at the top shows monthly recurring revenue (active plans only; quarterly and yearly amounts spread per month, one-time payments excluded), active and trial counts, renewals in the next 30 days and past-due accounts. Overdue renewals are highlighted.

### Finance

- **Overview** (`/admin/overview`): money in, money out and profit for an Indian financial year (April to March), month by month, spending by category, GST paid and collected, and bills and customer renewals due in the next 30 days.
- **Transactions** (`/admin/transactions`): the ledger. Add money in or out, or upload a receipt (screenshot or PDF) and the form fills itself. Foreign-currency receipts ask for the rupee amount from your statement; until it's added they're flagged "Needs ₹ amount" and left out of totals. **Export CSV** gives your accountant the filtered list.
- **Bills** (`/admin/bills`): subscriptions Imagenie pays for. **Paid** records the payment as an expense and moves the next due date on by the billing cycle.
- **Customers** (`/admin/subscriptions`): **Record payment** adds the customer's payment to income and moves their renewal date on.
- **Settings** (`/admin/settings`): business name, address and GSTIN. With a GSTIN set, the Overview shows GST payable (collected minus paid).

**Receipt reading** runs in the Supabase function `extract-receipt` (source in `supabase/functions/extract-receipt`), which sends the uploaded file to Claude (`claude-haiku-5-5`). It needs one secret: in Supabase, open Edge Functions → Secrets and add `ANTHROPIC_API_KEY` with a key from console.anthropic.com. Receipts are stored in the private `receipts` storage bucket; only admins can open them.

**Who can get in:** emails in the `admin_users` table. To add someone, insert their email (lowercase) in Supabase Table Editor → `admin_users`. Anyone else who signs in sees a "no admin access" message and no data; row-level security enforces this in the database, not just the page.

**One-time Supabase setup for sign-in links:** in the Supabase dashboard, open the imagenie project, then Authentication → URL Configuration. Set **Site URL** to the live site address, and add these to **Redirect URLs**:

- `http://localhost:5173/admin/leads` (local development)
- `https://<your live domain>/admin/leads`

Without this, sign-in links send people to the wrong address. Supabase's built-in email sender allows only a few sign-in emails per hour, which is enough for a small team; connect your own SMTP under Authentication → Emails for more.

## Contact form and leads CRM

Enquiries from `/contact` are saved to the `leads` table in the **imagenie** Supabase project (`ovkxyvstnavhhwacxkul`, Mumbai). The form posts straight to Supabase's REST API from `src/lib/leads.ts`; no extra package is needed. If saving fails, the visitor is offered the same message pre-filled in their email app, and the WhatsApp box always works.

**Working the leads:** open the project in the Supabase dashboard, then Table Editor → `leads`. Each lead has:

| Column | Filled by | Use |
| ------ | --------- | --- |
| `interest`, `name`, `organisation`, `email`, `phone`, `message` | Visitor | What they asked for |
| `status` | Team | `new` → `contacted` → `qualified` → `won` / `lost` |
| `assigned_to` | Team | Who is handling it |
| `follow_up_on` | Team | Date to get back to them |
| `notes` | Team | Call notes, quotes, next steps |
| `created_at`, `updated_at` | Automatic | `updated_at` changes whenever the team edits the row |

**Security:** row-level security lets the public site insert the visitor fields only. Visitors cannot read, edit or delete any lead, or write the team columns. Only signed-in dashboard users see the data.

**Configuration:** `.env` holds `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Both are public by design and safe to commit. Never add a secret or `service_role` key there; use `.env.local`, which git ignores.

The schema is in `supabase/migrations/`.

## Deploying

It builds to a static site in `dist/`. Because it uses client-side routing, the host must serve `index.html` for every path; `vercel.json` (Vercel) and `public/_redirects` (Netlify) already do this.
