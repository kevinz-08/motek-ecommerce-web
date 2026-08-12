import { IProductRepository } from '@/domain/repositories/IProductRepository'
import { Product } from '@/domain/entities/Product'
import { Result, ok, err, AppError } from '@/domain/shared/Result'

/** Obtiene un producto por su slug para la página de detalle */
export class GetProductBySlug {
  constructor(private readonly productRepo: IProductRepository) {}

  async execute(slug: string): Promise<Result<Product>> {
    try {
      const product = await this.productRepo.findBySlug(slug)
      if (!product) {
        return err(new AppError('NOT_FOUND', `Producto "${slug}" no encontrado`))
      }
      if (!product.isActive) {
        return err(new AppError('NOT_FOUND', `Producto "${slug}" no está disponible`))
      }
      return ok(product)
    } catch (e) {
      return err(new AppError('INTERNAL_ERROR', 'Error al obtener producto', e))
    }
  }
}
