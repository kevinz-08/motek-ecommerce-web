'use client'

/**
 * Enlace de texto "¿Prefieres pagar con Addi?" — abre WhatsApp con un mensaje pre-armado.
 *
 * No integramos la pasarela de Addi (sería 2-3 días de trabajo).
 * En cambio, abrimos el chat de WhatsApp del comercio con la consulta lista
 * para que el admin coordine el pago con Addi manualmente.
 *
 * Ya no es un botón — es una frase donde solo "¿Prefieres pagar con Addi?"
 * queda subrayado en azul; el resto del texto es de apoyo. Todo el bloque
 * (frase completa) es clicable y conduce al mismo link de WhatsApp.
 *
 * El mensaje incluye nombre del producto + SKU para que el admin sepa
 * exactamente qué producto referenciar sin preguntar.
 */

import { Product } from '@motek/domain'

interface PayWithAddiButtonProps {
  product: Product
  /** className opcional para overrides puntuales — el base ya viene fuerte. */
  className?: string
}

function buildWhatsappUrl(product: Product): string {
  const number = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '573152926609'
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

  const href = buildWhatsappUrl(product)

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Pagar con Addi por WhatsApp: ${product.name}`}
      className={className ?? 'text-sm c-text-2'}
    >
      {/* Azul Addi (#1A57FF) — solo esta frase queda subrayada, el resto es texto de apoyo. */}
      <span className="text-[#1A57FF] underline hover:text-[#0B47E5] font-medium">
        ¿Prefieres pagar con Addi?
      </span>{' '}
      Contacta con nuestra línea para coordinar la compra.
    </a>
  )
}
