import { IProductRepository } from '../../repositories/IProductRepository'
import { IProductDescriptionRepository } from '../../repositories/IProductDescriptionRepository'
import { ProductDescription, UpsertDescriptionInput } from '../../entities/ProductDescription'
import { Result, ok, err, AppError } from '../../shared/Result'

const MAX_BENEFITS = 10
const MAX_COMPATIBILITY = 30

export class UpsertProductDescription {
  constructor(
    private readonly productRepo: IProductRepository,
    private readonly descRepo: IProductDescriptionRepository,
  ) {}

  async execute(input: UpsertDescriptionInput): Promise<Result<ProductDescription>> {
    const product = await this.productRepo.findById(input.productId)
    if (!product) {
      return err(new AppError('NOT_FOUND', `Producto "${input.productId}" no encontrado`))
    }

    if (input.benefits.length > MAX_BENEFITS) {
      return err(new AppError('VALIDATION_ERROR', `Máximo ${MAX_BENEFITS} beneficios por producto`))
    }

    const emptyBody = input.benefits.find((b) => !b.body.trim())
    if (emptyBody) {
      return err(new AppError('VALIDATION_ERROR', 'Cada beneficio debe tener una descripción'))
    }

    if (input.compatibility.length > MAX_COMPATIBILITY) {
      return err(new AppError('VALIDATION_ERROR', `Máximo ${MAX_COMPATIBILITY} motos compatibles por producto`))
    }

    const emptyCompatibility = input.compatibility.find((c) => !c.body.trim())
    if (emptyCompatibility) {
      return err(new AppError('VALIDATION_ERROR', 'Cada moto compatible debe tener una descripción'))
    }

    const result = await this.descRepo.upsert(input)
    return ok(result)
  }
}
