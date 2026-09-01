'use client'

/**
 * Formulario de checkout en dos pasos:
 *
 * Paso 1 — "shipping": Recoge datos de envío y el método de pago. Al confirmar:
 *   - Pago online (WOMPI): POST /api/orders crea el pedido PENDING + inicia la
 *     transacción → se avanza al paso "payment" para mostrar el Widget de Wompi.
 *     El webhook /api/payments/wompi/webhook confirma o rechaza el pago de forma asíncrona.
 *   - Pago contra entrega (COD): POST /api/orders crea el pedido ya confirmado
 *     (no hay pasarela que esperar) → se redirige directo a /checkout/confirmacion.
 *
 * Nota: el precio en el formulario se muestra en pesos COP (display),
 * pero internamente todo se maneja en centavos.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import type { CreateOrderResponse } from '@motek/types'
import { useCart } from '@/lib/cart'
import { WompiWidget } from './WompiWidget'
import { CitySelector } from './CitySelector'
import { apiClient } from '@/lib/api-client'
import { useShippingQuote } from '@/lib/shipping-quote'
import { STORE_ADDRESS, STORE_CITY, STORE_MAP_EMBED_URL } from '@/lib/contact'

type PaymentMethod = 'WOMPI' | 'COD'
type DeliveryMethod = 'HOME_DELIVERY' | 'STORE_PICKUP'

interface CheckoutFormProps {
  userEmail: string
  /** Si el admin desactivó COD en /admin/configuracion, la opción no se muestra. */
  codEnabled: boolean
  /**
   * Política global (no elegible por el cliente): si el admin la desactivó en
   * /admin/configuracion, todos los pedidos pagados en línea (WOMPI) nacen con
   * el flete contraentrega en vez de cobrarse desde la billetera del negocio.
   * Solo se usa para mostrar una nota informativa — el backend decide el valor real.
   */
  shippingOnlineEnabled: boolean
}

interface ShippingFormData {
  fullName: string
  address: string
  phone: string
  notes: string
}

type BuyerIdType = 'CC' | 'CE' | 'NIT' | 'PASAPORTE'

interface BuyerFormData {
  idType: BuyerIdType
  idNumber: string
  businessName: string
}

function formatCOP(cents: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(cents / 100)
}

export function CheckoutForm({ userEmail, codEnabled, shippingOnlineEnabled }: CheckoutFormProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const { items, total, selectedCity, setSelectedCity } = useCart()
  const [step, setStep] = useState<'shipping' | 'payment'>('shipping')
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('HOME_DELIVERY')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('WOMPI')
  const [wompiParams, setWompiParams] = useState<CreateOrderResponse['payment'] | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [acceptedPolicies, setAcceptedPolicies] = useState(false)

  const [couponCode, setCouponCode] = useState('')
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string
    discount: number
    eligibleProductIds: string[]
  } | null>(null)

  const [form, setForm] = useState<ShippingFormData>({
    fullName: '',
    address: '',
    phone: '',
    notes: '',
  })
  const [buyer, setBuyer] = useState<BuyerFormData>({
    idType: 'CC',
    idNumber: '',
    businessName: '',
  })

  const cartTotal = total()
  const shippingItems = items.map((i) => ({ productId: i.product.id, quantity: i.quantity }))
  const quotePaymentMethod = paymentMethod === 'COD' ? 'COD' : 'EXTERNAL_PAYMENT'
  // Retiro en tienda: no hay nada que cotizar — se pasa `null` para que el hook
  // ni siquiera dispare la llamada a /api/shipping/quote.
  const { quote: shippingQuote, loading: shippingLoading, error: shippingError } = useShippingQuote(
    deliveryMethod === 'STORE_PICKUP' ? null : selectedCity,
    shippingItems,
    quotePaymentMethod,
  )
  const shippingCost = deliveryMethod === 'HOME_DELIVERY' && shippingQuote && !shippingQuote.freeShipping
    ? shippingQuote.quotedShippingTotal
    : 0
  // Si el admin activó "Flete pagado en línea", el estimado de arriba es lo que
  // realmente va a cobrar Wompi junto al producto (CreateOrder lo recalcula server-side
  // con la misma lógica) — no es solo informativo como en el resto de los casos.
  // No aplica a retiro en tienda: el flete siempre es $0 ahí.
  const chargingShippingOnline = paymentMethod === 'WOMPI' && shippingOnlineEnabled && deliveryMethod === 'HOME_DELIVERY'

  const handleApplyCoupon = async () => {
    const code = couponCode.trim().toUpperCase()
    if (!code) return
    setCouponLoading(true)
    setCouponError(null)
    setAppliedCoupon(null)
    try {
      const client = apiClient(session?.user?.accessToken)
      const res = await client.post<{ discount: number; eligibleProductIds: string[] }>('/coupons/validate', {
        code,
        items: items.map((i) => ({
          productId: i.product.id,
          price: i.product.price,
          quantity: i.quantity,
          categoryId: i.product.categoryId,
          parentCategoryId: i.product.parentCategoryId ?? null,
        })),
      })
      if (!res.ok) {
        setCouponError(res.error ?? 'Cupón no válido')
        return
      }
      setAppliedCoupon({ code, ...res.data })
    } catch {
      setCouponError('Error al validar el cupón')
    } finally {
      setCouponLoading(false)
    }
  }

  const handleSubmitShipping = async (e: React.FormEvent) => {
    e.preventDefault()

    if (deliveryMethod === 'HOME_DELIVERY' && !selectedCity) {
      setError('Por favor selecciona una ciudad de la lista.')
      return
    }
    if (buyer.idNumber.trim().length < 5) {
      setError('Ingresa un número de documento válido (mínimo 5 caracteres).')
      return
    }
    if (buyer.idType === 'NIT' && buyer.businessName.trim().length === 0) {
      setError('Cuando el documento es NIT, la razón social es obligatoria.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const client = apiClient(session?.user?.accessToken)

      const shippingAddress = deliveryMethod === 'STORE_PICKUP'
        ? {
          fullName: form.fullName,
          address: STORE_ADDRESS,
          city: STORE_CITY,
          phone: form.phone,
          notes: form.notes || undefined,
        }
        : {
          fullName: form.fullName,
          address: form.address,
          city: selectedCity!.name,
          cityCode: selectedCity!.code,
          subdivisionCode: selectedCity!.subdivisionCode,
          phone: form.phone,
          notes: form.notes || undefined,
        }

      const orderRes = await client.post<CreateOrderResponse>('/orders', {
        items: items.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
        shippingAddress,
        deliveryMethod,
        buyer: {
          idType: buyer.idType,
          idNumber: buyer.idNumber.trim(),
          ...(buyer.idType === 'NIT' && { businessName: buyer.businessName.trim() }),
        },
        paymentProvider: paymentMethod,
        policiesAcceptedAt: new Date().toISOString(),
        ...(appliedCoupon && { couponCode: appliedCoupon.code }),
      })

      if (!orderRes.ok) {
        throw new Error(orderRes.error ?? 'Error al crear el pedido')
      }

      const { order, payment } = orderRes.data

      if (paymentMethod === 'COD') {
        // El pedido COD ya nació confirmado — no hay widget de pago que mostrar.
        router.push(`/checkout/confirmacion?orderId=${order.id}`)
        return
      }

      if (!payment?.publicKey) {
        throw new Error('Configuración de pago incompleta. Contacta al administrador.')
      }

      setOrderId(order.id)
      setWompiParams(payment)
      setStep('payment')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500">
        Tu carrito está vacío.{' '}
        <a href="/catalogo" className="text-[var(--c-accent)] hover:underline">
          Volver al catálogo
        </a>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Formulario */}
      <div className="lg:col-span-2">
        {step === 'shipping' ? (
          <form onSubmit={handleSubmitShipping} className="space-y-5">
            {/* Método de entrega — domicilio vs retiro en tienda */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="font-bold text-gray-900 mb-1">¿Cómo quieres recibir tu pedido?</h2>
              <p className="text-xs text-gray-500 mb-5">
                Elige si prefieres que te lo enviemos a domicilio o pasar a recogerlo tú mismo.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={`flex items-start gap-3 border rounded-lg px-4 py-3 cursor-pointer transition-colors ${
                    deliveryMethod === 'HOME_DELIVERY' ? 'border-[var(--c-accent)] bg-[var(--c-active-bg)]' : 'border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="deliveryMethod"
                    value="HOME_DELIVERY"
                    checked={deliveryMethod === 'HOME_DELIVERY'}
                    onChange={() => setDeliveryMethod('HOME_DELIVERY')}
                    className="mt-0.5 accent-[var(--c-accent)]"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-gray-900">Envío a domicilio</span>
                    <span className="block text-xs text-gray-500">Lo llevamos hasta tu dirección</span>
                  </span>
                </label>

                <label
                  className={`flex items-start gap-3 border rounded-lg px-4 py-3 cursor-pointer transition-colors ${
                    deliveryMethod === 'STORE_PICKUP' ? 'border-[var(--c-accent)] bg-[var(--c-active-bg)]' : 'border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="deliveryMethod"
                    value="STORE_PICKUP"
                    checked={deliveryMethod === 'STORE_PICKUP'}
                    onChange={() => setDeliveryMethod('STORE_PICKUP')}
                    className="mt-0.5 accent-[var(--c-accent)]"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-gray-900">Retiro en tienda</span>
                    <span className="block text-xs text-gray-500">Lo recoges en el punto fisico</span>
                  </span>
                </label>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="font-bold text-gray-900 mb-5">
                {deliveryMethod === 'STORE_PICKUP' ? 'Datos de contacto' : 'Datos de envío'}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label htmlFor="checkout-fullName" className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre completo *
                  </label>
                  <input
                    id="checkout-fullName"
                    required
                    aria-required="true"
                    type="text"
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--c-accent)]"
                    placeholder="Juan Pérez"
                  />
                </div>

                {deliveryMethod === 'STORE_PICKUP' ? (
                  <div className="sm:col-span-2">
                    <span className="block text-sm font-medium text-gray-700 mb-1">
                      Recoges tu pedido en
                    </span>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <iframe
                        title="Ubicación de la tienda en Google Maps"
                        src={STORE_MAP_EMBED_URL}
                        className="w-full h-48 border-0"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                      <p className="text-sm text-gray-700 px-4 py-3 bg-gray-50">{STORE_ADDRESS}</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="sm:col-span-2">
                      <label htmlFor="checkout-address" className="block text-sm font-medium text-gray-700 mb-1">
                        Dirección *
                      </label>
                      <input
                        id="checkout-address"
                        required
                        aria-required="true"
                        type="text"
                        value={form.address}
                        onChange={(e) => setForm({ ...form, address: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--c-accent)]"
                        placeholder="Calle 45 # 23-10, Apto 302"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label htmlFor="checkout-city" className="block text-sm font-medium text-gray-700 mb-1">
                        Ciudad *
                        {!selectedCity && (
                          <span className="ml-1 text-xs text-gray-400 font-normal">(escribe para buscar)</span>
                        )}
                      </label>
                      <CitySelector
                        value={selectedCity}
                        onChange={setSelectedCity}
                        required
                        disabled={loading}
                      />
                    </div>
                  </>
                )}

                <div>
                  <label htmlFor="checkout-phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono *
                  </label>
                  <input
                    id="checkout-phone"
                    required
                    aria-required="true"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--c-accent)]"
                    placeholder="3001234567"
                  />
                </div>

                <div>
                  <label htmlFor="checkout-email" className="block text-sm font-medium text-gray-700 mb-1">
                    Correo electrónico
                  </label>
                  <input
                    id="checkout-email"
                    type="email"
                    disabled
                    aria-disabled="true"
                    value={userEmail}
                    className="w-full border border-gray-200 bg-gray-50 rounded-lg px-4 py-2.5 text-sm text-gray-400 cursor-not-allowed"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="checkout-notes" className="block text-sm font-medium text-gray-700 mb-1">
                    Notas adicionales
                  </label>
                  <textarea
                    id="checkout-notes"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--c-accent)] resize-none"
                    placeholder="Instrucciones para el mensajero..."
                  />
                </div>
              </div>
            </div>

            {/* Datos del comprador — para comprobante de venta y Vendelo */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="font-bold text-gray-900 mb-1">Datos del comprador</h2>
              <p className="text-xs text-gray-500 mb-5">
                Quedan registrados en el comprobante de venta. Si el comprador es una empresa, elige NIT.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="buyer-id-type" className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de documento *
                  </label>
                  <select
                    id="buyer-id-type"
                    value={buyer.idType}
                    onChange={(e) => setBuyer({ ...buyer, idType: e.target.value as BuyerIdType })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--c-accent)] bg-white"
                  >
                    <option value="CC">Cédula de Ciudadanía (CC)</option>
                    <option value="CE">Cédula de Extranjería (CE)</option>
                    <option value="NIT">NIT (empresa)</option>
                    <option value="PASAPORTE">Pasaporte</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="buyer-id-number" className="block text-sm font-medium text-gray-700 mb-1">
                    Número *
                  </label>
                  <input
                    id="buyer-id-number"
                    required
                    aria-required="true"
                    type="text"
                    inputMode={buyer.idType === 'CC' ? 'numeric' : 'text'}
                    value={buyer.idNumber}
                    onChange={(e) => setBuyer({ ...buyer, idNumber: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--c-accent)]"
                    placeholder={buyer.idType === 'NIT' ? '900123456-7' : '1000123456'}
                  />
                </div>

                {buyer.idType === 'NIT' && (
                  <div className="sm:col-span-3">
                    <label htmlFor="buyer-business-name" className="block text-sm font-medium text-gray-700 mb-1">
                      Razón social *
                    </label>
                    <input
                      id="buyer-business-name"
                      required
                      aria-required="true"
                      type="text"
                      value={buyer.businessName}
                      onChange={(e) => setBuyer({ ...buyer, businessName: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--c-accent)]"
                      placeholder="Motek Store S.A.S."
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Método de pago — el selector solo se muestra si el admin habilitó COD */}
            {codEnabled && (
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h2 className="font-bold text-gray-900 mb-1">Método de pago</h2>
                <p className="text-xs text-gray-500 mb-5">
                  Con pago contra entrega pagas en efectivo al repartidor cuando recibas tu pedido.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label
                    className={`flex items-start gap-3 border rounded-lg px-4 py-3 cursor-pointer transition-colors ${
                      paymentMethod === 'WOMPI' ? 'border-[var(--c-accent)] bg-[var(--c-active-bg)]' : 'border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="WOMPI"
                      checked={paymentMethod === 'WOMPI'}
                      onChange={() => setPaymentMethod('WOMPI')}
                      className="mt-0.5 accent-[var(--c-accent)]"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-gray-900">Pago en línea</span>
                      <span className="block text-xs text-gray-500">Tarjeta, Nequi, PSE o Bancolombia (Wompi)</span>
                    </span>
                  </label>

                  <label
                    className={`flex items-start gap-3 border rounded-lg px-4 py-3 cursor-pointer transition-colors ${
                      paymentMethod === 'COD' ? 'border-[var(--c-accent)] bg-[var(--c-active-bg)]' : 'border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="COD"
                      checked={paymentMethod === 'COD'}
                      onChange={() => setPaymentMethod('COD')}
                      className="mt-0.5 accent-[var(--c-accent)]"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-gray-900">Pago contra entrega</span>
                      <span className="block text-xs text-gray-500">Pagas en efectivo al recibir tu pedido</span>
                    </span>
                  </label>
                </div>

                {/* Nota informativa — no es una elección del cliente, es una política global
                    del negocio (toggle "Flete pagado en línea" en /admin/configuracion). */}
                {chargingShippingOnline && (
                  <div className="mt-3 flex items-start gap-3 border border-dashed border-[var(--c-accent)] bg-[var(--c-active-bg)] rounded-lg px-4 py-3">
                    <span>
                      <span className="block text-sm font-semibold text-gray-900">El envío se paga junto con tu pedido</span>
                      <span className="block text-xs text-gray-500">
                        El valor del flete se suma a tu pago en línea — no tienes que pagar nada más al recibir tu pedido
                      </span>
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Cupón de descuento */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="font-bold text-gray-900 mb-3">¿Tienes un cupón?</h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => {
                    setCouponCode(e.target.value.toUpperCase())
                    setCouponError(null)
                    if (appliedCoupon) setAppliedCoupon(null)
                  }}
                  disabled={couponLoading || !!appliedCoupon}
                  placeholder="HALLOWEEN20"
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm font-mono uppercase focus:outline-none focus:border-[var(--c-accent)] disabled:bg-gray-50 disabled:text-gray-400"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleApplyCoupon() } }}
                />
                {appliedCoupon ? (
                  <button
                    type="button"
                    onClick={() => { setAppliedCoupon(null); setCouponCode('') }}
                    className="px-4 py-2.5 text-sm font-medium border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Quitar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleApplyCoupon()}
                    disabled={!couponCode.trim() || couponLoading}
                    className="px-4 py-2.5 text-sm font-semibold bg-[var(--c-accent)] text-white rounded-lg hover:bg-[var(--c-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {couponLoading ? '...' : 'Aplicar'}
                  </button>
                )}
              </div>
              {couponError && (
                <p className="mt-2 text-xs text-red-600">{couponError}</p>
              )}
              {appliedCoupon && (
                <p className="mt-2 text-xs text-green-700 font-medium">
                  ¡Cupón aplicado! Descuento: {formatCOP(appliedCoupon.discount)}
                </p>
              )}
            </div>

            {error && (
              <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            {/* Aceptación de políticas — obligatoria antes de proceder al pago */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={acceptedPolicies}
                  onChange={(e) => setAcceptedPolicies(e.target.checked)}
                  aria-required="true"
                  aria-describedby="policies-description"
                  className="mt-0.5 w-4 h-4 shrink-0 rounded border-gray-300 text-[var(--c-accent)] focus:ring-[var(--c-accent)] accent-[var(--c-accent)]"
                />
                <span
                  id="policies-description"
                  className="text-xs text-gray-600 leading-relaxed group-hover:text-gray-800 transition-colors"
                >
                  Al realizar este pedido confirmo que he leído y acepto la{' '}
                  <a
                    href="/legal/politica-de-envios"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--c-accent)] underline hover:text-[var(--c-accent-hover)]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Política de envíos
                  </a>
                  , la{' '}
                  <a
                    href="/legal/politica-de-cambios"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--c-accent)] underline hover:text-[var(--c-accent-hover)]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Política de cambios
                  </a>{' '}
                  y los{' '}
                  <a
                    href="/legal/terminos-y-condiciones"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--c-accent)] underline hover:text-[var(--c-accent-hover)]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Términos y condiciones
                  </a>{' '}
                  de Motek Store.
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading || (deliveryMethod === 'HOME_DELIVERY' && !selectedCity) || !acceptedPolicies}
              aria-disabled={!acceptedPolicies}
              className="w-full bg-[var(--c-accent)] text-white py-3 rounded-xl font-bold text-base hover:bg-[var(--c-accent-hover)] active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Procesando...' : paymentMethod === 'COD' ? 'Confirmar pedido →' : 'Continuar al pago →'}
            </button>
          </form>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="font-bold text-gray-900 mb-2">Pago seguro con Wompi</h2>
            <p className="text-sm text-gray-500 mb-6">
              Completa tu pago. Aceptamos Tarjeta, Nequi, PSE y Bancolombia.
            </p>
            {wompiParams && wompiParams.publicKey && wompiParams.integritySignature && (
              <WompiWidget
                {...wompiParams}
                publicKey={wompiParams.publicKey}
                integritySignature={wompiParams.integritySignature}
                redirectUrl={`${process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== 'undefined' ? window.location.origin : '')}/checkout/confirmacion?orderId=${orderId}`}
              />
            )}
          </div>
        )}
      </div>

      {/* Resumen */}
      <div>
        <div className="bg-white border border-gray-200 rounded-xl p-6 sticky top-24">
          <h2 className="font-bold text-gray-900 mb-4">TU PEDIDO</h2>
          <div className="space-y-3 mb-4">
            {items.map(({ product, quantity }) => (
              <div key={product.id} className="flex justify-between text-sm">
                <span className="text-gray-600 line-clamp-1 flex-1">
                  {product.name} ×{quantity}
                </span>
                <span className="text-gray-900 font-medium ml-2 shrink-0">
                  {formatCOP(product.price * quantity)}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 pt-4 space-y-2">
            {appliedCoupon && (
              <div className="flex justify-between text-sm text-green-700">
                <span className="font-medium">Descuento ({appliedCoupon.code})</span>
                <span className="font-semibold">-{formatCOP(appliedCoupon.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">ENVIO</span>
              {deliveryMethod === 'STORE_PICKUP' && (
                <span className="inline-flex items-center gap-1 text-green-600 font-semibold text-xs bg-green-50 px-2 py-0.5 rounded-full">
                  NO APLICA
                </span>
              )}
              {deliveryMethod === 'HOME_DELIVERY' && !selectedCity && (
                <span className="text-gray-400 italic">Selecciona tu ciudad</span>
              )}
              {deliveryMethod === 'HOME_DELIVERY' && selectedCity && shippingLoading && (
                <span className="text-gray-400">Calculando...</span>
              )}
              {deliveryMethod === 'HOME_DELIVERY' && selectedCity && !shippingLoading && shippingQuote && shippingQuote.freeShipping && (
                <span className="inline-flex items-center gap-1 text-green-600 font-semibold text-xs bg-green-50 px-2 py-0.5 rounded-full">
                  🎉 ¡ENVÍO GRATIS!
                </span>
              )}
              {deliveryMethod === 'HOME_DELIVERY' && selectedCity && !shippingLoading && shippingQuote && !shippingQuote.freeShipping && (
                <span className="text-gray-700 font-medium">{formatCOP(shippingQuote.quotedShippingTotal)}</span>
              )}
              {deliveryMethod === 'HOME_DELIVERY' && selectedCity && !shippingLoading && shippingError && (
                <span className="text-gray-400 italic text-xs">No se pudo calcular ahora</span>
              )}
            </div>

            <div className="flex justify-between font-bold text-gray-900 pt-1">
              <span>{chargingShippingOnline ? 'Total a pagar (incluye envío)' : shippingCost > 0 ? 'TOTAL A PAGAR' : 'Total'}</span>
              <span>{formatCOP(Math.max(0, cartTotal + shippingCost - (appliedCoupon?.discount ?? 0)))}</span>
            </div>
            {deliveryMethod === 'HOME_DELIVERY' && !chargingShippingOnline && (
              <p className="text-xs text-gray-400">
                El envío lo cobra la transportadora directamente al recibir tu pedido.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
