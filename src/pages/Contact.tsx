import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, Mail, MapPin, Phone } from 'lucide-react'

import { Field } from '../components/Field'
import { submitLead } from '../lib/leads'
import { WhatsAppChat } from '../components/WhatsAppChat'
import { company, interests, type Interest } from '../data/company'

const interestFromQuery: Record<string, Interest> = {
  product: 'A Labs product',
  custom: 'A custom app',
  video: 'Video production',
}

function whatsappDraftFor(interest: Interest) {
  if (interest === 'A Labs product') return 'Hi Imagenie, I would like a demo of one of your Labs products.'
  if (interest === 'Video production') return 'Hi Imagenie, I would like to talk about a video production.'
  return 'Hi Imagenie, I would like to discuss a custom app for my business.'
}

function placeholderFor(interest: Interest) {
  if (interest === 'A Labs product') return 'For example: we run a 3-doctor eye clinic and would like a demo of Qwait for our OPD tokens.'
  if (interest === 'Video production') return 'For example: a two-minute film introducing our clinic, for our website and Instagram.'
  return 'For example: our clinic books appointments over the phone. We want patients to book online and get reminders on WhatsApp.'
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

type Form = { name: string; organisation: string; email: string; phone: string; message: string }
const emptyForm: Form = { name: '', organisation: '', email: '', phone: '', message: '' }

export function Contact() {
  const [params] = useSearchParams()
  const [interest, setInterest] = useState<Interest>(interestFromQuery[params.get('interest') ?? ''] ?? 'A custom app')
  const [form, setForm] = useState<Form>(emptyForm)
  const [emailError, setEmailError] = useState<string | undefined>()
  const [status, setStatus] = useState<'editing' | 'sending' | 'sent' | 'failed'>('editing')

  const set = (key: keyof Form) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (key === 'email') setEmailError(undefined)
    if (status === 'failed') setStatus('editing')
  }

  // Backup route if saving fails: the same enquiry, ready to send from the visitor's email app.
  const mailtoHref = () => {
    const subject = `Website enquiry: ${interest}${form.organisation ? `, ${form.organisation}` : ''}`
    const lines: (string | null)[] = [
      `Interested in: ${interest}`,
      `Name: ${form.name}`,
      form.organisation ? `Organisation: ${form.organisation}` : null,
      `Email: ${form.email}`,
      form.phone ? `Phone: ${form.phone}` : null,
      '',
      form.message,
    ]
    const body = lines.filter((l): l is string => l !== null).join('\n')
    return `mailto:${company.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (status === 'sending') return
    if (!emailPattern.test(form.email.trim())) {
      setEmailError('Enter a full email address, like name@clinic.in')
      return
    }
    setStatus('sending')
    try {
      await submitLead({ interest, ...form })
      setStatus('sent')
    } catch (err) {
      console.error(err)
      setStatus('failed')
    }
  }

  return (
    <main className="mx-auto grid max-w-6xl gap-14 px-5 py-14 sm:px-8 md:py-20 lg:grid-cols-[1.3fr_1fr] lg:gap-20">
      <section>
        <h1 className="font-display text-6xl font-black leading-[0.88] sm:text-8xl">Tell us what you need.</h1>
        <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-soft">
          A demo of Qwait, Smrithi or LoveAll, an application built for your business, or a film. A few lines are enough;
          we'll reply within one working day.
        </p>

        {status === 'sent' ? (
          <div className="mt-12 rounded-[4px] bg-slip-green p-8 shadow-[0_20px_40px_-28px_rgba(15,42,46,0.5)]" role="status">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-good text-white">
              <Check className="h-5 w-5" aria-hidden />
            </span>
            <h2 className="mt-5 font-display text-4xl font-extrabold leading-none">Thank you, we have your message.</h2>
            <p className="mt-3 max-w-md">
              Someone from Imagenie will write to you or call within one working day. If it's urgent, message us in the
              WhatsApp chat on this page.
            </p>
            <button
              onClick={() => {
                setStatus('editing')
                setForm(emptyForm)
              }}
              className="mt-8 whitespace-nowrap text-sm font-bold text-ink underline underline-offset-4 transition-colors duration-150 hover:text-accent-deep"
            >
              Write another message
            </button>
          </div>
        ) : (
          <form className="mt-12 space-y-7" onSubmit={onSubmit} noValidate>
            <fieldset>
              <legend className="text-sm font-bold">I'm interested in</legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {interests.map((i) => (
                  <button
                    type="button"
                    key={i}
                    onClick={() => setInterest(i)}
                    aria-pressed={interest === i}
                    className={`whitespace-nowrap rounded-full border-2 px-4 py-2 text-sm transition-colors duration-150 ${
                      interest === i
                        ? 'border-ink bg-slip-yellow font-bold text-ink'
                        : 'border-line bg-white text-ink-soft hover:border-ink-faint hover:text-ink'
                    }`}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Your name" name="name" value={form.name} onChange={set('name')} autoComplete="name" />
              <Field
                label="Organisation"
                name="organisation"
                value={form.organisation}
                onChange={set('organisation')}
                autoComplete="organization"
                optional
              />
              <Field
                label="Email"
                name="email"
                type="email"
                value={form.email}
                onChange={set('email')}
                autoComplete="email"
                error={emailError}
              />
              <Field label="Phone" name="phone" type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" optional />
            </div>

            <label className="block">
              <span className="text-sm font-bold">What should we know?</span>
              <textarea
                name="message"
                rows={5}
                value={form.message}
                onChange={(e) => set('message')(e.target.value)}
                placeholder={placeholderFor(interest)}
                className="mt-2 w-full rounded-[4px] border-2 border-line bg-white px-4 py-3 text-base leading-relaxed text-ink outline-none transition-colors duration-150 placeholder:text-ink-faint focus:border-ink"
              />
            </label>

            {status === 'failed' && (
              <div role="alert" className="rounded-[4px] border-2 border-accent bg-accent-wash p-5 text-sm leading-relaxed">
                <p className="font-bold text-accent-deep">Your message didn't send.</p>
                <p className="mt-1">
                  Check your connection and try again, or{' '}
                  <a href={mailtoHref()} className="font-bold underline underline-offset-4">
                    send it from your email app
                  </a>{' '}
                  instead. Nothing you typed has been lost.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={!form.name.trim() || !form.email.trim() || status === 'sending'}
              className="whitespace-nowrap rounded-full bg-ink px-6 py-3 text-sm font-bold text-paper transition-colors duration-150 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
            >
              {status === 'sending' ? 'Sending…' : status === 'failed' ? 'Try again' : 'Send message'}
            </button>
          </form>
        )}
      </section>

      <aside className="lg:pt-3">
        <div className="border-t-2 border-dashed border-line pt-8 lg:mt-[11rem]">
          <p className="font-display text-3xl font-extrabold">Imagenie Solutions</p>
          <p className="mt-1 text-sm text-ink-soft">Imagenie Labs and Imagenie Studios</p>

          <ul className="mt-8 space-y-6 text-base">
            <li className="flex gap-4">
              <Mail className="mt-1 h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
              <a href={`mailto:${company.email}`} className="break-all underline-offset-4 hover:underline">
                {company.email}
              </a>
            </li>
            <li className="flex gap-4">
              <Phone className="mt-1 h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
              <a href={company.phoneHref} className="underline-offset-4 hover:underline">
                {company.phone}
              </a>
            </li>
            <li className="flex gap-4">
              <MapPin className="mt-1 h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
              <address className="not-italic leading-relaxed text-ink-soft">
                {company.addressLines.map((l) => (
                  <span key={l} className="block">
                    {l}
                  </span>
                ))}
              </address>
            </li>
          </ul>

          <div className="mt-10">
            <p className="mb-3 text-sm font-bold">Prefer to chat? Message us on WhatsApp.</p>
            <WhatsAppChat draft={whatsappDraftFor(interest)} />
          </div>

          <p className="mt-10 border-t-2 border-dashed border-line pt-6 text-sm leading-relaxed text-ink-soft">
            Open Monday to Saturday, 9:30 AM to 6:30 PM IST. Meetings in English or Malayalam, in person in Thrissur or
            online.
          </p>
        </div>
      </aside>
    </main>
  )
}
