import { Body, Controller, HttpCode, Inject, Logger, Post } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Public } from '../auth/decorators/public.decorator'
import { QuoteShipping, IProductRepository, IVendeloShippingPort } from '@motek/domain'
import { PRODUCT_REPOSITORY, VENDELO_SHIPPING_PORT } from '../infrastructure/injection-tokens'
import { QuoteShippingDto } from './dto/quote-shipping.dto'

@ApiTags('shipping')
@Controller('shipping')
export class ShippingController {
  private readonly logger = new Logger(ShippingController.name)

  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly productRepo: IProductRepository,
    @Inject(VENDELO_SHIPPING_PORT) private readonly shippingPort: IVendeloShippingPort,
  ) {}

  /**
   * Cotiza el costo de envío sin crear el pedido — el carrito y el checkout
   * lo llaman para mostrarle al cliente un estimado antes de pagar (Vendelo
   * cobra el envío directo al cliente, no nuestro Wompi).
   *
   * @Public(): el carrito funciona para invitados, bloquear esto detrás de
   * JWT sería peor UX. La defensa contra abuso es el rate limit (10 req/min/IP,
   * además del 100/min global) — ver app.module.ts y main.ts (trust proxy).
   */
  @Public()
  @Post('quote')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Cotiza el costo de envío de un carrito sin crear el pedido' })
  async quote(@Body() dto: QuoteShippingDto) {
    const useCase = new QuoteShipping(this.productRepo, this.shippingPort)
    const result = await useCase.execute({
      shippingCityCode: dto.shippingCityCode,
      shippingSubdivisionCode: dto.shippingSubdivisionCode,
      items: dto.items,
      paymentMethod: dto.paymentMethod,
    })

    if (!result.ok) {
      this.logger.warn(`quote rejected: [${result.error.code}] ${result.error.message}`)
      throw result.error
    }

    return result.value
  }
}
