import { FormEvent, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import api from '../../lib/api'
import { useI18n } from '../../context/LocaleContext'
import type { FabricType } from '../../types'
import Card from '../ui/Card'

const emptyForm = {
  name: '',
  composition: '',
  default_width_cm: '150',
  default_gsm: '150',
  unit: 'm2',
  parent_id: '',
  market_price_m2_mad: '',
  target_margin_pct: '25',
}

export default function ArticlesPanel() {
  const { t } = useI18n()
  const [types, setTypes] = useState<FabricType[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)

  async function load() {
    const { data } = await api.get<FabricType[]>('/fabric-types')
    setTypes(data)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    await api.post('/fabric-types', {
      name: form.name,
      composition: form.composition || null,
      default_width_cm: form.default_width_cm ? Number(form.default_width_cm) : null,
      default_gsm: form.default_gsm ? Number(form.default_gsm) : null,
      unit: form.unit || 'm2',
      parent_id: form.parent_id ? Number(form.parent_id) : null,
      market_price_m2_mad: form.market_price_m2_mad ? Number(form.market_price_m2_mad) : null,
      target_margin_pct: form.target_margin_pct ? Number(form.target_margin_pct) : null,
    })
    setShowForm(false)
    setForm(emptyForm)
    load()
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{t.fabricTypes.description}</p>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-teal-500 px-4 py-2 text-sm font-semibold text-white"
        >
          <Plus size={16} />
          {t.fabricTypes.new}
        </button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <input
              placeholder={t.fabricTypes.typeName}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded-xl border border-border px-4 py-3"
              required
            />
            <select
              value={form.parent_id}
              onChange={(e) => setForm({ ...form, parent_id: e.target.value })}
              className="rounded-xl border border-border px-4 py-3"
            >
              <option value="">{t.fabricTypes.noParent}</option>
              {types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
            <input
              placeholder={t.fabricTypes.composition}
              value={form.composition}
              onChange={(e) => setForm({ ...form, composition: e.target.value })}
              className="rounded-xl border border-border px-4 py-3"
            />
            <input
              placeholder={t.fabricTypes.defaultWidth}
              value={form.default_width_cm}
              onChange={(e) => setForm({ ...form, default_width_cm: e.target.value })}
              className="rounded-xl border border-border px-4 py-3"
            />
            <input
              placeholder={t.fabricTypes.defaultGsm}
              value={form.default_gsm}
              onChange={(e) => setForm({ ...form, default_gsm: e.target.value })}
              className="rounded-xl border border-border px-4 py-3"
            />
            <select
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className="rounded-xl border border-border px-4 py-3"
              required
            >
              <option value="m2">{t.fabricTypes.unitM2}</option>
              <option value="kg">{t.fabricTypes.unitKg}</option>
            </select>
            <p className="text-xs text-muted md:col-span-2 -mt-2">{t.fabricTypes.unitHint}</p>
            <input
              placeholder={`${t.fabricTypes.marketPrice} (MAD/m²)`}
              value={form.market_price_m2_mad}
              onChange={(e) => setForm({ ...form, market_price_m2_mad: e.target.value })}
              className="rounded-xl border border-border px-4 py-3"
              type="number"
              min={0}
              step="0.01"
            />
            <input
              placeholder={t.fabricTypes.targetMargin}
              value={form.target_margin_pct}
              onChange={(e) => setForm({ ...form, target_margin_pct: e.target.value })}
              className="rounded-xl border border-border px-4 py-3"
              type="number"
              min={0}
              step="0.1"
            />
            <button type="submit" className="cursor-pointer rounded-xl bg-navy-900 px-4 py-3 font-semibold text-white md:col-span-2">
              {t.fabricTypes.save}
            </button>
          </form>
        </Card>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border text-muted">
              <tr>
                <th className="px-3 py-3">{t.common.name}</th>
                <th className="px-3 py-3">{t.fabricTypes.unit}</th>
                <th className="px-3 py-3">{t.fabricTypes.parent}</th>
                <th className="px-3 py-3">{t.fabricTypes.composition}</th>
                <th className="hidden px-3 py-3 sm:table-cell">{t.fabricTypes.width}</th>
                <th className="hidden px-3 py-3 md:table-cell">{t.fabricTypes.gsm}</th>
                <th className="px-3 py-3">{t.fabricTypes.marketPrice}</th>
                <th className="hidden px-3 py-3 lg:table-cell">{t.fabricTypes.targetMargin}</th>
              </tr>
            </thead>
            <tbody>
              {types.map((type) => (
                <tr key={type.id} className="border-b border-border/70">
                  <td className="px-3 py-3 font-medium">{type.name}</td>
                  <td className="px-3 py-3">{type.unit === 'kg' ? 'kg' : 'm²'}*</td>
                  <td className="px-3 py-3">{type.parent?.name ?? t.common.dash}</td>
                  <td className="px-3 py-3">{type.composition ?? t.common.dash}</td>
                  <td className="hidden px-3 py-3 sm:table-cell">
                    {type.default_width_cm ? `${type.default_width_cm} cm` : t.common.dash}
                  </td>
                  <td className="hidden px-3 py-3 md:table-cell">{type.default_gsm ?? t.common.dash}</td>
                  <td className="px-3 py-3">
                    {type.market_price_m2_mad != null
                      ? `${type.market_price_m2_mad} MAD/${type.unit === 'kg' ? 'kg' : 'm²'}`
                      : t.common.dash}
                  </td>
                  <td className="hidden px-3 py-3 lg:table-cell">
                    {type.target_margin_pct != null ? `${type.target_margin_pct}%` : t.common.dash}
                  </td>
                </tr>
              ))}
              {types.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-muted">
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
