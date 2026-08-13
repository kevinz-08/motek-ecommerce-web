import { Product } from '@/domain/entities/Product'

// ── Value objects ─────────────────────────────────────────────────────────────

/** Un ítem del archivo de Optimun ya parseado y validado por el parser. */
export type StockSyncItem = {
  readonly codigo: string // CÓDIGO de Optimun — puede llegar corrupto (fecha auto-formateada por Excel)
  readonly nombre: string // NOMBRE PRODUCTO — siempre limpio, usado como clave de fallback
  readonly stock:  number // EXISTENCIAS — entero >= 0
  readonly detal:  number // DETAL — centavos COP (ya convertido por el parser)
}

/** Payload de actualización atómica para un producto encontrado. */
export type StockSyncUpdate = {
  readonly productId: string
  readonly stock:     number
  readonly price?:    number // undefined = no tocar precio (DETAL era 0 en Optimun)
}

// ── Repository contract ───────────────────────────────────────────────────────

/**
 * Contrato de acceso a datos para el ciclo de sincronización con Optimun.
 *
 * Usa operaciones en batch para minimizar round-trips a la BD:
 *   - findBySkus:            una query para todos los SKUs válidos del export
 *   - findByNormalizedNames: una query para los nombres que no tuvieron match por SKU
 *   - bulkUpdateStockAndPrice: una transacción para todas las actualizaciones
 *
 * La implementación concreta vive en packages/database o apps/api/infrastructure.
 */
export interface IStockSyncRepository {
  /**
   * Busca productos por SKU en batch. Retorna solo los encontrados.
   * La clave del Map es el SKU tal como viene en el array de entrada.
   */
  findBySkus(skus: string[]): Promise<Map<string, Product>>

  /**
   * Busca productos por nombre normalizado en batch.
   * "Normalizado" = mayúsculas, sin tildes, sin espacios dobles.
   * La clave del Map es el nombre normalizado.
   * Usado como fallback cuando el SKU de Optimun llega corrupto o sin match.
   */
  findByNormalizedNames(normalizedNames: string[]): Promise<Map<string, Product>>

  /**
   * Actualiza stock y precio de múltiples productos en una sola transacción.
   * Si `price` es undefined, el precio del producto no se modifica.
   */
  bulkUpdateStockAndPrice(updates: StockSyncUpdate[]): Promise<void>
}

// Alias para mantener compatibilidad con el token DI existente en injection-tokens.ts
export type IInventorySyncRepository = IStockSyncRepository
