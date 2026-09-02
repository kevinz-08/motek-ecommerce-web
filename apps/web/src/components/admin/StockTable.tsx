'use client'

import { DataTable, type DataTableColumn } from '@/components/admin/DataTable'
import { StockUpdateForm } from '@/components/admin/StockUpdateForm'

export interface LowStockRow {
  id: string
  name: string
  sku: string
  stock: number
}

export function StockTable({ products }: { products: LowStockRow[] }) {
  const columns: DataTableColumn<LowStockRow>[] = [
    {
      key: 'name',
      header: 'Producto',
      className: 'max-w-xs',
      cell: (p) => <p className="line-clamp-1 font-medium text-[var(--c-text)]">{p.name}</p>,
    },
    {
      key: 'sku',
      header: 'SKU',
      cell: (p) => <span className="font-mono text-xs text-[var(--c-text-3)]">{p.sku}</span>,
    },
    {
      key: 'stock',
      header: 'Stock actual',
      align: 'center',
      cell: (p) => (
        <span className={`font-bold text-lg ${p.stock === 0 ? 'text-[var(--c-danger)]' : 'text-[var(--c-warning)]'}`}>
          {p.stock}
        </span>
      ),
    },
    {
      key: 'update',
      header: 'Actualizar stock',
      cell: (p) => <StockUpdateForm productId={p.id} currentStock={p.stock} />,
    },
  ]

  return <DataTable columns={columns} rows={products} rowKey={(p) => p.id} />
}
