'use client'

import type { KeyboardEvent, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface DataTableColumn<T> {
  key: string
  header: string
  align?: 'left' | 'right' | 'center'
  cell: (row: T) => ReactNode
  className?: string
  /** Oculta la columna en tablet/móvil (<lg) para densidad; usar solo en columnas no críticas. */
  hideBelowLg?: boolean
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  emptyMessage?: ReactNode
  onRowClick?: (row: T) => void
  className?: string
}

const ALIGN_CLASSES = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
} as const

/**
 * Tabla de datos del admin: headers semánticos (scope="col"), fila clicable
 * accesible por teclado (Enter/Espacio), y contenedor con scroll propio en
 * lugar de romper el layout (brief §9.3 — excepción de tablas densas de admin).
 */
export function DataTable<T>({ columns, rows, rowKey, emptyMessage, onRowClick, className }: DataTableProps<T>) {
  function handleRowKeyDown(e: KeyboardEvent<HTMLTableRowElement>, row: T) {
    if (!onRowClick) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onRowClick(row)
    }
  }

  return (
    <div className={cn('overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--c-border)] bg-[var(--c-surface)]', className)}>
      <table className="w-full text-[length:var(--text-body-sm)]">
        <thead>
          <tr className="border-b border-[var(--c-border)]">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  'px-4 py-3 font-semibold uppercase tracking-wide text-[11px] text-[var(--c-text-3)]',
                  ALIGN_CLASSES[col.align ?? 'left'],
                  col.hideBelowLg && 'hidden lg:table-cell',
                  col.className,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-16 text-center text-[var(--c-text-3)]">
                {emptyMessage ?? 'Sin registros'}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                tabIndex={onRowClick ? 0 : undefined}
                role={onRowClick ? 'button' : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (e) => handleRowKeyDown(e, row) : undefined}
                className={cn(
                  'border-b border-[var(--c-divider)] last:border-0 transition-colors duration-[var(--dur-hover)]',
                  onRowClick && 'cursor-pointer hover:bg-[var(--c-surface-hover)] focus-visible:bg-[var(--c-surface-hover)]',
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-4 py-3 text-[var(--c-text-2)]',
                      ALIGN_CLASSES[col.align ?? 'left'],
                      col.hideBelowLg && 'hidden lg:table-cell',
                      col.className,
                    )}
                  >
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
