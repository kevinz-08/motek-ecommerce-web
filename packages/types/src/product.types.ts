// ── Enums ─────────────────────────────────────────────────────────────────────

export type PaymentProvider = 'WOMPI' | 'MERCADO_PAGO' | 'COD'

// ── Query params ──────────────────────────────────────────────────────────────

export interface ListProductsQuery {
  categorySlug?: string
  search?: string
  /** Precio mínimo en centavos COP */
  minPrice?: number
  /** Precio máximo en centavos COP */
  maxPrice?: number
  inStock?: boolean
  /** Default: 1 */
  page?: number
  /** Default: 12, máx: 100 */
  limit?: number
}

// ── Responses ─────────────────────────────────────────────────────────────────

export interface CategoryResponse {
  id: string
  name: string
  slug: string
  description?: string | null
  imageUrl?: string | null
  parentId?: string | null
}

export interface ProductResponse {
  id: string
  name: string
  slug: string
  description: string
  /** Precio en centavos COP */
  price: number
  stock: number
  sku: string
  isActive: boolean
  images: string[]
  categoryId: string
  category?: CategoryResponse
  createdAt: string
  updatedAt: string
}
