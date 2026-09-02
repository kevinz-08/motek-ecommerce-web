'use client'

import Link from 'next/link'
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable'
import { DeleteProductButton } from '@/components/admin/DeleteProductButton'
import { formatCOP } from '@/lib/format'

export interface ProductRow {
  id: string
  name: string
  sku: string
  price: number
  stock: number
  isActive: boolean
  categoryId: string | null
}

export interface ProductCategoryOption {
  id: string
  name: string
}

export function ProductosTable({
  products,
  categories,
  emptyMessage,
}: {
  products: ProductRow[]
  categories: ProductCategoryOption[]
  emptyMessage?: string
}) {
  const columns: DataTableColumn<ProductRow>[] = [
    {
      key: 'name',
      header: 'Producto',
      className: 'max-w-[240px]',
      cell: (p) => <p className="truncate font-medium text-[var(--c-text)]">{p.name}</p>,
    },
    {
      key: 'sku',
      header: 'SKU',
      hideBelowLg: true,
      cell: (p) => <span className="font-mono text-xs text-[var(--c-text-3)] tracking-wider">{p.sku}</span>,
    },
    {
      key: 'category',
      header: 'Categoría',
      hideBelowLg: true,
      cell: (p) => categories.find((c) => c.id === p.categoryId)?.name ?? '—',
    },
    {
      key: 'price',
      header: 'Precio',
      align: 'right',
      cell: (p) => <span className="font-semibold text-[var(--c-text)] tabular-nums">{formatCOP(p.price)}</span>,
    },
    {
      key: 'stock',
      header: 'Stock',
      align: 'center',
      cell: (p) => (
        <span
          className={`font-bold tabular-nums ${
            p.stock === 0 ? 'text-[var(--c-danger)]' : p.stock <= 5 ? 'text-[var(--c-warning)]' : 'text-[var(--c-text-2)]'
          }`}
        >
          {p.stock}
        </span>
      ),
    },
    {
      key: 'isActive',
      header: 'Estado',
      align: 'center',
      cell: (p) => (
        <span
          aria-label={p.isActive ? 'Activo' : 'Inactivo'}
          className={`inline-block w-1.5 h-1.5 rounded-full ${p.isActive ? 'bg-[var(--c-success)]' : 'bg-[var(--c-text-4)]'}`}
        />
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (p) => (
        <span className="flex items-center justify-end gap-3">
          <DeleteProductButton id={p.id} name={p.name} />
          <Link href={`/admin/productos/${p.id}`} className="text-xs text-[var(--c-text-3)] hover:text-[var(--c-text)] transition-colors font-medium">
            Editar →
          </Link>
        </span>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={products}
      rowKey={(p) => p.id}
      className="[&_tbody_tr]:group"
      emptyMessage={emptyMessage}
    />
  )
}
