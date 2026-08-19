import { Controller, Get, Inject, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { IProductRepository, ListProducts } from '@motek/domain'
import { PRODUCT_REPOSITORY } from '../infrastructure/injection-tokens'
import { Public } from '../auth/decorators/public.decorator'
import { ListProductsQueryDto } from './dto/list-products.dto'

@ApiTags('products')
@Public()
@Controller('products')
export class ProductsController {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly productRepo: IProductRepository,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar productos con filtros y paginación' })
  async list(@Query() query: ListProductsQueryDto) {
    const useCase = new ListProducts(this.productRepo)
    const result = await useCase.execute({
      categorySlug: query.categorySlug,
      search: query.search,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      inStock: query.inStock,
      page: query.page,
      limit: query.limit,
    })
    if (!result.ok) throw result.error
    return result.value
  }
}
