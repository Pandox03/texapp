import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Container } from '../types'
import {
  containerStatusLabel as statusLabel,
  locales,
  type LocaleCode,
  type Translations,
} from '../locales'
import * as formatLib from '../lib/format'

const STORAGE_KEY = 'texflow-locale'

interface LocaleContextValue {
  locale: LocaleCode
  setLocale: (code: LocaleCode) => void
  t: Translations
  dir: 'ltr' | 'rtl'
  isRtl: boolean
  containerStatusLabel: (status: Container['status']) => string
  formatDate: (value: string | null | undefined) => string
  formatDateShort: (value: string | null | undefined) => string
  formatDateTime: (value: string) => string
  formatNumber: (value: number) => string
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined)

function readStoredLocale(): LocaleCode {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'ar' ? 'ar' : 'fr'
  } catch {
    return 'fr'
  }
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(readStoredLocale)

  const setLocale = (code: LocaleCode) => {
    setLocaleState(code)
    try {
      localStorage.setItem(STORAGE_KEY, code)
    } catch {
      /* ignore */
    }
  }

  const dir = locale === 'ar' ? 'rtl' : 'ltr'
  const t = locales[locale]
  const numberLocale = locale === 'ar' ? 'ar-MA' : 'fr-FR'

  useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = dir
    document.title = t.app.title
  }, [locale, dir, t.app.title])

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t,
      dir,
      isRtl: dir === 'rtl',
      containerStatusLabel: (status) => statusLabel(status, t),
      formatDate: (v) => formatLib.formatDate(v, locale),
      formatDateShort: (v) => formatLib.formatDateShort(v, locale),
      formatDateTime: (v) => formatLib.formatDateTime(v, locale),
      formatNumber: (v) => v.toLocaleString(numberLocale),
    }),
    [locale, t, dir, numberLocale],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useI18n() {
  const ctx = useContext(LocaleContext)
  if (!ctx) {
    throw new Error('useI18n must be used within LocaleProvider')
  }
  return ctx
}
