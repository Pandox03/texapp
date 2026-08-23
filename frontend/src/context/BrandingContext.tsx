import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import api from '../lib/api'

export interface Branding {
  app_name: string
  tagline: string
  legal_name: string
  currency: string
  tax_rate?: number
  logo_url: string | null
}

const FALLBACK: Branding = {
  app_name: 'TexFlow',
  tagline: 'Import textile & gestion de stock',
  legal_name: 'TexFlow',
  currency: 'MAD',
  tax_rate: 20,
  logo_url: '/logo.png',
}

interface BrandingContextValue {
  branding: Branding
  loading: boolean
  refresh: () => Promise<void>
}

const BrandingContext = createContext<BrandingContextValue | undefined>(undefined)

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<Branding>(FALLBACK)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get<Branding>('/settings/branding')
      setBranding({ ...FALLBACK, ...data })
      document.title = `${data.app_name} — ${data.tagline}`
    } catch {
      document.title = `${FALLBACK.app_name} — ${FALLBACK.tagline}`
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const value = useMemo(
    () => ({ branding, loading, refresh }),
    [branding, loading, refresh],
  )

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>
}

export function useBranding() {
  const ctx = useContext(BrandingContext)
  if (!ctx) throw new Error('useBranding must be used within BrandingProvider')
  return ctx
}
