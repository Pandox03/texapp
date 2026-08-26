import { useEffect, useRef, useState } from 'react'
import { ChevronDown, FileText } from 'lucide-react'
import { useI18n } from '../../context/LocaleContext'
import type { Invoice } from '../../types'

function formatMad(value: number) {
  return `${value.toLocaleString('fr-FR')} MAD`
}

function invoiceRemaining(inv: Invoice): number {
  if (inv.remaining_to_pay != null) return Number(inv.remaining_to_pay)
  const paid = Number(inv.paid_amount ?? 0)
  return Math.max(0, Number(inv.total) - paid)
}

/** Factures avec un reste à payer (y compris partiellement encaissées). */
export function unpaidInvoices(invoices: Invoice[]): Invoice[] {
  return invoices.filter((inv) => {
    const remaining = invoiceRemaining(inv)
    return remaining > 0.01 && inv.status !== 'paid'
  })
}

interface InvoicePickerProps {
  invoices: Invoice[]
  value: string
  onChange: (invoiceId: string, invoice: Invoice | undefined) => void
  disabled?: boolean
}

export default function InvoicePicker({ invoices, value, onChange, disabled }: InvoicePickerProps) {
  const { t, formatDate } = useI18n()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const options = unpaidInvoices(invoices)
  const selected = options.find((inv) => String(inv.id) === value)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div ref={rootRef} className="relative">
      <label className="mb-1 block text-sm font-medium">{t.clients.linkedInvoice}</label>
      <button
        type="button"
        disabled={disabled || options.length === 0}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-10 w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-white px-3 py-2 text-left text-sm outline-none transition hover:border-teal-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {selected ? (
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-navy-900">{selected.reference}</span>
            <span className="text-muted">
              {formatDate(selected.invoice_date)} · {formatMad(Number(selected.total))} TTC ·{' '}
              {t.clients.remaining}: {formatMad(invoiceRemaining(selected))}
            </span>
          </span>
        ) : (
          <span className="text-muted">
            {options.length === 0 ? t.clients.noPayableInvoices : t.clients.chooseInvoice}
          </span>
        )}
        <ChevronDown size={18} className={`shrink-0 text-muted transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && options.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-border bg-white py-1 shadow-lg">
          {options.map((inv) => {
            const remaining = invoiceRemaining(inv)
            const isSelected = String(inv.id) === value
            return (
              <li key={inv.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(String(inv.id), inv)
                    setOpen(false)
                  }}
                  className={`flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left text-sm hover:bg-teal-50 ${isSelected ? 'bg-teal-50' : ''}`}
                >
                  <FileText size={16} className="mt-0.5 shrink-0 text-teal-600" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-navy-900">{inv.reference}</span>
                    <span className="text-muted">{formatDate(inv.invoice_date)}</span>
                    <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                      <span>{t.invoices.totalTtc}: <strong>{formatMad(Number(inv.total))}</strong></span>
                      <span className="text-teal-700">{t.clients.remaining}: <strong>{formatMad(remaining)}</strong></span>
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {options.length === 0 && (
        <p className="mt-2 text-sm text-amber-700">{t.clients.noPayableInvoices}</p>
      )}

      {/* Hidden input for form validation */}
      <input type="hidden" name="invoice_id" value={value} required={options.length > 0} />
    </div>
  )
}

export { invoiceRemaining, formatMad as formatInvoiceMad }
