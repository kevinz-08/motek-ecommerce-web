import { IProductRepository } from '@/domain/repositories/IProductRepository'
import { Result, ok, err, AppError } from '@/domain/shared/Result'

export interface UpdateStockInput {
  productId: string
  newStock: number
}

/** Actualiza el stock de un producto — usado desde admin y webhook de pago */
export class UpdateStock {
  constructor(private readonly productRepo: IProductRepository) {}

  async execute({ productId, newStock }: UpdateStockInput): Promise<Result<void>> {
    if (newStock < 0) {
      return err(new AppError('VALIDATION_ERROR', 'El stock no puede ser negativo'))
    }

    try {
      const product = await this.productRepo.findBySku(productId)
      // Acepta tanto ID como SKU — intentamos por SKU primero, sino por ID directo
      if (!product) {
        await this.productRepo.updateStock(productId, newStock)
      } else {
        await this.productRepo.updateStock(product.id, newStock)
      }
      return ok(undefined)
    } catch (e) {
      return err(new AppError('INTERNAL_ERROR', 'Error al actualizar stock', e))
    }
  }
}
