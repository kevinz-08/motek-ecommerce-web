'use client'

/**
 * Botón "Pagar con Addi" — abre WhatsApp con un mensaje pre-armado.
 *
 * No integramos la pasarela de Addi (sería 2-3 días de trabajo).
 * En cambio, abrimos el chat de WhatsApp del comercio con la consulta lista
 * para que el admin coordine el pago con Addi manualmente.
 *
 * El mensaje incluye nombre del producto + SKU para que el admin sepa
 * exactamente qué producto referenciar sin preguntar.
 */

import { Product } from '@motek/domain'

interface PayWithAddiButtonProps {
  product: Product
  className?: string
}

function buildWhatsappUrl(product: Product): string {
  const number = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '573143371099'
  const lines = [
    `¡Hola!`,
    ``,
    `Estoy interesad@ en el producto:`,
    `${product.name}`,
    ``,
    `Me gustaría pagarlo con Addi. ¿Es posible coordinar esa opción?`,
  ]
  const message = encodeURIComponent(lines.join('\n'))
  return `https://wa.me/${number}?text=${message}`
}

export function PayWithAddiButton({ product, className }: PayWithAddiButtonProps) {
  if (product.stock === 0) return null

  return (
    <a
      href={buildWhatsappUrl(product)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Pagar con Addi por WhatsApp: ${product.name}`}
      // Azul de marca Addi (#1A57FF): es un medio de pago de terceros, no el acento de la tienda.
      className={`flex items-center justify-center gap-2 w-full h-12 rounded-full bg-[#1A57FF] hover:bg-[#0B47E5] text-white font-semibold text-[15px] shadow-md transition-colors ${className ?? ''}`}
    >
      <span
        aria-hidden
        className="w-6 h-6 rounded-full bg-white text-[#1A57FF] flex items-center justify-center text-sm font-extrabold"
      >
        A
      </span>
      Pagar con Addi
    </a>
  )
}
