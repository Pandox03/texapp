import { FormEvent, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'
import api from '../lib/api'
import { useI18n } from '../context/LocaleContext'
import { unitLabel } from '../lib/units'
import type { Container, FabricType } from '../types'
import Card from '../components/ui/Card'

export default function ContainerDetailPage() {
  const { t, locale } = useI18n()
  const loc = locale === 'ar' ? 'ar' : 'fr'
  const { id } = useParams()
  const [container, setContainer] = useState<Container | null>(null)
  const [fabricTypes, setFabricTypes] = useState<FabricType[]>([])
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    fabric_type_id: '',
    quantity_m2: '',
    unit: 'm2' as 'm2' | 'kg',
    estimated_rolls: '',
  })
  const [costForm, setCostForm] = useState({
    purchase_cost_mad: '',
    shipping_cost_mad: '',
    customs_fees_mad: '',
    other_fees_mad: '',
    market_notes: '',
  })
  const [savingCosts, setSavingCosts] = useState(false)
  const [costMessage, setCostMessage] = useState('')

  async function load() {
    const [containerRes, typesRes] = await Promise.all([
      api.get<Container>(`/containers/${id}`),
      api.get<FabricType[]>('/fabric-types'),
    ])
    setContainer(containerRes.data)
    setFabricTypes(typesRes.data)
    const c = containerRes.data
    setCostForm({
      purchase_cost_mad: c.purchase_cost_mad != null ? String(c.purchase_cost_mad) : '',
      shipping_cost_mad: c.shipping_cost_mad != null ? String(c.shipping_cost_mad) : '',
      customs_fees_mad: c.customs_fees_mad != null ? String(c.customs_fees_mad) : '',
      other_fees_mad: c.other_fees_mad != null ? String(c.other_fees_mad) : '',
      market_notes: c.market_notes ?? '',
    })
  }

  useEffect(() => {
    load()
  }, [id])

  async function handleSaveCosts(e: FormEvent) {
    e.preventDefault()
    setSavingCosts(true)
    setCostMessage('')

    try {
      await api.put(`/containers/${id}`, {
        purchase_cost_mad: costForm.purchase_cost_mad ? Number(costForm.purchase_cost_mad) : null,
        shipping_cost_mad: costForm.shipping_cost_mad ? Number(costForm.shipping_cost_mad) : null,
        customs_fees_mad: costForm.customs_fees_mad ? Number(costForm.customs_fees_mad) : null,
        other_fees_mad: costForm.other_fees_mad ? Number(costForm.other_fees_mad) : null,
        market_notes: costForm.market_notes || null,
      })
      setCostMessage(t.ai.costsSaved)
      load()
    } catch {
      setCostMessage(t.ai.error)
    } finally {
      setSavingCosts(false)
    }
  }

  async function handleAddItem(e: FormEvent) {
    e.preventDefault()
    setError('')

    try {
      await api.post(`/containers/${id}/items`, {
        fabric_type_id: Number(form.fabric_type_id),
        quantity_m2: Number(form.quantity_m2),
        unit: form.unit,
        estimated_rolls: form.estimated_rolls ? Number(form.estimated_rolls) : null,
      })
      setShowForm(false)
      setForm({ fabric_type_id: '', quantity_m2: '', unit: 'm2', estimated_rolls: '' })
      load()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'Impossible d\'ajouter la ligne stock.')
    }
  }

  if (!container) return <p className="text-muted">{t.common.loading}</p>

  const summary = container.stock_summary

  return (
    <div>
      <Link to="/containers" className="mb-4 inline-flex cursor-pointer items-center gap-2 text-sm text-teal-600 hover:underline">
        <ArrowLeft size={16} />
        {t.containers.back}
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy-900">{container.reference}</h1>
        <p className="text-muted">
          {container.type === 'local' ? t.containers.typeLocal : t.containers.typeContainer}
          {' · '}
          {t.containers.fournisseur}: {container.fournisseur?.name ?? t.common.dash}
          {' · '}
          {t.containers.arrivedOn} {container.arrival_date}
          {container.type === 'container' && container.origin ? ` · ${container.origin}` : ''}
        </p>
      </div>

      {summary && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <Card>
            <p className="text-sm text-muted">{t.containers.linesCount}</p>
            <p className="text-2xl font-bold text-navy-900">{summary.lines_count}</p>
          </Card>
          <Card>
            <p className="text-sm text-muted">{t.containers.arrivedM2}</p>
            <p className="text-2xl font-bold text-teal-600">{summary.total_m2.toLocaleString('fr-FR')}</p>
          </Card>
        </div>
      )}

      <Card className="mb-6">
        <h2 className="mb-4 text-lg font-semibold">{t.ai.costSection}</h2>
        <form onSubmit={handleSaveCosts} className="grid gap-4 md:grid-cols-2">
          <input type="number" step="0.01" min="0" placeholder={t.ai.purchaseCost} value={costForm.purchase_cost_mad} onChange={(e) => setCostForm({ ...costForm, purchase_cost_mad: e.target.value })} className="rounded-xl border border-border px-4 py-3" />
          <input type="number" step="0.01" min="0" placeholder={t.ai.shippingCost} value={costForm.shipping_cost_mad} onChange={(e) => setCostForm({ ...costForm, shipping_cost_mad: e.target.value })} className="rounded-xl border border-border px-4 py-3" />
          <input type="number" step="0.01" min="0" placeholder={t.ai.customsFees} value={costForm.customs_fees_mad} onChange={(e) => setCostForm({ ...costForm, customs_fees_mad: e.target.value })} className="rounded-xl border border-border px-4 py-3" />
          <input type="number" step="0.01" min="0" placeholder={t.ai.otherFees} value={costForm.other_fees_mad} onChange={(e) => setCostForm({ ...costForm, other_fees_mad: e.target.value })} className="rounded-xl border border-border px-4 py-3" />
          <textarea placeholder={t.ai.marketNotePlaceholder} value={costForm.market_notes} onChange={(e) => setCostForm({ ...costForm, market_notes: e.target.value })} className="rounded-xl border border-border px-4 py-3 md:col-span-2" rows={2} />
          {costMessage && <p className="md:col-span-2 text-sm text-teal-700">{costMessage}</p>}
          <button type="submit" disabled={savingCosts} className="cursor-pointer rounded-xl bg-navy-900 px-4 py-3 font-semibold text-white md:col-span-2 disabled:opacity-50">
            {savingCosts ? t.common.loading : t.ai.saveCosts}
          </button>
        </form>
      </Card>

      <p className="mb-4 text-sm text-muted">
        Les quantités ci-dessous alimentent le stock global par type de tissu.
      </p>

      <div className="mb-6 flex justify-end">
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-teal-500 px-4 py-2 text-sm font-semibold text-white"
        >
          <Plus size={16} />
          {t.containers.addStockLine}
        </button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <form onSubmit={handleAddItem} className="grid gap-4 md:grid-cols-2">
            <select
              value={form.fabric_type_id}
              onChange={(e) => setForm({ ...form, fabric_type_id: e.target.value })}
              className="rounded-xl border border-border px-4 py-3 md:col-span-2"
              required
            >
              <option value="">{t.containers.selectType}</option>
              {fabricTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
            <div className="flex gap-2 md:col-span-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, unit: 'm2' })}
                className={`cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold ${
                  form.unit === 'm2' ? 'bg-teal-500 text-white' : 'border border-border'
                }`}
              >
                m²
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, unit: 'kg' })}
                className={`cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold ${
                  form.unit === 'kg' ? 'bg-teal-500 text-white' : 'border border-border'
                }`}
              >
                kg
              </button>
            </div>
            <input
              placeholder={`${t.containers.quantityM2} (${unitLabel(form.unit, loc)})`}
              type="number"
              step="0.01"
              min="0.01"
              value={form.quantity_m2}
              onChange={(e) => setForm({ ...form, quantity_m2: e.target.value })}
              className="rounded-xl border border-border px-4 py-3"
              required
            />
            <input
              placeholder={t.containers.estimatedRolls}
              type="number"
              min="0"
              value={form.estimated_rolls}
              onChange={(e) => setForm({ ...form, estimated_rolls: e.target.value })}
              className="rounded-xl border border-border px-4 py-3"
            />
            {error && <p className="text-sm text-red-600 md:col-span-2">{error}</p>}
            <button type="submit" className="cursor-pointer rounded-xl bg-navy-900 px-4 py-3 font-semibold text-white md:col-span-2">
              {t.containers.addToContainer}
            </button>
          </form>
        </Card>
      )}

      <Card>
        <h2 className="mb-4 text-lg font-semibold">{t.containers.containerStock}</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border text-muted">
              <tr>
                <th className="px-3 py-3">{t.settings.tabs.articles}</th>
                <th className="px-3 py-3">{t.stock.unitCol}</th>
                <th className="px-3 py-3">{t.containers.arrivedM2}</th>
                <th className="px-3 py-3">{t.containers.estRolls}</th>
              </tr>
            </thead>
            <tbody>
              {(!container.items || container.items.length === 0) && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-muted">{t.containers.noStockLines}</td>
                </tr>
              )}
              {container.items?.map((item) => (
                <tr key={item.id} className="border-b border-border/70">
                  <td className="px-3 py-3 font-medium">{item.fabric_type?.name}</td>
                  <td className="px-3 py-3">{unitLabel(item.unit ?? item.fabric_type?.unit, loc)}</td>
                  <td className="px-3 py-3">{Number(item.quantity_m2).toLocaleString('fr-FR')}</td>
                  <td className="px-3 py-3">{item.estimated_rolls ?? t.common.dash}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
