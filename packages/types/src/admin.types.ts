// ── Product admin ─────────────────────────────────────────────────────────────

export interface CreateProductRequest {
  name: string
  slug: string
  description: string
  /** Precio en centavos COP, mínimo 0 */
  price: number
  stock: number
  sku: string
  categoryId: string
  isActive?: boolean
  images?: string[]
}

export interface UpdateProductRequest {
  name?: string
  slug?: string
  description?: string
  price?: number
  stock?: number
  sku?: string
  categoryId?: string
  isActive?: boolean
  images?: string[]
}

export interface UpdateStockRequest {
  /** Nuevo valor absoluto de stock, mínimo 0 */
  stock: number
}

export interface StockUpdateItem {
  sku: string
  stock: number
}

export interface BulkStockUpdateRequest {
  updates: StockUpdateItem[]
}

// ── Category admin ────────────────────────────────────────────────────────────

export interface CreateCategoryRequest {
  /** 2–80 caracteres */
  name: string
  /** Slug kebab-case, 2–80 caracteres */
  slug: string
  description?: string
  imageUrl?: string
  /** null = categoría raíz */
  parentId?: string
}

export interface UpdateCategoryRequest {
  name?: string
  slug?: string
  description?: string
  imageUrl?: string
  /** null = promover a raíz */
  parentId?: string | null
}

// ── Settings ──────────────────────────────────────────────────────────────────

export interface ToggleSettingRequest {
  enabled: boolean
}
