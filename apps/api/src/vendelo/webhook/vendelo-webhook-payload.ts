import type { ShipmentStatus, TrackingStatus } from '@motek/domain'

/**
 * Normalización del payload del webhook del Chatbot Connection de Venndelo.
 *
 * **Por qué tolerante:** el spec OpenAPI documenta los eventos y el formato de
 * los pedidos (ApiOrder / ApiOrderShipment), pero NO la forma del sobre del
 * webhook. Hasta tener un payload real, el parser acepta las variantes
 * razonables y nunca lanza:
 *   - evento en `event` | `type` | `event_type`
 *   - pedido en `data` | `data.order` | `order` | raíz
 *   - envío con `carrier_name`/`carrier_code` (spec) o `carrier` (legado)
 *
 * Cuando llegue el primer webhook real, `describeShape()` deja en logs su
 * estructura (solo claves y tipos, sin valores) para fijar el contrato.
 */

export const VENDELO_WEBHOOK_EVENTS = [
  'ORDER_CREATED',
  'ORDER_CANCELLED',
  'ORDER_CONFIRMATION_REQUESTED',
  'ORDER_PREPARED',
  'ORDER_READY_FOR_PICKUP',
  'ORDER_SHIPPED',
  'ORDER_DELIVERED',
  'SHIPMENT_EXCEPTION_CREATED',
  'SHIPMENT_STATUS_UPDATED',
] as const

export type VendeloWebhookEvent = (typeof VENDELO_WEBHOOK_EVENTS)[number]

const SHIPMENT_STATUSES: ReadonlySet<string> = new Set<ShipmentStatus>([
  'PENDING', 'READY', 'PREPARING', 'SHIPPED', 'INCIDENT', 'DELIVERED', 'RETURNED', 'CANCELLED',
])

const TRACKING_STATUSES: ReadonlySet<string> = new Set<TrackingStatus>([
  'IN-ORIGIN', 'IN-DESTINATION', 'OUT-FOR-DELIVERY', 'DELIVERED', 'RETURN',
  'TRANSIT', 'PENDING', 'READY', 'INCIDENT', 'UNKNOWN', 'AT-COLLECTION-POINT',
])

/** Eventos de pedido cuyo efecto en el envío es inequívoco. */
const EVENT_TO_STATUS: Partial<Record<VendeloWebhookEvent, ShipmentStatus>> = {
  ORDER_PREPARED:             'PREPARING',
  ORDER_READY_FOR_PICKUP:     'READY',
  ORDER_SHIPPED:              'SHIPPED',
  ORDER_DELIVERED:            'DELIVERED',
  ORDER_CANCELLED:            'CANCELLED',
  SHIPMENT_EXCEPTION_CREATED: 'INCIDENT',
}

/**
 * Estado fino de la transportadora → estado del envío, para
 * SHIPMENT_STATUS_UPDATED cuando no viene el estado del pedido.
 * `RETURN` (devolución EN CURSO), `PENDING` y `UNKNOWN` no se mapean a
 * propósito: RETURNED es terminal y repone stock, y no debe dispararse
 * antes de que Vendelo marque el pedido como devuelto.
 */
const TRACKING_TO_STATUS: Partial<Record<TrackingStatus, ShipmentStatus>> = {
  'READY':               'READY',
  'IN-ORIGIN':           'SHIPPED',
  'TRANSIT':             'SHIPPED',
  'IN-DESTINATION':      'SHIPPED',
  'OUT-FOR-DELIVERY':    'SHIPPED',
  'AT-COLLECTION-POINT': 'SHIPPED',
  'INCIDENT':            'INCIDENT',
  'DELIVERED':           'DELIVERED',
}

export interface ParsedVendeloWebhook {
  event: VendeloWebhookEvent | null
  /** Valor crudo del evento, aunque no sea uno conocido (para logs). */
  rawEvent: string | null
  /** Nuestro ID de pedido (external_order_id enviado al crear la orden). */
  externalOrderId: string | null
  /** ID del pedido en Vendelo — fallback para resolver el pedido. */
  vendeloOrderId: string | null
  /** Estado de envío al que lleva el evento; null = el evento no cambia el estado. */
  targetStatus: ShipmentStatus | null
  trackingNumber: string | null
  carrier: string | null
  trackingStatus: TrackingStatus | null
  deliveryAttempts: number | null
  deliveredAt: Date | null
  trackingUpdatedAt: Date | null
}

type Json = Record<string, unknown>

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const date = (v: unknown): Date | null => {
  const s = str(v)
  if (!s) return null
  const ms = Date.parse(s)
  return Number.isNaN(ms) ? null : new Date(ms)
}

/** Primer objeto candidato a ser "el pedido" dentro del sobre. */
function findOrder(payload: Json): Json {
  const data = isObject(payload['data']) ? payload['data'] : null
  const candidates = [data?.['order'], payload['order'], data, payload]
  return (candidates.find((c) => isObject(c) && ('external_order_id' in c || 'shipments' in c || 'status' in c)) as Json | undefined)
    ?? data
    ?? payload
}

function pickShipment(order: Json, payload: Json): Json | null {
  const data = isObject(payload['data']) ? payload['data'] : null
  const lists = [order['shipments'], data?.['shipments']].filter(Array.isArray) as unknown[][]
  const shipments = lists.flat().filter(isObject)
  const single = [order['shipment'], data?.['shipment']].find(isObject) as Json | undefined
  if (single) shipments.push(single)
  if (!shipments.length) return null
  return shipments.find((s) => s['type'] === 'OUTBOUND') ?? shipments[0] ?? null
}

export function parseVendeloWebhook(body: unknown): ParsedVendeloWebhook {
  const payload: Json = isObject(body) ? body : {}
  const rawEvent = str(payload['event']) ?? str(payload['type']) ?? str(payload['event_type'])
  const event = rawEvent && (VENDELO_WEBHOOK_EVENTS as readonly string[]).includes(rawEvent)
    ? (rawEvent as VendeloWebhookEvent)
    : null

  const order = findOrder(payload)
  const shipment = pickShipment(order, payload)

  const orderStatus = str(order['status'])
  const shipmentStatus = str(shipment?.['tracking_status']) ?? str(shipment?.['status'])
  const trackingStatus = shipmentStatus && TRACKING_STATUSES.has(shipmentStatus)
    ? (shipmentStatus as TrackingStatus)
    : null

  return {
    event,
    rawEvent,
    externalOrderId: str(order['external_order_id']) ?? str(payload['external_order_id']),
    vendeloOrderId: str(order['id']) ?? str(order['order_id']) ?? str(payload['order_id']),
    targetStatus: resolveTargetStatus(event, orderStatus, trackingStatus),
    trackingNumber: str(shipment?.['tracking_number']),
    carrier: str(shipment?.['carrier_name']) ?? str(shipment?.['carrier_code']) ?? str(shipment?.['carrier']),
    trackingStatus,
    deliveryAttempts: num(shipment?.['delivery_attempts']),
    deliveredAt: date(shipment?.['delivery_date']),
    trackingUpdatedAt: date(shipment?.['tracking_date']),
  }
}

function resolveTargetStatus(
  event: VendeloWebhookEvent | null,
  orderStatus: string | null,
  trackingStatus: TrackingStatus | null,
): ShipmentStatus | null {
  if (!event) return null
  const fromEvent = EVENT_TO_STATUS[event]
  if (fromEvent) return fromEvent
  if (event !== 'SHIPMENT_STATUS_UPDATED') return null // ORDER_CREATED, ORDER_CONFIRMATION_REQUESTED

  // El estado del pedido (mismo enum que ShipmentStatus) es la fuente más fiable;
  // si no viene, se deriva del estado fino de la transportadora.
  if (orderStatus && SHIPMENT_STATUSES.has(orderStatus)) return orderStatus as ShipmentStatus
  return trackingStatus ? TRACKING_TO_STATUS[trackingStatus] ?? null : null
}

/**
 * Estructura del payload SIN valores: rutas de claves con su tipo. Seguro para
 * logs — no expone datos personales ni el secreto de metadata. Ej:
 *   ["event:string", "data.external_order_id:string", "data.shipments[]:object", ...]
 */
export function describeShape(value: unknown, prefix = '', depth = 0, out: string[] = []): string[] {
  if (depth > 6 || out.length > 200) return out
  if (Array.isArray(value)) {
    out.push(`${prefix}[]:${value.length ? (isObject(value[0]) ? 'object' : typeof value[0]) : 'empty'}`)
    if (isObject(value[0])) describeShape(value[0], `${prefix}[]`, depth + 1, out)
    return out
  }
  if (isObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${key}` : key
      if (isObject(child) || Array.isArray(child)) describeShape(child, path, depth + 1, out)
      else out.push(`${path}:${child === null ? 'null' : typeof child}`)
    }
    return out
  }
  out.push(`${prefix || '(root)'}:${value === null ? 'null' : typeof value}`)
  return out
}
