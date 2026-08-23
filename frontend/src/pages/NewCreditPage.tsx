import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../lib/api'
import { extractApiError } from '../lib/errors'
import { useI18n } from '../context/LocaleContext'
import type { Client } from '../types'
import Card from '../components/ui/Card'
import FormField from '../components/ui/FormField'
import PageHeader from '../components/ui/PageHeader'

export default function NewCreditPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselectedClientId = searchParams.get('client_id') ?? ''
  const [clients, setClients] = useState<Client[]>([])
  const [clientSearch, setClientSearch] = useState('')
  const [credit, setCredit] = useState({
    client_id: '',
    sale_date: new Date().toISOString().slice(0, 10),
    total_amount: '',
    notes: '',
  })
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get<Client[]>('/clients', { params: { lite: 1 } })
      .then((res) => {
        setClients(res.data)
        if (preselectedClientId) {
          setCredit((prev) => ({ ...prev, client_id: preselectedClientId }))
        }
      })
      .catch(() => setError(t.credit.loadError))
      .finally(() => setLoadingOptions(false))
  }, [t.credit.loadError, preselectedClientId])

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase()
    if (!q) return clients
    return clients.filter((c) => c.name.toLowerCase().includes(q))
  }, [clients, clientSearch])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const { data } = await api.post<{ id: number; client_id: number }>('/sales', {
        sale_type: 'legacy_credit',
        client_id: Number(credit.client_id),
        sale_date: credit.sale_date,
        total_amount: Number(credit.total_amount),
        notes: credit.notes || null,
      })
      navigate(`/invoices/generer?sale_id=${data.id}`)
    } catch (err: unknown) {
      setError(extractApiError(err, t.credit.error))
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingOptions) {
    return <p className="text-muted">{t.common.loading}</p>
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title={t.credit.title} description={t.credit.description} />

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <div className="grid gap-4">
            <FormField
              type="date"
              label={t.common.date}
              value={credit.sale_date}
              onChange={(e) => setCredit({ ...credit, sale_date: e.target.value })}
              required
            />
            <FormField
              type="search"
              label={t.sales.client}
              placeholder={t.newSale.clientSearch}
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
            />
            <FormField
              as="select"
              label={t.credit.selectClient}
              value={credit.client_id}
              onChange={(e) => setCredit({ ...credit, client_id: e.target.value })}
              required
            >
              <option value="">{t.credit.selectClient}</option>
              {filteredClients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </FormField>
            <FormField
              type="number"
              step="0.01"
              min="0.01"
              label={t.credit.totalAmount}
              value={credit.total_amount}
              onChange={(e) => setCredit({ ...credit, total_amount: e.target.value })}
              placeholder="0.00"
              required
            />
            <FormField
              as="textarea"
              label={t.common.notes}
              value={credit.notes}
              onChange={(e) => setCredit({ ...credit, notes: e.target.value })}
              rows={2}
              placeholder={t.credit.notesPlaceholder}
            />
          </div>

          <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{t.credit.noStockHint}</p>
          <p className="mt-2 text-xs text-muted">{t.newSale.autoRefHint}</p>
        </Card>

        {error && <p className="whitespace-pre-line text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !credit.client_id}
          className="cursor-pointer rounded-xl bg-teal-500 px-6 py-3 font-semibold text-white disabled:opacity-50"
        >
          {submitting ? t.credit.saving : t.credit.submit}
        </button>
      </form>
    </div>
  )
}
