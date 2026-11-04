'use client'

/**
 * Sección "Guía Vendelo" del modal de detalle de pedido (`/admin/pedidos`).
 *
 * Expone el estado consolidado del despacho (cola → pedido en Vendelo → guía) y
 * las acciones correctivas. Sin esto, un despacho fallido solo se notaba por una
 * alerta en stderr, y la guía (create-shipments + generate-labels) no se podía
 * pedir desde el panel.
 *
 * La máquina de estados vive en el servidor (`actions` viene calculado desde
 * NestJS): acá solo se decide qué renderizar según esos flags.
 */

import { useCallback, useEffect, useState } from 'react'
import { Badge, type BadgeVariant } from '@/components/ui/Badge'

interface ShippingStatus {
  orderId: string
  deliveryMethod: 'HOME_DELIVERY' | 'STORE_PICKUP'
  orderStatus: string
  vendeloOrderId: string | null
  queue: {
    status: string
    attempts: number
    maxAttempts: number
    lastError: string | null
    nextRetry: string
  } | null
  shipment: {
    status: string
    trackingNumber: string | null
    carrier: string | null
    labelUrl: string | null
    updatedAt: string
  } | null
  actions: {
    canRequeue: boolean
    canCreateShipment: boolean
    canGenerateLabel: boolean
  }
}

type Busy = 'requeue' | 'shipment' | null

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  PENDING: 'warning',
  PROCESSING: 'info',
  SENT: 'success',
  FAILED: 'danger',
  CANCELLED: 'danger',
  READY: 'info',
  PREPARING: 'info',
  SHIPPED: 'info',
  DELIVERED: 'success',
  INCIDENT: 'warning',
  RETURNED: 'danger',
}

function formatDateTime(d: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(d))
}

async function fetchStatus(orderId: string): Promise<ShippingStatus> {
  const res = await fetch(`/api/admin/vendelo/orders/${orderId}`, { cache: 'no-store' })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
  return body as ShippingStatus
}

export function VendeloGuiaSection({ orderId }: { orderId: string }) {
  const [data, setData] = useState<ShippingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<Busy>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // `cancelled` evita escribir estado si el admin cierra el modal antes de que responda la API.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const status = await fetchStatus(orderId)
        if (!cancelled) setData(status)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error desconocido')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [orderId])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await fetchStatus(orderId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [orderId])

  /** Dispara una acción y recarga el estado — el servidor es la fuente de verdad. */
  const runAction = useCallback(
    async (kind: Exclude<Busy, null>, path: string, okMessage: string) => {
      setBusy(kind)
      setError(null)
      setNotice(null)
      try {
        const res = await fetch(`/api/admin/vendelo/orders/${orderId}${path}`, { method: 'POST' })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
        setNotice(okMessage)
        await load()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error desconocido')
      } finally {
        setBusy(null)
      }
    },
    [orderId, load],
  )

  if (loading && !data) {
    return (
      <Section title="Guía Vendelo">
        <p className="text-[length:var(--text-body-sm)] text-[var(--c-text-4)]">Cargando estado del despacho...</p>
      </Section>
    )
  }

  if (!data) {
    return (
      <Section title="Guía Vendelo">
        <ErrorBox message={error ?? 'No se pudo cargar el estado del despacho.'} />
      </Section>
    )
  }

  const { queue, shipment, actions } = data
  const isPickup = data.deliveryMethod === 'STORE_PICKUP'
  const queueInFlight = queue?.status === 'PENDING' || queue?.status === 'PROCESSING'

  return (
    <Section title="Guía Vendelo">
      <div className="flex flex-wrap gap-2 mb-3">
        {isPickup ? (
          <Badge>Retiro en tienda — sin guía</Badge>
        ) : (
          <>
            {queue ? (
              <Badge variant={STATUS_VARIANT[queue.status] ?? 'neutral'}>
                Cola: {queue.status}
                {queue.status === 'FAILED' || queueInFlight ? ` (${queue.attempts}/${queue.maxAttempts})` : ''}
              </Badge>
            ) : (
              <Badge>Nunca encolado</Badge>
            )}
            {data.vendeloOrderId && <Badge variant="info">Creado en Vendelo</Badge>}
            {shipment && <Badge variant={STATUS_VARIANT[shipment.status] ?? 'neutral'}>Guía: {shipment.status}</Badge>}
          </>
        )}
      </div>

      {isPickup && (
        <p className="text-[length:var(--text-body-sm)] text-[var(--c-text-3)]">
          Este pedido no se despacha por Vendelo: el cliente lo retira en la tienda.
        </p>
      )}

      {!isPickup && (
        <>
          {data.vendeloOrderId && <KV label="ID Vendelo" value={data.vendeloOrderId} mono />}
          {shipment?.trackingNumber && <KV label="Tracking" value={shipment.trackingNumber} mono />}
          {shipment?.carrier && <KV label="Transportador" value={shipment.carrier} />}
          {shipment && <KV label="Actualizado" value={formatDateTime(shipment.updatedAt)} />}
          {queueInFlight && queue && <KV label="Próximo intento" value={formatDateTime(queue.nextRetry)} />}
        </>
      )}

      {queue?.status === 'FAILED' && queue.lastError && (
        <div className="mt-3 bg-[var(--c-danger-bg)] border border-[var(--c-danger)]/30 rounded-[var(--radius-md)] px-3 py-2.5">
          <p className="text-xs font-bold text-[var(--c-danger)] uppercase tracking-wide mb-1">
            El despacho falló tras {queue.attempts} intento(s)
          </p>
          {/* Error crudo de Vendelo a propósito: sin él, diagnosticar exige entrar a la BD. */}
          <p className="text-xs text-[var(--c-danger)] font-mono break-all whitespace-pre-wrap">{queue.lastError}</p>
        </div>
      )}

      {notice && (
        <div className="mt-3 bg-[var(--c-success-bg)] border border-[var(--c-success)]/30 text-[var(--c-success)] text-xs rounded-[var(--radius-md)] px-3 py-2">
          {notice}
        </div>
      )}
      {error && <div className="mt-3"><ErrorBox message={error} /></div>}

      {!isPickup && (
        <div className="flex flex-wrap gap-2 mt-4">
          {actions.canRequeue && (
            <ActionButton
              onClick={() => runAction('requeue', '/requeue', 'Pedido reencolado y enviado a procesar.')}
              busy={busy === 'requeue'}
              tone="danger"
              label="Reintentar envío a Vendelo"
            />
          )}

          {actions.canCreateShipment && (
            <ActionButton
              onClick={() => runAction('shipment', '/shipment', 'Envío solicitado. Vendelo lo crea de forma asincrónica: la guía aparecerá en unos minutos.')}
              busy={busy === 'shipment'}
              tone="primary"
              label="Generar guía"
            />
          )}

          {actions.canGenerateLabel && (
            <>
              <LinkButton href={`/api/admin/vendelo/orders/${orderId}/guia?disposition=inline`} label="Ver guía PDF" tone="primary" />
              <LinkButton href={`/api/admin/vendelo/orders/${orderId}/guia`} label="Descargar guía PDF" tone="neutral" download />
            </>
          )}

          {queueInFlight && (
            <span className="text-xs text-[var(--c-text-4)] self-center">En cola — se reintenta automáticamente.</span>
          )}

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading || busy !== null}
            className="text-xs text-[var(--c-text-3)] hover:text-[var(--c-text)] transition-colors self-center disabled:opacity-40"
          >
            Actualizar
          </button>
        </div>
      )}
    </Section>
  )
}

// ── Subcomponentes ───────────────────────────────────────────────────────────

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

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="bg-[var(--c-danger-bg)] border border-[var(--c-danger)]/30 text-[var(--c-danger)] text-xs rounded-[var(--radius-md)] px-3 py-2 break-all">
      {message}
    </div>
  )
}

const TONE: Record<'primary' | 'danger' | 'neutral', string> = {
  primary: 'bg-[var(--c-info-bg)] text-[var(--c-info)] border-[var(--c-info)]/30 hover:opacity-80',
  danger: 'bg-[var(--c-danger-bg)] text-[var(--c-danger)] border-[var(--c-danger)]/30 hover:opacity-80',
  neutral: 'bg-[var(--c-surface-2)] text-[var(--c-text-2)] border-[var(--c-border)] hover:bg-[var(--c-surface-hover)]',
}

function ActionButton({
  onClick, busy, label, tone,
}: { onClick: () => void; busy: boolean; label: string; tone: keyof typeof TONE }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`text-xs font-medium px-3 py-1.5 rounded-[var(--radius-md)] border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${TONE[tone]}`}
    >
      {busy ? 'Procesando...' : label}
    </button>
  )
}

function LinkButton({
  href, label, tone, download = false,
}: { href: string; label: string; tone: keyof typeof TONE; download?: boolean }) {
  return (
    <a
      href={href}
      target={download ? undefined : '_blank'}
      rel="noopener noreferrer"
      {...(download ? { download: '' } : {})}
      className={`text-xs font-medium px-3 py-1.5 rounded-[var(--radius-md)] border transition-colors ${TONE[tone]}`}
    >
      {label}
    </a>
  )
}
