import { FormEvent, useEffect, useRef, useState } from 'react'
import { Building2, ImagePlus, Save } from 'lucide-react'
import api from '../lib/api'
import { useBranding } from '../context/BrandingContext'
import { useI18n } from '../context/LocaleContext'
import Card from '../components/ui/Card'
import PageHeader from '../components/ui/PageHeader'

interface CompanySettings {
  app_name: string
  tagline: string
  legal_name: string
  legal_form: string
  ice: string | null
  rc: string | null
  rc_city: string | null
  address: string | null
  city: string | null
  country: string
  activity: string | null
  capital: string | null
  phone: string | null
  email: string | null
  if_number: string | null
  tp_number: string | null
  cnss: string | null
  currency: string
  tax_rate: number
  default_payment_terms_days: number
  logo_url: string | null
}

const emptyForm: CompanySettings = {
  app_name: '',
  tagline: '',
  legal_name: '',
  legal_form: 'SARL',
  ice: '',
  rc: '',
  rc_city: '',
  address: '',
  city: '',
  country: 'Maroc',
  activity: '',
  capital: '',
  phone: '',
  email: '',
  if_number: '',
  tp_number: '',
  cnss: '',
  currency: 'MAD',
  tax_rate: 20,
  default_payment_terms_days: 30,
  logo_url: null,
}

export default function SettingsPage() {
  const { t } = useI18n()
  const { refresh: refreshBranding } = useBranding()
  const [form, setForm] = useState<CompanySettings>(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get<CompanySettings>('/settings/company')
      setForm({ ...emptyForm, ...data })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function updateField<K extends keyof CompanySettings>(key: K, value: CompanySettings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const { data } = await api.put<CompanySettings>('/settings/company', {
        ...form,
        ice: form.ice || null,
        rc: form.rc || null,
        rc_city: form.rc_city || null,
        address: form.address || null,
        city: form.city || null,
        activity: form.activity || null,
        capital: form.capital || null,
        phone: form.phone || null,
        email: form.email || null,
        if_number: form.if_number || null,
        tp_number: form.tp_number || null,
        cnss: form.cnss || null,
      })
      setForm({ ...emptyForm, ...data })
      await refreshBranding()
      setMessage(t.settings.saved)
    } catch {
      setError(t.settings.error)
    } finally {
      setSaving(false)
    }
  }

  async function handleLogoChange(file: File) {
    setUploading(true)
    setError('')
    try {
      const body = new FormData()
      body.append('logo', file)
      const { data } = await api.post<{ logo_url: string }>('/settings/company/logo', body)
      setForm((prev) => ({ ...prev, logo_url: data.logo_url }))
      await refreshBranding()
      setMessage(t.settings.logoSaved)
    } catch {
      setError(t.settings.logoError)
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-teal-500 border-t-transparent" />
      </div>
    )
  }

  const inputClass =
    'w-full rounded-xl border border-border bg-white px-4 py-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20'

  return (
    <div>
      <PageHeader
        title={t.settings.title}
        description={t.settings.description}
      />

      {message && (
        <div className="mb-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <div className="mb-4 flex items-center gap-2 text-navy-900">
            <ImagePlus size={20} />
            <h2 className="text-lg font-semibold">{t.settings.branding}</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface">
                {form.logo_url ? (
                  <img src={form.logo_url} alt="" className="h-full w-full object-contain p-2" />
                ) : (
                  <Building2 className="text-muted" size={32} />
                )}
              </div>
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleLogoChange(file)
                  }}
                />
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                  className="cursor-pointer rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-surface disabled:opacity-60"
                >
                  {uploading ? t.settings.uploading : t.settings.uploadLogo}
                </button>
                <p className="mt-1 text-xs text-muted">{t.settings.logoHint}</p>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t.settings.appName}</label>
              <input
                value={form.app_name}
                onChange={(e) => updateField('app_name', e.target.value)}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t.settings.tagline}</label>
              <input
                value={form.tagline}
                onChange={(e) => updateField('tagline', e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center gap-2 text-navy-900">
            <Building2 size={20} />
            <h2 className="text-lg font-semibold">{t.settings.legal}</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">{t.settings.legalName}</label>
              <input value={form.legal_name} onChange={(e) => updateField('legal_name', e.target.value)} className={inputClass} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t.settings.legalForm}</label>
              <input value={form.legal_form} onChange={(e) => updateField('legal_form', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t.clients.ice}</label>
              <input value={form.ice ?? ''} onChange={(e) => updateField('ice', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">RC</label>
              <input value={form.rc ?? ''} onChange={(e) => updateField('rc', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t.settings.rcCity}</label>
              <input value={form.rc_city ?? ''} onChange={(e) => updateField('rc_city', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t.common.phone}</label>
              <input value={form.phone ?? ''} onChange={(e) => updateField('phone', e.target.value)} className={inputClass} />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">{t.common.address}</label>
              <input value={form.address ?? ''} onChange={(e) => updateField('address', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t.common.city}</label>
              <input value={form.city ?? ''} onChange={(e) => updateField('city', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t.settings.country}</label>
              <input value={form.country} onChange={(e) => updateField('country', e.target.value)} className={inputClass} />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">{t.settings.activity}</label>
              <input value={form.activity ?? ''} onChange={(e) => updateField('activity', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t.auth.email}</label>
              <input type="email" value={form.email ?? ''} onChange={(e) => updateField('email', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t.settings.capital}</label>
              <input value={form.capital ?? ''} onChange={(e) => updateField('capital', e.target.value)} className={inputClass} />
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold text-navy-900">{t.settings.financial}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">{t.settings.currency}</label>
              <input value={form.currency} onChange={(e) => updateField('currency', e.target.value.toUpperCase())} className={inputClass} maxLength={8} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t.settings.taxRate}</label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={form.tax_rate}
                onChange={(e) => updateField('tax_rate', Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t.clients.paymentTerms}</label>
              <input
                type="number"
                min={0}
                max={365}
                value={form.default_payment_terms_days}
                onChange={(e) => updateField('default_payment_terms_days', Number(e.target.value))}
                className={inputClass}
              />
            </div>
          </div>
        </Card>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-teal-500 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-60"
          >
            <Save size={16} />
            {saving ? t.common.saving : t.settings.save}
          </button>
        </div>
      </form>
    </div>
  )
}
