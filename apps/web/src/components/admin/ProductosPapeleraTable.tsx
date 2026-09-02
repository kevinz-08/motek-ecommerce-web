'use client'

import type { ReactNode } from 'react'
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable'
import { RestoreProductButton } from '@/components/admin/RestoreProductButton'
import { formatCOP, formatDateShort } from '@/lib/format'

export interface DeletedProductRow {
  id: string
  name: string
  sku: string
  price: number
  deletedAt?: Date | null
}

export function ProductosPapeleraTable({ products, emptyMessage }: { products: DeletedProductRow[]; emptyMessage?: ReactNode }) {
  const columns: DataTableColumn<DeletedProductRow>[] = [
    {
      key: 'name',
      header: 'Producto',
      className: 'max-w-[260px]',
      cell: (p) => <p className="truncate font-medium text-[var(--c-text-2)]">{p.name}</p>,
    },
    {
      key: 'sku',
      header: 'SKU',
      cell: (p) => <span className="font-mono text-xs text-[var(--c-text-4)] tracking-wider">{p.sku}</span>,
    },
    {
      key: 'price',
      header: 'Precio',
      align: 'right',
      cell: (p) => <span className="font-semibold text-[var(--c-text-3)] tabular-nums">{formatCOP(p.price)}</span>,
    },
    {
      key: 'deletedAt',
      header: 'Eliminado el',
      cell: (p) => <span className="text-[var(--c-text-4)] text-xs">{formatDateShort(p.deletedAt)}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (p) => <RestoreProductButton id={p.id} name={p.name} />,
    },
  ]

  return <DataTable columns={columns} rows={products} rowKey={(p) => p.id} emptyMessage={emptyMessage} />
}
