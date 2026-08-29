'use client'

/**
 * Contador de "espectadores" en vivo — señal social de urgencia.
 * No refleja tráfico real: es un número entre 10 y 200 que hace un pequeño
 * "random walk" cada ~10s (más creíble que un salto totalmente aleatorio).
 * Se inicializa en `null` y solo se sortea en el cliente (useEffect) para
 * evitar mismatches de hidratación contra el render del servidor.
 */
import { useEffect, useState } from 'react'

const MIN_VIEWERS = 10
const MAX_VIEWERS = 200
const UPDATE_INTERVAL_MS = 10_000

function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function nextViewers(current: number): number {
  const step = randomInRange(-15, 15)
  return Math.min(MAX_VIEWERS, Math.max(MIN_VIEWERS, current + step))
}

export function LiveViewersCounter() {
  const [viewers, setViewers] = useState<number | null>(null)

  useEffect(() => {
    setViewers(randomInRange(MIN_VIEWERS, MAX_VIEWERS))
    const interval = setInterval(() => {
      setViewers((prev) => (prev === null ? randomInRange(MIN_VIEWERS, MAX_VIEWERS) : nextViewers(prev)))
    }, UPDATE_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  if (viewers === null) return null

  return (
    <p className="flex items-center gap-1.5 text-sm md:text-[14px] font-semibold text-[var(--c-warning)]">
      <span aria-hidden="true">🔥</span>
      {viewers} {viewers === 1 ? 'persona está viendo' : 'personas están viendo'} este producto
    </p>
  )
}
