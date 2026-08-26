export type QuantityUnit = 'm2' | 'kg'

export function normalizeUnit(unit?: string | null): QuantityUnit {
  return unit === 'kg' ? 'kg' : 'm2'
}

export function unitLabel(unit?: string | null, locale: 'fr' | 'ar' = 'fr'): string {
  if (normalizeUnit(unit) === 'kg') return 'kg'
  return locale === 'ar' ? 'م²' : 'm²'
}

export function pricePerUnitLabel(unit?: string | null, locale: 'fr' | 'ar' = 'fr'): string {
  return `MAD/${unitLabel(unit, locale)}`
}
