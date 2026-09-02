'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Package, Tag, ShoppingBag,
  AlertTriangle, Settings, RefreshCcw, Image, Ticket, Trash2,
} from 'lucide-react'

const navItems = [
  { href: '/admin',                           label: 'Dashboard',     Icon: LayoutDashboard },
  { href: '/admin/productos',                 label: 'Productos',     Icon: Package },
  { href: '/admin/productos/papelera',        label: 'Papelera',      Icon: Trash2 },
  { href: '/admin/categorias',                label: 'Categorías',    Icon: Tag },
  { href: '/admin/banners',                   label: 'Banners',       Icon: Image },
  { href: '/admin/cupones',                   label: 'Cupones',       Icon: Ticket },
  { href: '/admin/pedidos',                   label: 'Pedidos',       Icon: ShoppingBag },
  { href: '/admin/stock',                     label: 'Stock bajo',    Icon: AlertTriangle },
  { href: '/admin/sync',                      label: 'Sincronizar',   Icon: RefreshCcw },
  { href: '/admin/configuracion',             label: 'Configuración', Icon: Settings },
]

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="flex-1 px-3 space-y-0.5 max-md:px-2" aria-label="Navegación del panel admin">
      {navItems.map(({ href, label, Icon }) => {
        const isActive =
          href === '/admin'
            ? pathname === '/admin'
            : href === '/admin/productos'
            ? pathname.startsWith('/admin/productos') && !pathname.startsWith('/admin/productos/papelera')
            : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            title={label}
            aria-current={isActive ? 'page' : undefined}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] text-[length:var(--text-body-sm)] transition-colors duration-[var(--dur-hover)] max-md:justify-center ${
              isActive
                ? 'bg-[var(--c-active-bg)] text-[var(--c-active-text)] font-medium'
                : 'text-[var(--c-text-3)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-hover)]'
            }`}
          >
            <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[var(--c-active-text)]' : 'text-[var(--c-text-4)]'}`} />
            <span className="max-md:hidden">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
