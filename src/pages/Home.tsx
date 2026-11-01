import { Link } from 'react-router-dom'
import { ArrowRight, Mail, MessageCircle, Phone } from 'lucide-react'

import { HeroSlips } from '../components/HeroSlips'
import { ProductTicket } from '../components/ProductTicket'
import { company, products } from '../data/company'

const stack = [
  { title: 'Web applications', detail: 'Portals, dashboards and booking systems that work on any phone or laptop.' },
  { title: 'Backend and APIs', detail: 'Databases, payments by UPI, WhatsApp and SMS integrations.' },
  { title: 'Mobile-first by default', detail: 'Built for the phones your customers already carry.' },
  { title: 'Hosting and upkeep', detail: 'Deployed, monitored and kept up to date after launch.' },
]

const steps = [
  { title: 'Understand the problem', detail: 'We sit with the people who will use it and agree on what success looks like.' },
  { title: 'Design the simplest version', detail: 'Clickable screens you can try before a line of code is written.' },
  { title: 'Build in short rounds', detail: 'Working software to review every two weeks, not a surprise at the end.' },
  { title: 'Deploy, train, hand over', detail: 'Live on your domain, with your team shown how to use it.' },
  { title: 'Look after it', detail: 'Fixes, updates and new features as your business grows.' },
]

const studioWork = [
  { title: 'Brand and corporate films', detail: 'Who you are, in two minutes' },
  { title: 'Product demos and explainers', detail: 'Show how it works' },
  { title: 'Documentaries and interviews', detail: 'Real people, real places' },
  { title: 'Events and commercials', detail: 'Coverage and ads for social' },
]

export function Home() {
  return (
    <main>
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-12 sm:px-8 md:pt-16 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
        <div>
          <p className="text-sm text-ink-soft">Imagenie Labs and Imagenie Studios, Thrissur</p>
          <h1 className="mt-4 font-display text-[4.25rem] font-black leading-[0.88] tracking-[-0.01em] sm:text-[6rem] lg:text-[7.25rem]">
            Software people find easy to use.
          </h1>
          <p className="mt-7 max-w-lg text-lg leading-relaxed text-ink-soft">
            Ready-to-use products for Indian businesses, and custom applications built from scratch, deployed and handed
            over working. The kind of software that ends up on a token slip, a receipt or a guest's phone.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a
              href="#products"
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-ink px-5 py-3 text-sm font-bold text-paper transition-colors duration-150 hover:bg-accent"
            >
              See our products
            </a>
            <Link
              to="/contact?interest=custom"
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border-2 border-ink px-5 py-[10px] text-sm font-bold text-ink transition-colors duration-150 hover:bg-ink hover:text-paper"
            >
              Build a custom app
            </Link>
          </div>
        </div>

        <HeroSlips />
      </section>

      {/* Products */}
      <section id="products" className="scroll-mt-20 border-t-2 border-dashed border-line bg-paper-deep">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 md:py-24">
          <div className="grid gap-6 md:grid-cols-2 md:items-end">
            <h2 className="font-display text-5xl font-extrabold leading-[0.92] sm:text-6xl">Products you can start using today.</h2>
            <p className="max-w-md text-lg leading-relaxed text-ink-soft md:justify-self-end">
              Each one solves a single, everyday problem well. Sign up, set it up in minutes, and pay in rupees.
            </p>
          </div>

          <div className="mt-14 space-y-8">
            {products.map((p) => (
              <ProductTicket key={p.name} product={p} />
            ))}
          </div>
        </div>
      </section>

      {/* Custom apps */}
      <section id="custom" className="scroll-mt-20 bg-labs text-paper">
        <div className="mx-auto grid max-w-6xl gap-14 px-5 py-20 sm:px-8 md:py-24 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <p className="text-sm text-paper/60">Imagenie Labs, custom applications</p>
            <h2 className="mt-4 font-display text-5xl font-extrabold leading-[0.92] sm:text-6xl">
              Need something that doesn't exist yet? We'll build it.
            </h2>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-paper/75">
              Full-stack applications built from scratch, deployed on your domain and ready for your team on day one. One
              team from the first conversation to the live app, and after.
            </p>
            <dl className="mt-10 grid grid-cols-1 gap-x-8 gap-y-6 border-t border-dashed border-paper/25 pt-8 text-sm sm:grid-cols-2">
              {stack.map((s) => (
                <div key={s.title}>
                  <dt className="font-bold text-paper">{s.title}</dt>
                  <dd className="mt-1 leading-relaxed text-paper/65">{s.detail}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div>
            <p className="text-sm text-paper/60">How a custom build runs</p>
            <ol className="mt-5">
              {steps.map((s, i) => (
                <li key={s.title} className="grid grid-cols-[3rem_1fr] gap-4 border-t border-dashed border-paper/25 py-5 last:border-b">
                  <span className="font-display text-4xl font-black leading-none text-slip-yellow">{i + 1}</span>
                  <div>
                    <p className="text-lg font-bold">{s.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-paper/70">{s.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link
              to="/contact?interest=custom"
              className="mt-8 inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-slip-yellow px-5 py-3 text-sm font-bold text-ink transition-colors duration-150 hover:bg-paper"
            >
              Tell us what you need <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      {/* Belief */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 md:py-28">
        <p className="max-w-4xl text-3xl leading-snug sm:text-4xl">
          We'd rather ship one screen your staff understands on the first day than ten they need training for.
        </p>
        <p className="mt-5 max-w-2xl text-lg text-ink-soft">Fewer steps, plain language, and support from people in the same time zone.</p>
      </section>

      {/* Studios */}
      <section id="studios" className="scroll-mt-20 border-t-2 border-dashed border-line">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 sm:px-8 md:grid-cols-2 md:gap-16 md:py-24">
          <img
            src="https://cdn.magicpatterns.com/patterns/generated-images/3d541b85-d27e-46a9-beef-e18cbdeb4484.jpg"
            alt="Imagenie Studios crew filming an interview in a carpentry workshop"
            loading="lazy"
            className="aspect-[4/3] w-full rounded-[4px] object-cover"
          />
          <div>
            <p className="text-sm text-ink-faint">Imagenie Studios</p>
            <h2 className="mt-3 font-display text-5xl font-extrabold leading-[0.92]">Video production, from script to screen.</h2>
            <p className="mt-5 text-lg leading-relaxed text-ink-soft">
              Our production wing tells stories for brands, products and people: planned, shot and edited by one crew.
            </p>
            <ul className="mt-8 border-y border-dashed border-line text-sm">
              {studioWork.map((w) => (
                <li
                  key={w.title}
                  className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-dashed border-line py-3.5 last:border-0"
                >
                  <span className="font-bold text-ink">{w.title}</span>
                  <span className="text-ink-soft">{w.detail}</span>
                </li>
              ))}
            </ul>
            <Link
              to="/contact?interest=video"
              className="mt-8 inline-flex items-center gap-2 whitespace-nowrap text-sm font-bold text-ink underline underline-offset-4 transition-colors duration-150 hover:text-accent-deep"
            >
              Plan a video with us
            </Link>
          </div>
        </div>
      </section>

      {/* Contact: take a token */}
      <section className="px-5 pb-20 sm:px-8 md:pb-24">
        <div className="mx-auto grid max-w-6xl overflow-hidden rounded-[4px] bg-slip-yellow shadow-[0_20px_40px_-28px_rgba(15,42,46,0.5)] md:grid-cols-[1.3fr_14px_1fr]">
          <div className="p-8 sm:p-12">
            <h2 className="font-display text-7xl font-black leading-[0.85] sm:text-8xl">Let's talk.</h2>
            <p className="mt-5 max-w-md text-lg leading-relaxed">
              A product demo, a custom app, or a video. Write or call, and you'll hear back within a working day.
            </p>
          </div>
          <div aria-hidden className="perf-y hidden bg-ink/10 md:block" />
          <div aria-hidden className="perf-x h-3.5 bg-ink/10 md:hidden" />
          <div className="flex flex-col justify-center gap-4 p-8 sm:p-12">
            <a href={`mailto:${company.email}`} className="inline-flex items-center gap-3 break-all text-lg underline-offset-4 hover:underline">
              <Mail className="h-5 w-5 shrink-0" aria-hidden /> {company.email}
            </a>
            <a href={company.phoneHref} className="inline-flex items-center gap-3 whitespace-nowrap text-lg underline-offset-4 hover:underline">
              <Phone className="h-5 w-5" aria-hidden /> {company.phone}
            </a>
            <a
              href={`https://wa.me/${company.whatsappNumber}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-3 whitespace-nowrap text-lg underline-offset-4 hover:underline"
            >
              <MessageCircle className="h-5 w-5" aria-hidden /> Message on WhatsApp
            </a>
            <Link
              to="/contact"
              className="mt-3 inline-flex w-fit items-center gap-2 whitespace-nowrap rounded-full bg-ink px-5 py-3 text-sm font-bold text-paper transition-colors duration-150 hover:bg-accent"
            >
              Send us a message
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
