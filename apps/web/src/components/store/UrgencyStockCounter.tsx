/**
 * Contador de urgencia — solo se muestra cuando el stock es lo bastante bajo
 * como para ser un disparador de compra creíble (no en todo el catálogo).
 */
interface Props {
  stock: number
  /** Umbral máximo de unidades para mostrar el mensaje. Default: 5. */
  threshold?: number
}

export function UrgencyStockCounter({ stock, threshold = 5 }: Props) {
  if (stock <= 0 || stock > threshold) return null

  return (
    <p className="flex items-center gap-1.5 text-sm md:text-[14px] font-semibold text-[var(--c-danger)]">
      <svg className="w-4 h-4 md:w-[16px] md:h-[16px] shrink-0 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
      {stock === 1 ? '¡Solo 1 unidad disponible!' : `¡Solo ${stock} unidades disponibles!`}
    </p>
  )
}
