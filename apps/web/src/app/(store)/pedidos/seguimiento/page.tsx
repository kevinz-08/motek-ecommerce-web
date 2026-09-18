import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/infrastructure/database/prisma-client'
import { OrderStatusBadge } from '@/components/store/OrderStatusBadge'

/**
 * Seguimiento de pedido sin sesión.
 *
 * La URL lleva el `trackingToken` del pedido: 256 bits aleatorios, la misma
 * fuerza que un ID de sesión. Quien tiene el enlace ve el pedido — por eso:
 *
 *   - `noindex, nofollow`: el enlace no debe terminar en un buscador.
 *   - `Referrer-Policy: no-referrer` (en next.config para esta ruta): sin él, el
 *     token viajaría en el header Referer hacia Cloudinary, Sentry o cualquier
 *     recurso externo que cargue la página.
 *   - La vista no muestra el documento del comprador ni el email completo.
 */
export const metadata: Metadata = {
  title: 'Seguimiento de pedido',
  description: 'Consulta el estado de tu pedido.',
  robots: { index: false, follow: false },
}

// El estado cambia por webhooks: nunca servir una versión cacheada.
export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ token?: string }>
}

const PAYMENT_PROVIDER_LABEL: Record<string, string> = {
  WOMPI: 'Wompi',
  MERCADO_PAGO: 'Mercado Pago',
  COD: 'Pago contra entrega',
}

const SHIPMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendiente de despacho',
  READY: 'Listo para despacho',
  PREPARING: 'En preparación',
  SHIPPED: 'En camino',
  INCIDENT: 'Con novedad',
  DELIVERED: 'Entregado',
  RETURNED: 'Devuelto',
  CANCELLED: 'Cancelado',
}

function formatCOP(cents: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(cents / 100)
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(date))
}

/** "carlos@gmail.com" → "ca****@gmail.com" */
function maskEmail(email: string): string {
  const at = email.indexOf('@')
  if (at < 1) return '***'
  const local = email.slice(0, at)
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(1, local.length - 2))}${email.slice(at)}`
}

/**
 * Mismo mensaje para token inexistente, token mal copiado y pedido borrado.
 * Cualquier diferencia observable convertiría la página en un oráculo.
 */
function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-4">🔍</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Pedido no encontrado</h1>
        <p className="text-gray-500 mb-6">
          El enlace no es válido o ya no está disponible. Revisa que lo hayas
          copiado completo desde el correo de confirmación.
        </p>
        <Link
          href="/pedidos/seguimiento/solicitar"
          className="inline-block bg-[var(--c-accent)] text-[var(--c-text-on-accent)] px-6 py-3 rounded-xl font-bold hover:bg-[var(--c-accent-hover)] transition-colors"
        >
          Recuperar mi enlace
        </Link>
      </div>
    </div>
  )
}

export default async function SeguimientoPage({ searchParams }: PageProps) {
  const { token } = await searchParams
  if (!token) return <NotFound />

  const order = await prisma.order.findUnique({
    where: { trackingToken: token },
    select: {
      id: true,
      status: true,
      total: true,
      shippingTotal: true,
      discountAmount: true,
      createdAt: true,
      paymentProvider: true,
      deliveryMethod: true,
      contactEmail: true,
      shippingAddress: true,
      userId: true,
      items: {
        select: {
          id: true,
          quantity: true,
          priceAtPurchase: true,
          product: { select: { name: true, slug: true } },
        },
      },
      shipment: { select: { status: true, trackingNumber: true, carrier: true } },
    },
  })

  if (!order) return <NotFound />

  const addr = order.shippingAddress as {
    fullName?: string; address?: string; city?: string; department?: string
  }
  const isPending = order.status === 'PENDING'

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">

        <div className="mb-8">
          <h1 className="text-3xl font-black text-gray-900">Seguimiento de pedido</h1>
          <p className="text-sm text-gray-500 mt-1">
            Pedido asociado a {maskEmail(order.contactEmail)}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">

          <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-1">
                Número de pedido
              </p>
              <p className="font-mono text-lg font-black text-gray-900">
                #{order.id.slice(-8).toUpperCase()}
              </p>
            </div>
            <div className="flex flex-col sm:items-end gap-1">
              <OrderStatusBadge status={order.status} />
              <p className="text-xs text-gray-400">{formatDate(order.createdAt)}</p>
            </div>
          </div>

          {/* Estado del envío — solo aparece cuando Vendelo ya reportó algo */}
          {order.shipment && (
            <div className="px-6 py-5 border-b border-gray-100 bg-[var(--c-active-bg)]">
              <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-2">
                Estado del envío
              </p>
              <p className="text-sm font-bold text-gray-900">
                {SHIPMENT_STATUS_LABEL[order.shipment.status] ?? order.shipment.status}
              </p>
              {order.shipment.trackingNumber && (
                <p className="text-sm text-gray-600 mt-1">
                  Guía <span className="font-mono font-semibold">{order.shipment.trackingNumber}</span>
                  {order.shipment.carrier ? ` · ${order.shipment.carrier}` : ''}
                </p>
              )}
            </div>
          )}

          <div className="px-6 py-5">
            <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-4">
              Productos
            </p>
            <ul className="space-y-3">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/producto/${item.product.slug}`}
                      className="text-sm font-semibold text-gray-900 hover:text-[var(--c-accent)] transition-colors"
                    >
                      {item.product.name}
                    </Link>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {item.quantity} × {formatCOP(item.priceAtPurchase)}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-gray-800 shrink-0">
                    {formatCOP(item.quantity * item.priceAtPurchase)}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 space-y-1">
            {order.discountAmount > 0 && (
              <div className="flex items-center justify-between text-sm text-green-700">
                <span>Descuento aplicado</span>
                <span>−{formatCOP(order.discountAmount)}</span>
              </div>
            )}
            {order.shippingTotal > 0 && (
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>Envío</span>
                <span>{formatCOP(order.shippingTotal)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1">
              <span className="text-sm font-semibold text-gray-600">Total</span>
              <span className="text-xl font-black text-gray-900">{formatCOP(order.total)}</span>
            </div>
          </div>

          <div className="px-6 py-5 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-2">
                {order.deliveryMethod === 'STORE_PICKUP' ? 'Retiro en tienda' : 'Dirección de envío'}
              </p>
              <address className="not-italic text-sm text-gray-700 space-y-0.5">
                <p className="font-semibold">{addr.fullName ?? ''}</p>
                <p>{addr.address ?? ''}</p>
                <p>{addr.city ?? ''}{addr.department ? `, ${addr.department}` : ''}</p>
              </address>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-2">
                Método de pago
              </p>
              <p className="text-sm font-semibold text-gray-700">
                {PAYMENT_PROVIDER_LABEL[order.paymentProvider] ?? order.paymentProvider}
              </p>
              {isPending && (
                <p className="text-xs text-amber-600 mt-1">
                  El pago aún no ha sido confirmado por la pasarela.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <a
            href={`/api/orders/${order.id}/comprobante?token=${encodeURIComponent(token)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center bg-[var(--c-accent)] text-[var(--c-text-on-accent)] px-6 py-3 rounded-xl font-bold hover:bg-[var(--c-accent-hover)] transition-colors"
          >
            Descargar comprobante
          </a>
          <Link
            href="/catalogo"
            className="flex-1 text-center bg-white text-gray-900 border border-gray-300 px-6 py-3 rounded-xl font-bold hover:bg-gray-50 transition-colors"
          >
            Seguir comprando
          </Link>
        </div>

        {/* Solo tiene sentido ofrecer vincular si el pedido sigue siendo de invitado. */}
        {order.userId === null && (
          <div className="mt-6 bg-white border border-gray-200 rounded-xl px-5 py-4 text-sm text-gray-600">
            <p className="font-semibold text-gray-900 mb-1">¿Quieres tener todo esto en un solo lugar?</p>
            <p>
              Si creas una cuenta con{' '}
              <span className="font-medium">{maskEmail(order.contactEmail)}</span>, podrás vincular
              este pedido a tu historial y no depender del enlace.{' '}
              <Link href="/auth/register" className="text-[var(--c-accent)] font-bold hover:underline">
                Crear cuenta
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
