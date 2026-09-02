'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, LabelList,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { ChartTooltip } from '@/components/admin/charts/ChartTooltip'
import { formatCOP, formatCOPCompact } from '@/lib/format'

interface DataPoint {
  label: string
  total: number
}

interface RevenueChartProps {
  data: DataPoint[]
}

function RevenueTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return <ChartTooltip label={label} value={formatCOP(payload[0].value)} seriesColor="var(--c-chart-1)" />
}

/**
 * Ingresos por bucket del rango.
 *
 * Barras y no área: cada bucket es una magnitud discreta que se compara con sus
 * vecinos. El área anterior dibujaba una pendiente entre días, sugiriendo una
 * continuidad que no existe — entre el martes y el miércoles no hay ingresos
 * intermedios que interpolar.
 */
export function RevenueChart({ data }: RevenueChartProps) {
  const peak = data.reduce((max, d) => Math.max(max, d.total), 0)

  return (
    <ResponsiveContainer width="100%" height={208}>
      <BarChart data={data} margin={{ top: 20, right: 4, left: -12, bottom: 0 }}>
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
          tickFormatter={formatCOPCompact}
          tick={{ fontSize: 10, fill: 'var(--c-chart-axis)', fontFamily: 'inherit' }}
          axisLine={false}
          tickLine={false}
          width={64}
        />
        <Tooltip
          content={<RevenueTooltip />}
          cursor={{ fill: 'var(--c-surface-hover)', fillOpacity: 0.4 }}
        />
        <Bar
          dataKey="total"
          fill="var(--c-chart-1)"
          /* Extremo de dato redondeado, base cuadrada sobre la línea de base. */
          radius={[4, 4, 0, 0]}
          /* Tope de grosor: el aire sobrante de cada banda es intencional. */
          maxBarSize={24}
          /* La barra bajo el cursor se aclara; el color no cambia de significado. */
          activeBar={{ style: { filter: 'brightness(1.3)' } }}
          isAnimationActive={false}
        >
          {/*
            Etiqueta directa solo en el máximo. Un número sobre cada barra es
            ruido que nadie lee — el eje y el tooltip cubren el resto, y el pico
            se distingue por su etiqueta, nunca por un color distinto.
          */}
          <LabelList
            dataKey="total"
            position="top"
            offset={8}
            content={(props) => {
              const { x, y, width, value } = props as { x: number; y: number; width: number; value: number }
              if (value !== peak || peak === 0) return null
              return (
                <text
                  x={x + width / 2}
                  y={y - 6}
                  textAnchor="middle"
                  fill="var(--c-text-2)"
                  fontSize={11}
                  fontWeight={600}
                >
                  {formatCOPCompact(value)}
                </text>
              )
            }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
