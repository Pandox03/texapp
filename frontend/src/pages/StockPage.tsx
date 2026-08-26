import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Plus, Trash2, Layers, Package, Ruler, Undo2 } from 'lucide-react'
import api from '../lib/api'
import { extractApiError } from '../lib/errors'
import { unitLabel } from '../lib/units'
import { useI18n } from '../context/LocaleContext'
import type {
  Client,
  FabricRoll,
  FabricType,
  Paginated,
  ReturnableLine,
  Sale,
  StockLine,
  StockResponse,
  StockReturn,
} from '../types'
import Card from '../components/ui/Card'
import FilterBar from '../components/ui/FilterBar'
import PageHeader from '../components/ui/PageHeader'
import StatCard from '../components/ui/StatCard'

type Tab = 'summary' | 'rolls' | 'returns'

const emptyReturnForm = () => ({
  client_id: '',
  sale_id: '',
  fabric_type_id: '',
  quantity_m2: '',
  roll_count: '1',
  returned_at: new Date().toISOString().slice(0, 10),
  reason: '',
  notes: '',
})

export default function StockPage() {
  const { t, locale } = useI18n()
  const loc = locale === 'ar' ? 'ar' : 'fr'
  const [tab, setTab] = useState<Tab>('summary')
  const [stock, setStock] = useState<StockResponse | null>(null)
  const [rolls, setRolls] = useState<FabricRoll[]>([])
  const [returns, setReturns] = useState<StockReturn[]>([])
  const [fabricTypes, setFabricTypes] = useState<FabricType[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [returnableLines, setReturnableLines] = useState<ReturnableLine[]>([])
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [showReturnForm, setShowReturnForm] = useState(false)
  const [savingReturn, setSavingReturn] = useState(false)
  const [returnError, setReturnError] = useState('')
  const [returnMessage, setReturnMessage] = useState('')
  const [returnForm, setReturnForm] = useState(emptyReturnForm)

  const loadMeta = useCallback(() => {
    api.get<FabricType[]>('/fabric-types').then((res) => setFabricTypes(res.data))
  }, [])

  const loadStock = useCallback(() => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
    api.get<StockResponse>('/stock', { params }).then((res) => setStock(res.data))
  }, [filters])

  const loadRolls = useCallback(() => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
    api.get<Paginated<FabricRoll>>('/stock/rolls', { params }).then((res) => setRolls(res.data.data))
  }, [filters])

  const loadReturns = useCallback(() => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
    api.get<Paginated<StockReturn>>('/stock/returns', { params }).then((res) => setReturns(res.data.data))
  }, [filters])

  useEffect(() => {
    loadMeta()
  }, [loadMeta])

  useEffect(() => {
    if (tab === 'summary') loadStock()
    else if (tab === 'rolls') loadRolls()
    else loadReturns()
  }, [tab, loadStock, loadRolls, loadReturns])

  useEffect(() => {
    if (showReturnForm && clients.length === 0) {
      api
        .get<Paginated<Client>>('/clients', { params: { per_page: 500 } })
        .then((res) => setClients(res.data.data))
    }
  }, [showReturnForm, clients.length])

  useEffect(() => {
    if (!returnForm.client_id) {
      setSales([])
      return
    }
    api
      .get<Paginated<Sale>>('/sales', {
        params: { client_id: returnForm.client_id, sale_type: 'stock', page: 1 },
      })
      .then((res) => setSales(res.data.data))
      .catch(() => setSales([]))
  }, [returnForm.client_id])

  useEffect(() => {
    if (!returnForm.sale_id) {
      setReturnableLines([])
      return
    }
    api
      .get<{ lines: ReturnableLine[] }>(`/stock/returns/returnable/${returnForm.sale_id}`)
      .then((res) => setReturnableLines(res.data.lines))
      .catch(() => setReturnableLines([]))
  }, [returnForm.sale_id])

  const selectedReturnable = returnableLines.find(
    (line) => String(line.fabric_type_id) === returnForm.fabric_type_id,
  )

  function openReturnForm() {
    setTab('returns')
    setShowReturnForm(true)
    setReturnError('')
    setReturnMessage('')
  }

  async function handleReturnSubmit(e: FormEvent) {
    e.preventDefault()
    setSavingReturn(true)
    setReturnError('')
    setReturnMessage('')
    try {
      await api.post('/stock/returns', {
        sale_id: Number(returnForm.sale_id),
        fabric_type_id: Number(returnForm.fabric_type_id),
        quantity_m2: Number(returnForm.quantity_m2),
        unit: selectedReturnable?.unit ?? 'm2',
        roll_count: Number(returnForm.roll_count),
        returned_at: returnForm.returned_at,
        reason: returnForm.reason || null,
        notes: returnForm.notes || null,
      })
      setReturnMessage(t.stock.returnSaved)
      setShowReturnForm(false)
      setReturnForm(emptyReturnForm())
      setReturnableLines([])
      setSales([])
      loadReturns()
      loadStock()
    } catch (err) {
      setReturnError(extractApiError(err, t.stock.returnError))
    } finally {
      setSavingReturn(false)
    }
  }

  async function handleFullSaleReturn() {
    if (!returnForm.sale_id || returnableLines.length === 0) return
    if (!window.confirm(t.stock.returnFullSaleConfirm)) return

    setSavingReturn(true)
    setReturnError('')
    setReturnMessage('')
    try {
      await api.post('/stock/returns/full', {
        sale_id: Number(returnForm.sale_id),
        returned_at: returnForm.returned_at,
        reason: returnForm.reason || null,
        notes: returnForm.notes || null,
      })
      setReturnMessage(t.stock.returnFullSaleSaved)
      setShowReturnForm(false)
      setReturnForm(emptyReturnForm())
      setReturnableLines([])
      setSales([])
      loadReturns()
      loadStock()
    } catch (err) {
      setReturnError(extractApiError(err, t.stock.returnError))
    } finally {
      setSavingReturn(false)
    }
  }

  async function handleDeleteReturn(row: StockReturn) {
    if (row.sale_id) {
      setReturnError(t.stock.cannotDeleteSaleReturn)
      return
    }
    if (!window.confirm(t.stock.deleteReturnConfirm)) return
    try {
      await api.delete(`/stock/returns/${row.id}`)
      loadReturns()
      loadStock()
    } catch (err) {
      setReturnError(extractApiError(err, t.stock.returnError))
    }
  }

  const items = stock?.items.data ?? []

  return (
    <div>
      <PageHeader
        title={t.stock.title}
        description={t.stock.description}
        action={
          <button
            type="button"
            onClick={openReturnForm}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-teal-500 px-4 py-2 text-sm font-semibold text-white"
          >
            <Undo2 size={16} />
            {t.stock.newReturn}
          </button>
        }
      />

      <FilterBar
        fields={[
          { key: 'search', label: t.filters.search, type: 'text', placeholder: t.filters.search },
          {
            key: 'fabric_type_id',
            label: t.settings.tabs.articles,
            type: 'select',
            placeholder: t.containers.selectType,
            options: fabricTypes.map((type) => ({ value: String(type.id), label: type.name })),
          },
        ]}
        values={filters}
        onChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
        onReset={() => setFilters({})}
      />

      {stock && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label={t.stock.totalM2} value={stock.summary.total_m2.toLocaleString('fr-FR')} icon={Layers} accent="navy" />
          <StatCard label={t.stock.availableM2} value={stock.summary.available_m2.toLocaleString('fr-FR')} icon={Ruler} accent="mint" />
          <StatCard label={t.stock.soldM2} value={stock.summary.sold_m2.toLocaleString('fr-FR')} icon={Package} accent="teal" />
          <StatCard
            label={t.stock.returnedM2}
            value={(stock.summary.returned_m2 ?? 0).toLocaleString('fr-FR')}
            icon={Undo2}
            accent="gold"
          />
          {(stock.summary.total_kg ?? 0) > 0 && (
            <>
              <StatCard
                label={t.stock.totalKg}
                value={(stock.summary.total_kg ?? 0).toLocaleString('fr-FR')}
                icon={Layers}
                accent="navy"
              />
              <StatCard
                label={t.stock.availableKg}
                value={(stock.summary.available_kg ?? 0).toLocaleString('fr-FR')}
                icon={Ruler}
                accent="mint"
              />
              <StatCard
                label={t.stock.soldKg}
                value={(stock.summary.sold_kg ?? 0).toLocaleString('fr-FR')}
                icon={Package}
                accent="teal"
              />
              <StatCard
                label={t.stock.returnedKg}
                value={(stock.summary.returned_kg ?? 0).toLocaleString('fr-FR')}
                icon={Undo2}
                accent="gold"
              />
            </>
          )}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ['summary', t.stock.summaryTab],
            ['rolls', t.stock.rollsTab],
            ['returns', t.stock.returnsTab],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`cursor-pointer rounded-xl px-4 py-2 text-sm font-medium ${
              tab === id ? 'bg-teal-500 text-white' : 'border border-border'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {returnMessage && (
        <div className="mb-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
          {returnMessage}
        </div>
      )}

      {tab === 'summary' && (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-border text-muted">
                <tr>
                  <th className="px-3 py-3">{t.settings.tabs.articles}</th>
                  <th className="px-3 py-3">{t.stock.unitCol}</th>
                  <th className="px-3 py-3">{t.stock.totalRolls}</th>
                  <th className="px-3 py-3">{t.stock.availableRollsCol}</th>
                  <th className="px-3 py-3">{t.containers.totalM2}</th>
                  <th className="px-3 py-3">{t.containers.availableM2}</th>
                  <th className="px-3 py-3">{t.containers.soldM2}</th>
                  <th className="px-3 py-3">{t.stock.returnedM2}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((line: StockLine) => (
                  <tr key={line.fabric_type_id} className="border-b border-border/70">
                    <td className="px-3 py-3 font-medium">{line.fabric_type?.name}</td>
                    <td className="px-3 py-3">{unitLabel(line.unit ?? line.fabric_type?.unit, loc)}</td>
                    <td className="px-3 py-3">{line.total_rolls}</td>
                    <td className="px-3 py-3 font-semibold text-teal-600">{line.available_rolls}</td>
                    <td className="px-3 py-3">{line.quantity_m2.toLocaleString('fr-FR')}</td>
                    <td className="px-3 py-3 font-semibold text-teal-600">{line.available_m2.toLocaleString('fr-FR')}</td>
                    <td className="px-3 py-3">{line.sold_m2.toLocaleString('fr-FR')}</td>
                    <td className="px-3 py-3">{(line.returned_m2 ?? 0).toLocaleString('fr-FR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'rolls' && (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-border text-muted">
                <tr>
                  <th className="px-3 py-3">{t.stock.rollNo}</th>
                  <th className="px-3 py-3">{t.settings.tabs.articles}</th>
                  <th className="px-3 py-3">{t.stock.unitCol}</th>
                  <th className="px-3 py-3">{t.containers.quantityM2}</th>
                  <th className="px-3 py-3">{t.fabricTypes.width}</th>
                  <th className="px-3 py-3">{t.stock.lengthM}</th>
                  <th className="px-3 py-3">{t.stock.rollStatus}</th>
                  <th className="px-3 py-3">{t.sales.client}</th>
                </tr>
              </thead>
              <tbody>
                {rolls.map((roll) => (
                  <tr key={roll.id} className="border-b border-border/70">
                    <td className="px-3 py-3 font-medium">{roll.roll_number}</td>
                    <td className="px-3 py-3">{roll.fabric_type?.name}</td>
                    <td className="px-3 py-3">{unitLabel(roll.fabric_type?.unit, loc)}</td>
                    <td className="px-3 py-3">{Number(roll.quantity_m2).toLocaleString('fr-FR')}</td>
                    <td className="px-3 py-3">{roll.width_cm} cm</td>
                    <td className="px-3 py-3">{roll.length_m} m</td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          roll.status === 'available' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {roll.status === 'available' ? t.stock.available : t.stock.sold}
                      </span>
                    </td>
                    <td className="px-3 py-3">{roll.sale?.client?.name ?? t.common.dash}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'returns' && (
        <div>
          <p className="mb-4 text-sm text-muted">{t.stock.returnsHint}</p>

          {showReturnForm && (
            <Card className="mb-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-navy-900">{t.stock.newReturn}</h2>
                <button
                  type="button"
                  onClick={() => setShowReturnForm(false)}
                  className="cursor-pointer text-sm text-muted hover:underline"
                >
                  {t.common.cancel}
                </button>
              </div>
              <form onSubmit={handleReturnSubmit} className="grid gap-4 md:grid-cols-2">
                <select
                  value={returnForm.client_id}
                  onChange={(e) =>
                    setReturnForm({
                      ...emptyReturnForm(),
                      client_id: e.target.value,
                      returned_at: returnForm.returned_at,
                      reason: returnForm.reason,
                      notes: returnForm.notes,
                    })
                  }
                  className="rounded-xl border border-border px-4 py-3 md:col-span-2"
                  required
                >
                  <option value="">{t.stock.selectClient}</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>

                <select
                  value={returnForm.sale_id}
                  onChange={(e) =>
                    setReturnForm({
                      ...returnForm,
                      sale_id: e.target.value,
                      fabric_type_id: '',
                      quantity_m2: '',
                      roll_count: '1',
                    })
                  }
                  className="rounded-xl border border-border px-4 py-3 md:col-span-2"
                  required
                  disabled={!returnForm.client_id}
                >
                  <option value="">{t.stock.selectSale}</option>
                  {sales.map((sale) => (
                    <option key={sale.id} value={sale.id}>
                      {sale.reference} — {Number(sale.total_amount).toLocaleString('fr-FR')} MAD —{' '}
                      {sale.sale_date}
                    </option>
                  ))}
                </select>

                {returnableLines.length > 0 && (
                  <div className="md:col-span-2 rounded-xl border border-teal-200 bg-teal-50/60 px-4 py-3">
                    <p className="mb-3 text-sm text-teal-900">{t.stock.returnFullSaleHint}</p>
                    <button
                      type="button"
                      onClick={handleFullSaleReturn}
                      disabled={savingReturn}
                      className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      <Undo2 size={16} />
                      {savingReturn ? t.common.saving : t.stock.returnFullSale}
                    </button>
                  </div>
                )}

                <select
                  value={returnForm.fabric_type_id}
                  onChange={(e) => {
                    const line = returnableLines.find((l) => String(l.fabric_type_id) === e.target.value)
                    setReturnForm({
                      ...returnForm,
                      fabric_type_id: e.target.value,
                      quantity_m2: line ? String(line.quantity_m2) : '',
                      roll_count: line ? String(line.roll_count) : '1',
                    })
                  }}
                  className="rounded-xl border border-border px-4 py-3 md:col-span-2"
                  required
                  disabled={!returnForm.sale_id}
                >
                  <option value="">{t.containers.selectType}</option>
                  {returnableLines.map((line) => (
                    <option key={line.fabric_type_id} value={line.fabric_type_id}>
                      {line.fabric_type_name} — {line.quantity_m2.toLocaleString('fr-FR')}{' '}
                      {unitLabel(line.unit, loc)} / {line.roll_count} {t.stock.rollsShort}
                    </option>
                  ))}
                </select>

                {selectedReturnable && (
                  <p className="text-sm text-muted md:col-span-2">
                    {t.stock.returnableMax}: {selectedReturnable.quantity_m2.toLocaleString('fr-FR')}{' '}
                    {unitLabel(selectedReturnable.unit, loc)} · {selectedReturnable.roll_count}{' '}
                    {t.stock.rollsShort}
                  </p>
                )}

                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedReturnable?.quantity_m2}
                  placeholder={
                    selectedReturnable
                      ? `${t.containers.quantityM2} (${unitLabel(selectedReturnable.unit, loc)})`
                      : t.containers.quantityM2
                  }
                  value={returnForm.quantity_m2}
                  onChange={(e) => setReturnForm({ ...returnForm, quantity_m2: e.target.value })}
                  className="rounded-xl border border-border px-4 py-3"
                  required
                  disabled={!selectedReturnable}
                />
                <input
                  type="number"
                  min="1"
                  max={selectedReturnable?.roll_count}
                  placeholder={t.stock.rollCount}
                  value={returnForm.roll_count}
                  onChange={(e) => setReturnForm({ ...returnForm, roll_count: e.target.value })}
                  className="rounded-xl border border-border px-4 py-3"
                  required
                  disabled={!selectedReturnable}
                />
                <input
                  type="date"
                  value={returnForm.returned_at}
                  onChange={(e) => setReturnForm({ ...returnForm, returned_at: e.target.value })}
                  className="rounded-xl border border-border px-4 py-3 md:col-span-2"
                  required
                />
                <input
                  placeholder={t.stock.reasonPlaceholder}
                  value={returnForm.reason}
                  onChange={(e) => setReturnForm({ ...returnForm, reason: e.target.value })}
                  className="rounded-xl border border-border px-4 py-3 md:col-span-2"
                />
                <textarea
                  placeholder={t.common.notes}
                  value={returnForm.notes}
                  onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })}
                  className="rounded-xl border border-border px-4 py-3 md:col-span-2"
                  rows={2}
                />
                {returnError && <p className="text-sm text-red-600 md:col-span-2">{returnError}</p>}
                <button
                  type="submit"
                  disabled={savingReturn || !selectedReturnable}
                  className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-navy-900 px-4 py-3 font-semibold text-white disabled:opacity-60 md:col-span-2"
                >
                  <Plus size={16} />
                  {savingReturn ? t.common.saving : t.stock.saveReturn}
                </button>
              </form>
            </Card>
          )}

          {!showReturnForm && (
            <div className="mb-4">
              <button
                type="button"
                onClick={openReturnForm}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium"
              >
                <Plus size={16} />
                {t.stock.newReturn}
              </button>
            </div>
          )}

          {returnError && !showReturnForm && (
            <p className="mb-4 text-sm text-red-600">{returnError}</p>
          )}

          <Card>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-border text-muted">
                  <tr>
                    <th className="px-3 py-3">{t.stock.returnDate}</th>
                    <th className="px-3 py-3">{t.settings.tabs.articles}</th>
                    <th className="px-3 py-3">m²</th>
                    <th className="px-3 py-3">{t.stock.rollCount}</th>
                    <th className="px-3 py-3">{t.sales.client}</th>
                    <th className="px-3 py-3">{t.common.reference}</th>
                    <th className="px-3 py-3">{t.stock.reason}</th>
                    <th className="px-3 py-3">{t.common.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {returns.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-muted">
                        {t.stock.noReturns}
                      </td>
                    </tr>
                  )}
                  {returns.map((row) => (
                    <tr key={row.id} className="border-b border-border/70">
                      <td className="px-3 py-3">{row.returned_at}</td>
                      <td className="px-3 py-3 font-medium">{row.fabric_type?.name}</td>
                      <td className="px-3 py-3 font-semibold text-teal-600">
                        {Number(row.quantity_m2).toLocaleString('fr-FR')}
                      </td>
                      <td className="px-3 py-3">{row.roll_count}</td>
                      <td className="px-3 py-3">{row.client?.name ?? t.common.dash}</td>
                      <td className="px-3 py-3">{row.sale?.reference ?? t.common.dash}</td>
                      <td className="px-3 py-3">{row.reason ?? t.common.dash}</td>
                      <td className="px-3 py-3">
                        {row.sale_id ? (
                          <span className="text-xs text-muted">{t.stock.returnLocked}</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleDeleteReturn(row)}
                            className="inline-flex cursor-pointer items-center gap-1 text-red-600 hover:underline"
                          >
                            <Trash2 size={14} />
                            {t.common.delete}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
