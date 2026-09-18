import {
  Body, Controller, ForbiddenException, Get, HttpCode, Inject, Ip, Logger,
  NotFoundException, Param, Post, ServiceUnavailableException,
} from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import {
  IOrderRepository, IProductRepository, IPaymentService, IVendeloShippingPort,
  ICouponRepository, IShipmentRepository, CreateOrder, QuoteShipping, ValidateCoupon,
  Order,
} from '@motek/domain'
import {
  ORDER_REPOSITORY, PRODUCT_REPOSITORY, PAYMENT_SERVICE, VENDELO_SHIPPING_PORT,
  COUPON_REPOSITORY, SHIPMENT_REPOSITORY,
} from '../infrastructure/injection-tokens'
import { MercadoPagoService } from '../infrastructure/services/MercadoPagoService'
import { ResendEmailService } from '../infrastructure/services/ResendEmailService'
import { TurnstileService } from '../infrastructure/services/TurnstileService'
import { PrismaService } from '../infrastructure/database/prisma.service'
import { Public } from '../auth/decorators/public.decorator'
import { CreateGuestOrderDto, RequestTrackingLinkDto } from './dto/create-guest-order.dto'

const MAX_SHIPPING_CHARGE_CENTS = parseInt(process.env['MAX_SHIPPING_CHARGE_CENTS'] ?? '5000000', 10)

/**
 * Cuántos pedidos PENDING sin resolver puede acumular un mismo email de contacto
 * dentro de la ventana, antes de que se le corte el checkout de invitado.
 *
 * El ThrottlerGuard limita por IP, pero no ve un ataque repartido entre muchas
 * IPs (botnet, proxies residenciales). El email de contacto es el otro eje
 * barato de limitar: un comprador real no abre 5 pedidos sin pagar en una hora,
 * y quien prueba tarjetas robadas sí.
 */
const MAX_PENDING_PER_EMAIL = 5
const PENDING_WINDOW_MS = 60 * 60 * 1000

/**
 * Proyección pública de un pedido para la página de seguimiento.
 *
 * Es una lista explícita, nunca la entidad cruda: quien tiene el enlace no es
 * necesariamente el comprador (un enlace se reenvía, se filtra de un historial
 * compartido). Por eso quedan fuera `trackingToken`, el `contactEmail` completo,
 * `vendeloOrderId` y los IDs internos de pago.
 */
interface TrackingView {
  id: string
  status: Order['status']
  createdAt: Date
  total: number
  shippingTotal: number
  paymentProvider: Order['paymentProvider']
  deliveryMethod: Order['deliveryMethod']
  isGuest: boolean
  /** Email parcialmente oculto — confirma al comprador que es su pedido sin exponer la dirección. */
  contactEmailMasked: string
  shippingAddress: { fullName: string; address: string; city: string; department?: string }
  items: Array<{ name: string; sku: string; quantity: number; priceAtPurchase: number }>
  shipment: { status: string; trackingNumber: string | null; carrier: string | null } | null
}

/** Deja visibles las dos primeras letras y el dominio: "carlos@gmail.com" queda "ca****@gmail.com". */
function maskEmail(email: string): string {
  const at = email.indexOf('@')
  if (at < 1) return '***'
  const local = email.slice(0, at)
  const domain = email.slice(at)
  const stars = '*'.repeat(Math.max(1, local.length - 2))
  return `${local.slice(0, 2)}${stars}${domain}`
}

/**
 * Endpoints de compra sin registro.
 *
 * Viven en un controlador aparte del autenticado a propósito. El `JwtAuthGuard`
 * es global y se desactiva ruta por ruta con `@Public()`; meter rutas
 * "a veces autenticadas" dentro de `OrdersController` obligaría a ramificar la
 * identidad dentro de cada handler, que es justo donde nacen los bugs de
 * autorización. Dos controladores = dos superficies, cada una con sus propios
 * límites de rate y su propia auditoría.
 */
@ApiTags('orders / guest')
@Controller('orders')
export class GuestOrdersController {
  private readonly logger = new Logger(GuestOrdersController.name)

  constructor(
    @Inject(ORDER_REPOSITORY)      private readonly orderRepo: IOrderRepository,
    @Inject(PRODUCT_REPOSITORY)    private readonly productRepo: IProductRepository,
    @Inject(PAYMENT_SERVICE)       private readonly wompiService: IPaymentService,
    @Inject(VENDELO_SHIPPING_PORT) private readonly shippingPort: IVendeloShippingPort,
    @Inject(COUPON_REPOSITORY)     private readonly couponRepo: ICouponRepository,
    @Inject(SHIPMENT_REPOSITORY)   private readonly shipmentRepo: IShipmentRepository,
    private readonly mercadoPagoService: MercadoPagoService,
    private readonly emailService: ResendEmailService,
    private readonly turnstile: TurnstileService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Crea un pedido sin sesión e inicia el pago.
   *
   * Es el único endpoint que abre una transacción en la pasarela sin
   * autenticación, así que carga con todos los frenos: kill-switch de admin,
   * captcha, tope de pedidos PENDING por email y rate limit por IP.
   */
  @Post('guest')
  @Public()
  @HttpCode(201)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Crear pedido como invitado (sin cuenta) e iniciar pago' })
  async createGuestOrder(@Body() dto: CreateGuestOrderDto, @Ip() ip: string) {
    // 1. Kill-switch: default FALSE si no existe la fila. Deliberado — el flujo
    //    se activa desde /admin/configuracion cuando el negocio decide abrirlo,
    //    no por el solo hecho de desplegar el código.
    const flag = await this.prisma.client.settings.findUnique({
      where: { key: 'GUEST_CHECKOUT_ENABLED' },
    })
    if (flag?.value !== 'true') {
      throw new ForbiddenException('La compra sin registro no está disponible. Inicia sesión o crea una cuenta.')
    }

    // 2. Captcha. Fail-closed: sin verificación válida no se crea nada.
    const captcha = await this.turnstile.verify(dto.captchaToken, ip)
    if (!captcha.ok) {
      if (captcha.reason === 'not_configured' || captcha.reason === 'unavailable') {
        // 503 y no 403: el problema es nuestro, no del cliente. El mensaje
        // empuja al camino que sigue funcionando (comprar con cuenta).
        throw new ServiceUnavailableException(
          'No pudimos completar la verificación de seguridad. Intenta de nuevo o inicia sesión con tu cuenta.',
        )
      }
      throw new ForbiddenException('No pudimos verificar que no eres un robot. Recarga la página e intenta de nuevo.')
    }

    // 3. Tope de pedidos PENDING por email dentro de la ventana.
    const since = new Date(Date.now() - PENDING_WINDOW_MS)
    const pending = await this.orderRepo.countPendingByEmailSince(dto.contactEmail, since)
    if (pending >= MAX_PENDING_PER_EMAIL) {
      this.logger.warn(
        `[GuestCheckout] Tope de pedidos PENDING alcanzado email=${maskEmail(dto.contactEmail)} pending=${pending}`,
      )
      throw new ForbiddenException(
        'Tienes varios pedidos sin completar el pago. Termina o cancela alguno antes de crear otro.',
      )
    }

    // 4. Pasarela. COD nunca llega acá: lo cortan el DTO y el use case.
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

    const shippingOnlineSetting = await this.prisma.client.settings.findUnique({
      where: { key: 'SHIPPING_ONLINE_ENABLED' },
    })
    const chargeShippingOnline = shippingOnlineSetting?.value === 'true'

    const useCase = new CreateOrder(
      this.orderRepo,
      this.productRepo,
      paymentService,
      new QuoteShipping(this.productRepo, this.shippingPort),
      new ValidateCoupon(this.couponRepo, this.orderRepo),
    )
    const result = await useCase.execute({
      customer: {
        kind: 'guest',
        email: dto.contactEmail,
        name: dto.guestName,
        phone: dto.guestPhone,
        marketingConsent: dto.marketingConsent,
      },
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

    const order = result.value.order

    if (result.value.shippingQuoteFallback) {
      this.logger.warn(
        `orderId=${order.id}: no se pudo cotizar/cargar el envío en línea — `
        + 'se creó con shippingTotal=0 (negocio absorbe el flete, comportamiento legado)',
      )
    }

    // 5. Sello de aceptación de políticas. Lo pone el servidor a partir de
    //    `acceptsPolicies`, no el cliente: un timestamp elegido por el navegador
    //    no sirve como evidencia ante una auditoría.
    await this.prisma.client.order.update({
      where: { id: order.id },
      data: { policiesAcceptedAt: new Date() },
    })

    // Fire-and-forget, igual que en el flujo autenticado: el email nunca bloquea
    // ni hace fallar la respuesta del pedido.
    this.emailService
      .sendOrderReceived(order, order.contactEmail)
      .catch((e) => this.logger.error(`Email sendOrderReceived failed orderId=${order.id}: ${e}`))

    this.logger.log(`[GuestCheckout] Pedido creado orderId=${order.id} provider=${order.paymentProvider}`)

    // `trackingToken` sale SOLO acá y en el correo de confirmación. Ninguna
    // lectura posterior lo devuelve.
    return {
      order: this.stripToken(order),
      payment: result.value.payment,
      trackingToken: order.trackingToken,
      trackingUrl: `/pedidos/seguimiento?token=${encodeURIComponent(order.trackingToken)}`,
    }
  }

  /**
   * Consulta pública de un pedido por su `trackingToken`.
   *
   * El token es una credencial de 256 bits: no se loguea nunca, y un token que
   * no resuelve devuelve el mismo 404 genérico que un pedido inexistente —
   * distinguir "token inválido" de "pedido borrado" sería un oráculo.
   */
  @Get('track/:token')
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Consultar un pedido por token de seguimiento (sin sesión)' })
  async track(@Param('token') token: string): Promise<TrackingView> {
    const order = await this.orderRepo.findByTrackingToken(token)
    if (!order) throw new NotFoundException('Pedido no encontrado')

    const shipment = await this.shipmentRepo.findByOrderId(order.id)

    return {
      id: order.id,
      status: order.status,
      createdAt: order.createdAt,
      total: order.total,
      shippingTotal: order.shippingTotal,
      paymentProvider: order.paymentProvider,
      deliveryMethod: order.deliveryMethod,
      isGuest: order.userId === null,
      contactEmailMasked: maskEmail(order.contactEmail),
      shippingAddress: {
        fullName: order.shippingAddress.fullName,
        address: order.shippingAddress.address,
        city: order.shippingAddress.city,
        department: order.shippingAddress.department,
      },
      items: (order.items ?? []).map((i) => ({
        name: i.productSnapshot?.name ?? 'Producto',
        sku: i.productSnapshot?.sku ?? '',
        quantity: i.quantity,
        priceAtPurchase: i.priceAtPurchase,
      })),
      shipment: shipment
        ? { status: shipment.status, trackingNumber: shipment.trackingNumber, carrier: shipment.carrier }
        : null,
    }
  }

  /**
   * Reenvía por correo los enlaces de seguimiento de los pedidos de invitado
   * asociados a un email ("perdí el correo de confirmación").
   *
   * Responde SIEMPRE 202 con el mismo cuerpo, exista o no el email y tenga o no
   * pedidos. Cualquier diferencia observable convertiría este endpoint en un
   * oráculo para saber quién compró en la tienda. La única señal llega a la
   * bandeja de entrada del dueño del correo.
   */
  @Post('track/request-link')
  @Public()
  @HttpCode(202)
  @Throttle({ default: { limit: 3, ttl: 600_000 } })
  @ApiOperation({ summary: 'Reenviar por email los enlaces de seguimiento de pedidos de invitado' })
  async requestTrackingLink(@Body() dto: RequestTrackingLinkDto, @Ip() ip: string) {
    const genericResponse = {
      message: 'Si hay pedidos asociados a ese correo, te enviamos los enlaces de seguimiento.',
    }

    const captcha = await this.turnstile.verify(dto.captchaToken, ip)
    if (!captcha.ok) {
      // Incluso acá la respuesta es la genérica: un captcha rechazado tampoco
      // debe revelar nada, y quien lo envió ya sabe que su token era inválido.
      this.logger.warn(`[TrackingLink] Captcha rechazado (${captcha.reason})`)
      return genericResponse
    }

    const orders = await this.orderRepo.findUnclaimedByEmail(dto.email)

    if (orders.length > 0) {
      this.emailService
        .sendGuestTrackingLinks(
          dto.email,
          orders.map((o) => ({
            id: o.id,
            trackingToken: o.trackingToken,
            createdAt: o.createdAt,
            total: o.total,
          })),
        )
        .catch((e) => this.logger.error(`sendGuestTrackingLinks failed: ${e}`))
    }

    return genericResponse
  }

  /**
   * Quita `trackingToken` del pedido antes de devolverlo dentro de una respuesta
   * que ya lo expone por separado — así ningún consumidor lo lee "por accidente"
   * desde el objeto `order` y lo propaga a un log o a otra vista.
   */
  private stripToken(order: Order): Omit<Order, 'trackingToken'> {
    const { trackingToken: _t, ...rest } = order
    return rest
  }
}
