import { ProductDescription, UpsertDescriptionInput } from '../entities/ProductDescription'

export interface IProductDescriptionRepository {
  /** Retorna la descripción estructurada de un producto, o null si no existe. */
  findByProductId(productId: string): Promise<ProductDescription | null>
  /**
   * Crea o reemplaza la descripción estructurada de un producto.
   * Los beneficios y los ítems de compatibilidad anteriores se eliminan y se
   * recrean en una sola transacción.
   */
  upsert(input: UpsertDescriptionInput): Promise<ProductDescription>
}
