import { IProductRepository, PaginatedProducts } from '@/domain/repositories/IProductRepository'
import { ProductFilters } from '@/domain/entities/Product'
import { Result, ok, err, AppError } from '@/domain/shared/Result'

/** Lista productos con filtros y paginación */
export class ListProducts {
  constructor(private readonly productRepo: IProductRepository) {}

  async execute(filters: ProductFilters): Promise<Result<PaginatedProducts>> {
    try {
      const result = await this.productRepo.findAll(filters)
      return ok(result)
    } catch (e) {
      return err(new AppError('INTERNAL_ERROR', 'Error al obtener productos', e))
    }
  }
}
