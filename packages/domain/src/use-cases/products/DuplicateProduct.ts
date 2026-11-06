import { IProductRepository, IProductDuplicator } from '@/domain/repositories/IProductRepository'
import { Product } from '@/domain/entities/Product'
import { Result, ok, err, AppError } from '@/domain/shared/Result'
import { buildDuplicateIdentity } from '@/domain/shared/duplicateIdentity'

/** Intentos máximos de identidad única antes de rendirse (slug/SKU ocupados). */
const MAX_ATTEMPTS = 10

/**
 * Duplica un producto: la copia nace inactiva y con stock 0, con nombre, slug y SKU
 * únicos. Las imágenes (URLs de Cloudinary) se comparten con el original.
 * Un producto en la papelera no se puede duplicar.
 */
export class DuplicateProduct {
  constructor(private readonly productRepo: IProductRepository & IProductDuplicator) {}

  async execute(productId: string): Promise<Result<Product>> {
    try {
      const source = await this.productRepo.findById(productId)
      if (!source || source.deletedAt) {
        return err(new AppError('NOT_FOUND', 'Producto no encontrado'))
      }

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const copy = await this.productRepo.createDuplicate(
          productId,
          buildDuplicateIdentity(source, attempt),
        )
        if (copy === null) return err(new AppError('NOT_FOUND', 'Producto no encontrado'))
        if (copy !== 'CONFLICT') return ok(copy)
      }

      return err(new AppError('INTERNAL_ERROR', 'No se pudo generar un SKU/slug único para la copia'))
    } catch (e) {
      return err(new AppError('INTERNAL_ERROR', 'Error al duplicar el producto', e))
    }
  }
}
