import Image from 'next/image'

/**
 * Franja de logos de medios de pago aceptados — refuerza confianza justo
 * debajo del CTA de compra. Los assets viven en `public/assets/facilidadesPago/`.
 */
const PAYMENT_METHODS = [
  { file: 'pse-logo-png.png', alt: 'PSE' },
  { file: 'Bancolombia-Logo-Vector.svg-.png', alt: 'Bancolombia' },
  { file: 'nequi-logo-png.png', alt: 'Nequi' },
  { file: 'visa-logo.webp', alt: 'Visa' },
  { file: 'mastercard-logo.png', alt: 'Mastercard' },
  { file: 'amex-logo.png', alt: 'American Express' },
]

export function PaymentMethodsRow() {
  return (
    <div className="mt-4">
      <p className="text-xs md:text-[12px] c-text-4 mb-2">Facilidades de pago</p>
      <div className="flex flex-wrap items-center gap-3 md:gap-4">
        {PAYMENT_METHODS.map((method) => (
          <div
            key={method.file}
            className="h-7 md:h-8 w-14 md:w-16 relative shrink-0"
          >
            <Image
              src={`/assets/facilidadesPago/${method.file}`}
              alt={method.alt}
              fill
              className="object-contain"
              sizes="64px"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
