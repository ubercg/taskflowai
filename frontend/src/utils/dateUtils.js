/**
 * Fechas “solo día” desde la API (ISO / TIMESTAMPTZ).
 * `new Date(iso)` interpreta UTC y en zonas como América puede mostrar un día menos.
 * Aquí usamos el calendario YYYY-MM-DD del propio string y medianoche local.
 *
 * Nombres de mes/día siguen el locale activo de i18n (TSK-018 / RN-011).
 */
import { format } from 'date-fns'
import { es, enUS } from 'date-fns/locale'

import i18n from '../i18n'

const DATE_FNS_BY_LOCALE = {
  es,
  en: enUS,
}

const BCP47_BY_LOCALE = {
  es: 'es-ES',
  en: 'en-US',
}

export function getActiveLocaleCode() {
  const lng = (i18n.resolvedLanguage || i18n.language || 'es').split('-')[0]
  return lng in DATE_FNS_BY_LOCALE ? lng : 'es'
}

/** date-fns locale object for the active (or given) app locale. */
export function getDateFnsLocale(localeCode = getActiveLocaleCode()) {
  return DATE_FNS_BY_LOCALE[localeCode] || es
}

export function getBcp47Locale(localeCode = getActiveLocaleCode()) {
  return BCP47_BY_LOCALE[localeCode] || 'es-ES'
}

/** Format with date-fns using the active i18n locale (month/day names). */
export function formatLocalized(date, pattern, localeCode = getActiveLocaleCode()) {
  return format(date, pattern, { locale: getDateFnsLocale(localeCode) })
}

export function parseDateOnly(value) {
  if (value == null || value === '') return null
  const s = String(value)
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) {
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const d = Number(m[3])
  return new Date(y, mo, d)
}

/** Valor para <input type="date" /> coherente con el día calendario guardado */
export function toDateInputValue(value) {
  const date = parseDateOnly(value)
  if (!date) return ''
  const y = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${month}-${day}`
}

/** Ej. "7 abr" / "7 Apr" según locale activo */
export function formatCalendarShort(value) {
  const date = parseDateOnly(value)
  if (!date || Number.isNaN(date.getTime())) return ''
  return date
    .toLocaleDateString(getBcp47Locale(), { day: 'numeric', month: 'short' })
    .replace('.', '')
}

/** @deprecated use formatCalendarShort — kept for existing call sites */
export function formatCalendarShortEs(value) {
  return formatCalendarShort(value)
}

/** Fecha local corta para listados; defaults to the active i18n locale. */
export function formatCalendarLocale(value, localeOrOpts, maybeOpts) {
  const date = parseDateOnly(value)
  if (!date || Number.isNaN(date.getTime())) return ''

  // Back-compat: formatCalendarLocale(value, 'es-ES', opts) OR (value, opts)
  let bcp47 = getBcp47Locale()
  let opts = {}
  if (typeof localeOrOpts === 'string') {
    bcp47 = localeOrOpts
    opts = maybeOpts || {}
  } else if (localeOrOpts && typeof localeOrOpts === 'object') {
    opts = localeOrOpts
  }
  return date.toLocaleDateString(bcp47, opts)
}
