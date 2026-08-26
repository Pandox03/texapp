import { FormEvent, useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import api from '../../lib/api'
import { extractApiError } from '../../lib/errors'
import { useI18n } from '../../context/LocaleContext'
import type { Fournisseur } from '../../types'
import Card from '../ui/Card'

const emptyForm = {
  name: '',
  contact_person: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  country: 'Maroc',
  ice_number: '',
  cin: '',
  rc: '',
  notes: '',
}

export default function FournisseursPanel() {
  const { t } = useI18n()
  const [rows, setRows] = useState<Fournisseur[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')

  const hasCin = form.cin.trim().length > 0
  const hasRc = form.rc.trim().length > 0

  async function load() {
    const { data } = await api.get<Fournisseur[]>('/fournisseurs')
    setRows(data)
  }

  useEffect(() => {
    load()
  }, [])

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
    setError('')
  }

  function openEdit(row: Fournisseur) {
    setEditingId(row.id)
    setForm({
      name: row.name,
      contact_person: row.contact_person ?? '',
      phone: row.phone ?? '',
      email: row.email ?? '',
      address: row.address ?? '',
      city: row.city ?? '',
      country: row.country ?? 'Maroc',
      ice_number: row.ice_number ?? '',
      cin: row.cin ?? '',
      rc: row.rc ?? '',
      notes: row.notes ?? '',
    })
    setShowForm(true)
    setError('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!hasCin && !hasRc) {
      setError(t.clients.cinOrRcRequired)
      return
    }
    setError('')
    const payload = {
      name: form.name,
      contact_person: form.contact_person || null,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      city: form.city || null,
      country: form.country || null,
      ice_number: form.ice_number || null,
      cin: form.cin || null,
      rc: form.rc || null,
      notes: form.notes || null,
    }
    try {
      if (editingId) {
        await api.put(`/fournisseurs/${editingId}`, payload)
      } else {
        await api.post('/fournisseurs', payload)
      }
      setShowForm(false)
      setEditingId(null)
      setForm(emptyForm)
      load()
    } catch (err) {
      setError(extractApiError(err, t.fournisseurs.saveError))
    }
  }

  async function handleDelete(row: Fournisseur) {
    if (!window.confirm(t.fournisseurs.deleteConfirm.replace('{name}', row.name))) return
    await api.delete(`/fournisseurs/${row.id}`)
    load()
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{t.fournisseurs.description}</p>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-teal-500 px-4 py-2 text-sm font-semibold text-white"
        >
          <Plus size={16} />
          {t.fournisseurs.new}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {showForm && (
        <Card className="mb-6">
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <input
              placeholder={t.common.name}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded-xl border border-border px-4 py-3"
              required
            />
            <input
              placeholder={t.clients.contact}
              value={form.contact_person}
              onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
              className="rounded-xl border border-border px-4 py-3"
            />
            <input
              placeholder={t.common.phone}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="rounded-xl border border-border px-4 py-3"
            />
            <input
              placeholder={t.auth.email}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="rounded-xl border border-border px-4 py-3"
              type="email"
            />
            <input
              placeholder={`${t.clients.cin}${!hasRc ? ' *' : ''}`}
              value={form.cin}
              onChange={(e) => setForm({ ...form, cin: e.target.value })}
              className="rounded-xl border border-border px-4 py-3"
              required={!hasRc}
            />
            <input
              placeholder={`${t.clients.rc}${!hasCin ? ' *' : ''}`}
              value={form.rc}
              onChange={(e) => setForm({ ...form, rc: e.target.value })}
              className="rounded-xl border border-border px-4 py-3"
              required={!hasCin}
            />
            <input
              placeholder={t.clients.ice}
              value={form.ice_number}
              onChange={(e) => setForm({ ...form, ice_number: e.target.value })}
              className="rounded-xl border border-border px-4 py-3"
            />
            <input
              placeholder={t.common.city}
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="rounded-xl border border-border px-4 py-3"
            />
            <input
              placeholder={t.settings.country}
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
              className="rounded-xl border border-border px-4 py-3"
            />
            <input
              placeholder={t.common.address}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="rounded-xl border border-border px-4 py-3 md:col-span-2"
            />
            <textarea
              placeholder={t.common.notes}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="rounded-xl border border-border px-4 py-3 md:col-span-2"
              rows={3}
            />
            <p className="text-xs text-muted md:col-span-2">{t.clients.cinOrRcHint}</p>
            <div className="flex gap-2 md:col-span-2">
              <button type="submit" className="cursor-pointer rounded-xl bg-navy-900 px-4 py-3 font-semibold text-white">
                {editingId ? t.common.save : t.fournisseurs.save}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setEditingId(null)
                }}
                className="cursor-pointer rounded-xl border border-border px-4 py-3 font-medium"
              >
                {t.common.cancel}
              </button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border text-muted">
              <tr>
                <th className="px-3 py-3">{t.common.name}</th>
                <th className="px-3 py-3">{t.clients.contact}</th>
                <th className="px-3 py-3">{t.common.phone}</th>
                <th className="hidden px-3 py-3 md:table-cell">{t.clients.cin}</th>
                <th className="hidden px-3 py-3 lg:table-cell">{t.clients.rc}</th>
                <th className="px-3 py-3">{t.common.actions}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border/70">
                  <td className="px-3 py-3 font-medium">{row.name}</td>
                  <td className="px-3 py-3">{row.contact_person ?? t.common.dash}</td>
                  <td className="px-3 py-3">{row.phone ?? t.common.dash}</td>
                  <td className="hidden px-3 py-3 md:table-cell">{row.cin ?? t.common.dash}</td>
                  <td className="hidden px-3 py-3 lg:table-cell">{row.rc ?? t.common.dash}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        className="inline-flex cursor-pointer items-center gap-1 text-teal-600 hover:underline"
                      >
                        <Pencil size={14} />
                        {t.common.edit}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(row)}
                        className="inline-flex cursor-pointer items-center gap-1 text-red-600 hover:underline"
                      >
                        <Trash2 size={14} />
                        {t.common.delete}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted">
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
