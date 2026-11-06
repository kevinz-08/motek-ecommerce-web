/**
 * Estimado de entrega en días hábiles colombianos (lun–vie, sin festivos).
 *
 * Es solo informativo: la política de envíos promete despacho en 1–5 días hábiles
 * y Vendelo no devuelve ETA, así que los rangos son constantes de la tienda.
 * Todo se calcula con fechas "de calendario" (UTC al mediodía) para evitar
 * saltos por zona horaria; "hoy" se toma en America/Bogota.
 */

/** Rango (días hábiles desde hoy) en que el pedido sale de bodega. */
export const SHIPPED_BUSINESS_DAYS = { min: 1, max: 3 } as const
/** Rango (días hábiles desde hoy) en que el pedido llega al cliente. */
export const DELIVERED_BUSINESS_DAYS = { min: 4, max: 8 } as const

const DAY_MS = 86_400_000

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, 12))
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

function key(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Domingo de Pascua (algoritmo de Meeus/Jones/Butcher). */
function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return utcDate(year, month - 1, day)
}

/** Ley Emiliani: el festivo se traslada al lunes siguiente (si ya es lunes, se queda). */
function nextMonday(date: Date): Date {
  const dow = date.getUTCDay()
  return dow === 1 ? date : addDays(date, (8 - dow) % 7)
}

const holidayCache = new Map<number, Set<string>>()

function holidaysOf(year: number): Set<string> {
  const cached = holidayCache.get(year)
  if (cached) return cached

  const easter = easterSunday(year)
  const list: Date[] = [
    // Fijos
    utcDate(year, 0, 1), utcDate(year, 4, 1), utcDate(year, 6, 20),
    utcDate(year, 7, 7), utcDate(year, 11, 8), utcDate(year, 11, 25),
    // Trasladados al lunes
    nextMonday(utcDate(year, 0, 6)), nextMonday(utcDate(year, 2, 19)),
    nextMonday(utcDate(year, 5, 29)), nextMonday(utcDate(year, 7, 15)),
    nextMonday(utcDate(year, 9, 12)), nextMonday(utcDate(year, 10, 1)),
    nextMonday(utcDate(year, 10, 11)),
    // Semana Santa y festivos móviles ligados a la Pascua
    addDays(easter, -3), addDays(easter, -2),
    nextMonday(addDays(easter, 39)), nextMonday(addDays(easter, 60)),
    nextMonday(addDays(easter, 68)),
  ]
  const set = new Set(list.map(key))
  holidayCache.set(year, set)
  return set
}

function isBusinessDay(date: Date): boolean {
  const dow = date.getUTCDay()
  if (dow === 0 || dow === 6) return false
  return !holidaysOf(date.getUTCFullYear()).has(key(date))
}

/** Suma `n` días hábiles a `from` (ISO `YYYY-MM-DD`) y devuelve la fecha resultante. */
export function addBusinessDays(from: string, n: number): Date {
  const [y, m, d] = from.split('-').map(Number)
  let date = utcDate(y, m - 1, d)
  let remaining = n
  while (remaining > 0) {
    date = addDays(date, 1)
    if (isBusinessDay(date)) remaining--
  }
  return date
}

/** Fecha de hoy en Colombia como `YYYY-MM-DD`. */
export function bogotaToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(now)
}

/** "5 de noviembre" */
export function formatDayMonth(date: Date): string {
  return `${date.getUTCDate()} de ${MONTHS[date.getUTCMonth()]}`
}

export function formatRange(from: string, range: { min: number; max: number }): string {
  return `${formatDayMonth(addBusinessDays(from, range.min))} - ${formatDayMonth(addBusinessDays(from, range.max))}`
}
