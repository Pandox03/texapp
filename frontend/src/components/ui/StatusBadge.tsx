import type { InvoiceStatus, PaymentStatus } from '../../types'
import { useI18n } from '../../context/LocaleContext'

const paymentColors: Record<PaymentStatus, string> = {
  unpaid: 'bg-red-100 text-red-700',
  partial: 'bg-amber-100 text-amber-800',
  paid: 'bg-emerald-100 text-emerald-800',
}

const invoiceColors: Record<InvoiceStatus, string> = {
  sent: 'bg-blue-100 text-blue-800',
  paid: 'bg-emerald-100 text-emerald-800',
  unpaid: 'bg-red-100 text-red-700',
  partial: 'bg-amber-100 text-amber-800',
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const { t } = useI18n()

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${paymentColors[status]}`}>
      {t.paymentStatus[status]}
    </span>
  )
}

export function InvoiceBadge({ status }: { status: InvoiceStatus }) {
  const { t } = useI18n()

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${invoiceColors[status]}`}>
      {t.invoiceStatus[status]}
    </span>
  )
}
