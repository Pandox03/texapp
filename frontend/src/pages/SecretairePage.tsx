import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FilePlus, Layers, Package, Palette, ShoppingCart, Truck, Users } from 'lucide-react'
import api from '../lib/api'
import { useI18n } from '../context/LocaleContext'
import type { Client, Container, Sale } from '../types'
import Card from '../components/ui/Card'
import PageHeader from '../components/ui/PageHeader'
import StatCard from '../components/ui/StatCard'

interface SecretaireDashboard {
  stats: {
    containers: number
    clients: number
    invoices: number
    sales_without_invoice: number
    recent_containers: number
  }
  recent_containers: Container[]
  recent_clients: Client[]
  pending_invoices: Sale[]
}

export default function SecretairePage() {
  const { t } = useI18n()
  const [data, setData] = useState<SecretaireDashboard | null>(null)

  useEffect(() => {
    api.get<SecretaireDashboard>('/secretaire/dashboard').then((res) => setData(res.data))
  }, [])

  if (!data) {
    return <div className="text-muted">{t.common.loading}</div>
  }

  const quickActions = [
    {
      to: '/containers',
      icon: Package,
      title: t.secretaire.manageContainers,
      desc: t.secretaire.manageContainersDesc,
      color: 'bg-teal-500',
    },
    {
      to: '/settings?tab=articles',
      icon: Palette,
      title: t.settings.tabs.articles,
      desc: t.fabricTypes.description,
      color: 'bg-violet-600',
    },
    {
      to: '/settings?tab=fournisseurs',
      icon: Truck,
      title: t.settings.tabs.fournisseurs,
      desc: t.fournisseurs.description,
      color: 'bg-sky-600',
    },
    {
      to: '/clients',
      icon: Users,
      title: t.secretaire.manageClients,
      desc: t.secretaire.manageClientsDesc,
      color: 'bg-navy-900',
    },
    {
      to: '/sales/new',
      icon: ShoppingCart,
      title: t.sales.new,
      desc: t.secretaire.newSaleDesc,
      color: 'bg-teal-600',
    },
    {
      to: '/stock',
      icon: Layers,
      title: t.nav.stock,
      desc: t.secretaire.viewStockDesc,
      color: 'bg-emerald-600',
    },
    {
      to: '/invoices/generer',
      icon: FilePlus,
      title: t.secretaire.generateInvoice,
      desc: t.secretaire.generateInvoiceDesc,
      color: 'bg-gold-500',
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.secretaire.title}
        description={t.secretaire.description}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t.nav.containers} value={data.stats.containers} icon={Package} accent="teal" />
        <StatCard label={t.nav.clients} value={data.stats.clients} icon={Users} accent="navy" />
        <StatCard label={t.nav.invoices} value={data.stats.invoices} icon={FilePlus} accent="gold" />
        <StatCard
          label={t.secretaire.pendingInvoices}
          value={data.stats.sales_without_invoice}
          icon={FilePlus}
          accent="mint"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {quickActions.map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className="group cursor-pointer rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:border-teal-500/40 hover:shadow-md"
          >
            <div className={`mb-4 inline-flex rounded-xl ${action.color} p-3 text-white`}>
              <action.icon size={24} />
            </div>
            <h3 className="text-lg font-semibold text-navy-900 group-hover:text-teal-600">{action.title}</h3>
            <p className="mt-1 text-sm text-muted">{action.desc}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t.secretaire.pendingInvoices}</h2>
            <Link to="/invoices/generer" className="text-sm text-teal-600 hover:underline">
              {t.secretaire.generateInvoice}
            </Link>
          </div>
          <div className="space-y-3">
            {data.pending_invoices.length === 0 && (
              <p className="text-sm text-muted">{t.secretaire.noPendingInvoices}</p>
            )}
            {data.pending_invoices.map((sale) => (
              <div key={sale.id} className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                <div>
                  <p className="font-medium">{sale.reference}</p>
                  <p className="text-sm text-muted">{sale.client?.name} · {sale.sale_date}</p>
                </div>
                <p className="font-semibold">{Number(sale.total_amount).toLocaleString('fr-FR')} MAD</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold">{t.secretaire.recentContainers}</h2>
          <div className="space-y-3">
            {data.recent_containers.map((c) => (
              <Link
                key={c.id}
                to={`/containers/${c.id}`}
                className="flex cursor-pointer items-center justify-between rounded-xl border border-border px-4 py-3 hover:bg-surface"
              >
                <div>
                  <p className="font-medium">{c.reference}</p>
                  <p className="text-sm text-muted">{c.arrival_date}</p>
                </div>
                <span className="text-xs text-teal-600">{c.items_count ?? 0} types</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
