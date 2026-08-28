/**
 * Utilidades para construcción de URLs de Cloudinary optimizadas.
 *
 * Cloudinary permite inyectar parámetros de transformación en la URL DESPUÉS
 * de que la imagen fue subida. La URL sigue siendo válida y Cloudinary aplica
 * las transformaciones en su CDN (no recalcula en cada request: las cachea).
 *
 * Formato de URL de Cloudinary:
 *   https://res.cloudinary.com/{cloud}/image/upload/{transformaciones}/{public_id}
 *
 * Esta utilidad detecta si una URL es de Cloudinary y le inyecta las
 * transformaciones correctas según el contexto (thumbnail, detail, carousel).
 * Si la URL no es de Cloudinary (imagen de otra fuente) la devuelve sin cambios.
 *
 * Transformaciones aplicadas:
 *   f_auto   → WebP en Chrome/Edge/Firefox, AVIF donde está disponible, JPEG fallback
 *   q_auto   → Cloudinary elige la calidad óptima por imagen (IA)
 *   w_{n}    → Redimensiona al ancho indicado (sin upscale, c_limit)
 *   c_limit  → Solo reduce, nunca amplía
 *
 * Impacto estimado vs JPEG sin optimizar:
 *   WebP   → ~30% menos que JPEG a igual calidad visual
 *   AVIF   → ~50% menos que JPEG
 *   q_auto → otro 20-40% de reducción según la imagen
 */

const CLOUDINARY_RE = /^https?:\/\/res\.cloudinary\.com\/([^/]+)\/image\/upload\//

type ImageContext = 'thumbnail' | 'card' | 'detail' | 'zoom' | 'carousel' | 'admin' | 'hero' | 'hero-mobile'

const WIDTH: Record<ImageContext, number> = {
  thumbnail:    200,
  card:         480,
  detail:       900,
  zoom:        1600, // versión de alta resolución usada por el lens de zoom del detalle de producto
  carousel:     480,
  admin:        400,
  hero:         1920, // full-bleed en el carrusel de la home (desktop)
  'hero-mobile': 900, // recurso mobile del Hero — viewport ≤768px, cubre pantallas retina
}

/**
 * Placeholder de un píxel gris claro usado como blurDataURL mientras carga
 * la imagen real. Evita un destello blanco/vacío en el LCP.
 */
export const IMAGE_BLUR_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3Crect width='1' height='1' fill='%23f3f4f6'/%3E%3C/svg%3E"

/**
 * Construye una URL de Cloudinary optimizada para el contexto dado.
 * Acepta dos formatos:
 *   - URL completa:  "https://res.cloudinary.com/cloud/image/upload/..."
 *   - Public ID:     "products/7-RR23/1"  (formato almacenado por upload-catalog.ts)
 */
export function cloudinaryUrl(src: string | undefined | null, context: ImageContext): string {
  if (!src) return ''

  const width      = WIDTH[context]
  const transforms = `f_auto,q_auto,w_${width},c_limit`

  // Public ID (no empieza con http) → construir URL completa
  if (!src.startsWith('http')) {
    const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? process.env.CLOUDINARY_CLOUD_NAME
    if (!cloud) return src
    return `https://res.cloudinary.com/${cloud}/image/upload/${transforms}/${src}`
  }

  // URL completa de Cloudinary → inyectar/reemplazar transformaciones
  const match = src.match(CLOUDINARY_RE)
  if (!match) return src

  const prefix    = match[0]
  const rest      = src.slice(prefix.length)
  const cleanRest = rest.replace(/^[^v][^/]*\//, '')

  return `${prefix}${transforms}/${cleanRest}`
}
