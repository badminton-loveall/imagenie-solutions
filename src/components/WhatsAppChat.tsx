import { useEffect, useState } from 'react'
import { MessageCircle, Send } from 'lucide-react'

import { company } from '../data/company'

type Props = {
  /** Starting message, so the chat opens with something relevant already typed. */
  draft: string
}

export function WhatsAppChat({ draft }: Props) {
  const [text, setText] = useState(draft)
  useEffect(() => setText(draft), [draft])

  const href = `https://wa.me/${company.whatsappNumber}?text=${encodeURIComponent(text.trim())}`

  return (
    <section aria-label="Chat with Imagenie on WhatsApp" className="overflow-hidden rounded-[4px] border-2 border-line bg-white">
      <header className="flex items-center gap-3 bg-wa-deep px-4 py-3 text-white">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-wa">
          <MessageCircle className="h-5 w-5 text-white" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">Imagenie on WhatsApp</p>
          <p className="text-xs text-white/80">Usually replies within an hour</p>
        </div>
      </header>

      <div className="space-y-2 bg-wa-chat px-4 py-5">
        <p className="max-w-[85%] rounded-xl rounded-tl-sm bg-wa-bubble px-3.5 py-2.5 text-sm leading-relaxed text-ink shadow-[0_1px_0_rgba(0,0,0,0.06)]">
          Hello! This is the Imagenie team. Ask us anything about our products, custom apps or films.
        </p>
      </div>

      <form
        className="flex items-end gap-2 border-t border-line bg-white p-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (text.trim()) window.open(href, '_blank', 'noopener,noreferrer')
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">Your WhatsApp message</span>
          <textarea
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message"
            className="block w-full resize-none rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm leading-relaxed text-ink outline-none transition-colors duration-150 placeholder:text-ink-faint focus:border-wa-deep"
          />
        </label>
        <button
          type="submit"
          disabled={!text.trim()}
          aria-label="Open this chat in WhatsApp"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-wa-deep text-white transition-[background-color,transform] duration-150 ease-out hover:bg-[#054a42] active:scale-95 disabled:opacity-40"
        >
          <Send className="h-4 w-4" aria-hidden />
        </button>
      </form>
      <p className="border-t border-line bg-white px-4 py-2.5 text-xs text-ink-soft">Opens WhatsApp on your phone or WhatsApp Web.</p>
    </section>
  )
}
