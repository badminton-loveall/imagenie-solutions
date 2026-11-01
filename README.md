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
