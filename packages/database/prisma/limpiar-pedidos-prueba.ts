/**
 * Borra los pedidos de prueba antes del lanzamiento a producción.
 *
 * Por defecto es una SIMULACIÓN: lista lo que se borraría y no toca nada.
 * Para borrar de verdad hay que pasar `--confirmar`.
 *
 * Borra, en una sola transacción y en este orden:
 *   1. EmailQueue y VendeloOrderQueue de esos pedidos (solo guardan orderId, sin FK)
 *   2. Payment (su FK a Order no tiene cascada)
 *   3. Order (OrderItem y Shipment se borran en cascada)
 *   4. GuestCustomer que queden sin pedidos
 *   5. El cliente de prueba del seed (`cliente@ejemplo.co`, contraseña pública en
 *      seed.ts) — sus cuentas/sesiones/OTP se borran en cascada
 *
 * NO toca productos, categorías, cupones, settings ni ningún otro usuario.
 *
 * Importante: los pedidos de prueba que se pagaron descontaron stock, y borrarlos
 * NO lo repone. El script muestra las unidades descontadas por producto; después
 * de borrar, resincronizar el inventario real desde /admin (sincronización de stock).
 * Los pedidos que llegaron a Vendelo (vendeloOrderId) siguen existiendo allá:
 * anularlos desde el panel de Vendelo.
 *
 * Uso (desde la raíz del repo):
 *   pnpm --filter @motek/database exec tsx prisma/limpiar-pedidos-prueba.ts
 *   pnpm --filter @motek/database exec tsx prisma/limpiar-pedidos-prueba.ts --hasta=2026-10-28
 *   pnpm --filter @motek/database exec tsx prisma/limpiar-pedidos-prueba.ts --confirmar
 *
 * `--hasta=YYYY-MM-DD` limita a pedidos creados ANTES de esa fecha (default: todos).
 */
import 'dotenv/config'
import { prisma } from '../src/index'

/** Usuarios creados por prisma/seed.ts con contraseña escrita en el repo. */
const SEED_TEST_USERS = ['cliente@ejemplo.co']

const args = process.argv.slice(2)
const confirmar = args.includes('--confirmar')
const hastaArg = args.find((a) => a.startsWith('--hasta='))?.split('=')[1]
const hasta = hastaArg ? new Date(`${hastaArg}T00:00:00Z`) : null

if (hastaArg && Number.isNaN(hasta?.getTime())) {
  console.error(`Fecha inválida en --hasta: ${hastaArg} (formato YYYY-MM-DD)`)
  process.exit(1)
}

/** a***@dominio.com — el email nunca se imprime completo. */
function maskEmail(email: string): string {
  const [user, domain] = email.split('@')
  return `${user?.slice(0, 1) ?? ''}***@${domain ?? ''}`
}

const COP = (cents: number) =>
  (cents / 100).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

async function main() {
  const where = hasta ? { createdAt: { lt: hasta } } : {}

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      createdAt: true,
      status: true,
      total: true,
      contactEmail: true,
      vendeloOrderId: true,
      items: { select: { quantity: true, product: { select: { name: true, sku: true } } } },
    },
  })

  const seedUsers = await prisma.user.findMany({
    where: { email: { in: SEED_TEST_USERS }, role: 'CUSTOMER' },
    select: { id: true, email: true },
  })

  if (orders.length === 0 && seedUsers.length === 0) {
    console.log('No hay pedidos ni usuarios de prueba que borrar.')
    return
  }
  if (seedUsers.length) {
    console.log(`
Usuario(s) de prueba del seed: ${seedUsers.map((u) => maskEmail(u.email)).join(', ')}`)
  }

  console.log(`\n${orders.length} pedido(s)${hasta ? ` creados antes de ${hastaArg}` : ''}:\n`)
  for (const o of orders) {
    console.log(
      `  #${o.id.slice(-8).toUpperCase()}  ${o.createdAt.toISOString().slice(0, 16)}  `
      + `${o.status.padEnd(9)}  ${COP(o.total).padStart(12)}  ${maskEmail(o.contactEmail)}`
      + `${o.vendeloOrderId ? '  [en Vendelo]' : ''}`,
    )
  }

  // Stock descontado: pedidos que pasaron por un pago aprobado
  const descontado = new Map<string, number>()
  for (const o of orders.filter((o) => o.status === 'PAID' || o.status === 'SHIPPED' || o.status === 'DELIVERED')) {
    for (const item of o.items) {
      const key = `${item.product.sku} — ${item.product.name}`
      descontado.set(key, (descontado.get(key) ?? 0) + item.quantity)
    }
  }
  if (descontado.size) {
    console.log(
      '\nUnidades vendidas en pedidos pagados. Si se pagaron por la pasarela, descontaron stock y'
      + '\nborrarlos NO lo repone (los creados por prisma/seed.ts no descontaron nada):',
    )
    for (const [producto, unidades] of descontado) console.log(`  ${String(unidades).padStart(4)}  ${producto}`)
  }

  const enVendelo = orders.filter((o) => o.vendeloOrderId).length
  if (enVendelo) {
    console.log(`\n${enVendelo} pedido(s) existen también en Vendelo: anularlos desde el panel de Vendelo.`)
  }

  const ids = orders.map((o) => o.id)

  if (!confirmar) {
    console.log('\nSIMULACIÓN: no se borró nada. Para borrar, repetir con --confirmar.')
    return
  }

  const result = await prisma.$transaction(async (tx) => {
    const emailQueue = await tx.emailQueue.deleteMany({ where: { orderId: { in: ids } } })
    const vendeloQueue = await tx.vendeloOrderQueue.deleteMany({ where: { orderId: { in: ids } } })
    const payments = await tx.payment.deleteMany({ where: { orderId: { in: ids } } })
    const deletedOrders = await tx.order.deleteMany({ where: { id: { in: ids } } })
    const guests = await tx.guestCustomer.deleteMany({ where: { orders: { none: {} } } })
    // Solo si ya no tiene pedidos (los de prueba se borraron arriba)
    const users = await tx.user.deleteMany({
      where: { id: { in: seedUsers.map((u) => u.id) }, orders: { none: {} } },
    })
    return { emailQueue, vendeloQueue, payments, deletedOrders, guests, users }
  }, { timeout: 60_000 })

  console.log('\nBorrado completado:')
  console.log(`  Pedidos:            ${result.deletedOrders.count} (con sus ítems y envíos)`)
  console.log(`  Pagos:              ${result.payments.count}`)
  console.log(`  Cola de correos:    ${result.emailQueue.count}`)
  console.log(`  Cola de Vendelo:    ${result.vendeloQueue.count}`)
  console.log(`  Invitados sin pedidos: ${result.guests.count}`)
  console.log(`  Usuarios de prueba: ${result.users.count}`)
  console.log('\nSiguiente paso: resincronizar el stock real desde /admin.')
}

main()
  .catch((e) => {
    console.error(`\nError: ${e instanceof Error ? e.message : e}`)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
