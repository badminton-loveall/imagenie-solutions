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

## Contact form

There is no backend yet. Submitting the form opens the visitor's email app with the enquiry addressed to `info@imageniestudio.in`, and the WhatsApp box opens a chat with the company number. To receive submissions directly, replace the `mailto:` hand-off in `onSubmit` in `src/pages/Contact.tsx` with a call to a form service or your own API.

## Deploying

It builds to a static site in `dist/`. Because it uses client-side routing, the host must serve `index.html` for every path; `vercel.json` (Vercel) and `public/_redirects` (Netlify) already do this.
