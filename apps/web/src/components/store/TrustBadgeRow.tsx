/**
 * Fila compacta de insignias de confianza (pago seguro / envío).
 * Se ubica inmediatamente debajo del precio, antes del CTA de compra.
 */
export function TrustBadgeRow() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs md:text-[12px] c-text-3">
      <div className="flex items-center gap-1.5">
        <svg className="w-4 h-4 md:w-[16px] md:h-[16px] shrink-0 text-[var(--c-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-12V7a4 4 0 10-8 0v4h8z" />
        </svg>
        <span>Pago seguro con Wompi</span>
      </div>
      <div className="flex items-center gap-1.5">
        <svg className="w-4 h-4 md:w-[16px] md:h-[16px] shrink-0 text-[var(--c-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zM5 17H3V7a1 1 0 011-1h9a1 1 0 011 1v10h-2m-8 0h8m0-10l4 4h-4v-4z" />
        </svg>
        <span>Envío a todo Colombia</span>
      </div>
    </div>
  )
}
