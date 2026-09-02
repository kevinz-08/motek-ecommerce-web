import { PrismaProductRepository } from '@/infrastructure/repositories/PrismaProductRepository'
import { AdminHelpButton } from '@/components/admin/AdminHelpButton'
import { stockHelpContent } from '@/components/admin/help-content/stock'
import { StockTable } from '@/components/admin/StockTable'

export default async function AdminStockPage() {
  const repo = new PrismaProductRepository()
  const lowStockProducts = await repo.findLowStock(5)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--c-text)] tracking-tight">Stock bajo</h1>
        <AdminHelpButton content={stockHelpContent} />
      </div>

      <p className="text-[length:var(--text-body-sm)] text-[var(--c-text-3)] mb-6">
        Productos con{' '}
        <span className="font-semibold text-[var(--c-danger)]">5 o menos unidades</span> en stock.
      </p>

      {lowStockProducts.length === 0 ? (
        <div className="bg-[var(--c-success-bg)] border border-[var(--c-success)]/20 rounded-[var(--radius-lg)] p-8 text-center">
          <p className="text-[var(--c-success)] font-medium">Todo el inventario está en niveles normales</p>
        </div>
      ) : (
        <StockTable products={lowStockProducts} />
      )}
    </div>
  )
}
