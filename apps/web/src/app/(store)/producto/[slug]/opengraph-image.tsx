import { ImageResponse } from 'next/og'
import { getCachedProductBySlug } from '@/lib/cache'

export const runtime = 'nodejs'
export const alt = 'Producto — Motek Store'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

interface Props {
  params: Promise<{ slug: string }>
}

/**
 * `product.images` puede contener tanto Public IDs de Cloudinary (ej. "products/7-RR23/1")
 * como URLs completas, dependiendo de si el producto fue creado vía script o vía Panel Admin.
 * 
 * - Si es un Public ID, construimos la URL base usando f_jpg para evitar la negociación 
 *   de formato (f_auto) que Satori no interpreta correctamente.
 * - Si es una URL completa, la normalizamos para asegurar que Cloudinary entregue un 
 *   formato compatible (JPEG) y eliminar parámetros de transformación conflictivos.
 * 
 * Satori (el motor de ImageResponse) requiere binarios de imagen puros (JPG/PNG), por lo 
 * que forzamos explícitamente el formato JPEG en todos los casos para garantizar la decodificación.
 */
function cloudinaryOgImageUrl(publicIdOrUrl: string): string | null {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? process.env.CLOUDINARY_CLOUD_NAME
  if (!cloud) return null

  // Si el panel de administración guardó una URL completa en lugar del ID
  if (publicIdOrUrl.startsWith('http://') || publicIdOrUrl.startsWith('https://')) {
    // Reemplazamos f_auto por f_jpg para asegurar la compatibilidad con Satori
    return publicIdOrUrl.replace('f_auto', 'f_jpg'); 
  }

  // Si el script guardó el Public ID (Comportamiento original)
  return `https://res.cloudinary.com/${cloud}/image/upload/f_jpg,q_auto,w_1100,c_limit/${publicIdOrUrl}`
}

const FALLBACK = (
  <div
    style={{
      display: 'flex',
      width: '100%',
      height: '100%',
      backgroundColor: '#1a1a1a',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <div style={{ fontSize: '52px', fontWeight: '900', color: '#ffffff' }}>
      Motek Store
    </div>
  </div>
)

/**
 * Solo la foto del producto, a pantalla completa — sin panel de texto.
 * WhatsApp (y la mayoría de apps de mensajería) recorta el og:image a un
 * thumbnail chico, y con el diseño anterior (foto + panel de texto al lado)
 * el recorte solía mostrar solo una porción del panel oscuro, perdiendo
 * la foto por completo. El nombre/precio ya los muestra la app de mensajería
 * aparte, tomados de og:title — no hace falta repetirlos en la imagen.
 */
export default async function OgImage({ params }: Props) {
  const { slug } = await params
  const result = await getCachedProductBySlug(slug)

  if (!result.ok) {
    return new ImageResponse(FALLBACK, { width: 1200, height: 630 })
  }

  const product = result.value
  const imageUrl = product.images[0] ? cloudinaryOgImageUrl(product.images[0]) : null

  if (!imageUrl) {
    return new ImageResponse(FALLBACK, { width: 1200, height: 630 })
  }

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          backgroundColor: '#f1f5f9',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <img
          src={imageUrl}
          alt={product.name}
          style={{
            maxWidth: '1100px',
            maxHeight: '580px',
            objectFit: 'contain',
          }}
        />
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
