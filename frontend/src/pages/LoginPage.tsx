import { FormEvent, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useBranding } from '../context/BrandingContext'
import { useI18n } from '../context/LocaleContext'
import LanguageSwitcher from '../components/ui/LanguageSwitcher'

export default function LoginPage() {
  const navigate = useNavigate()
  const { user, login, loading } = useAuth()
  const { branding } = useBranding()
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [logoHidden, setLogoHidden] = useState(false)

  if (!loading && user) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await login(email, password)
      navigate('/')
    } catch {
      setError(t.auth.invalidCredentials)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-navy-900 px-4 py-8">
      <div className="absolute end-4 top-4">
        <LanguageSwitcher variant="dark" />
      </div>
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white p-6 shadow-2xl sm:p-8">
        <div className="mb-8 text-center">
          {branding.logo_url && !logoHidden ? (
            <img
              src={branding.logo_url}
              alt={branding.app_name}
              className="mx-auto mb-4 h-20 w-20 object-contain"
              onError={() => setLogoHidden(true)}
            />
          ) : (
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-teal-50 text-2xl font-bold text-teal-600">
              {branding.app_name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <h1 className="text-2xl font-bold text-navy-900">{branding.app_name}</h1>
          <p className="mt-1 text-sm text-muted">{branding.tagline || t.app.tagline}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-navy-800">{t.auth.email}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-border px-4 py-3 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-navy-800">{t.auth.password}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-border px-4 py-3 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full cursor-pointer rounded-xl bg-teal-500 px-4 py-3 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
          >
            {submitting ? t.auth.signingIn : t.auth.signIn}
          </button>
        </form>
      </div>
    </div>
  )
}
