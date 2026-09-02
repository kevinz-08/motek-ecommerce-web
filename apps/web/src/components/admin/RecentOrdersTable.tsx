'use client'

import { DataTable, type DataTableColumn } from '@/components/admin/DataTable'
import { OrderStatusBadge } from '@/components/admin/StatusBadge'
import { formatCOP } from '@/lib/format'

export interface RecentOrderRow {
  id: string
  createdAt: Date
  status: string
  /** HOME_DELIVERY | STORE_PICKUP — cambia la operación, no solo el flete. */
  deliveryMethod?: string
  total: number
}

const DELIVERY_LABELS: Record<string, string> = {
  HOME_DELIVERY: 'Domicilio',
  STORE_PICKUP: 'Retiro',
}

export function RecentOrdersTable({ orders, className }: { orders: RecentOrderRow[]; className?: string }) {
  const columns: DataTableColumn<RecentOrderRow>[] = [
    {
      key: 'id',
      header: 'Pedido',
      cell: (o) => <span className="font-mono text-xs tracking-wider text-[var(--c-text)]">#{o.id.slice(-8).toUpperCase()}</span>,
    },
    {
      key: 'createdAt',
      header: 'Fecha',
      hideBelowLg: true,
      cell: (o) => new Date(o.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }),
    },
    {
      key: 'deliveryMethod',
      header: 'Entrega',
      hideBelowLg: true,
      cell: (o) => (o.deliveryMethod ? (DELIVERY_LABELS[o.deliveryMethod] ?? o.deliveryMethod) : '—'),
    },
    { key: 'status', header: 'Estado', cell: (o) => <OrderStatusBadge status={o.status} /> },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      cell: (o) => <span className="font-semibold text-[var(--c-text)] tabular-nums">{formatCOP(o.total)}</span>,
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={orders}
      rowKey={(o) => o.id}
      emptyMessage="Sin pedidos aún"
      className={className}
    />
  )
}
