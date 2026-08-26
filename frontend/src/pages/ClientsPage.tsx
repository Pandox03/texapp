import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye } from 'lucide-react'
import api from '../lib/api'
import { useI18n } from '../context/LocaleContext'
import type { Client, Paginated } from '../types'
import Card from '../components/ui/Card'
import FilterBar from '../components/ui/FilterBar'
import PageHeader from '../components/ui/PageHeader'

export default function ClientsPage() {
  const { t } = useI18n()
  const [clients, setClients] = useState<Client[]>([])
  const [filters, setFilters] = useState<Record<string, string>>({})

  const load = useCallback(() => {
    const params = {
      per_page: 1000,
      ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
    }
    api.get<Paginated<Client>>('/clients', { params }).then((res) => setClients(res.data.data))
  }, [filters])

  useEffect(() => {
    load()
  }, [load])

  const cities = [...new Set(clients.map((c) => c.city).filter(Boolean))] as string[]

  return (
    <div>
      <PageHeader title={t.clients.title} description={t.clients.description} />

      <FilterBar
        fields={[
          { key: 'search', label: t.filters.search, type: 'text', placeholder: 'Nom, téléphone, ICE...' },
          {
            key: 'city',
            label: t.common.city,
            type: 'select',
            placeholder: t.common.all,
            options: cities.map((c) => ({ value: c, label: c })),
          },
          { key: 'category', label: t.common.category, type: 'text', placeholder: t.common.category },
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
                <th className="px-3 py-3">{t.common.name}</th>
                <th className="px-3 py-3">{t.common.city}</th>
                <th className="px-3 py-3">{t.common.category}</th>
                <th className="px-3 py-3">{t.clients.ordersCount}</th>
                <th className="px-3 py-3">{t.clients.totalSales}</th>
                <th className="px-3 py-3">{t.clients.balanceDue}</th>
                <th className="px-3 py-3">{t.common.actions}</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} className="border-b border-border/70">
                  <td className="px-3 py-3">
                    <p className="font-medium text-navy-900">{client.name}</p>
                    {client.contact_person && <p className="text-xs text-muted">{client.contact_person}</p>}
                  </td>
                  <td className="px-3 py-3">{client.city ?? t.common.dash}</td>
                  <td className="px-3 py-3">{client.category ?? t.common.dash}</td>
                  <td className="px-3 py-3">{client.orders_count ?? 0}</td>
                  <td className="px-3 py-3">{client.total_sales?.toLocaleString('fr-FR') ?? 0} MAD</td>
                  <td className="px-3 py-3 font-medium text-red-600">
                    {client.balance_due?.toLocaleString('fr-FR') ?? 0} MAD
                  </td>
                  <td className="px-3 py-3">
                    <Link
                      to={`/clients/${client.id}`}
                      className="inline-flex cursor-pointer items-center gap-1 text-teal-600 hover:underline"
                    >
                      <Eye size={14} />
                      {t.common.view}
                    </Link>
                  </td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted">
                    {t.common.noResults}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
