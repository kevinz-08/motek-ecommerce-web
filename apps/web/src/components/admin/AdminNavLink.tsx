'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LucideIcon } from 'lucide-react'

interface AdminNavLinkProps {
  href: string
  Icon: LucideIcon
  children: React.ReactNode
}

export function AdminNavLink({ href, Icon, children }: AdminNavLinkProps) {
  const pathname = usePathname()
  // Dashboard solo es exacto; el resto activa si el pathname empieza con el href
  const isActive = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
        isActive
          ? 'bg-white/[0.07] text-white font-medium'
          : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
      }`}
    >
      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-white/30'}`} />
      {children}
    </Link>
  )
}
