import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Calculator, Trash2 } from 'lucide-react'
import api from '../lib/api'
import { extractApiError } from '../lib/errors'
import { useI18n } from '../context/LocaleContext'
import type { Client, FabricType, PricingBasis } from '../types'
import Card from '../components/ui/Card'
import FormField from '../components/ui/FormField'
import PageHeader from '../components/ui/PageHeader'

interface SaleLine {
  fabric_type_id: string
  roll_count: string
  quantity_m2: string
  unit_price: string
  margin_pct: string
  m2Manual: boolean
}

interface StockAvailability {
  found: boolean
  fabric_type_id?: number
  fabric_type_name?: string
  available_m2: number
  total_m2: number
  sold_m2: number
  total_rolls: number
  sold_rolls: number
  available_rolls: number
  avg_m2_per_roll: number
}

const emptyLine = (): SaleLine => ({
  fabric_type_id: '',
  roll_count: '1',
  quantity_m2: '',
  unit_price: '',
  margin_pct: '25',
  m2Manual: false,
})

function suggestedM2(rollCount: string, stock?: StockAvailability): string {
  const rolls = Number(rollCount)
  if (!stock || !Number.isFinite(rolls) || rolls <= 0) return ''
  return String(Math.round(rolls * stock.avg_m2_per_roll * 100) / 100)
}

function sellFromCost(landed: number, marginPct: number): number {
  return Math.round(landed * (1 + marginPct / 100) * 100) / 100
}

export default function NewSalePage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [clients, setClients] = useState<Client[]>([])
  const [clientSearch, setClientSearch] = useState('')
  const [fabricTypes, setFabricTypes] = useState<FabricType[]>([])
  const [sale, setSale] = useState({
    client_id: '',
    sale_date: new Date().toISOString().slice(0, 10),
    notes: '',
  })
  const [lines, setLines] = useState<SaleLine[]>([emptyLine()])
  const [stockByType, setStockByType] = useState<Record<string, StockAvailability>>({})
  const [pricingByType, setPricingByType] = useState<Record<string, PricingBasis>>({})
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    api
      .get<{ clients: Client[]; fabric_types: FabricType[] }>('/sales/form-options', {
        signal: controller.signal,
      })
      .then((res) => {
        setClients(res.data.clients)
        setFabricTypes(res.data.fabric_types)
      })
      .catch((err: { code?: string }) => {
        if (controller.signal.aborted || err?.code === 'ERR_CANCELED') return
        setError(t.newSale.loadError)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingOptions(false)
      })

    return () => controller.abort()
  }, [t.newSale.loadError])

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase()
    if (!q) return clients
    return clients.filter((c) => c.name.toLowerCase().includes(q))
  }, [clients, clientSearch])

  const fabricTypeIds = useMemo(() => {
    const ids = new Set<string>()
    for (const line of lines) {
      if (line.fabric_type_id) ids.add(line.fabric_type_id)
    }
    return [...ids]
  }, [lines])

  const loadStock = useCallback(async () => {
    if (fabricTypeIds.length === 0) {
      setStockByType({})
      setPricingByType({})
      return
    }

    const [stockEntries, pricingEntries] = await Promise.all([
      Promise.all(
        fabricTypeIds.map(async (fabricTypeId) => {
          const { data } = await api.get<StockAvailability>('/sales/stock-availability', {
            params: { fabric_type_id: fabricTypeId },
          })
          return [fabricTypeId, data] as const
        }),
      ),
      Promise.all(
        fabricTypeIds.map(async (fabricTypeId) => {
          const { data } = await api.get<PricingBasis>('/sales/pricing-basis', {
            params: { fabric_type_id: fabricTypeId },
          })
          return [fabricTypeId, data] as const
        }),
      ),
    ])

    setStockByType(Object.fromEntries(stockEntries))
    setPricingByType(Object.fromEntries(pricingEntries))
  }, [fabricTypeIds])

  useEffect(() => {
    loadStock()
  }, [loadStock])

  useEffect(() => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.m2Manual || !line.fabric_type_id) return line
        const stock = stockByType[line.fabric_type_id]
        if (!stock) return line
        const nextM2 = suggestedM2(line.roll_count, stock)
        if (nextM2 === line.quantity_m2) return line
        return { ...line, quantity_m2: nextM2 }
      }),
    )
  }, [stockByType])

  const requestedByType = useMemo(() => {
    const totals: Record<string, { rolls: number; m2: number }> = {}
    for (const line of lines) {
      if (!line.fabric_type_id) continue
      const rolls = Number(line.roll_count)
      const m2 = Number(line.quantity_m2)
      if (!Number.isFinite(rolls) || rolls <= 0) continue
      if (!totals[line.fabric_type_id]) totals[line.fabric_type_id] = { rolls: 0, m2: 0 }
      totals[line.fabric_type_id].rolls += rolls
      if (Number.isFinite(m2) && m2 > 0) totals[line.fabric_type_id].m2 += m2
    }
    return totals
  }, [lines])

  const grandTotal = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const m2 = Number(line.quantity_m2) || 0
        const price = Number(line.unit_price) || 0
        return sum + m2 * price
      }, 0),
    [lines],
  )

  function updateLine(index: number, field: keyof SaleLine, value: string | boolean) {
    setLines((prev) =>
      prev.map((line, i) => {
        if (i !== index) return line
        const updated: SaleLine = { ...line, [field]: value } as SaleLine
        if (field === 'quantity_m2') updated.m2Manual = true
        if (field === 'fabric_type_id') {
          updated.m2Manual = false
          const stock = stockByType[String(value)]
          updated.quantity_m2 = suggestedM2(updated.roll_count, stock)
          const fabric = fabricTypes.find((type) => String(type.id) === String(value))
          if (fabric?.target_margin_pct != null) {
            updated.margin_pct = String(fabric.target_margin_pct)
          }
        }
        if (field === 'roll_count' && !line.m2Manual) {
          const stock = stockByType[updated.fabric_type_id]
          updated.quantity_m2 = suggestedM2(String(value), stock)
        }
        return updated
      }),
    )
  }

  function useMaxStock(index: number) {
    const line = lines[index]
    const stock = line.fabric_type_id ? stockByType[line.fabric_type_id] : undefined
    if (!stock?.found) return
    setLines((prev) =>
      prev.map((l, i) =>
        i === index
          ? {
              ...l,
              roll_count: String(stock.available_rolls),
              quantity_m2: String(stock.available_m2),
              m2Manual: true,
            }
          : l,
      ),
    )
  }

  function applyCostMarginPrice(index: number) {
    const line = lines[index]
    const pricing = line.fabric_type_id ? pricingByType[line.fabric_type_id] : undefined
    if (!pricing?.landed_cost_m2_mad) return
    const margin = Number(line.margin_pct)
    if (!Number.isFinite(margin) || margin < 0) return
    const price = sellFromCost(pricing.landed_cost_m2_mad, margin)
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, unit_price: String(price) } : l)))
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))
  }

  function fabricLabel(fabricTypeId: string, stock?: StockAvailability): string {
    if (stock?.fabric_type_name) return stock.fabric_type_name
    return fabricTypes.find((type) => String(type.id) === fabricTypeId)?.name ?? t.newSale.fabricType
  }

  const stockWarnings = Object.entries(requestedByType).flatMap(([fabricTypeId, requested]) => {
    const stock = stockByType[fabricTypeId]
    if (!stock) return []
    const fabric = fabricLabel(fabricTypeId, stock)
    const messages: string[] = []
    if (!stock.found) {
      messages.push(t.newSale.stockNotFound.replace('{fabric}', fabric))
      return messages
    }
    if (requested.rolls > stock.available_rolls) {
      messages.push(
        t.newSale.stockExceededRolls
          .replace('{fabric}', fabric)
          .replace('{available}', String(stock.available_rolls))
          .replace('{requested}', String(requested.rolls)),
      )
    }
    if (requested.m2 > stock.available_m2 + 0.01) {
      messages.push(
        t.newSale.stockExceededM2
          .replace('{fabric}', fabric)
          .replace('{available}', stock.available_m2.toLocaleString('fr-FR'))
          .replace('{requested}', requested.m2.toLocaleString('fr-FR')),
      )
    }
    return messages
  })

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const { data } = await api.post<{ id: number; client_id: number }>('/sales', {
        client_id: Number(sale.client_id),
        sale_date: sale.sale_date,
        notes: sale.notes || null,
        lines: lines.map((line) => ({
          fabric_type_id: Number(line.fabric_type_id),
          roll_count: Number(line.roll_count),
          quantity_m2: Number(line.quantity_m2),
          unit_price: Number(line.unit_price),
        })),
      })
      navigate(`/invoices/generer?sale_id=${data.id}`)
    } catch (err: unknown) {
      setError(extractApiError(err, t.newSale.error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="pb-28">
      <PageHeader title={t.newSale.title} description={t.newSale.description} />

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">{t.newSale.saleInfo}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              type="date"
              label={t.common.date}
              value={sale.sale_date}
              onChange={(e) => setSale({ ...sale, sale_date: e.target.value })}
              required
            />
            <div className="md:col-span-2 grid gap-2">
              <FormField
                type="search"
                label={t.sales.client}
                placeholder={t.newSale.clientSearch}
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
              />
              <FormField
                as="select"
                label={t.newSale.selectClient}
                value={sale.client_id}
                onChange={(e) => setSale({ ...sale, client_id: e.target.value })}
                required
                disabled={loadingOptions}
              >
                <option value="">{loadingOptions ? t.common.loading : t.newSale.selectClient}</option>
                {filteredClients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </FormField>
            </div>
            <FormField
              as="textarea"
              label={t.common.notes}
              value={sale.notes}
              onChange={(e) => setSale({ ...sale, notes: e.target.value })}
              rows={2}
              wrapperClassName="md:col-span-2"
            />
            <p className="md:col-span-2 text-xs text-muted">{t.newSale.autoRefHint}</p>
          </div>
        </Card>

        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t.newSale.linesTitle}</h2>
          <p className="text-sm text-muted">{t.ai.costPlusMargin}</p>
        </div>

        {lines.map((line, index) => {
          const stock = line.fabric_type_id ? stockByType[line.fabric_type_id] : undefined
          const pricing = line.fabric_type_id ? pricingByType[line.fabric_type_id] : undefined
          const lineM2 = Number(line.quantity_m2) || 0
          const lineTotal = lineM2 > 0 && line.unit_price ? lineM2 * Number(line.unit_price) : 0
          const margin = Number(line.margin_pct)
          const calculatedSell =
            pricing?.landed_cost_m2_mad != null && Number.isFinite(margin) && margin >= 0
              ? sellFromCost(pricing.landed_cost_m2_mad, margin)
              : null

          return (
            <Card key={index}>
              <div className="mb-4 flex items-center justify-between gap-2">
                <h3 className="font-semibold text-navy-900">
                  {t.newSale.lineLabel} {index + 1}
                </h3>
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLine(index)}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={14} />
                    {t.newSale.removeLine}
                  </button>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  as="select"
                  label={t.newSale.fabricType}
                  value={line.fabric_type_id}
                  onChange={(e) => updateLine(index, 'fabric_type_id', e.target.value)}
                  required
                  wrapperClassName="md:col-span-2"
                >
                  <option value="">{t.newSale.fabricType}</option>
                  {fabricTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </FormField>

                <FormField
                  type="number"
                  min={1}
                  step={1}
                  label={t.newSale.rollCount}
                  value={line.roll_count}
                  onChange={(e) => updateLine(index, 'roll_count', e.target.value)}
                  required
                />
                <FormField
                  type="number"
                  min={0.01}
                  step="0.01"
                  label={t.newSale.quantityM2}
                  value={line.quantity_m2}
                  onChange={(e) => updateLine(index, 'quantity_m2', e.target.value)}
                  required
                />
                <FormField
                  type="number"
                  min={0}
                  step="0.01"
                  label={t.newSale.unitPrice}
                  value={line.unit_price}
                  onChange={(e) => updateLine(index, 'unit_price', e.target.value)}
                  required
                />
                <div className="flex flex-wrap items-end gap-2">
                  {stock?.found && (
                    <button
                      type="button"
                      onClick={() => useMaxStock(index)}
                      className="cursor-pointer rounded-xl border border-border px-3 py-3 text-sm font-medium hover:bg-surface"
                    >
                      {t.newSale.useMaxStock}
                    </button>
                  )}
                </div>
              </div>

              {line.fabric_type_id && (
                <div className="mt-4 rounded-xl border border-teal-200 bg-teal-50/40 px-4 py-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-navy-900">
                    <Calculator size={16} className="text-teal-700" />
                    {t.ai.costPlusMargin}
                  </div>
                  {pricing && !pricing.has_container_costs ? (
                    <p className="text-sm text-amber-800">
                      {t.ai.noContainerCosts}{' '}
                      <Link to="/containers" className="font-medium text-teal-700 underline">
                        {t.nav.containers}
                      </Link>
                    </p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <p className="text-xs text-muted">{t.ai.landedCostLabel}</p>
                        <p className="text-base font-semibold text-navy-900">
                          {pricing?.landed_cost_m2_mad != null
                            ? `${pricing.landed_cost_m2_mad.toLocaleString('fr-FR')} ${t.ai.perM2}`
                            : t.common.loading}
                        </p>
                      </div>
                      <FormField
                        type="number"
                        min={0}
                        step="0.1"
                        label={t.ai.marginLabel}
                        value={line.margin_pct}
                        onChange={(e) => updateLine(index, 'margin_pct', e.target.value)}
                      />
                      <div>
                        <p className="text-xs text-muted">{t.ai.sellPriceLabel}</p>
                        <p className="text-base font-bold text-teal-700">
                          {calculatedSell != null
                            ? `${calculatedSell.toLocaleString('fr-FR')} ${t.ai.perM2}`
                            : t.common.dash}
                        </p>
                        {calculatedSell != null && (
                          <button
                            type="button"
                            onClick={() => applyCostMarginPrice(index)}
                            className="mt-1 cursor-pointer text-sm font-medium text-teal-700 hover:underline"
                          >
                            {t.ai.applyCostMargin}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {line.fabric_type_id && stock && (
                <div className="mt-3 rounded-xl bg-surface px-4 py-2 text-sm">
                  <span className="font-medium">{fabricLabel(line.fabric_type_id, stock)}</span>
                  <span className={stock.found ? 'ms-2 text-teal-700' : 'ms-2 text-amber-700'}>
                    · {t.newSale.stockAvailable}:{' '}
                    {stock.found ? (
                      <>
                        <strong>{stock.available_rolls}</strong> {t.newSale.rollsUnit} ·{' '}
                        <strong>{stock.available_m2.toLocaleString('fr-FR')} m²</strong>
                      </>
                    ) : (
                      t.newSale.stockNotFound.replace('{fabric}', fabricLabel(line.fabric_type_id, stock))
                    )}
                  </span>
                  {lineTotal > 0 && (
                    <span className="ms-2 text-muted">
                      · {t.newSale.lineTotal}: <strong>{lineTotal.toLocaleString('fr-FR')} MAD</strong>
                    </span>
                  )}
                </div>
              )}
            </Card>
          )
        })}

        {stockWarnings.length > 0 && (
          <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 whitespace-pre-line">
            {stockWarnings.map((message, index) => (
              <p key={index}>{message}</p>
            ))}
          </div>
        )}

        {error && <p className="whitespace-pre-line text-sm text-red-600">{error}</p>}

        {/* Sticky bar only over main content (lg:start-64 = sidebar width), not the sidebar */}
        <div className="fixed bottom-0 start-0 end-0 z-30 border-t border-border bg-white/95 px-4 py-3 shadow-lg backdrop-blur sm:px-6 lg:start-64">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted">{t.newSale.grandTotal}</p>
              <p className="text-xl font-bold text-navy-900">{grandTotal.toLocaleString('fr-FR')} MAD</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setLines((prev) => [...prev, emptyLine()])}
                className="cursor-pointer rounded-xl border border-border px-4 py-2 text-sm font-medium"
              >
                {t.newSale.addLine}
              </button>
              <button
                type="submit"
                disabled={submitting || stockWarnings.length > 0 || !sale.client_id}
                className="cursor-pointer rounded-xl bg-teal-500 px-6 py-2 font-semibold text-white disabled:opacity-60"
              >
                {submitting ? t.newSale.saving : t.newSale.complete}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
