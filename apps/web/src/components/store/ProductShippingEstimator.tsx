'use client'

/**
 * "¿Cuánto cuesta el envío a tu ciudad?" para el PDP. Reusa la ciudad del
 * carrito (`selectedCity`) y el hook de cotización compartido, así que la
 * elección se recuerda en /carrito y /checkout. Es solo informativo: un fallo
 * nunca bloquea la compra.
 */
import { CitySelector } from '@/components/checkout/CitySelector'
import { useCart } from '@/lib/cart'
import { useShippingQuote } from '@/lib/shipping-quote'
import { normalizeCityName } from '@/lib/colombia-divipola'

function formatCOP(cents: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(cents / 100)
}

interface Props {
  productId: string
  quantity: number
}

export function ProductShippingEstimator({ productId, quantity }: Props) {
  const { selectedCity, setSelectedCity } = useCart()
  const { quote, loading, error } = useShippingQuote(selectedCity, [{ productId, quantity }])

  return (
    <section aria-label="Costo de envío" className="mt-4 rounded-2xl border c-border c-bg p-4">
      <p className="text-sm c-text mb-3">¿Cuánto cuesta el envío a tu ciudad?</p>
      <CitySelector value={selectedCity} onChange={setSelectedCity} />

      {selectedCity && (
        <p className="mt-3 text-sm c-text-2" aria-live="polite">
          {loading && 'Calculando...'}
          {!loading && quote && (
            <>
              Envío a {normalizeCityName(selectedCity.name).toUpperCase()} :{' '}
              {quote.freeShipping ? (
                <span className="font-bold text-green-600">¡Gratis!</span>
              ) : (
                <span className="font-bold c-text">{formatCOP(quote.quotedShippingTotal)}</span>
              )}
            </>
          )}
          {!loading && error && <span className="c-text-4 italic">No se pudo calcular ahora; se calculará en el checkout.</span>}
        </p>
      )}

      <p className="mt-1 text-xs c-text-4">
        Envío gratis en compras desde {formatCOP(50_000_000)}.{' '}
        <a
          href="/legal/politica-de-envios"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-[var(--c-accent)] transition-colors"
        >
          Ver política de envíos
        </a>
      </p>
    </section>
  )
}
