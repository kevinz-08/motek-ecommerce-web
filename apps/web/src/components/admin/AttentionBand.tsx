import Link from 'next/link'
import { ShoppingBag, AlertTriangle, Clock, ArrowRight } from 'lucide-react'
import type { AttentionCounts } from '@/infrastructure/repositories/PrismaDashboardRepository'

/**
 * Lo accionable, antes que lo analítico.
 *
 * Va arriba de los KPIs a propósito: quien abre el panel varias veces al día
 * entra a resolver, no a analizar. Cada chip lleva directo a la pantalla donde
 * se resuelve, y la banda entera desaparece cuando no hay nada pendiente — un
 * cero permanente enseña a ignorar la fila.
 *
 * No se acota al rango: un pedido sin despachar de hace dos meses sigue sin
 * despacharse.
 */
export function AttentionBand({ counts }: { counts: AttentionCounts }) {
  const items = [
    {
      show: counts.paidNotShipped > 0,
      href: '/admin/pedidos',
      Icon: ShoppingBag,
      tone: 'text-[var(--c-warning)]',
      text: `${counts.paidNotShipped} ${counts.paidNotShipped === 1 ? 'pedido pagado sin despachar' : 'pedidos pagados sin despachar'}`,
    },
    {
      show: counts.outOfStock > 0,
      href: '/admin/stock',
      Icon: AlertTriangle,
      tone: 'text-[var(--c-danger)]',
      text: `${counts.outOfStock} ${counts.outOfStock === 1 ? 'producto agotado' : 'productos agotados'}`,
    },
    {
      show: counts.couponsExpiringSoon > 0,
      href: '/admin/cupones',
      Icon: Clock,
      tone: 'text-[var(--c-text-3)]',
      text: `${counts.couponsExpiringSoon} ${counts.couponsExpiringSoon === 1 ? 'cupón vence' : 'cupones vencen'} esta semana`,
    },
  ].filter((item) => item.show)

  if (items.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 transition-colors hover:border-[var(--c-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--c-accent)]"
        >
          <item.Icon className={`h-3.5 w-3.5 shrink-0 ${item.tone}`} aria-hidden="true" />
          <span className="text-[length:var(--text-body-sm)] text-[var(--c-text-2)]">{item.text}</span>
          <ArrowRight className="h-3 w-3 shrink-0 text-[var(--c-text-4)]" aria-hidden="true" />
        </Link>
      ))}
    </div>
  )
}
