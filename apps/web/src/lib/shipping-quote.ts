'use client'

/**
 * Cache cliente de cotizaciones de envío — compartida entre /carrito y /checkout.
 *
 * Por qué cache cliente y no servidor:
 *   - Vendelo cobra por hit a su API (a futuro). El cache reduce llamadas.
 *   - Mantiene a NestJS/Cloud Run stateless (autoscale sin coordinación).
 *   - El admin puede cambiar precios; como esto es solo informativo (Vendelo
 *     cobra el envío al cliente, no nosotros), no hay riesgo de servir un
 *     precio de producto desactualizado — solo el costo de envío, que cambia
 *     con poca frecuencia.
 *
 * Por qué sessionStorage y no localStorage:
 *   El estimado de envío no debe sobrevivir entre sesiones — si el cliente
 *   vuelve días después, los precios/tarifas pueden haber cambiado.
 */
import { useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

const TTL_MS = 5 * 60 * 1000 // 5 min — las tarifas de Vendelo no cambian con frecuencia
const DEBOUNCE_MS = 500

export interface ShippingQuoteRequestItem {
  productId: string
  quantity: number
}

export interface ShippingQuoteRequest {
  shippingCityCode: string
  shippingSubdivisionCode: string
  items: ShippingQuoteRequestItem[]
  paymentMethod: 'COD' | 'EXTERNAL_PAYMENT'
}

export interface ShippingQuoteResult {
  quotedShippingTotal: number
  freeShipping: boolean
}

interface CachedQuote extends ShippingQuoteResult {
  fetchedAt: number
}

/**
 * Cache key estable sin importar el orden en que los ítems llegaron al carrito.
 * Incluye el método de pago porque Vendelo cotiza distinto para COD vs prepago.
 * Ej: "11001000-prod1x2|prod2x1-EXTERNAL_PAYMENT"
 */
export function buildShippingQuoteCacheKey(
  cityCode: string,
  items: ShippingQuoteRequestItem[],
  paymentMethod: 'COD' | 'EXTERNAL_PAYMENT' = 'EXTERNAL_PAYMENT',
): string {
  const itemsKey = items
    .map((i) => `${i.productId}x${i.quantity}`)
    .sort()
    .join('|')
  return `${cityCode}-${itemsKey}-${paymentMethod}`
}

interface ShippingQuoteStore {
  cache: Record<string, CachedQuote>

  /**
   * Retorna la cotización cacheada si sigue vigente (TTL 5 min), o null si
   * no existe o expiró — el caller decide si recalcular.
   */
  getCached: (cacheKey: string) => ShippingQuoteResult | null

  /**
   * Cotiza contra el proxy de Next.js (que a su vez llama a NestJS → Vendelo).
   * Cachea el resultado exitoso. Retorna null si falla — el caller degrada
   * elegante (no bloquea checkout, solo no muestra el costo).
   */
  fetchQuote: (request: ShippingQuoteRequest) => Promise<ShippingQuoteResult | null>
}

export const useShippingQuoteStore = create<ShippingQuoteStore>()(
  persist(
    (set, get) => ({
      cache: {},

      getCached: (cacheKey) => {
        const entry = get().cache[cacheKey]
        if (!entry) return null
        if (Date.now() - entry.fetchedAt > TTL_MS) return null
        return { quotedShippingTotal: entry.quotedShippingTotal, freeShipping: entry.freeShipping }
      },

      fetchQuote: async (request) => {
        const cacheKey = buildShippingQuoteCacheKey(request.shippingCityCode, request.items, request.paymentMethod)
        const cached = get().getCached(cacheKey)
        if (cached) return cached

        try {
          const res = await fetch('/api/shipping/quote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request),
          })
          if (!res.ok) return null

          const data = (await res.json()) as ShippingQuoteResult
          set((state) => ({
            cache: {
              ...state.cache,
              [cacheKey]: { ...data, fetchedAt: Date.now() },
            },
          }))
          return data
        } catch {
          return null
        }
      },
    }),
    {
      name: 'motek-store-shipping-quote',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ cache: state.cache }),
    },
  ),
)

export interface UseShippingQuoteState {
  quote: ShippingQuoteResult | null
  loading: boolean
  error: boolean
}

/**
 * Hook compartido entre /carrito y /checkout: debounce 500ms, recalcula al
 * cambiar ciudad o ítems, usa la cache de useShippingQuoteStore. Nunca lanza
 * — un fallo solo se refleja en `error`, el caller decide cómo degradar.
 */
export function useShippingQuote(
  city: { code: string; subdivisionCode: string } | null,
  items: ShippingQuoteRequestItem[],
  paymentMethod: 'COD' | 'EXTERNAL_PAYMENT' = 'EXTERNAL_PAYMENT',
): UseShippingQuoteState {
  const fetchQuote = useShippingQuoteStore((s) => s.fetchQuote)
  const getCached = useShippingQuoteStore((s) => s.getCached)
  const [state, setState] = useState<UseShippingQuoteState>({ quote: null, loading: false, error: false })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const itemsKey = items.map((i) => `${i.productId}x${i.quantity}`).sort().join('|')
  const cityCode = city?.code ?? ''

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!city || items.length === 0) {
      setState({ quote: null, loading: false, error: false })
      return
    }

    debounceRef.current = setTimeout(() => {
      void (async () => {
        const cacheKey = buildShippingQuoteCacheKey(city.code, items, paymentMethod)
        const cached = getCached(cacheKey)
        if (cached) {
          setState({ quote: cached, loading: false, error: false })
          return
        }

        setState((prev) => ({ ...prev, loading: true, error: false }))
        const result = await fetchQuote({
          shippingCityCode: city.code,
          shippingSubdivisionCode: city.subdivisionCode,
          items,
          paymentMethod,
        })

        setState(
          result
            ? { quote: result, loading: false, error: false }
            : { quote: null, loading: false, error: true },
        )
      })()
    }, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cityCode/itemsKey/paymentMethod ya resumen los inputs
  }, [cityCode, itemsKey, paymentMethod])

  return state
}
