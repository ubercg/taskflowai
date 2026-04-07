/**
 * Fechas “solo día” desde la API (ISO / TIMESTAMPTZ).
 * `new Date(iso)` interpreta UTC y en zonas como América puede mostrar un día menos.
 * Aquí usamos el calendario YYYY-MM-DD del propio string y medianoche local.
 */

export function parseDateOnly(value) {
  if (value == null || value === '') return null;
  const s = String(value);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  return new Date(y, mo, d);
}

/** Valor para <input type="date" /> coherente con el día calendario guardado */
export function toDateInputValue(value) {
  const date = parseDateOnly(value);
  if (!date) return '';
  const y = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${month}-${day}`;
}

/** Ej. "7 abr" en español */
export function formatCalendarShortEs(value) {
  const date = parseDateOnly(value);
  if (!date || Number.isNaN(date.getTime())) return '';
  return date
    .toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
    .replace('.', '');
}

/** Fecha local corta para listados */
export function formatCalendarLocale(value, locale = 'es-ES', opts = {}) {
  const date = parseDateOnly(value);
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(locale, opts);
}
