import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import { extractApiError } from '../../lib/errors'
import { useI18n } from '../../context/LocaleContext'
import type { Client } from '../../types'
import Card from '../ui/Card'

const emptyForm = {
  name: '',
  contact_person: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  category: '',
  ice_number: '',
  cin: '',
  rc: '',
  credit_limit: '',
  payment_terms_days: '30',
}

export default function ClientsAddPanel() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [createdId, setCreatedId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)

  const hasCin = form.cin.trim().length > 0
  const hasRc = form.rc.trim().length > 0

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!hasCin && !hasRc) {
      setError(t.clients.cinOrRcRequired)
      return
    }
    setSaving(true)
    setMessage('')
    setError('')
    setCreatedId(null)
    try {
      const { data } = await api.post<Client>('/clients', {
        ...form,
        ice_number: form.ice_number || null,
        cin: form.cin || null,
        rc: form.rc || null,
        credit_limit: form.credit_limit ? Number(form.credit_limit) : null,
        payment_terms_days: Number(form.payment_terms_days),
      })
      setForm(emptyForm)
      setMessage(t.clients.created)
      setCreatedId(data.id)
    } catch (err) {
      setError(extractApiError(err, t.clients.createError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <p className="mb-4 text-sm text-muted">{t.clients.addDescription}</p>

      {message && (
        <div className="mb-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
          {message}
          {createdId && (
            <button
              type="button"
              onClick={() => navigate(`/clients/${createdId}`)}
              className="ms-2 cursor-pointer font-semibold underline"
            >
              {t.common.view}
            </button>
          )}
          {' · '}
          <Link to="/clients" className="font-semibold underline">
            {t.nav.clients}
          </Link>
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-navy-900">{t.clients.new}</h2>
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-3">
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
            placeholder={t.common.category}
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="rounded-xl border border-border px-4 py-3"
          />
          <input
            placeholder={t.clients.creditLimit}
            type="number"
            value={form.credit_limit}
            onChange={(e) => setForm({ ...form, credit_limit: e.target.value })}
            className="rounded-xl border border-border px-4 py-3"
          />
          <input
            placeholder={t.clients.paymentTerms}
            type="number"
            value={form.payment_terms_days}
            onChange={(e) => setForm({ ...form, payment_terms_days: e.target.value })}
            className="rounded-xl border border-border px-4 py-3"
          />
          <input
            placeholder={t.common.address}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="rounded-xl border border-border px-4 py-3 md:col-span-3"
          />
          <p className="text-xs text-muted md:col-span-3">{t.clients.cinOrRcHint}</p>
          <button
            type="submit"
            disabled={saving}
            className="cursor-pointer rounded-xl bg-navy-900 px-4 py-3 font-semibold text-white disabled:opacity-60 md:col-span-3"
          >
            {saving ? t.common.saving : t.clients.save}
          </button>
        </form>
      </Card>
    </div>
  )
}
