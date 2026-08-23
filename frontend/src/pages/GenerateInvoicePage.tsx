import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, FileCheck } from 'lucide-react'
import api from '../lib/api'
import { extractApiError } from '../lib/errors'
import { splitTtc } from '../lib/tax'
import { useBranding } from '../context/BrandingContext'
import { useI18n } from '../context/LocaleContext'
import type { Invoice, Sale } from '../types'
import Card from '../components/ui/Card'
import PageHeader from '../components/ui/PageHeader'

export default function GenerateInvoicePage() {
  const { t, formatDate } = useI18n()
  const { branding } = useBranding()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselectedSaleId = searchParams.get('sale_id') ?? ''
  const [sales, setSales] = useState<Sale[]>([])
  const [selectedSaleId, setSelectedSaleId] = useState('')
  const [amountTtc, setAmountTtc] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<Invoice | null>(null)

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get<Sale[]>('/invoices/sales-for-invoice')
      .then((res) => {
        setSales(res.data)
        if (preselectedSaleId) {
          const match = res.data.find((s) => String(s.id) === preselectedSaleId)
          if (match && (match.remaining_to_invoice ?? 0) > 0) {
            setSelectedSaleId(String(match.id))
            setAmountTtc(String(match.remaining_to_invoice))
          }
        }
      })
      .catch(() => setError(t.secretaire.loadSalesError))
      .finally(() => setLoading(false))
  }, [t.secretaire.loadSalesError, preselectedSaleId])

  const billableSales = sales.filter((s) => (s.remaining_to_invoice ?? 0) > 0)

  const selectedSale = billableSales.find((s) => s.id === Number(selectedSaleId))
  const remaining = selectedSale?.remaining_to_invoice ?? 0
  const billedTtc = Number(amountTtc || remaining)
  const taxRate = branding.tax_rate ?? 20
  const breakdown = useMemo(() => splitTtc(billedTtc, taxRate), [billedTtc, taxRate])

  function handleSaleChange(saleId: string) {
    setSelectedSaleId(saleId)
    const sale = billableSales.find((s) => s.id === Number(saleId))
    const saleRemaining = sale?.remaining_to_invoice ?? 0
    if (saleRemaining <= 0) {
      setSelectedSaleId('')
      setAmountTtc('')
      return
    }
    setAmountTtc(String(saleRemaining))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    setSuccess(null)
    try {
      const { data } = await api.post<Invoice>('/invoices', {
        sale_id: Number(selectedSaleId),
        amount: Number(amountTtc || remaining),
        invoice_date: invoiceDate,
        due_date: dueDate || null,
        notes: notes || null,
      })
      setSuccess(data)
      setSelectedSaleId('')
      setAmountTtc('')
      api.get<Sale[]>('/invoices/sales-for-invoice').then((res) => setSales(res.data))
      setTimeout(() => navigate('/invoices'), 2000)
    } catch (err: unknown) {
      setError(extractApiError(err, t.secretaire.generateError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-w-0">
      <Link to="/invoices" className="mb-4 inline-flex cursor-pointer items-center gap-2 text-sm text-teal-600 hover:underline">
        <ArrowLeft size={16} />
        {t.nav.invoices}
      </Link>

      <PageHeader title={t.secretaire.generateInvoice} description={t.secretaire.generateInvoiceDesc} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">{t.secretaire.selectSale}</label>
              <select
                value={selectedSaleId}
                onChange={(e) => handleSaleChange(e.target.value)}
                className="w-full rounded-xl border border-border px-4 py-3"
                required
                disabled={loading || billableSales.length === 0}
              >
                <option value="">
                  {loading ? t.common.loading : billableSales.length === 0 ? t.secretaire.noPendingInvoices : t.secretaire.chooseSale}
                </option>
                {billableSales.map((sale) => {
                  const saleRemaining = Number(sale.remaining_to_invoice ?? 0)
                  const typeLabel = sale.sale_type === 'legacy_credit' ? t.sales.legacyBadge : t.nav.sales
                  return (
                    <option key={sale.id} value={sale.id}>
                      [{typeLabel}] {sale.reference} — {sale.client?.name} — {t.secretaire.remainingShort}{' '}
                      {saleRemaining.toLocaleString('fr-FR')} MAD {t.invoices.amountTtc}
                    </option>
                  )
                })}
              </select>
              {!loading && billableSales.length === 0 && sales.length > 0 && (
                <p className="mt-2 text-sm text-amber-700">{t.secretaire.allSalesInvoiced}</p>
              )}
              {!loading && sales.length === 0 && (
                <p className="mt-2 text-sm text-muted">{t.sales.noSales}</p>
              )}
            </div>

            {selectedSale && (
              <div>
                <label className="mb-1 block text-sm font-medium">{t.secretaire.invoiceAmount}</label>
                <input
                  type="number"
                  min={0.01}
                  max={remaining}
                  step="0.01"
                  value={amountTtc}
                  onChange={(e) => setAmountTtc(e.target.value)}
                  className="w-full rounded-xl border border-border px-4 py-3"
                  required
                />
                <p className="mt-1 text-xs text-muted">
                  {t.secretaire.remainingToInvoice} : {Number(remaining).toLocaleString('fr-FR')} MAD {t.invoices.amountTtc}
                  {(selectedSale.invoices_count ?? selectedSale.invoices?.length ?? 0) > 0 && (
                    <> · {t.secretaire.existingInvoices} : {selectedSale.invoices_count ?? selectedSale.invoices?.length}</>
                  )}
                </p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">{t.invoices.invoiceDate}</label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full rounded-xl border border-border px-4 py-3"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{t.invoices.dueDate}</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-xl border border-border px-4 py-3"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">{t.common.notes}</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-xl border border-border px-4 py-3"
                rows={3}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <FileCheck size={18} />
                {t.secretaire.generateSuccess} {success.reference}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !selectedSaleId}
              className="w-full cursor-pointer rounded-xl bg-teal-500 px-4 py-3 font-semibold text-white disabled:opacity-50"
            >
              {submitting ? t.secretaire.generating : t.secretaire.generateButton}
            </button>
          </form>
        </Card>

        {selectedSale && (
          <Card>
            <h2 className="mb-4 text-lg font-semibold">{t.secretaire.salePreview}</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">{t.common.reference}</dt>
                <dd className="font-medium">{selectedSale.reference}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">{t.sales.client}</dt>
                <dd className="font-medium">{selectedSale.client?.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">{t.common.date}</dt>
                <dd>{formatDate(selectedSale.sale_date)}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-3">
                <dt className="text-muted">{t.invoices.saleTotalTtc}</dt>
                <dd>{Number(selectedSale.total_amount).toLocaleString('fr-FR')} MAD</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">{t.secretaire.remainingToInvoice}</dt>
                <dd>{Number(remaining).toLocaleString('fr-FR')} MAD {t.invoices.amountTtc}</dd>
              </div>
              <div className="mt-2 rounded-xl bg-surface px-3 py-2 text-xs text-muted">
                {t.invoices.taxInclusiveHint}
              </div>
              <div className="flex justify-between border-t border-border pt-3">
                <dt className="text-muted">{t.invoices.amountTtc}</dt>
                <dd>{breakdown.total.toLocaleString('fr-FR')} MAD</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">{t.invoices.subtotal}</dt>
                <dd>{breakdown.ht.toLocaleString('fr-FR')} MAD</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">{t.invoices.tax} ({taxRate}%)</dt>
                <dd>{breakdown.tax.toLocaleString('fr-FR')} MAD</dd>
              </div>
              <div className="flex justify-between text-base font-bold text-navy-900">
                <dt>{t.invoices.totalTtc}</dt>
                <dd>{breakdown.total.toLocaleString('fr-FR')} MAD</dd>
              </div>
            </dl>
          </Card>
        )}
      </div>
    </div>
  )
}
