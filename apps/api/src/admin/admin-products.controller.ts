import {
  Body, Controller, Delete, Get, HttpCode, HttpException, Inject, NotFoundException,
  Param, Patch, Post, Put, UnprocessableEntityException, UploadedFile, UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger'
import {
  IProductRepository,
  IProductDescriptionRepository,
  UpsertProductDescription,
  validateProductPricing,
} from '@motek/domain'
import { PRODUCT_REPOSITORY, PRODUCT_DESCRIPTION_REPOSITORY } from '../infrastructure/injection-tokens'
import { CloudinaryService } from '../infrastructure/services/CloudinaryService'
import { Roles } from '../auth/decorators/roles.decorator'
import { CreateProductDto } from './dto/create-product.dto'
import { UpdateProductDto } from './dto/update-product.dto'
import { UpdateStockDto } from './dto/update-stock.dto'
import { UpsertProductDescriptionDto } from './dto/upsert-description.dto'

const ERROR_HTTP_STATUS: Record<string, number> = {
  NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  INTERNAL_ERROR: 500,
}

@ApiTags('admin / products')
@ApiBearerAuth('access-token')
@Roles('ADMIN')
@Controller('admin/products')
export class AdminProductsController {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly productRepo: IProductRepository,
    @Inject(PRODUCT_DESCRIPTION_REPOSITORY) private readonly descRepo: IProductDescriptionRepository,
    private readonly cloudinary: CloudinaryService,
  ) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Crear producto' })
  create(@Body() dto: CreateProductDto) {
    const pricingError = validateProductPricing(dto.price, dto.compareAtPrice)
    if (pricingError) throw new UnprocessableEntityException(pricingError)

    return this.productRepo.save({
      name: dto.name,
      slug: dto.slug,
      description: dto.description,
      price: dto.price,
      compareAtPrice: dto.compareAtPrice ?? null,
      stock: dto.stock,
      sku: dto.sku,
      categoryId: dto.categoryId,
      isActive: dto.isActive ?? true,
      images: dto.images ?? [],
      weightKg: dto.weightKg ?? null,
      heightCm: dto.heightCm ?? null,
      widthCm: dto.widthCm ?? null,
      lengthCm: dto.lengthCm ?? null,
      compatible: dto.compatible?.map((c) => ({ id: '', brand: c.brand, model: c.model, year: c.year ?? null })),
    })
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar producto' })
  async update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    // Actualización parcial: la invariante price/compareAtPrice se valida contra
    // los valores resultantes (lo enviado + lo que ya está en BD).
    if (dto.price !== undefined || dto.compareAtPrice !== undefined) {
      const current = await this.productRepo.findById(id)
      if (!current) throw new NotFoundException('Producto no encontrado')
      const pricingError = validateProductPricing(
        dto.price ?? current.price,
        dto.compareAtPrice !== undefined ? dto.compareAtPrice : current.compareAtPrice,
      )
      if (pricingError) throw new UnprocessableEntityException(pricingError)
    }
    return this.productRepo.update(id, {
      ...dto,
      compatible: dto.compatible?.map((c) => ({ id: '', brand: c.brand, model: c.model, year: c.year ?? null })),
    })
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Soft-delete producto (mueve a papelera)' })
  async delete(@Param('id') id: string) {
    await this.productRepo.softDelete(id)
    return { success: true }
  }

  @Patch(':id/restore')
  @HttpCode(200)
  @ApiOperation({ summary: 'Restaurar producto desde la papelera' })
  async restore(@Param('id') id: string) {
    await this.productRepo.restore(id)
    return { success: true }
  }

  @Get('deleted')
  @ApiOperation({ summary: 'Listar productos en la papelera' })
  async findDeleted() {
    return this.productRepo.findDeleted()
  }

  @Patch(':id/stock')
  @ApiOperation({ summary: 'Actualizar stock de un producto' })
  async updateStock(@Param('id') id: string, @Body() dto: UpdateStockDto) {
    await this.productRepo.updateStock(id, dto.stock)
    return { success: true }
  }

  @Get(':id/description')
  @ApiOperation({ summary: 'Obtener descripción estructurada de un producto' })
  async getDescription(@Param('id') id: string) {
    const desc = await this.descRepo.findByProductId(id)
    if (!desc) throw new NotFoundException('Este producto no tiene descripción estructurada')
    return desc
  }

  @Put(':id/description')
  @ApiOperation({ summary: 'Crear o actualizar descripción estructurada' })
  async upsertDescription(
    @Param('id') id: string,
    @Body() dto: UpsertProductDescriptionDto,
  ) {
    const useCase = new UpsertProductDescription(this.productRepo, this.descRepo)
    const result = await useCase.execute({ productId: id, ...dto })

    if (!result.ok) {
      const status = ERROR_HTTP_STATUS[result.error.code] ?? 500
      throw new HttpException(result.error.message, status)
    }

    return result.value
  }

  @Post('upload-image')
  @HttpCode(201)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Subir imagen de producto a Cloudinary' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadImage(
    @UploadedFile() file: { buffer: Buffer; originalname: string },
    @Body('sku') sku: string,
  ) {
    const result = await this.cloudinary.uploadProductImage(file.buffer, sku)
    return { url: result.secureUrl }
  }
}
