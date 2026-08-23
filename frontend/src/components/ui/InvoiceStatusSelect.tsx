import type { InvoiceStatus } from '../../types'
import { useI18n } from '../../context/LocaleContext'

export const INVOICE_STATUSES: InvoiceStatus[] = ['sent', 'partial', 'paid', 'unpaid']

const selectColors: Record<InvoiceStatus, string> = {
  sent: 'border-blue-200 bg-blue-50 text-blue-800',
  paid: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  unpaid: 'border-red-200 bg-red-50 text-red-700',
  partial: 'border-amber-200 bg-amber-50 text-amber-800',
}

interface InvoiceStatusSelectProps {
  value: InvoiceStatus
  onChange: (status: InvoiceStatus) => void
  disabled?: boolean
}

export function InvoiceStatusSelect({ value, onChange, disabled }: InvoiceStatusSelectProps) {
  const { t } = useI18n()

  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as InvoiceStatus)}
      className={`cursor-pointer rounded-lg border px-2 py-1.5 text-xs font-medium outline-none focus:ring-2 focus:ring-teal-500/30 ${selectColors[value] ?? selectColors.sent}`}
    >
      {INVOICE_STATUSES.map((status) => (
        <option key={status} value={status}>
          {t.invoiceStatus[status]}
        </option>
      ))}
    </select>
  )
}
