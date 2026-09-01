const STATUS_MAP = {
  PENDING:   { label: 'Pendiente de pago', className: 'bg-amber-400/15 text-amber-400 ring-amber-400/30' },
  PAID:      { label: 'Pago confirmado',   className: 'bg-green-400/15 text-green-400 ring-green-400/30' },
  SHIPPED:   { label: 'En camino',         className: 'bg-sky-400/15 text-sky-400 ring-sky-400/30' },
  DELIVERED: { label: 'Entregado',         className: 'bg-emerald-400/15 text-emerald-400 ring-emerald-400/30' },
  CANCELLED: { label: 'Cancelado',         className: 'bg-red-400/15 text-red-400 ring-red-400/30' },
} as const

type OrderStatus = keyof typeof STATUS_MAP

interface OrderStatusBadgeProps {
  status: string
}

export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  const config = STATUS_MAP[status as OrderStatus] ?? STATUS_MAP.PENDING
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ${config.className}`}>
      {config.label}
    </span>
  )
}
