import Link from 'next/link'
import type { Metadata } from 'next'
import { auth, signOut } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ArrowUpRight, LogOut } from 'lucide-react'
import { AdminNav } from '@/components/admin/AdminNav'

export const metadata: Metadata = {
  title: {
    default: 'Panel Admin',
    template: '%s · Admin | Motek Store',
  },
  description: 'Panel administrativo de Motek Store.',
  robots: { index: false, follow: false },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const user = session?.user as ({ role?: string } & NonNullable<typeof session>['user'])

  if (!session?.user || user.role !== 'ADMIN') redirect('/')

  const initials = session.user?.name
    ? session.user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : (session.user?.email?.[0] ?? 'A').toUpperCase()

  return (
    /*
     * `theme-dark` es lo que realmente aplica la paleta oscura: `:root` solo
     * matchea <html>, así que el `data-theme` que este <div> llevaba desde el
     * principio nunca enganchó y el panel se renderizaba claro. Se conserva el
     * atributo como marca semántica del contenedor; el color lo pone la clase.
     */
    <div data-theme="dark" className="theme-dark fixed inset-0 flex bg-[var(--c-bg)] overflow-hidden">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="w-[220px] shrink-0 flex flex-col border-r border-[var(--c-border)] md:w-[220px] max-md:w-[72px]">

        {/* Brand */}
        <div className="px-6 pt-7 pb-6 max-md:px-3 max-md:text-center">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--c-text-3)] uppercase mb-1 max-md:hidden">
            Admin Panel
          </p>
          <Link href="/" className="text-[var(--c-text)] font-bold text-sm leading-tight hover:text-[var(--c-text-2)] transition-colors max-md:hidden">
            Motek Store
          </Link>
          <Link href="/" className="hidden max-md:block text-[var(--c-text)] font-bold text-sm">
            M
          </Link>
        </div>

        {/* Nav */}
        <AdminNav />

        {/* Footer */}
        <div className="px-4 py-5 border-t border-[var(--c-border)] space-y-4 max-md:px-2">
          {/* Avatar + email */}
          <div className="flex items-center gap-3 max-md:justify-center">
            <div className="w-8 h-8 rounded-full bg-[var(--c-surface-2)] flex items-center justify-center shrink-0">
              <span className="text-[11px] font-bold text-[var(--c-text-2)]">{initials}</span>
            </div>
            <p className="text-xs text-[var(--c-text-3)] truncate leading-tight max-md:hidden">
              {session.user?.email}
            </p>
          </div>

          <div className="flex items-center justify-between max-md:flex-col max-md:gap-3">
            <Link
              href="/"
              className="flex items-center gap-1 text-xs text-[var(--c-text-3)] hover:text-[var(--c-text)] transition-colors"
              title="Ver tienda"
            >
              <span className="max-md:hidden">Ver tienda</span>
              <ArrowUpRight className="w-3 h-3" />
            </Link>

            <form action={async () => {
              'use server'
              await signOut({ redirectTo: '/auth/login' })
            }}>
              <button
                type="submit"
                className="flex items-center gap-1 text-xs text-[var(--c-text-3)] hover:text-[var(--c-danger)] transition-colors"
                title="Salir"
              >
                <LogOut className="w-3 h-3" />
                <span className="max-md:hidden">Salir</span>
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* ── Contenido ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto bg-[var(--c-bg)]">
        <main className="p-8 max-md:p-4 max-w-[1400px] min-h-full">{children}</main>
      </div>
    </div>
  )
}
