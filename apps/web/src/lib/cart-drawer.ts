'use client'

/**
 * Store de UI del panel lateral del carrito (Side Drawer).
 *
 * Separado de `useCart()` (apps/web/src/lib/cart.ts) a propósito: este store
 * solo guarda si el panel está abierto o cerrado, es efímero y NO se persiste
 * en localStorage — si se persistiera, el drawer podría reabrirse solo al
 * recargar la página. Los datos del carrito (items, cantidades, total) siguen
 * viviendo únicamente en `useCart()`; ambos se leen del mismo store de datos
 * por lo que quedan sincronizados automáticamente.
 */
import { create } from 'zustand'

interface CartDrawerStore {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

export const useCartDrawer = create<CartDrawerStore>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
}))
