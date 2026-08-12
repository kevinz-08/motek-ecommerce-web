/**
 * Interfaces del repositorio de productos.
 *
 * IProductRepository es el CONTRATO que define qué operaciones de datos
 * necesita el dominio. La implementación concreta (PrismaProductRepository)
 * está en infrastructure/ y puede ser reemplazada sin tocar el dominio.
 *
 * Por qué esta separación:
 *   Si en el futuro se cambia de PostgreSQL a otro motor de BD (MongoDB, DynamoDB, etc.),
 *   solo se necesita crear un nuevo repositorio que implemente esta interfaz.
 *   Los use cases siguen funcionando sin cambios.
 */
import { Product, ProductFilters } from '@/domain/entities/Product'

/**
 * Resultado paginado del listado de productos.
 * Incluye los metadatos necesarios para renderizar la paginación en el frontend.
 */
export interface PaginatedProducts {
  /** Productos de la página actual */
  items: Product[]
  /** Total de productos que cumplen los filtros (para calcular número de páginas) */
  total: number
  /** Página actual (empieza en 1) */
  page: number
  /** Máximo de productos por página */
  limit: number
}

/**
 * Contrato de acceso a datos de productos.
 * Implementado por PrismaProductRepository en infrastructure/repositories/.
 */
export interface IProductRepository {
  /** Busca un producto por su ID único (cuid). Retorna null si no existe. */
  findById(id: string): Promise<Product | null>
  /** Busca un producto por su slug URL. Retorna null si no existe. */
  findBySlug(slug: string): Promise<Product | null>
  /** Busca un producto por su SKU único. Retorna null si no existe. */
  findBySku(sku: string): Promise<Product | null>
  /** Lista productos con filtros opcionales y paginación */
  findAll(filters: ProductFilters): Promise<PaginatedProducts>
  /** Retorna productos con stock ≤ threshold. Usado para alertas en el dashboard admin. */
  findLowStock(threshold: number): Promise<Product[]>
  /** Crea un nuevo producto. Los campos id, createdAt y updatedAt los genera la BD. */
  save(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product>
  /** Actualiza campos específicos de un producto. Solo actualiza los campos definidos en data. */
  update(id: string, data: Partial<Product>): Promise<Product>
  /** Actualiza únicamente el campo stock (operación frecuente, endpoint separado) */
  updateStock(id: string, newStock: number): Promise<void>
  /**
   * Decremento atómico del stock (`stock -= by`).
   * Se usa desde ConfirmPayment para evitar races: dos webhooks concurrentes no
   * pueden descontar el mismo stock porque el decremento ocurre en la BD, no en memoria.
   */
  decrementStock(id: string, by: number): Promise<void>
  /**
   * Soft delete: pone deletedAt = now(). El producto desaparece del catálogo y del admin
   * pero la fila permanece en la BD y puede restaurarse.
   * Nunca llames a prisma.product.delete() — usa siempre este método.
   */
  softDelete(id: string): Promise<void>
  /** Restaura un producto soft-deleted poniendo deletedAt = null. */
  restore(id: string): Promise<void>
  /** Lista productos soft-deleted (papelera). Solo para el panel admin. */
  findDeleted(): Promise<Product[]>
}
