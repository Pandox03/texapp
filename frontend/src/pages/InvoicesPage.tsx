import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Download, FilePlus } from 'lucide-react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../context/LocaleContext'
import { InvoiceStatusSelect } from '../components/ui/InvoiceStatusSelect'
import { InvoiceBadge } from '../components/ui/StatusBadge'
import Card from '../components/ui/Card'
import FilterBar from '../components/ui/FilterBar'
import PageHeader from '../components/ui/PageHeader'
import type { Client, Invoice, InvoiceStatus, Paginated } from '../types'

export default function InvoicesPage() {
  const { isComptable } = useAuth()
  const { t, formatDate } = useI18n()
  const [searchParams] = useSearchParams()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [filters, setFilters] = useState<Record<string, string>>(() => {
    const status = searchParams.get('status')
    return status ? { status } : {} as Record<string, string>
  })
  const [updatingId, setUpdatingId] = useState<number | null>(null)

  const [pdfError, setPdfError] = useState('')
  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  const load = useCallback(() => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
    api.get<Paginated<Invoice>>('/invoices', { params }).then((res) => setInvoices(res.data.data))
  }, [filters])

  useEffect(() => {
    api.get<Client[]>('/clients', { params: { lite: 1 } }).then((res) => setClients(res.data))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function downloadPdf(invoice: Invoice) {
    setPdfError('')
    setDownloadingId(invoice.id)
    try {
      const res = await api.get(`/invoices/${invoice.id}/pdf`, {
        responseType: 'blob',
        headers: { Accept: 'application/pdf' },
      })

      const contentType = String(res.headers['content-type'] ?? '')
      if (contentType.includes('application/json') || res.data.type === 'application/json') {
        const text = await (res.data as Blob).text()
        const parsed = JSON.parse(text) as { message?: string }
        throw new Error(parsed.message ?? t.invoices.pdfError)
      }

      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `${invoice.reference}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setPdfError(msg || t.invoices.pdfError)
    } finally {
      setDownloadingId(null)
    }
  }

  async function updateStatus(invoice: Invoice, status: InvoiceStatus) {
    if (status === invoice.status) return
    setUpdatingId(invoice.id)
    try {
      const { data } = await api.put<Invoice>(`/invoices/${invoice.id}`, { status })
      setInvoices((list) => list.map((inv) => (inv.id === invoice.id ? { ...inv, ...data } : inv)))
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="min-w-0">
      <PageHeader
        title={t.invoices.title}
        description={t.invoices.description}
        action={
          !isComptable ? (
            <Link
              to="/invoices/generer"
              className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-600"
            >
              <FilePlus size={18} />
              <span className="whitespace-nowrap">{t.secretaire.generateInvoice}</span>
            </Link>
          ) : undefined
        }
      />

      {pdfError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {pdfError}
        </div>
      )}

      <FilterBar
        fields={[
          { key: 'search', label: t.filters.search, type: 'text', placeholder: 'Réf. ou client...' },
          {
            key: 'status',
            label: t.containers.status,
            type: 'select',
            placeholder: t.common.all,
            options: (['sent', 'partial', 'paid', 'unpaid'] as const).map((s) => ({
              value: s,
              label: t.invoiceStatus[s],
            })),
          },
          {
            key: 'client_id',
            label: t.sales.client,
            type: 'select',
            placeholder: t.common.all,
            options: clients.map((c) => ({ value: String(c.id), label: c.name })),
          },
          { key: 'date_from', label: t.common.from, type: 'date' },
          { key: 'date_to', label: t.common.to, type: 'date' },
        ]}
        values={filters}
        onChange={(k, v) => setFilters((f) => ({ ...f, [k]: v }))}
        onReset={() => setFilters({})}
      />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-border text-muted">
              <tr>
                <th className="whitespace-nowrap px-4 py-3">{t.common.reference}</th>
                <th className="whitespace-nowrap px-4 py-3">{t.sales.client}</th>
                <th className="whitespace-nowrap px-4 py-3">{t.invoices.invoiceDate}</th>
                <th className="whitespace-nowrap px-4 py-3">{t.invoices.dueDate}</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">{t.invoices.subtotal}</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">{t.invoices.tax}</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">{t.invoices.totalTtc}</th>
                <th className="whitespace-nowrap px-4 py-3">{t.containers.status}</th>
                <th className="whitespace-nowrap px-4 py-3">{t.invoices.linkedSale}</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">{t.common.actions}</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-muted">{t.invoices.noInvoices}</td>
                </tr>
              )}
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-border/70">
                  <td className="whitespace-nowrap px-4 py-3 font-medium">{inv.reference}</td>
                  <td className="max-w-[160px] truncate px-4 py-3">
                    <Link to={`/clients/${inv.client_id}`} className="text-teal-600 hover:underline">
                      {inv.client?.name}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">{formatDate(inv.invoice_date)}</td>
                  <td className="whitespace-nowrap px-4 py-3">{formatDate(inv.due_date)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">{Number(inv.subtotal).toLocaleString('fr-FR')} MAD</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">{Number(inv.tax_amount).toLocaleString('fr-FR')} MAD</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">{Number(inv.total).toLocaleString('fr-FR')} MAD</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {isComptable ? (
                      <InvoiceBadge status={inv.status} />
                    ) : (
                      <InvoiceStatusSelect
                        value={inv.status}
                        disabled={updatingId === inv.id}
                        onChange={(status) => updateStatus(inv, status)}
                      />
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">{inv.sale?.reference ?? t.common.dash}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => downloadPdf(inv)}
                      disabled={downloadingId === inv.id}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-50 disabled:opacity-50"
                      title={t.invoices.downloadPdf}
                    >
                      <Download size={14} />
                      {downloadingId === inv.id ? '…' : 'PDF'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
