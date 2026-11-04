/**
 * Deja un solo producto por categoría y borra DEFINITIVAMENTE el resto.
 *
 * Por defecto es una SIMULACIÓN: lista qué se conserva y qué se borraría, y no toca nada.
 * Para borrar de verdad hay que pasar `--confirmar`.
 *
 * Criterio del producto que se conserva en cada categoría (en este orden):
 *   1. activo y no borrado (deletedAt null)
 *   2. con stock > 0
 *   3. el más recientemente creado
 *
 * Borra los productos sobrantes (incluidos los de la papelera) con todo lo que cuelga de
 * ellos por cascada (compatibilidad de motos, descripción estructurada, historial de
 * precios, relación con cupones). `OrderItem` NO tiene cascada hacia Product, así que si
 * un producto sobrante tiene pedidos el script se niega a seguir: hay que borrar antes esos
 * pedidos con `limpiar-pedidos-prueba.ts`.
 *
 * NO toca categorías, cupones, pedidos, usuarios ni settings. Las imágenes en Cloudinary de
 * los productos borrados quedan huérfanas (no se eliminan desde acá).
 *
 * Uso (desde la raíz del repo):
 *   pnpm --filter @motek/database exec tsx prisma/limpiar-productos.ts
 *   pnpm --filter @motek/database exec tsx prisma/limpiar-productos.ts --confirmar
 */
import 'dotenv/config'
import { prisma } from '../src/index'

const confirmar = process.argv.slice(2).includes('--confirmar')

const COP = (cents: number) =>
  (cents / 100).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

async function main() {
  const products = await prisma.product.findMany({
    select: {
      id: true, name: true, sku: true, price: true, stock: true, isActive: true,
      deletedAt: true, createdAt: true, categoryId: true,
      category: { select: { name: true, parent: { select: { name: true } } } },
      _count: { select: { orderItems: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Un ganador por categoría: activo y no borrado primero, luego con stock, luego el más reciente.
  const rank = (p: (typeof products)[number]) =>
    (p.isActive && !p.deletedAt ? 2 : 0) + (p.stock > 0 ? 1 : 0)
  const byCategory = new Map<string, typeof products>()
  for (const p of products) byCategory.set(p.categoryId, [...(byCategory.get(p.categoryId) ?? []), p])

  const keep: typeof products = []
  const remove: typeof products = []
  for (const list of byCategory.values()) {
    const sorted = [...list].sort((a, b) => rank(b) - rank(a) || b.createdAt.getTime() - a.createdAt.getTime())
    keep.push(sorted[0]!)
    remove.push(...sorted.slice(1))
  }

  const catLabel = (p: (typeof products)[number]) =>
    p.category.parent ? `${p.category.parent.name} › ${p.category.name}` : p.category.name

  console.log(`\n${products.length} producto(s) en ${byCategory.size} categoría(s) con productos.\n`)
  console.log(`SE CONSERVAN (${keep.length}):`)
  for (const p of keep.sort((a, b) => catLabel(a).localeCompare(catLabel(b)))) {
    console.log(`  ${catLabel(p).padEnd(40)} ${p.sku.padEnd(22)} stock=${String(p.stock).padStart(4)}  ${COP(p.price).padStart(12)}  ${p.name}`)
  }

  console.log(`\nSE BORRAN (${remove.length}):`)
  for (const p of remove.sort((a, b) => catLabel(a).localeCompare(catLabel(b)))) {
    const flags = [p.deletedAt ? 'papelera' : null, !p.isActive ? 'inactivo' : null, p._count.orderItems ? `${p._count.orderItems} ítem(s) de pedido` : null]
      .filter(Boolean).join(', ')
    console.log(`  ${catLabel(p).padEnd(40)} ${p.sku.padEnd(22)} ${p.name}${flags ? `  [${flags}]` : ''}`)
  }

  const withOrders = remove.filter((p) => p._count.orderItems > 0)
  if (withOrders.length) {
    console.log(`\n${withOrders.length} producto(s) a borrar tienen pedidos: no se pueden borrar hasta eliminar esos pedidos (limpiar-pedidos-prueba.ts).`)
  }

  if (!confirmar) {
    console.log('\nSIMULACIÓN: no se borró nada. Para borrar, repetir con --confirmar.')
    return
  }
  if (withOrders.length) {
    console.error('\nAbortado: hay productos a borrar con pedidos asociados.')
    process.exitCode = 1
    return
  }

  const result = await prisma.product.deleteMany({ where: { id: { in: remove.map((p) => p.id) } } })
  console.log(`\nBorrado completado: ${result.count} producto(s). Quedan ${keep.length}.`)
  console.log('Siguiente paso: invalidar la caché de la tienda (admin) y revisar las imágenes huérfanas en Cloudinary.')
}

main()
  .catch((e) => {
    console.error(`\nError: ${e instanceof Error ? e.message : e}`)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
