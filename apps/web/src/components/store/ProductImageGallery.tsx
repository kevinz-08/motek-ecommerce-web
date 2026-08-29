'use client'

/**
 * Galería de imágenes para la página de detalle de producto.
 *
 * Comportamiento:
 *   - Muestra hasta 4 imágenes del producto.
 *   - Miniaturas alineadas verticalmente a la izquierda de la imagen principal
 *     (mismo layout en desktop y mobile).
 *   - Desktop: zoom tipo "lens" al hacer hover sobre la imagen principal.
 *   - Mobile: tap sobre la imagen principal abre un lightbox a pantalla completa.
 *   - Si el producto no tiene imágenes muestra un placeholder SVG.
 *
 * Se usa en /producto/[slug]/page.tsx (Server Component) pasando
 * las URLs de imágenes como prop string[].
 */
import { useCallback, useState } from 'react'
import Image from 'next/image'
import { cloudinaryUrl, IMAGE_BLUR_PLACEHOLDER } from '@/lib/cloudinary'

interface Props {
  images: string[]
  productName: string
}

export function ProductImageGallery({ images, productName }: Props) {
  // Limitar a 4 imágenes máximo
  const imgs = images.slice(0, 4)
  const [current, setCurrent] = useState(0)
  // Key para forzar re-render y activar animate-fadeIn al cambiar de imagen
  const [fadeKey, setFadeKey] = useState(0)
  const [lensPosition, setLensPosition] = useState<{ x: number; y: number } | null>(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const goTo = useCallback((index: number) => {
    if (index === current) return
    setCurrent(index)
    setFadeKey((k) => k + 1)
    setLensPosition(null)
  }, [current])

  const prev = useCallback(() => {
    goTo((current - 1 + imgs.length) % imgs.length)
  }, [current, imgs.length, goTo])

  const next = useCallback(() => {
    goTo((current + 1) % imgs.length)
  }, [current, imgs.length, goTo])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setLensPosition({ x, y })
  }, [])

  // ── Sin imágenes ──────────────────────────────────────────────────────────
  if (imgs.length === 0) {
    return (
      <div className="aspect-square bg-[var(--c-surface-2)] rounded-2xl border c-border flex items-center justify-center c-text-4">
        <svg className="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    )
  }

  const hasMultiple = imgs.length > 1
  const zoomUrl = cloudinaryUrl(imgs[current], 'zoom')

  return (
    <div className="flex gap-3">

      {/* ── Miniaturas — columna vertical a la izquierda ──────────────── */}
      {hasMultiple && (
        <div className="flex flex-col gap-2 md:gap-3 w-16 md:w-28 shrink-0 max-h-[420px] md:max-h-[620px] overflow-y-auto">
          {imgs.map((img, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Ver imagen ${i + 1}`}
              className={`relative w-16 h-16 md:w-28 md:h-28 shrink-0 rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                i === current
                  ? 'border-[var(--c-accent)] shadow-sm'
                  : 'c-border hover:border-[var(--c-border-hover)]'
              }`}
            >
              <Image
                src={cloudinaryUrl(img, 'thumbnail')}
                alt={`${productName} — miniatura ${i + 1}`}
                fill
                className="object-contain p-2"
                sizes="(max-width: 768px) 64px, 112px"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}

      {/* ── Imagen principal ─────────────────────────────────────────── */}
      <div
        className="relative flex-1 aspect-square bg-[var(--c-surface-2)] rounded-2xl border c-border overflow-hidden cursor-zoom-in"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setLensPosition(null)}
        onClick={() => setLightboxOpen(true)}
        role="button"
        tabIndex={0}
        aria-label="Ampliar imagen"
        onKeyDown={(e) => e.key === 'Enter' && setLightboxOpen(true)}
      >
        <Image
          key={fadeKey}
          src={cloudinaryUrl(imgs[current], 'detail')}
          alt={`${productName} — imagen ${current + 1}`}
          fill
          className="object-contain p-6 md:p-5 animate-fadeIn"
          sizes="(max-width: 768px) 100vw, 60vw"
          priority={current === 0}
          placeholder="blur"
          blurDataURL={IMAGE_BLUR_PLACEHOLDER}
        />

        {/* Lens de zoom — solo desktop (hover), oculto en touch */}
        {lensPosition && (
          <div
            className="hidden md:block absolute inset-0 pointer-events-none bg-no-repeat bg-[length:220%_220%]"
            style={{
              backgroundImage: `url(${zoomUrl})`,
              backgroundPosition: `${lensPosition.x}% ${lensPosition.y}%`,
            }}
          />
        )}

        {/* Botones de navegación (solo con >1 imagen) */}
        {hasMultiple && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); prev() }}
              aria-label="Imagen anterior"
              className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 z-10 w-9 h-9 md:w-11 md:h-11 rounded-full c-bg shadow-md border c-border flex items-center justify-center c-text-3 hover:c-text hover:shadow-lg active:scale-90 transition-all"
            >
              <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); next() }}
              aria-label="Imagen siguiente"
              className="absolute right-3 md:right-4 top-1/2 -translate-y-1/2 z-10 w-9 h-9 md:w-11 md:h-11 rounded-full c-bg shadow-md border c-border flex items-center justify-center c-text-3 hover:c-text hover:shadow-lg active:scale-90 transition-all"
            >
              <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        {/* Indicador de posición (puntitos en la parte inferior) */}
        {hasMultiple && (
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
            {imgs.map((_, i) => (
              <span
                key={i}
                className={`block h-1.5 rounded-full transition-all duration-300 ${i === current ? 'w-5 bg-[var(--c-text-2)]' : 'w-1.5 bg-[var(--c-text-4)]'}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Lightbox a pantalla completa (mobile tap / click desktop) ── */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            aria-label="Cerrar"
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="relative w-full h-full max-w-3xl max-h-[90vh] touch-pinch-zoom">
            <Image
              src={zoomUrl}
              alt={`${productName} — imagen ${current + 1} ampliada`}
              fill
              className="object-contain"
              sizes="100vw"
            />
          </div>
        </div>
      )}
    </div>
  )
}
