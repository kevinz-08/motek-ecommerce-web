import {
  Body, Controller, Delete, Get, Inject, Param, Patch, Post, HttpCode,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import {
  ICouponRepository,
  IOrderRepository,
  ValidateCoupon,
} from '@motek/domain'
import { COUPON_REPOSITORY, ORDER_REPOSITORY } from '../infrastructure/injection-tokens'
import { Throttle } from '@nestjs/throttler'
import { Public } from '../auth/decorators/public.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator'
import { CreateCouponDto } from './dto/create-coupon.dto'
import { UpdateCouponDto } from './dto/update-coupon.dto'
import { ValidateCouponDto } from './dto/validate-coupon.dto'

@ApiTags('coupons')
@ApiBearerAuth('access-token')
@Controller('coupons')
export class CouponsController {
  constructor(
    @Inject(COUPON_REPOSITORY) private readonly couponRepo: ICouponRepository,
    @Inject(ORDER_REPOSITORY)  private readonly orderRepo: IOrderRepository,
  ) {}

  /**
   * Valida un cupón contra los ítems del carrito del cliente autenticado.
   * Retorna el descuento calculable y qué productos están cubiertos.
   * Requiere JWT (no Admin) — llamado desde el checkout del cliente.
   */
  @Post('validate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Validar cupón contra ítems del carrito' })
  async validate(@Body() dto: ValidateCouponDto, @CurrentUser() user: JwtUser) {
    const useCase = new ValidateCoupon(this.couponRepo, this.orderRepo)
    const result = await useCase.execute({
      code: dto.code,
      identity: { kind: 'user', userId: user.id },
      items: dto.items,
    })
    if (!result.ok) throw result.error
    return result.value
  }

  /**
   * Misma validación que `POST /coupons/validate`, pero sin sesión — la usa el
   * checkout de invitado para poder mostrar el descuento antes de pagar.
   *
   * No es una versión "relajada": `ValidateCoupon` rechaza con UNAUTHORIZED
   * cualquier cupón cuya restricción dependa del historial del cliente
   * (ONCE_PER_CUSTOMER, FIRST_PURCHASE), porque un email sin verificar no es
   * identidad. El invitado ve el mismo resultado que verá al crear el pedido.
   *
   * Es público y barato de llamar, así que va con un throttle propio para que no
   * sirva de oráculo para enumerar códigos de cupón por fuerza bruta.
   */
  @Post('validate-guest')
  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Validar cupón sin sesión (checkout de invitado)' })
  async validateAsGuest(@Body() dto: ValidateCouponDto) {
    const useCase = new ValidateCoupon(this.couponRepo, this.orderRepo)
    const result = await useCase.execute({
      code: dto.code,
      identity: { kind: 'guest' },
      items: dto.items,
    })
    if (!result.ok) throw result.error
    return result.value
  }

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: '[ADMIN] Listar todos los cupones' })
  async findAll() {
    return this.couponRepo.findAll()
  }

  @Post()
  @Roles('ADMIN')
  @HttpCode(201)
  @ApiOperation({ summary: '[ADMIN] Crear cupón' })
  async create(@Body() dto: CreateCouponDto) {
    return this.couponRepo.create({
      code: dto.code,
      type: dto.type,
      value: dto.value,
      restriction: dto.restriction,
      expiresAt: new Date(dto.expiresAt),
      categoryId: dto.categoryId,
      productId: dto.productId,
    })
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: '[ADMIN] Editar cupón' })
  async update(@Param('id') id: string, @Body() dto: UpdateCouponDto) {
    return this.couponRepo.update(id, {
      ...(dto.code        !== undefined && { code:        dto.code }),
      ...(dto.type        !== undefined && { type:        dto.type }),
      ...(dto.value       !== undefined && { value:       dto.value }),
      ...(dto.restriction !== undefined && { restriction: dto.restriction }),
      ...(dto.expiresAt   !== undefined && { expiresAt:   new Date(dto.expiresAt) }),
      ...(dto.isActive    !== undefined && { isActive:    dto.isActive }),
      ...('categoryId' in dto && { categoryId: dto.categoryId }),
      ...('productId'  in dto && { productId:  dto.productId }),
    })
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: '[ADMIN] Desactivar cupón (soft delete)' })
  async remove(@Param('id') id: string) {
    await this.couponRepo.delete(id)
    return { success: true }
  }

}
