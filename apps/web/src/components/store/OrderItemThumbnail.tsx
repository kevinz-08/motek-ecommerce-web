'use client'

import { useState } from 'react'
import Image from 'next/image'
import { cloudinaryUrl } from '@/lib/cloudinary'

interface OrderItemThumbnailProps {
  /** Public ID de Cloudinary (p.ej. "products/9-DR150/1") o URL completa — mismo formato que `Product.images[0]`. */
  src: string | null
  alt: string
  size?: number
}

/** Miniatura de producto en listados de pedidos. Si la imagen falla al cargar (URL rota, 404),
 *  cae al ícono 🛒 en vez de dejar que el navegador muestre el texto `alt` sin estilo. */
export function OrderItemThumbnail({ src, alt, size = 56 }: OrderItemThumbnailProps) {
  const [failed, setFailed] = useState(false)
  const resolvedSrc = src ? cloudinaryUrl(src, 'thumbnail') : ''

  if (!resolvedSrc || failed) {
    return (
      <div
        className="rounded-lg bg-gray-100 flex items-center justify-center shrink-0 text-xl"
        style={{ width: size, height: size }}
      >
        🛒
      </div>
    )
  }

  return (
    <div className="relative rounded-lg overflow-hidden bg-gray-100 shrink-0" style={{ width: size, height: size }}>
      <Image
        src={resolvedSrc}
        alt={alt}
        fill
        className="object-cover"
        sizes={`${size}px`}
        onError={() => setFailed(true)}
      />
    </div>
  )
}
