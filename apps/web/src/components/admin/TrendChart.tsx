'use client'

import { useId, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { ChartTooltip } from '@/components/admin/charts/ChartTooltip'
import { cn } from '@/lib/cn'

export interface TrendPoint {
  label: string
  total: number
}

export interface TrendChartProps {
  orders: TrendPoint[]
  customers: TrendPoint[]
}

type SeriesKey = 'orders' | 'customers'

const SERIES: Record<SeriesKey, { tab: string; unit: (n: number) => string }> = {
  orders: { tab: 'Pedidos', unit: (n) => (n === 1 ? '1 pedido' : `${n} pedidos`) },
  customers: { tab: 'Clientes nuevos', unit: (n) => (n === 1 ? '1 cliente' : `${n} clientes`) },
}

/**
 * Tendencia de volumen: pedidos confirmados o cuentas nuevas.
 *
 * Línea y no barras: aquí lo que importa es la dirección del cambio, no el
 * valor de cada bucket. Se muestra una serie a la vez, así que no lleva leyenda
 * — el subtítulo del módulo ya dice qué está trazado.
 *
 * No es un gráfico de visitas: no hay analítica de tráfico en la base de datos y
 * no se inventa una.
 */
export function TrendChart({ orders, customers }: TrendChartProps) {
  const [series, setSeries] = useState<SeriesKey>('orders')
  const gradientId = useId()
  const data = series === 'orders' ? orders : customers

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex items-center gap-1 self-end rounded-[var(--radius-md)] bg-[var(--c-surface-2)] p-[3px]"
        role="tablist"
        aria-label="Serie de la tendencia"
      >
        {(Object.keys(SERIES) as SeriesKey[]).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={series === key}
            onClick={() => setSeries(key)}
            className={cn(
              'rounded-[var(--radius-sm)] px-2.5 py-1 text-xs font-semibold transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--c-accent)]',
              series === key
                ? 'bg-[var(--c-surface)] text-[var(--c-text)]'
                : 'text-[var(--c-text-3)] hover:text-[var(--c-text)]',
            )}
          >
            {SERIES[key].tab}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={172}>
        <AreaChart data={data} margin={{ top: 8, right: 6, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--c-chart-2)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--c-chart-2)" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid vertical={false} stroke="var(--c-chart-grid)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: 'var(--c-chart-axis)', fontFamily: 'inherit' }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={20}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 10, fill: 'var(--c-chart-axis)', fontFamily: 'inherit' }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip
            /* El crosshair encuentra la X: el lector apunta a una fecha, no a un trazo de 2 px. */
            cursor={{ stroke: 'var(--c-text-4)', strokeWidth: 1 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              return (
                <ChartTooltip
                  label={label}
                  value={SERIES[series].unit(payload[0].value as number)}
                  seriesColor="var(--c-chart-2)"
                />
              )
            }}
          />
          <Area
            type="monotone"
            dataKey="total"
            stroke="var(--c-chart-2)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill={`url(#${gradientId})`}
            dot={false}
            /* El anillo del color de la superficie mantiene el punto legible donde cruza la línea. */
            activeDot={{ r: 4, fill: 'var(--c-chart-2)', stroke: 'var(--c-surface)', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
