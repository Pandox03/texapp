import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import api from '../lib/api'
import { useI18n } from '../context/LocaleContext'
import type { Client, Paginated, Sale } from '../types'
import Card from '../components/ui/Card'
import FilterBar from '../components/ui/FilterBar'
import PageHeader from '../components/ui/PageHeader'
import { PaymentBadge } from '../components/ui/StatusBadge'

export default function SalesPage() {
  const { t } = useI18n()
  const [sales, setSales] = useState<Sale[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [filters, setFilters] = useState<Record<string, string>>({})

  const load = useCallback(() => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
    api.get<Paginated<Sale>>('/sales', { params }).then((res) => setSales(res.data.data))
  }, [filters])

  useEffect(() => {
    api.get<Client[]>('/clients', { params: { lite: 1 } }).then((res) => setClients(res.data))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div>
      <PageHeader
        title={t.sales.title}
        description={t.sales.description}
        action={
          <Link to="/sales/new" className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-teal-500 px-4 py-2 text-sm font-semibold text-white">
            <Plus size={16} />
            {t.sales.new}
          </Link>
        }
      />

      <FilterBar
        fields={[
          { key: 'search', label: t.filters.search, type: 'text', placeholder: 'Réf. ou client...' },
          {
            key: 'client_id',
            label: t.sales.client,
            type: 'select',
            placeholder: t.common.all,
            options: clients.map((c) => ({ value: String(c.id), label: c.name })),
          },
          {
            key: 'payment_status',
            label: t.sales.payment,
            type: 'select',
            placeholder: t.common.all,
            options: (['unpaid', 'partial', 'paid'] as const).map((s) => ({ value: s, label: t.paymentStatus[s] })),
          },
          { key: 'date_from', label: t.common.from, type: 'date' },
          { key: 'date_to', label: t.common.to, type: 'date' },
        ]}
        values={filters}
        onChange={(k, v) => setFilters((f) => ({ ...f, [k]: v }))}
        onReset={() => setFilters({})}
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border text-muted">
              <tr>
                <th className="px-3 py-3">{t.common.reference}</th>
                <th className="px-3 py-3">{t.sales.client}</th>
                <th className="px-3 py-3">{t.common.date}</th>
                <th className="px-3 py-3">{t.common.total}</th>
                <th className="px-3 py-3">{t.sales.payment}</th>
                <th className="px-3 py-3">{t.sales.balance}</th>
                <th className="px-3 py-3">{t.nav.invoices}</th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted">{t.sales.noSales}</td>
                </tr>
              )}
              {sales.map((sale) => (
                <tr key={sale.id} className="border-b border-border/70">
                  <td className="px-3 py-3 font-medium">
                    <span>{sale.reference}</span>
                    {sale.sale_type === 'legacy_credit' && (
                      <span className="ms-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        {t.sales.legacyBadge}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <Link to={`/clients/${sale.client_id}`} className="text-teal-600 hover:underline">
                      {sale.client?.name}
                    </Link>
                  </td>
                  <td className="px-3 py-3">{sale.sale_date}</td>
                  <td className="px-3 py-3 font-semibold">{Number(sale.total_amount).toLocaleString('fr-FR')} MAD</td>
                  <td className="px-3 py-3">{sale.payment_status && <PaymentBadge status={sale.payment_status} />}</td>
                  <td className="px-3 py-3">{(Number(sale.total_amount) - Number(sale.paid_amount ?? 0)).toLocaleString('fr-FR')} MAD</td>
                  <td className="px-3 py-3">
                    {(sale.invoices_count ?? sale.invoices?.length ?? 0) > 0
                      ? `${sale.invoices_count ?? sale.invoices?.length} facture(s)`
                      : t.common.dash}
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
