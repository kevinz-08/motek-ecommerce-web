'use client'

/**
 * Carrusel "center mode": la card centrada se muestra a tamaño completo y
 * opaca; las adyacentes se ven parcialmente, escaladas hacia abajo y con
 * opacidad reducida. Implementado con scroll-snap nativo (no transform manual)
 * para que el swipe táctil en mobile funcione gratis, sin recalcular anchos
 * a mano ni escuchar `resize`.
 *
 * Detección de la card activa: IntersectionObserver con varios `threshold`
 * (no solo isIntersecting) — se guarda el ratio de intersección de cada card
 * y se elige la de mayor ratio, así solo hay una "activa" a la vez incluso
 * mientras el usuario está scrolleando entre dos cards.
 */
import { useEffect, useRef, useState } from 'react'
import { Product } from '@motek/domain'
import { ProductCard } from '@/components/store/ProductCard'

interface CenterModeCarouselProps {
  products: Product[]
}

const CARD_WIDTH = 240
const GAP = 16
const THRESHOLDS = Array.from({ length: 21 }, (_, i) => i / 20) // 0, 0.05, ..., 1

export function CenterModeCarousel({ products }: CenterModeCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const ratiosRef = useRef<Record<string, number>>({})
  const [activeId, setActiveId] = useState<string | null>(products[0]?.id ?? null)

  useEffect(() => {
    const container = trackRef.current
    if (!container || products.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = (entry.target as HTMLElement).dataset.cardId
          if (id) ratiosRef.current[id] = entry.intersectionRatio
        })
        const best = Object.entries(ratiosRef.current).sort((a, b) => b[1] - a[1])[0]
        if (best && best[1] > 0) setActiveId(best[0])
      },
      { root: container, threshold: THRESHOLDS },
    )

    const cards = container.querySelectorAll('[data-card-id]')
    cards.forEach((card) => observer.observe(card))
    return () => observer.disconnect()
  }, [products])

  const scrollByCard = (direction: 1 | -1) => {
    trackRef.current?.scrollBy({ left: direction * (CARD_WIDTH + GAP), behavior: 'smooth' })
  }

  const centerCard = (el: HTMLElement) => {
    el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }

  if (products.length === 0) return null

  const spacerWidth = `calc(50% - ${CARD_WIDTH / 2}px)`

  return (
    <div className="relative">
      <div
        ref={trackRef}
        className="flex items-center overflow-x-auto snap-x snap-mandatory scroll-smooth scrollbar-hide"
        style={{ gap: GAP }}
      >
        {/* Spacers laterales — permiten que la primera y última card también lleguen al centro */}
        <div className="shrink-0" style={{ width: spacerWidth }} aria-hidden="true" />

        {products.map((product) => {
          const isActive = product.id === activeId
          return (
            <div
              key={product.id}
              data-card-id={product.id}
              className="snap-center shrink-0 transition-all duration-500 ease-out"
              style={{
                width: CARD_WIDTH,
                transform: isActive ? 'scale(1)' : 'scale(0.9)',
                opacity: isActive ? 1 : 0.55,
                zIndex: isActive ? 10 : 0,
              }}
              onClickCapture={(e) => {
                if (!isActive) {
                  e.preventDefault()
                  e.stopPropagation()
                  centerCard(e.currentTarget)
                }
              }}
            >
              <div className={isActive ? 'shadow-lg rounded-[var(--radius-lg)]' : ''}>
                <ProductCard product={product} />
              </div>
            </div>
          )
        })}

        <div className="shrink-0" style={{ width: spacerWidth }} aria-hidden="true" />
      </div>

      {products.length > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            type="button"
            onClick={() => scrollByCard(-1)}
            aria-label="Producto anterior"
            className="w-10 h-10 rounded-full border border-[var(--c-border)] text-[var(--c-text-2)] hover:border-[var(--c-accent)] hover:text-[var(--c-accent)] transition-colors flex items-center justify-center"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => scrollByCard(1)}
            aria-label="Siguiente producto"
            className="w-10 h-10 rounded-full border border-[var(--c-border)] text-[var(--c-text-2)] hover:border-[var(--c-accent)] hover:text-[var(--c-accent)] transition-colors flex items-center justify-center"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
