import Link from 'next/link'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { PrismaProductRepository } from '@/infrastructure/repositories/PrismaProductRepository'
import { ProductosPapeleraTable } from '@/components/admin/ProductosPapeleraTable'

export default async function PapeleraProductosPage() {
  const repo = new PrismaProductRepository()
  const items = await repo.findDeleted()

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--c-text-3)] uppercase mb-1">
            Catálogo
          </p>
          <h1 className="text-2xl font-bold text-[var(--c-text)] tracking-tight">Papelera de productos</h1>
          <p className="text-[length:var(--text-body-sm)] text-[var(--c-text-3)] mt-1">
            {items.length === 0
              ? 'No hay productos eliminados'
              : `${items.length} producto${items.length === 1 ? '' : 's'} en la papelera`}
          </p>
        </div>
        <Link
          href="/admin/productos"
          className="flex items-center gap-2 text-[length:var(--text-body-sm)] text-[var(--c-text-3)] hover:text-[var(--c-text)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a productos
        </Link>
      </div>

      {/* ── Tabla ──────────────────────────────────────────────────────── */}
      <ProductosPapeleraTable
        products={items}
        emptyMessage={
          <div className="py-4">
            <Trash2 className="w-8 h-8 text-[var(--c-text-4)] mx-auto mb-3" />
            <p className="text-[var(--c-text-4)]">La papelera está vacía</p>
          </div>
        }
      />
    </div>
  )
}
