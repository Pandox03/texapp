import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  Clock,
  FileText,
  Layers,
  Package,
  ShoppingCart,
  TrendingUp,
  Users,
} from 'lucide-react'
import api from '../lib/api'
import { useI18n } from '../context/LocaleContext'
import { unitLabel } from '../lib/units'
import type { DashboardData } from '../types'
import BarChart from '../components/charts/BarChart'
import DonutChart from '../components/charts/DonutChart'
import Card from '../components/ui/Card'
import PageHeader from '../components/ui/PageHeader'
import StatCard from '../components/ui/StatCard'
import { PaymentBadge } from '../components/ui/StatusBadge'

const containerColors: Record<string, string> = {
  in_transit: '#f59e0b',
  arrived: '#2a9d8f',
  processing: '#3b82f6',
  closed: '#64748b',
}

const paymentColors: Record<string, string> = {
  sent: '#3b82f6',
  unpaid: '#ef4444',
  paid: '#10b981',
}

const paymentLinks: Record<string, string> = {
  sent: '/invoices?status=sent',
  unpaid: '/invoices?status=unpaid',
  paid: '/invoices?status=paid',
}

function severityClass(severity: 'high' | 'medium') {
  return severity === 'high'
    ? 'border-red-200 bg-red-50/80'
    : 'border-amber-200 bg-amber-50/60'
}

export default function DashboardPage() {
  const { t, locale, containerStatusLabel, formatDateShort, formatNumber } = useI18n()
  const loc = locale === 'ar' ? 'ar' : 'fr'
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  function formatMad(value: number) {
    return `${formatNumber(value)} MAD`
  }

  useEffect(() => {
    api
      .get<DashboardData>('/dashboard')
      .then((res) => setData(res.data))
      .catch(() => setError(t.dashboard.loadError))
  }, [t.dashboard.loadError])

  if (error) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-red-600">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="cursor-pointer rounded-xl bg-teal-500 px-4 py-2 text-sm font-semibold text-white"
        >
          {t.dashboard.retry}
        </button>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-teal-500 border-t-transparent" />
      </div>
    )
  }

  const { stats } = data
  const receivables = data.receivables ?? { total: stats.balance_due, by_client: [] }
  const actions = data.priority_actions ?? []
  const stockUsage = stats.total_stock_m2 > 0
    ? Math.round((stats.sold_m2 / stats.total_stock_m2) * 100)
    : 0

  const containerSegments = Object.entries(data.container_status).map(([status, count]) => ({
    label: containerStatusLabel(status as keyof typeof t.containerStatus),
    value: count,
    color: containerColors[status] ?? '#94a3b8',
  }))

  const paymentSegments = ['sent', 'unpaid', 'paid']
    .filter((s) => data.payment_breakdown[s])
    .map((status) => ({
      label: t.invoiceStatus[status as keyof typeof t.invoiceStatus],
      value: data.payment_breakdown[status].count,
      color: paymentColors[status],
      to: paymentLinks[status],
    }))

  const growthContext = stats.revenue_last_month > 0
    ? `M-1 : ${formatMad(stats.revenue_last_month)}`
    : stats.revenue_three_month_avg
      ? `${t.dashboard.revenueAvg} : ${formatMad(stats.revenue_three_month_avg ?? 0)}`
      : undefined

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.dashboard.title}
        description={t.dashboard.dynamicSubtitle(
          stats.unpaid_invoices_count ?? data.invoice_stats.unpaid,
          formatMad(receivables.total),
        )}
      />

      {/* À traiter */}
      <Card className="border-s-4 border-s-gold-500">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-navy-900">
            <Clock size={20} className="text-gold-500" />
            {t.dashboard.toProcess}
          </h2>
          {actions.length > 0 && (
            <span className="rounded-full bg-gold-500/15 px-3 py-1 text-xs font-semibold text-gold-600">
              {actions.length}
            </span>
          )}
        </div>
        {actions.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl bg-surface px-4 py-5 text-sm text-muted">
            <CheckCircle2 size={20} className="shrink-0 text-teal-500" />
            {t.dashboard.toProcessEmpty}
          </div>
        ) : (
          <div className="space-y-2">
            {actions.map((action) => (
              <Link
                key={`${action.type}-${action.entity_id}`}
                to={action.link}
                className={`flex cursor-pointer items-center justify-between gap-4 rounded-xl border px-4 py-3 transition hover:shadow-sm ${severityClass(action.severity)}`}
              >
                <div className="min-w-0">
                  <p className="font-medium text-navy-900">{action.label}</p>
                  <p className="text-sm text-muted">{action.detail}</p>
                </div>
                {action.amount != null && (
                  <p className="shrink-0 text-sm font-semibold text-navy-900">{formatMad(action.amount)}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* KPI — finance */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-12">
        <div className="rounded-2xl border border-border bg-gradient-to-br from-navy-900 to-navy-800 p-5 text-white shadow-sm xl:col-span-4">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white/70">{t.dashboard.revenueMonth}</p>
              <p className="mt-2 text-3xl font-bold">{formatMad(stats.revenue_this_month)}</p>
              <div className={`mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm ${stats.revenue_growth >= 0 ? 'text-mint-400' : 'text-red-300'}`}>
                {stats.revenue_growth >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                <span>
                  {stats.revenue_growth >= 0 ? '+' : ''}{stats.revenue_growth}% {t.dashboard.revenueGrowth}
                </span>
                {growthContext && <span className="text-white/50">· {growthContext}</span>}
              </div>
              {data.sales_chart.length > 1 && (
                <div className="mt-4 flex h-8 items-end gap-0.5">
                  {data.sales_chart.map((pt) => {
                    const max = Math.max(...data.sales_chart.map((p) => p.revenue), 1)
                    const h = pt.revenue > 0 ? Math.max((pt.revenue / max) * 100, 12) : 8
                    return (
                      <div
                        key={pt.month}
                        className={`flex-1 rounded-t ${pt.revenue > 0 ? 'bg-mint-400/80' : 'bg-white/10'}`}
                        style={{ height: `${h}%` }}
                        title={`${pt.label}: ${formatMad(pt.revenue)}`}
                      />
                    )
                  })}
                </div>
              )}
            </div>
            <TrendingUp size={22} className="shrink-0 text-white/40" />
          </div>
        </div>

        <div className="xl:col-span-4">
          <StatCard
            label={t.dashboard.balanceDue}
            value={formatMad(receivables.total)}
            icon={AlertTriangle}
            variant="alert"
            subtitle={t.dashboard.receivablesFormula}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:col-span-4 xl:grid-cols-2">
          <StatCard label={t.dashboard.totalPaid} value={formatMad(stats.total_paid)} variant="compact" />
          <StatCard label={t.dashboard.totalInvoiced} value={formatMad(stats.total_invoiced ?? data.invoice_stats.total_amount)} variant="compact" />
        </div>
      </div>

      {/* Créances par client */}
      {receivables.by_client.length > 0 && (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-navy-900">{t.dashboard.receivablesDetail}</h2>
            <Link to="/clients" className="text-sm text-teal-600 hover:underline">{t.dashboard.viewAll}</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-border text-muted">
                <tr>
                  <th className="px-3 py-2">{t.common.name}</th>
                  <th className="px-3 py-2">{t.dashboard.totalInvoiced}</th>
                  <th className="px-3 py-2">{t.dashboard.totalPaid}</th>
                  <th className="px-3 py-2 text-right">{t.dashboard.balanceDue}</th>
                </tr>
              </thead>
              <tbody>
                {receivables.by_client.slice(0, 6).map((client) => (
                  <tr key={client.id} className="border-b border-border/70">
                    <td className="px-3 py-2.5">
                      <Link
                        to={`/clients/${client.id}`}
                        className="font-medium text-navy-900 hover:text-teal-600"
                        title={client.name}
                      >
                        {client.name}
                      </Link>
                      {client.city && <span className="ml-1 text-xs text-muted">({client.city})</span>}
                    </td>
                    <td className="px-3 py-2.5 text-muted">{formatMad(client.invoiced)}</td>
                    <td className="px-3 py-2.5 text-muted">{formatMad(client.paid)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-amber-700">{formatMad(client.balance_due)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* KPI ops — compact */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label={t.dashboard.availableStock} value={`${stats.available_m2.toLocaleString('fr-FR')} m²`} variant="compact" />
        <StatCard label={t.dashboard.salesMonth} value={stats.sales_this_month} icon={ShoppingCart} variant="compact" />
        <StatCard label={t.dashboard.containers} value={stats.containers} icon={Package} variant="compact" />
        <StatCard label={t.dashboard.clients} value={stats.clients} icon={Users} variant="compact" />
        <StatCard label={t.dashboard.availableRolls} value={stats.available_rolls} variant="compact" />
      </div>

      {/* Charts */}
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-navy-900">{t.dashboard.salesChart}</h2>
            <Link to="/invoices" className="text-sm text-teal-600 hover:underline">{t.dashboard.viewAll}</Link>
          </div>
          <BarChart
            data={data.sales_chart.map((p) => ({
              label: p.label,
              value: p.revenue,
              empty: !p.has_data,
            }))}
            valueSuffix=" MAD"
            referenceLine={stats.revenue_three_month_avg}
            referenceLabel={t.dashboard.revenueAvg}
          />
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold text-navy-900">{t.dashboard.stockByType}</h2>
          {data.stock_by_type.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted">
              <Layers size={28} className="text-border" />
              {t.dashboard.noStockRegistered}
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {data.stock_by_type.map((type) => {
                  const max = data.stock_by_type[0]?.available_m2 || 1
                  const pct = (type.available_m2 / max) * 100
                  const barColor = type.is_low ? '#ef4444' : type.usage_pct > 70 ? '#f59e0b' : '#2a9d8f'

                  return (
                    <div key={type.fabric_type_id}>
                      <div className="mb-1 flex justify-between gap-2 text-sm">
                        <span className="font-medium text-navy-900" title={type.name}>{type.name}</span>
                        <span className={`shrink-0 ${type.is_low ? 'font-semibold text-red-600' : 'text-muted'}`}>
                          {type.available_m2.toLocaleString('fr-FR')} {unitLabel(type.unit, loc)} dispo.
                          {type.is_low && ` · ${t.dashboard.stockLowThreshold}`}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: barColor }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-4 rounded-xl bg-surface px-4 py-3 text-sm">
                <span className="text-muted">{t.dashboard.stockSold} : </span>
                <span className="font-semibold text-navy-900">{stockUsage}%</span>
                <span className="text-muted"> · {stats.sold_m2.toLocaleString('fr-FR')} / {stats.total_stock_m2.toLocaleString('fr-FR')} m²</span>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Breakdowns + top clients */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-navy-900">{t.dashboard.containerStatus}</h2>
          {containerSegments.length > 0 ? (
            <DonutChart segments={containerSegments} />
          ) : (
            <div className="flex flex-col items-center gap-2 py-6 text-sm text-muted">
              <Package size={24} className="text-border" />
              {t.dashboard.noContainers}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold text-navy-900">{t.dashboard.paymentBreakdown}</h2>
          {paymentSegments.length > 0 ? (
            <DonutChart segments={paymentSegments} />
          ) : (
            <div className="flex flex-col items-center gap-2 py-6 text-sm text-muted">
              <FileText size={24} className="text-border" />
              {t.dashboard.noInvoicesChart}
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-navy-900">{t.dashboard.topClients}</h2>
            <Link to="/clients" className="text-sm text-teal-600 hover:underline">{t.dashboard.viewAll}</Link>
          </div>
          <div className="space-y-3">
            {data.top_clients.map((client, i) => (
              <Link
                key={client.id}
                to={`/clients/${client.id}`}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-border px-3 py-2.5 transition hover:bg-surface"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-900 text-sm font-bold text-white">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-snug text-navy-900" title={client.name}>
                    {client.name}
                  </p>
                  <p className="text-xs text-muted">
                    {client.orders_count} {t.dashboard.orders}
                    {client.city ? ` · ${client.city}` : ''}
                  </p>
                  {client.days_since_last_order != null && (
                    <p className={`mt-0.5 text-xs ${client.is_inactive ? 'font-medium text-amber-600' : 'text-muted'}`}>
                      {t.dashboard.lastOrder} : {t.dashboard.daysAgo(client.days_since_last_order)}
                      {client.is_inactive && ` · ${t.dashboard.inactiveClient}`}
                    </p>
                  )}
                </div>
                <p className="shrink-0 text-sm font-semibold text-teal-600">{formatMad(client.revenue)}</p>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {/* Invoices + low stock */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <FileText size={20} className="text-teal-600" />
            <h2 className="text-lg font-semibold text-navy-900">{t.dashboard.invoiceOverview}</h2>
          </div>
          <div className="mb-4 grid grid-cols-4 gap-3 text-center">
            <div className="rounded-xl bg-surface p-3">
              <p className="text-2xl font-bold text-navy-900">{data.invoice_stats.total}</p>
              <p className="text-xs text-muted">Total</p>
            </div>
            <Link to="/invoices?status=paid" className="rounded-xl bg-emerald-50 p-3 transition hover:bg-emerald-100">
              <p className="text-2xl font-bold text-emerald-700">{data.invoice_stats.paid}</p>
              <p className="text-xs text-muted">{t.invoiceStatus.paid}</p>
            </Link>
            <Link to="/invoices?status=sent" className="rounded-xl bg-blue-50 p-3 transition hover:bg-blue-100">
              <p className="text-2xl font-bold text-blue-700">{data.invoice_stats.sent}</p>
              <p className="text-xs text-muted">{t.invoiceStatus.sent}</p>
            </Link>
            <Link to="/invoices?status=unpaid" className="rounded-xl bg-red-50 p-3 transition hover:bg-red-100">
              <p className="text-2xl font-bold text-red-700">{data.invoice_stats.unpaid}</p>
              <p className="text-xs text-muted">{t.invoiceStatus.unpaid}</p>
            </Link>
          </div>
          <p className="text-sm text-muted">
            {t.dashboard.totalInvoiced} :{' '}
            <span className="font-semibold text-navy-900">{formatMad(data.invoice_stats.total_amount)}</span>
          </p>
          {data.unpaid_invoices.length > 0 && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-2 text-sm font-semibold text-red-600">{t.dashboard.overdueInvoices}</p>
              {data.unpaid_invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0" title={`${inv.reference} — ${inv.client?.name}`}>
                    {inv.reference} — {inv.client?.name}
                    {(inv as { days_overdue?: number }).days_overdue ? (
                      <span className="ml-1 text-xs text-red-500">
                        (+{(inv as { days_overdue?: number }).days_overdue} j)
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 font-medium">
                    {formatMad(Number((inv as { remaining?: number }).remaining ?? inv.total))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Layers size={20} className="text-amber-500" />
            <h2 className="text-lg font-semibold text-navy-900">{t.dashboard.lowStock}</h2>
            <Link to="/stock" className="ml-auto text-sm text-teal-600 hover:underline">{t.dashboard.viewAll}</Link>
          </div>
          {data.low_stock.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-surface/50 px-6 py-10 text-center">
              <CheckCircle2 size={32} className="text-teal-500" />
              <div>
                <p className="font-medium text-navy-900">{t.dashboard.noAlertsTitle}</p>
                <p className="mt-1 text-sm text-muted">{t.dashboard.noAlertsDesc}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {data.low_stock.map((item) => (
                <Link
                  key={item.fabric_type_id}
                  to="/stock"
                  className="block cursor-pointer rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3 transition hover:border-amber-300"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-navy-900">
                      {item.fabric_type}
                    </p>
                    <span className="shrink-0 rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-900">
                      {item.available_rolls} {t.dashboard.rollsShort}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {item.ratio}% restant · {item.available_m2.toLocaleString('fr-FR')}{' '}
                    {unitLabel(item.unit, loc)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Activity feeds */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-navy-900">{t.dashboard.recentSales}</h2>
          <div className="space-y-3">
            {data.recent_sales.map((sale) => (
              <div key={sale.id} className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-navy-900">{sale.reference}</p>
                  <p className="truncate text-sm text-muted" title={sale.client?.name}>{sale.client?.name}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold">{formatMad(Number(sale.total_amount))}</p>
                  {sale.payment_status && <PaymentBadge status={sale.payment_status} />}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold text-navy-900">{t.dashboard.recentPayments}</h2>
          <div className="space-y-3">
            {data.recent_payments.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-6 text-sm text-muted">
                <Banknote size={24} className="text-border" />
                {t.clients.noPayments}
              </div>
            )}
            {data.recent_payments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-navy-900" title={payment.client?.name}>{payment.client?.name}</p>
                  <p className="text-sm text-muted">
                    {t.paymentMethod[payment.method]} · {formatDateShort(payment.payment_date)}
                  </p>
                  {payment.invoice?.reference && (
                    <p className="text-xs text-muted">{payment.invoice.reference}</p>
                  )}
                </div>
                <p className="shrink-0 font-semibold text-teal-600">{formatMad(Number(payment.amount))}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold text-navy-900">{t.dashboard.recentContainers}</h2>
          <div className="space-y-3">
            {data.recent_containers.map((container) => {
              const lines = container.stock_summary?.lines_count ?? container.items_count ?? 0
              const m2 = container.stock_summary?.total_m2

              return (
                <Link
                  key={container.id}
                  to={`/containers/${container.id}`}
                  className="flex cursor-pointer items-center justify-between rounded-xl border border-border px-4 py-3 transition hover:bg-surface"
                >
                  <div>
                    <p className="font-medium text-navy-900">{container.reference}</p>
                    <p className="text-sm text-muted">{formatDateShort(container.arrival_date)}</p>
                  </div>
                  <div className="text-right">
                    <span className="rounded-full bg-teal-500/10 px-3 py-1 text-xs font-medium text-teal-600">
                      {lines} {t.dashboard.lines}
                    </span>
                    {m2 != null && m2 > 0 && (
                      <p className="mt-1 text-xs text-muted">{m2.toLocaleString('fr-FR')} {t.dashboard.m2Arrived}</p>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </Card>
      </div>
    </div>
  )
}
