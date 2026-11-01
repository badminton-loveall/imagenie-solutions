type FieldProps = {
  label: string
  name: string
  type?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  optional?: boolean
  error?: string
  autoComplete?: string
}

export function Field({ label, name, type = 'text', value, onChange, placeholder, optional, error, autoComplete }: FieldProps) {
  const errorId = `${name}-error`
  return (
    <label className="block">
      <span className="text-sm font-bold">
        {label} {optional && <span className="font-normal text-ink-faint">(optional)</span>}
      </span>
      <input
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={!optional}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        className={`mt-2 w-full rounded-[4px] border-2 bg-white px-4 py-3 text-base text-ink outline-none transition-colors duration-150 placeholder:text-ink-faint focus:border-ink ${
          error ? 'border-accent' : 'border-line'
        }`}
      />
      {error && (
        <span id={errorId} className="mt-1.5 block text-sm text-accent-deep">
          {error}
        </span>
      )}
    </label>
  )
}
