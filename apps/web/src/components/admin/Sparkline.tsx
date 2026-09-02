export interface SparklineProps {
  values: number[]
  width?: number
  height?: number
  /** Descripción para lectores de pantalla; sin ella el SVG queda oculto. */
  label?: string
}

/**
 * Micro-tendencia que acompaña a la cifra héroe.
 *
 * SVG plano en el servidor: son doce puntos sin ejes ni interacción, y montar
 * Recharts en el cliente para esto cargaría la librería en una tarjeta que no la
 * necesita.
 *
 * El trazo va en tono recesivo y solo el punto actual lleva el acento — el
 * sparkline apoya a la cifra, no compite con ella.
 */
export function Sparkline({ values, width = 120, height = 32, label }: SparklineProps) {
  if (values.length < 2) return null

  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  const inset = 4

  const points = values.map((value, i) => {
    const x = (i / (values.length - 1)) * (width - inset * 2) + inset
    const y = height - inset - ((value - min) / span) * (height - inset * 2)
    return [x, y] as const
  })

  const last = points[points.length - 1]

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role={label ? 'img' : 'presentation'}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className="overflow-visible"
    >
      <polyline
        points={points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
        fill="none"
        stroke="var(--c-text-4)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Anillo del color de la superficie: mantiene el punto legible sobre el trazo. */}
      <circle
        cx={last[0].toFixed(1)}
        cy={last[1].toFixed(1)}
        r={4}
        fill="var(--c-chart-1)"
        stroke="var(--c-surface)"
        strokeWidth={2}
      />
    </svg>
  )
}
