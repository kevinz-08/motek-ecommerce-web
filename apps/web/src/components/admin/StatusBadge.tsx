import { Badge, type BadgeVariant } from '@/components/ui/Badge'

const ORDER_STATUS_MAP: Record<string, { label: string; variant: BadgeVariant }> = {
  PENDING: { label: 'Pendiente', variant: 'warning' },
  PAID: { label: 'Pagado', variant: 'success' },
  SHIPPED: { label: 'Enviado', variant: 'info' },
  DELIVERED: { label: 'Entregado', variant: 'success' },
  CANCELLED: { label: 'Cancelado', variant: 'danger' },
}

const PAYMENT_STATUS_MAP: Record<string, { label: string; variant: BadgeVariant }> = {
  PENDING: { label: 'Pendiente', variant: 'warning' },
  APPROVED: { label: 'Aprobado', variant: 'success' },
  DECLINED: { label: 'Rechazado', variant: 'danger' },
  VOIDED: { label: 'Anulado', variant: 'neutral' },
  ERROR: { label: 'Error', variant: 'danger' },
}

export function OrderStatusBadge({ status }: { status: string }) {
  const config = ORDER_STATUS_MAP[status] ?? { label: status, variant: 'neutral' as const }
  return <Badge variant={config.variant}>{config.label}</Badge>
}

export function PaymentStatusBadge({ status }: { status: string }) {
  const config = PAYMENT_STATUS_MAP[status] ?? { label: status, variant: 'neutral' as const }
  return <Badge variant={config.variant}>{config.label}</Badge>
}
