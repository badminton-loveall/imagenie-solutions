import { useRef, useState, type DragEvent } from 'react'
import { FileUp, Loader2 } from 'lucide-react'

type Props = {
  busy: boolean
  message: string
  tone: 'idle' | 'working' | 'done' | 'error'
  onFile: (file: File) => void
}

/** Drop zone for a receipt screenshot or PDF. */
export function ReceiptDrop({ busy, message, tone, onFile }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file && !busy) onFile(file)
  }

  const toneClass =
    tone === 'error' ? 'text-accent-deep' : tone === 'done' ? 'text-good' : 'text-ink-soft'

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={`rounded-[4px] border-2 border-dashed p-5 transition-colors duration-150 ${
        over ? 'border-ink bg-slip-yellow/60' : 'border-line bg-white'
      }`}
    >
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-slip-yellow px-4 py-2 text-sm font-bold text-ink transition-colors duration-150 hover:bg-ink hover:text-paper disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <FileUp className="h-4 w-4" aria-hidden />}
          {busy ? 'Reading receipt…' : 'Upload receipt'}
        </button>
        <p className={`min-w-0 flex-1 text-sm ${toneClass}`} role={tone === 'error' ? 'alert' : 'status'}>
          {message}
        </p>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}
