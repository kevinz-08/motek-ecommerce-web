'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { cloudinaryUrl } from '@/lib/cloudinary'

type BannerItem = {
  id: string
  src: string
  /** Recurso optimizado para mobile (recorte/peso distinto). Si no viene, se usa `src` también en mobile. */
  srcMobile?: string
  /** Texto alternativo de la imagen (accesibilidad) — no se muestra visualmente. */
  alt: string
  /** Destino al hacer click en la imagen completa. Sin href = banner no clickeable. */
  href?: string
}

interface HeroBannerCarouselProps {
  banners: BannerItem[]
}

/**
 * Hero — solo imagen, sin título/descripción/botón superpuestos (decisión de
 * producto: el carrusel no debe competir visualmente con el contenido de la
 * imagen). Si el banner tiene `href`, la imagen completa es un link; si no,
 * es puramente decorativo.
 */
export function HeroBannerCarousel({ banners }: HeroBannerCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  const total = banners.length

  useEffect(() => {
    if (total <= 1 || isPaused) return
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % total)
    }, 5000)
    return () => clearInterval(timer)
  }, [total, isPaused])

  const goTo = useCallback((index: number) => {
    setActiveIndex(index)
  }, [])

  const goPrev = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + total) % total)
  }, [total])

  const goNext = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % total)
  }, [total])

  const canRender = useMemo(() => total > 0, [total])
  if (!canRender) return null

  return (
    <section
      className="relative h-[75vh] min-h-[470px] max-h-[700px] overflow-hidden bg-[var(--c-surface-2)]"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {banners.map((banner, index) => {
        // <picture> en vez de next/image: se necesitan DOS recursos distintos por
        // breakpoint (no solo una resolución distinta de la misma imagen), algo que
        // next/image no soporta de forma nativa. Cloudinary ya optimiza formato/peso
        // (f_auto,q_auto) en cloudinaryUrl(), así que la pérdida de next/image aquí
        // es solo el blur placeholder — aceptable para el hero, que es LCP priority.
        const picture = (
          <picture>
            {banner.srcMobile && (
              <source media="(max-width: 767px)" srcSet={cloudinaryUrl(banner.srcMobile, 'hero-mobile')} />
            )}
            <img
              src={cloudinaryUrl(banner.src, 'hero')}
              alt={banner.alt}
              className="absolute inset-0 w-full h-full object-cover"
              loading={index === 0 ? 'eager' : 'lazy'}
              fetchPriority={index === 0 ? 'high' : 'auto'}
            />
          </picture>
        )

        return (
          <div
            key={banner.id}
            className="absolute inset-0 transition-all duration-700"
            style={{
              opacity: index === activeIndex ? 1 : 0,
              transform: `scale(${index === activeIndex ? 1 : 1.05})`,
              transition: 'opacity 0.7s ease-out, transform 7s ease-out',
              pointerEvents: index === activeIndex ? 'auto' : 'none',
            }}
            aria-hidden={index !== activeIndex}
          >
            {banner.href ? (
              <Link href={banner.href} aria-label={banner.alt} className="absolute inset-0">
                {picture}
              </Link>
            ) : picture}
          </div>
        )
      })}

      <div className="absolute bottom-8 left-6 md:left-20 z-20 flex items-center gap-2">
        <button
          type="button"
          onClick={goPrev}
          aria-label="Banner anterior"
          className="w-10 h-10 rounded-full border border-white/30 bg-black/30 text-white/70 hover:bg-[var(--c-accent)] hover:border-[var(--c-accent)] hover:text-white transition-all duration-200 flex items-center justify-center backdrop-blur-sm"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          type="button"
          onClick={goNext}
          aria-label="Siguiente banner"
          className="w-10 h-10 rounded-full border border-white/30 bg-black/30 text-white/70 hover:bg-[var(--c-accent)] hover:border-[var(--c-accent)] hover:text-white transition-all duration-200 flex items-center justify-center backdrop-blur-sm"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="absolute bottom-8 right-6 md:right-20 z-20 flex items-center gap-2">
        {banners.map((banner, index) => (
          <button
            key={banner.id}
            type="button"
            onClick={() => goTo(index)}
            aria-label={`Ir al banner ${index + 1}`}
            className={`h-2 rounded-full transition-all duration-300 border border-black/10 ${
              index === activeIndex
                ? 'w-8 bg-[var(--c-accent)]'
                : 'w-2 bg-white/60 hover:bg-white/90'
            }`}
          />
        ))}
      </div>
    </section>
  )
}
