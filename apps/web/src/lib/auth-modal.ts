'use client'

/**
 * Store de UI del modal de autenticación (login/registro).
 *
 * Mismo patrón que `useCartDrawer` (apps/web/src/lib/cart-drawer.ts): efímero,
 * sin persistencia — solo controla si el modal está abierto, en qué modo
 * (login/register) y a qué URL volver tras autenticarse.
 *
 * `callbackUrl` se captura en el momento del click (ej. `usePathname()` en
 * Navbar) porque, a diferencia del flujo de página completa (que lee
 * `callbackUrl` de la query string vía `searchParams` en el servidor), el
 * modal no navega — necesita que quien lo abre le pase explícitamente a
 * dónde volver.
 */
import { create } from 'zustand'

export type AuthModalMode = 'login' | 'register'

interface AuthModalStore {
  isOpen: boolean
  mode: AuthModalMode
  callbackUrl: string | null
  open: (mode: AuthModalMode, callbackUrl?: string) => void
  close: () => void
  switchMode: (mode: AuthModalMode) => void
}

export const useAuthModal = create<AuthModalStore>((set) => ({
  isOpen: false,
  mode: 'login',
  callbackUrl: null,
  open: (mode, callbackUrl) => set({ isOpen: true, mode, callbackUrl: callbackUrl ?? null }),
  close: () => set({ isOpen: false }),
  switchMode: (mode) => set({ mode }),
}))
