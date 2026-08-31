'use client'

/**
 * Store de carrito de compras — separado por usuario.
 *
 * PROBLEMA QUE RESUELVE:
 *   Si se usa una clave fija en localStorage (ej: 'motek-store-cart'),
 *   todos los usuarios del mismo navegador comparten el carrito.
 *   El admin veía el carrito del cliente y viceversa.
 *
 * SOLUCIÓN:
 *   La clave de localStorage incluye el ID del usuario:
 *     Usuario autenticado: 'motek-store-cart-{userId}'
 *     Usuario no autenticado (invitado): 'motek-store-cart-guest'
 *
 *   Cada usuario tiene su propio carrito completamente separado.
 *   Al iniciar sesión, el carrito de invitado queda intacto en localStorage
 *   (no se mezcla con el carrito del usuario autenticado).
 *
 * IMPLEMENTACIÓN:
 *   - `createCartStore(key)` crea una instancia de Zustand con persist para esa clave.
 *   - `stores` es un caché módulo-nivel que evita crear múltiples instancias
 *     para el mismo usuario en el mismo ciclo de vida de la página.
 *   - `useCart()` usa `useSession()` para obtener el userId actual y retorna
 *     la instancia correcta del store.
 *
 * FLUJO:
 *   useCart() → useSession() → userId → clave localStorage → store de Zustand
 *
 * NOTA sobre useSession():
 *   Requiere que <AuthSessionProvider> (next-auth/react SessionProvider) envuelva
 *   la aplicación — está configurado en src/app/layout.tsx.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useSession } from 'next-auth/react'
import { Product } from '@motek/domain'
import type { CityOption } from '@/components/checkout/CitySelector'

/** Representa un ítem dentro del carrito con su producto y cantidad */
export interface CartItem {
  product: Product
  quantity: number
}

/** Interfaz del store — estado + acciones */
interface CartStore {
  /** Lista de ítems actualmente en el carrito */
  items: CartItem[]

  /**
   * Agrega un producto al carrito.
   * Si el producto ya existe, incrementa la cantidad sin superar el stock disponible.
   * @param product - El producto a agregar
   * @param quantity - Cantidad a agregar (por defecto 1)
   */
  addItem: (product: Product, quantity?: number) => void

  /**
   * Elimina un producto del carrito por su ID.
   * @param productId - ID del producto a eliminar
   */
  removeItem: (productId: string) => void

  /**
   * Actualiza la cantidad de un producto en el carrito.
   * Si la cantidad es <= 0, elimina el ítem completamente.
   * @param productId - ID del producto
   * @param quantity - Nueva cantidad deseada
   */
  updateQuantity: (productId: string, quantity: number) => void

  /** Vacía el carrito completamente */
  clearCart: () => void

  /** Calcula el total del carrito en centavos COP */
  total: () => number

  /** Retorna el número total de unidades en el carrito (suma de todas las cantidades) */
  count: () => number

  /**
   * Ciudad de envío elegida en /carrito al cotizar el envío. Se persiste para
   * que /checkout la tenga preseleccionada — el cliente no la vuelve a tipear.
   */
  selectedCity: CityOption | null

  /** Actualiza la ciudad de envío seleccionada (o la limpia con null). */
  setSelectedCity: (city: CityOption | null) => void
}

/**
 * Caché de instancias de stores por clave de localStorage.
 * Evita crear múltiples instancias de Zustand para el mismo usuario
 * cuando useCart() es llamado desde distintos componentes.
 *
 * La clave es el identificador del store (ej: 'motek-store-cart-abc123').
 */
const stores: Record<string, ReturnType<typeof createCartStore>> = {}

/**
 * Crea una nueva instancia del store de carrito para una clave de almacenamiento dada.
 * Solo se llama una vez por clave gracias al caché `stores`.
 *
 * @param storageKey - Clave de localStorage. Ej: 'motek-store-cart-userId123'
 */
function createCartStore(storageKey: string) {
  return create<CartStore>()(
    persist(
      (set, get) => ({
        items: [],

        addItem: (product, quantity = 1) => {
          set((state) => {
            const existing = state.items.find((i) => i.product.id === product.id)
            if (existing) {
              // Incrementar cantidad sin superar el stock disponible
              return {
                items: state.items.map((i) =>
                  i.product.id === product.id
                    ? { ...i, quantity: Math.min(i.quantity + quantity, product.stock) }
                    : i,
                ),
              }
            }
            // Producto nuevo: agregar al final del carrito
            return { items: [...state.items, { product, quantity }] }
          })
        },

        removeItem: (productId) => {
          set((state) => ({
            items: state.items.filter((i) => i.product.id !== productId),
          }))
        },

        updateQuantity: (productId, quantity) => {
          if (quantity <= 0) {
            // Cantidad 0 o negativa = eliminar el ítem
            get().removeItem(productId)
            return
          }
          set((state) => ({
            items: state.items.map((i) =>
              i.product.id === productId ? { ...i, quantity } : i,
            ),
          }))
        },

        clearCart: () => set({ items: [] }),

        // Total = suma de (precio unitario × cantidad) para cada ítem, en centavos COP
        total: () => get().items.reduce((acc, i) => acc + i.product.price * i.quantity, 0),

        // Count = suma de unidades (no de líneas distintas)
        count: () => get().items.reduce((acc, i) => acc + i.quantity, 0),

        selectedCity: null,
        setSelectedCity: (city) => set({ selectedCity: city }),
      }),
      {
        name: storageKey, // Clave única en localStorage para este usuario
      },
    ),
  )
}

/**
 * Hook principal del carrito de compras.
 *
 * Retorna el store de Zustand correspondiente al usuario actualmente autenticado.
 * Si no hay sesión, usa el carrito de invitado ('guest').
 *
 * Uso:
 * ```tsx
 * const { items, addItem, removeItem, total, count, clearCart } = useCart()
 * ```
 *
 * El carrito se persiste automáticamente en localStorage con una clave
 * específica por usuario, por lo que sobrevive recargas de página y cada
 * usuario ve únicamente sus propios ítems.
 */
export function useCart() {
  const { data: session } = useSession()

  // Si hay sesión activa, usar el ID del usuario; si no, usar 'guest'
  const userId = (session?.user as { id?: string } | undefined)?.id ?? 'guest'
  const storageKey = `motek-store-cart-${userId}`

  // Crear el store si no existe para este usuario, o recuperar el existente del caché
  if (!stores[storageKey]) {
    // eslint-disable-next-line react-hooks/immutability
    stores[storageKey] = createCartStore(storageKey)
  }

  // Llamar al hook de Zustand y retornar el estado + acciones
  return stores[storageKey]()
}
