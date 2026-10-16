import {
  Body, Controller, ForbiddenException, HttpCode,
  Inject, Logger, Param, Patch, Post,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import {
  IOrderRepository, IProductRepository, IPaymentService, IVendeloShippingPort,
  ICouponRepository, CreateOrder, QuoteShipping, ValidateCoupon, OrderStatus,
  ClaimGuestOrders, CancelOrder, IShipmentRepository, ICityCoverageRepository,
} from '@motek/domain'
import {
  ORDER_REPOSITORY, PRODUCT_REPOSITORY, PAYMENT_SERVICE, VENDELO_SHIPPING_PORT,
  COUPON_REPOSITORY, SHIPMENT_REPOSITORY, CITY_COVERAGE_REPOSITORY,
} from '../infrastructure/injection-tokens'
import { MercadoPagoService } from '../infrastructure/services/MercadoPagoService'
import { WompiService } from '../infrastructure/services/WompiService'
import { ResendEmailService } from '../infrastructure/services/ResendEmailService'
import { EmailQueueService } from '../infrastructure/services/EmailQueueService'
import { VendeloOrderQueueService } from '../infrastructure/services/VendeloOrderQueueService'
import { PrismaService } from '../infrastructure/database/prisma.service'
import { Roles } from '../auth/decorators/roles.decorator'
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator'
import { CreateOrderDto } from './dto/create-order.dto'
import { UpdateOrderStatusDto } from './dto/update-order-status.dto'

// Tope defensivo: si Vendelo cotiza un flete más alto que esto, se cobra el tope
// en vez del valor cotizado — protege al cliente de una cotización anormal sin
// bloquear el checkout. $50.000 COP por defecto, ajustable por env var.
const MAX_SHIPPING_CHARGE_CENTS = parseInt(process.env['MAX_SHIPPING_CHARGE_CENTS'] ?? '5000000', 10)

@ApiTags('orders')
@ApiBearerAuth('access-token')
@Controller('orders')
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name)

  constructor(
    @Inject(ORDER_REPOSITORY)       private readonly orderRepo: IOrderRepository,
    @Inject(PRODUCT_REPOSITORY)     private readonly productRepo: IProductRepository,
    @Inject(PAYMENT_SERVICE)        private readonly wompiService: IPaymentService,
    @Inject(VENDELO_SHIPPING_PORT)  private readonly shippingPort: IVendeloShippingPort,
    @Inject(COUPON_REPOSITORY)      private readonly couponRepo: ICouponRepository,
    @Inject(SHIPMENT_REPOSITORY)    private readonly shipmentRepo: IShipmentRepository,
    @Inject(CITY_COVERAGE_REPOSITORY) private readonly cityCoverage: ICityCoverageRepository,
    private readonly mercadoPagoService: MercadoPagoService,
    private readonly emailService: ResendEmailService,
    private readonly emailQueue: EmailQueueService,
    private readonly vendeloOrderQueue: VendeloOrderQueueService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Crear pedido e iniciar pago' })
  async create(@Body() dto: CreateOrderDto, @CurrentUser() user: JwtUser) {
    let paymentService: IPaymentService = this.wompiService
    if (dto.paymentProvider === 'MERCADO_PAGO') {
      const setting = await this.prisma.client.settings.findUnique({
        where: { key: 'MERCADOPAGO_ENABLED' },
      })
      if (!setting || setting.value !== 'true') {
        throw new ForbiddenException('Mercado Pago no está disponible en este momento')
      }
      paymentService = this.mercadoPagoService
    }

    let chargeShippingOnline = false

    if (dto.paymentProvider === 'COD') {
      // Por defecto habilitado (sin fila aún en Settings) — el admin puede desactivarlo
      // desde /admin/configuracion, que crea la fila en false.
      const setting = await this.prisma.client.settings.findUnique({
        where: { key: 'COD_ENABLED' },
      })
      if (setting && setting.value !== 'true') {
        throw new ForbiddenException('Pago contra entrega no está disponible en este momento')
      }
    } else {
      // Pedido pagado en línea (WOMPI/MERCADO_PAGO): si el admin activó
      // SHIPPING_ONLINE_ENABLED, el flete se suma al monto cobrado por la pasarela
      // en vez de descontarse de la billetera Vendelo. Política global del negocio,
      // no una elección del cliente — el DTO no acepta nada de flete desde el frontend.
      // Default FALSE si no existe la fila aún — deliberado: no empezar a cobrar
      // flete extra sin opt-in explícito del admin.
      const shippingOnlineSetting = await this.prisma.client.settings.findUnique({
        where: { key: 'SHIPPING_ONLINE_ENABLED' },
      })
      chargeShippingOnline = shippingOnlineSetting?.value === 'true'
    }

    const useCase = new CreateOrder(
      this.orderRepo,
      this.productRepo,
      paymentService,
      new QuoteShipping(this.productRepo, this.shippingPort, this.cityCoverage),
      new ValidateCoupon(this.couponRepo, this.orderRepo),
      this.cityCoverage,
    )
    const result = await useCase.execute({
      customer: { kind: 'user', userId: user.id, email: user.email },
      items: dto.items,
      shippingAddress: dto.shippingAddress,
      buyer: dto.buyer,
      paymentProvider: dto.paymentProvider,
      deliveryMethod: dto.deliveryMethod,
      chargeShippingOnline,
      maxShippingChargeCents: MAX_SHIPPING_CHARGE_CENTS,
      couponCode: dto.couponCode,
    })

    if (!result.ok) throw result.error

    if (result.value.shippingQuoteFallback) {
      this.logger.warn(
        `orderId=${result.value.order.id}: no se pudo cotizar/cargar el envío en línea — `
        + 'se creó con shippingTotal=0 (negocio absorbe el flete, comportamiento legado)',
      )
    }

    // Persiste el timestamp de aceptación de políticas si el cliente lo envió
    if (dto.policiesAcceptedAt) {
      await this.prisma.client.order.update({
        where: { id: result.value.order.id },
        data: { policiesAcceptedAt: new Date(dto.policiesAcceptedAt) },
      })
    }

    if (dto.paymentProvider === 'COD') {
      // COD no tiene webhook de pasarela que confirme el pago — el pedido ya nació
      // PAID (CreateOrder lo confirmó al crearlo), así que disparamos aquí mismo
      // los efectos secundarios que para pagos online dispara ConfirmPayment.
      await this.emailQueue.enqueue(result.value.order.contactEmail, result.value.order.id)
      // Retiro en tienda: el cliente lo recoge en persona, nunca se despacha
      // por Vendelo — no encolar o un mensajero saldría a entregar en falso.
      if (result.value.order.deliveryMethod !== 'STORE_PICKUP') {
        await this.vendeloOrderQueue.enqueue(result.value.order.id)
      }
    } else {
      // Fire-and-forget: nunca bloquea ni falla la respuesta del pedido
      this.emailService
        .sendOrderReceived(result.value.order, result.value.order.contactEmail)
        .catch((e) => this.logger.error(`Email sendOrderReceived failed orderId=${result.value.order.id}: ${e}`))
    }

    return result.value
  }

  /**
   * Vincula a la cuenta autenticada los pedidos que se hicieron como invitado
   * con ese mismo email.
   *
   * No recibe email en el body a propósito: el único email en el que se puede
   * confiar es el del JWT. Si el cliente pudiera elegirlo, cualquiera reclamaría
   * los pedidos de cualquier otro con solo escribir su correo.
   */
  @Post('claim')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Vincular a mi cuenta los pedidos hechos como invitado' })
  async claim(@CurrentUser() user: JwtUser) {
    const result = await new ClaimGuestOrders(this.orderRepo).execute({
      userId: user.id,
      accountEmail: user.email,
    })
    if (!result.ok) throw result.error

    if (result.value.claimed > 0) {
      this.logger.log(`[Claim] userId=${user.id} reclamó ${result.value.claimed} pedido(s) de invitado`)
    }
    return result.value
  }

  /**
   * Anular (CANCELLED) pasa por el use case CancelOrder: si el pedido ya está
   * en Vendelo lo anula allá primero, y rechaza anular envíos ya despachados.
   * El resto de estados se asignan directo (comportamiento previo).
   */
  @Patch(':id/status')
  @Roles('ADMIN')
  @ApiOperation({ summary: '[ADMIN] Actualizar estado de un pedido (anular también anula en Vendelo)' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    if (dto.status === 'CANCELLED') {
      const result = await new CancelOrder(this.orderRepo, this.shipmentRepo, this.shippingPort).execute({ orderId: id })
      if (!result.ok) throw result.error
      this.logger.log(
        `[CancelOrder] orderId=${id} cancelledInVendelo=${result.value.cancelledInVendelo} alreadyCancelled=${result.value.alreadyCancelled}`,
      )
      return { success: true, status: dto.status, ...result.value }
    }

    await this.orderRepo.updateStatus(id, dto.status as OrderStatus)
    return { success: true, status: dto.status }
  }
}
