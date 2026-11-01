import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

/* ---------- Status pill ---------- */

const pillTone = {
  yellow: 'bg-slip-yellow text-ink',
  pink: 'bg-slip-pink text-ink',
  green: 'bg-slip-green text-ink',
  ink: 'bg-ink text-paper',
  muted: 'bg-paper-deep text-ink-soft',
  red: 'bg-accent text-white',
} as const
export type PillTone = keyof typeof pillTone

export function Pill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${pillTone[tone]}`}>
      {children}
    </span>
  )
}

/* ---------- Filter tabs with counts ---------- */

export function FilterTabs<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; count: number }[]
  value: T
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-3 py-1.5 text-sm transition-colors duration-150 ${
            value === o.value ? 'border-ink bg-ink font-bold text-paper' : 'border-line bg-white text-ink-soft hover:border-ink-faint hover:text-ink'
          }`}
        >
          {o.label}
          <span className={value === o.value ? 'text-paper/70' : 'text-ink-faint'}>{o.count}</span>
        </button>
      ))}
    </div>
  )
}

/* ---------- Side panel ---------- */

export function Panel({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  footer: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button aria-label="Close panel" onClick={onClose} className="absolute inset-0 bg-ink/30" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex h-full w-full max-w-xl flex-col bg-paper shadow-[0_0_60px_-20px_rgba(15,42,46,0.6)]"
      >
        <div className="flex items-start justify-between gap-4 border-b-2 border-dashed border-line px-6 py-5">
          <div className="min-w-0">
            <h2 className="font-display text-3xl font-extrabold leading-tight">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-ink-soft hover:bg-paper-deep hover:text-ink">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-dashed border-line px-6 py-4">{footer}</div>
      </aside>
    </div>
  )
}

/* ---------- Form controls ---------- */

const controlClass =
  'mt-1.5 w-full rounded-[4px] border-2 border-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors duration-150 focus:border-ink'

export function TextInput({
  label,
  value,
  onChange,
  type = 'text',
  required,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className={controlClass}
      />
    </label>
  )
}

export function SelectInput<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className={controlClass}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function TextArea({ label, value, onChange, rows = 5 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <label className="block">
      <span className="text-sm font-bold">{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className={`${controlClass} leading-relaxed`} />
    </label>
  )
}

export const primaryButton =
  'whitespace-nowrap rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-paper transition-colors duration-150 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40'
export const secondaryButton =
  'whitespace-nowrap rounded-full border-2 border-line px-4 py-2 text-sm font-bold text-ink transition-colors duration-150 hover:border-ink disabled:opacity-40'
export const dangerLink = 'whitespace-nowrap text-sm font-bold text-accent-deep underline-offset-4 hover:underline disabled:opacity-40'

/* ---------- Empty and error states ---------- */

export function Notice({ tone = 'muted', children }: { tone?: 'muted' | 'error'; children: ReactNode }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={`rounded-[4px] border-2 p-6 text-sm leading-relaxed ${
        tone === 'error' ? 'border-accent bg-accent-wash text-accent-deep' : 'border-dashed border-line text-ink-soft'
      }`}
    >
      {children}
    </div>
  )
}
