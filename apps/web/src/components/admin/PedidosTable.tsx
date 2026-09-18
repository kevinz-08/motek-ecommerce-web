'use client'

import { Download } from 'lucide-react'
import { OrderStatus } from '@motek/domain'
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable'
import { OrderStatusBadge } from '@/components/admin/StatusBadge'
import { OrderStatusSelect } from '@/components/admin/OrderStatusSelect'
import { OrderInfoModal } from '@/components/admin/OrderInfoModal'
import { formatCOP } from '@/lib/format'

const PROVIDER_LABELS: Record<string, string> = {
  WOMPI: 'Wompi',
  MERCADO_PAGO: 'Mercado Pago',
  COD: 'Contra entrega',
}

export interface OrderRow {
  id: string
  createdAt: Date
  status: string
  total: number
  shippingTotal: number
  paymentProvider: string
  /** Email de contacto del pedido — presente tanto para registrados como invitados. */
  contactEmail: string
  /** true = compra sin cuenta. Se muestra como badge para no confundirlo con un cliente registrado. */
  isGuest: boolean
}

export function PedidosTable({ orders }: { orders: OrderRow[] }) {
  const columns: DataTableColumn<OrderRow>[] = [
    {
      key: 'id',
      header: 'Pedido',
      cell: (o) => <span className="font-mono font-medium text-[var(--c-text)]">#{o.id.slice(-8).toUpperCase()}</span>,
    },
    {
      key: 'createdAt',
      header: 'Fecha',
      hideBelowLg: true,
      cell: (o) => new Date(o.createdAt).toLocaleDateString('es-CO'),
    },
    {
      key: 'cliente',
      header: 'Cliente',
      hideBelowLg: true,
      cell: (o) => (
        <div className="min-w-0">
          <span className="block truncate text-xs text-[var(--c-text-3)]">{o.contactEmail}</span>
          {o.isGuest && (
            <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-[var(--c-surface-hover)] text-[var(--c-text-4)]">
              Invitado
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'provider',
      header: 'Pasarela',
      hideBelowLg: true,
      cell: (o) => <span className="text-xs font-medium text-[var(--c-text-3)]">{PROVIDER_LABELS[o.paymentProvider] ?? o.paymentProvider}</span>,
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      cell: (o) => (
        <>
          <span className="font-bold text-[var(--c-text)]">{formatCOP(o.total)}</span>
          {o.shippingTotal > 0 && (
            <span className="block text-xs font-normal text-[var(--c-text-4)]">incl. envío {formatCOP(o.shippingTotal)}</span>
          )}
        </>
      ),
    },
    { key: 'status', header: 'Estado', align: 'center', cell: (o) => <OrderStatusBadge status={o.status} /> },
    {
      key: 'change-status',
      header: 'Cambiar estado',
      cell: (o) => <OrderStatusSelect orderId={o.id} currentStatus={o.status as OrderStatus} />,
    },
    {
      key: 'actions',
      header: 'Acciones',
      align: 'center',
      cell: (o) => (
        <div className="flex items-center justify-center gap-2">
          <OrderInfoModal orderId={o.id} />
          <a
            href={`/api/orders/${o.id}/comprobante`}
            target="_blank"
            rel="noopener noreferrer"
            title="Descargar comprobante de venta"
            className="inline-flex items-center justify-center w-8 h-8 rounded-[var(--radius-md)] bg-[var(--c-info-bg)] text-[var(--c-info)] hover:brightness-95 transition-colors"
          >
            <Download className="w-4 h-4" />
          </a>
        </div>
      ),
    },
  ]

  return <DataTable columns={columns} rows={orders} rowKey={(o) => o.id} emptyMessage="No hay pedidos" />
}
