import { FormEvent, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Bot, Send, X } from 'lucide-react'
import api from '../../lib/api'
import { useI18n } from '../../context/LocaleContext'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/** Pages with a fixed bottom action bar — lift the FAB above them. */
const RAISED_FAB_PATHS = ['/sales/new']

export default function AiAssistant() {
  const { t, locale } = useI18n()
  const { pathname } = useLocation()
  const raised = RAISED_FAB_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, open])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return

    setError('')
    setInput('')
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)
    setLoading(true)

    try {
      const { data } = await api.post<{ reply: string }>('/ai/chat', {
        message: text,
        locale,
        history: messages.slice(-8),
      })
      setMessages([...nextMessages, { role: 'assistant', content: data.reply }])
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? t.ai.error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`fixed z-50 inline-flex cursor-pointer items-center gap-2 rounded-full bg-navy-900 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-navy-800 end-5 ${
          raised ? 'bottom-24' : 'bottom-5'
        }`}
        aria-label={t.ai.title}
      >
        {open ? <X size={18} /> : <Bot size={18} />}
        {open ? t.ai.close : t.ai.title}
      </button>

      {open && (
        <div
          className={`fixed z-50 flex h-[min(32rem,70vh)] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl end-5 ${
            raised ? 'bottom-40' : 'bottom-20'
          }`}
        >
          <div className="border-b border-border bg-teal-50/60 px-4 py-3">
            <p className="font-semibold text-navy-900">{t.ai.title}</p>
            <p className="text-xs text-muted">{t.ai.subtitle}</p>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <p className="text-sm text-muted">{t.ai.placeholder}</p>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'ms-8 bg-teal-500 text-white'
                    : 'me-4 bg-surface text-navy-900'
                }`}
              >
                {msg.content}
              </div>
            ))}
            {loading && (
              <p className="text-sm text-muted">{t.ai.thinking}</p>
            )}
            <div ref={bottomRef} />
          </div>

          {error && <p className="px-4 pb-2 text-sm text-red-600">{error}</p>}

          <form onSubmit={handleSubmit} className="flex gap-2 border-t border-border p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t.ai.inputPlaceholder}
              className="h-10 min-w-0 flex-1 rounded-xl border border-border px-3 text-sm"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-teal-500 px-3 text-white disabled:opacity-50"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  )
}
