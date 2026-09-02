/**
 * Bucketing de series temporales del dashboard admin.
 *
 * Vive aparte porque lo consumen dos repositorios: `PrismaOrderRepository`
 * (ingresos) y `PrismaDashboardRepository` (pedidos, clientes nuevos). Si cada
 * uno agrupara por su cuenta, el gráfico de barras y el de tendencia acabarían
 * con etiquetas distintas para el mismo rango y dejarían de leerse juntos.
 *
 * La agrupación se hace en JS, no en SQL, para no depender de la zona horaria
 * del servidor de base de datos.
 */

/** Rango de las series del dashboard admin. */
export type RevenueRange = '2w' | '1m' | '3m' | 'all'

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

/** Días cubiertos por cada rango acotado. '3m' usa 91 para cerrar 13 semanas exactas. */
export const RANGE_DAYS: Record<Exclude<RevenueRange, 'all'>, number> = { '2w': 14, '1m': 30, '3m': 91 }

/** Granularidad por rango: diaria hasta un mes, semanal a tres meses, mensual en histórico. */
export type Granularity = 'day' | 'week' | 'month'

export function granularityOf(range: RevenueRange): Granularity {
  if (range === 'all') return 'month'
  return range === '3m' ? 'week' : 'day'
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/** Lunes de la semana que contiene `d`. */
function startOfWeek(d: Date): Date {
  const day = d.getDay() // 0 = domingo
  const monday = new Date(d)
  monday.setDate(d.getDate() + ((day === 0 ? -6 : 1) - day))
  monday.setHours(0, 0, 0, 0)
  return monday
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

/**
 * Plan de agrupación: la lista ordenada de buckets vacíos más la función que
 * asigna una fecha a su bucket. Los buckets sin datos se conservan en 0 para
 * que la serie no se corte donde no hubo ventas.
 */
export interface BucketPlan {
  /** Inicio de la ventana. `null` en 'all' cuando todavía no hay pedidos. */
  since: Date | null
  granularity: Granularity
  keys: string[]
  labelOf: Map<string, string>
  keyOf: (date: Date) => string
}

/**
 * Construye el plan de buckets de un rango.
 *
 * @param earliest fecha del primer pedido; solo se usa en 'all', donde marca
 *   dónde empieza la serie. Si es `null` en 'all', el plan sale vacío.
 */
export function buildBucketPlan(range: RevenueRange, earliest?: Date | null): BucketPlan {
  const now = new Date()

  if (range === 'all') {
    if (!earliest) {
      return { since: null, granularity: 'month', keys: [], labelOf: new Map(), keyOf: monthKey }
    }
    const keys: string[] = []
    const labelOf = new Map<string, string>()
    const last = startOfMonth(now)
    for (const d = startOfMonth(earliest); d <= last; d.setMonth(d.getMonth() + 1)) {
      const key = monthKey(d)
      keys.push(key)
      labelOf.set(key, `${MONTHS[d.getMonth()]} ${d.getFullYear()}`)
    }
    return { since: startOfMonth(earliest), granularity: 'month', keys, labelOf, keyOf: monthKey }
  }

  const todayStart = startOfDay(now)
  const since = new Date(todayStart)
  since.setDate(since.getDate() - (RANGE_DAYS[range] - 1))

  const keys: string[] = []
  const labelOf = new Map<string, string>()

  if (range === '3m') {
    const last = startOfWeek(todayStart)
    for (const d = startOfWeek(since); d <= last; d.setDate(d.getDate() + 7)) {
      const key = d.toDateString()
      keys.push(key)
      labelOf.set(key, `${d.getDate()} ${MONTHS[d.getMonth()]}`)
    }
    return { since, granularity: 'week', keys, labelOf, keyOf: (d) => startOfWeek(d).toDateString() }
  }

  for (let i = 0; i < RANGE_DAYS[range]; i++) {
    const d = new Date(since)
    d.setDate(since.getDate() + i)
    const key = d.toDateString()
    keys.push(key)
    labelOf.set(key, `${d.getDate()} ${MONTHS[d.getMonth()]}`)
  }
  return { since, granularity: 'day', keys, labelOf, keyOf: (d) => startOfDay(d).toDateString() }
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}`
}

/**
 * Vuelca filas sobre el plan y devuelve la serie completa, incluidos los
 * buckets en 0. Las filas fuera de la ventana se descartan en silencio.
 */
export function foldIntoBuckets<T>(
  plan: BucketPlan,
  rows: T[],
  dateOf: (row: T) => Date,
  valueOf: (row: T) => number,
): Array<{ label: string; total: number }> {
  const totals = new Map<string, number>()
  for (const key of plan.keys) totals.set(key, 0)

  for (const row of rows) {
    const key = plan.keyOf(dateOf(row))
    const current = totals.get(key)
    if (current !== undefined) totals.set(key, current + valueOf(row))
  }

  return plan.keys.map((key) => ({ label: plan.labelOf.get(key) ?? '', total: totals.get(key) ?? 0 }))
}

/**
 * Ventana del rango y la ventana inmediatamente anterior del mismo largo, para
 * calcular las variaciones de los KPIs.
 *
 * 'all' no tiene período anterior contra el cual comparar — devuelve `null` y
 * quien lo consuma debe omitir la variación en vez de inventar una.
 */
export function rangeWindow(range: RevenueRange): {
  since: Date | null
  prevSince: Date | null
  prevUntil: Date | null
} {
  if (range === 'all') return { since: null, prevSince: null, prevUntil: null }

  const since = startOfDay(new Date())
  since.setDate(since.getDate() - (RANGE_DAYS[range] - 1))

  const prevUntil = new Date(since)
  const prevSince = new Date(since)
  prevSince.setDate(prevSince.getDate() - RANGE_DAYS[range])

  return { since, prevSince, prevUntil }
}
