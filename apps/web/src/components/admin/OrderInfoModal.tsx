'use client'

/**
 * Modal de información detallada del pedido para el panel admin.
 *
 * Patrón:
 *   - Renderiza siempre un botón (info icon) que abre el modal.
 *   - Al abrir, dispara fetch a /api/admin/orders/[id] (lazy: solo cuando lo abren).
 *
 * No carga datos hasta que el admin clickea — evita N+1 queries por cada
 * fila de la tabla si nunca abre los modales.
 */

import { useState, useCallback } from 'react'
import { Info } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Badge, type BadgeVariant } from '@/components/ui/Badge'

interface OrderDetails {
  id: string
  createdAt: string
  status: string
  total: number
  shippingTotal: number
  paymentProvider: string
  vendeloOrderId: string | null
  policiesAcceptedAt: string | null
  buyer: { idType: string; idNumber: string; businessName: string | null }
  shippingAddress: {
    fullName: string
    address: string
    city: string
    department?: string
    phone: string
    notes?: string
  }
  user: { email: string; name: string | null; isGuest: boolean }
  items: Array<{ sku: string; name: string; quantity: number; unitPrice: number; subtotal: number }>
  payment: {
    provider: string
    status: string
    externalId: string | null
    amount: number
    createdAt: string
  } | null
  shipment: {
    status: string
    trackingNumber: string | null
    carrier: string | null
    updatedAt: string
  } | null
}

function formatCOP(cents: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(cents / 100)
}

function formatDateTime(d: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(d))
}

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  PENDING: 'warning',
  PAID: 'success',
  APPROVED: 'success',
  SHIPPED: 'info',
  DELIVERED: 'success',
  CANCELLED: 'danger',
  DECLINED: 'danger',
  PREPARING: 'info',
  READY: 'info',
  INCIDENT: 'warning',
  RETURNED: 'danger',
}

export function OrderInfoModal({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<OrderDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Carga lazy: solo cuando se abre por primera vez. Se cachea para reaperturas.
  const load = useCallback(async () => {
    if (data) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [orderId, data])

  function handleOpen() {
    setOpen(true)
    void load()
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        title="Ver información del pedido"
        className="inline-flex items-center justify-center w-8 h-8 rounded-[var(--radius-md)] bg-[var(--c-surface-2)] text-[var(--c-text-3)] hover:bg-[var(--c-surface-hover)] hover:text-[var(--c-text)] transition-colors"
      >
        <Info className="w-4 h-4" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={`Pedido #${orderId.slice(-8).toUpperCase()}`} size="xl">
        {loading && (
          <div className="text-center py-10 text-[var(--c-text-4)]">Cargando...</div>
        )}
        {error && (
          <div className="bg-[var(--c-danger-bg)] border border-[var(--c-danger)]/30 text-[var(--c-danger)] text-[length:var(--text-body-sm)] rounded-[var(--radius-md)] px-4 py-3">
            Error: {error}
          </div>
        )}
        {data && (
          <div className="space-y-6">
            {data.createdAt && (
              <p className="text-xs text-[var(--c-text-4)] -mt-2">Creado el {formatDateTime(data.createdAt)}</p>
            )}

            {/* Estado del pedido */}
            <Section title="Estado">
              <div className="flex flex-wrap gap-2">
                <Badge variant={STATUS_VARIANT[data.status] ?? 'neutral'}>Pedido: {data.status}</Badge>
                {data.payment && (
                  <Badge variant={STATUS_VARIANT[data.payment.status] ?? 'neutral'}>Pago: {data.payment.status}</Badge>
                )}
                {data.shipment && (
                  <Badge variant={STATUS_VARIANT[data.shipment.status] ?? 'neutral'}>Envío: {data.shipment.status}</Badge>
                )}
                {data.shippingTotal > 0 && <Badge variant="info">Envío pagado en línea</Badge>}
              </div>
            </Section>

            {/* Comprador */}
            <Section title="Comprador">
              <KV label="Nombre" value={data.buyer.businessName ?? data.shippingAddress.fullName} />
              {data.buyer.businessName && <KV label="Contacto" value={data.shippingAddress.fullName} />}
              <KV label={data.buyer.idType} value={data.buyer.idNumber || '(no proporcionado)'} />
              <KV label="Email" value={data.user.email} mono />
              {/* Un pedido de invitado no tiene cuenta detrás: al admin le
                  importa saberlo antes de, por ejemplo, buscar al cliente en el
                  panel de usuarios o fiarse de su historial de compras. */}
              <KV label="Tipo de cliente" value={data.user.isGuest ? 'Invitado (sin cuenta)' : 'Registrado'} />
              <KV label="Teléfono" value={data.shippingAddress.phone} />
            </Section>

            {/* Envío */}
            <Section title="Envío">
              <KV label="Dirección" value={data.shippingAddress.address} />
              <KV label="Ciudad" value={data.shippingAddress.city} />
              {data.shippingAddress.department && <KV label="Departamento" value={data.shippingAddress.department} />}
              {data.shippingAddress.notes && <KV label="Notas" value={data.shippingAddress.notes} />}
              {data.shipment?.trackingNumber && <KV label="Tracking" value={data.shipment.trackingNumber} mono />}
              {data.shipment?.carrier && <KV label="Transportador" value={data.shipment.carrier} />}
              {data.vendeloOrderId && <KV label="ID Vendelo" value={data.vendeloOrderId} mono />}
            </Section>

            {/* Items */}
            <Section title="Productos">
              <div className="rounded-[var(--radius-md)] border border-[var(--c-border)] overflow-x-auto">
                <table className="w-full text-[length:var(--text-body-sm)]">
                  <thead className="bg-[var(--c-surface-2)] text-[var(--c-text-3)] text-xs uppercase tracking-wide">
                    <tr>
                      <th scope="col" className="text-left px-3 py-2 font-semibold">SKU</th>
                      <th scope="col" className="text-left px-3 py-2 font-semibold">Producto</th>
                      <th scope="col" className="text-center px-3 py-2 font-semibold">Cant</th>
                      <th scope="col" className="text-right px-3 py-2 font-semibold">Unitario</th>
                      <th scope="col" className="text-right px-3 py-2 font-semibold">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--c-divider)] text-[var(--c-text-2)]">
                    {data.items.map((it, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-mono text-xs text-[var(--c-text-3)]">{it.sku}</td>
                        <td className="px-3 py-2">{it.name}</td>
                        <td className="px-3 py-2 text-center">{it.quantity}</td>
                        <td className="px-3 py-2 text-right">{formatCOP(it.unitPrice)}</td>
                        <td className="px-3 py-2 text-right font-medium">{formatCOP(it.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-[var(--c-surface-2)]">
                    {data.shippingTotal > 0 && (
                      <>
                        <tr>
                          <td colSpan={4} className="px-3 py-1.5 text-right text-[var(--c-text-3)]">Subtotal productos</td>
                          <td className="px-3 py-1.5 text-right text-[var(--c-text-2)]">{formatCOP(data.total - data.shippingTotal)}</td>
                        </tr>
                        <tr>
                          <td colSpan={4} className="px-3 py-1.5 text-right text-[var(--c-text-3)]">Envío</td>
                          <td className="px-3 py-1.5 text-right text-[var(--c-text-2)]">{formatCOP(data.shippingTotal)}</td>
                        </tr>
                      </>
                    )}
                    <tr>
                      <td colSpan={4} className="px-3 py-2 text-right font-semibold text-[var(--c-text-3)]">Total</td>
                      <td className="px-3 py-2 text-right font-bold text-[var(--c-text)] text-base">{formatCOP(data.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Section>

            {/* Pago */}
            {data.payment && (
              <Section title="Pago">
                <KV label="Pasarela" value={data.payment.provider} />
                {data.payment.externalId && <KV label="ID transacción" value={data.payment.externalId} mono />}
                <KV label="Procesado" value={formatDateTime(data.payment.createdAt)} />
              </Section>
            )}

            {/* Footer de acciones */}
            <div className="flex justify-between items-center gap-3 pt-4 border-t border-[var(--c-border)]">
              <a
                href={`/api/orders/${orderId}/comprobante`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[var(--c-info)] hover:underline transition-colors"
              >
                Descargar comprobante PDF
              </a>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

// ── Subcomponentes pequeños ──────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-bold text-[var(--c-text-4)] uppercase tracking-wide mb-2">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function KV({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-3 text-[length:var(--text-body-sm)]">
      <span className="text-[var(--c-text-4)] w-28 shrink-0">{label}</span>
      <span className={`text-[var(--c-text)] ${mono ? 'font-mono text-xs' : ''} break-all`}>{value}</span>
    </div>
  )
}
