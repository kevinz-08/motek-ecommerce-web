import { IOrderRepository, CreateOrderInput } from '@/domain/repositories/IOrderRepository'
import { IProductRepository } from '@/domain/repositories/IProductRepository'
import { IPaymentService, PaymentResult } from '@/domain/services/IPaymentService'
import { Order, ShippingAddress, BuyerInfo, PaymentProvider, DeliveryMethod } from '@/domain/entities/Order'
import { QuoteShipping } from '@/domain/use-cases/shipping/QuoteShipping'
import { ValidateCoupon } from '@/domain/use-cases/coupons/ValidateCoupon'
import { Result, ok, err, AppError } from '@/domain/shared/Result'

export interface CreateOrderUseCaseInput {
  userId: string
  // Intencionalmente sin `price`: el precio siempre se lee de la BD en el use case
  // para prevenir manipulación de precios desde el cliente.
  items: Array<{ productId: string; quantity: number }>
  shippingAddress: ShippingAddress
  buyer: BuyerInfo
  paymentProvider: PaymentProvider
  /**
   * Método de entrega elegido en el checkout. STORE_PICKUP fuerza shippingTotal=0
   * y nunca cotiza con Vendelo, sin importar chargeShippingOnline. Default
   * (undefined) = HOME_DELIVERY (comportamiento legado).
   */
  deliveryMethod?: DeliveryMethod
  /**
   * true = si el pedido es online (WOMPI/MERCADO_PAGO), cotizar el flete y sumarlo
   * al monto cobrado por la pasarela. Lo calcula el caller (orders.controller.ts)
   * a partir de Settings.SHIPPING_ONLINE_ENABLED — no es una elección del cliente.
   * Ignorado para paymentProvider 'COD' (el flete de COD nunca se cobra en línea).
   */
  chargeShippingOnline?: boolean
  /**
   * Tope defensivo en centavos COP para el flete a cobrar en línea — protege al
   * cliente de una cotización de Vendelo anormalmente alta. Ignorado si
   * chargeShippingOnline es false/undefined. El paquete domain no lee env vars;
   * el caller (NestJS) lo resuelve y lo pasa acá.
   */
  maxShippingChargeCents?: number
  /** Código del cupón a aplicar. Si no se valida correctamente, la orden no se crea. */
  couponCode?: string
}

export interface CreateOrderOutput {
  order: Order
  payment: PaymentResult | null
  /**
   * true = se pidió cobrar el flete en línea (chargeShippingOnline) pero no se pudo
   * cotizar (dirección incompleta, QuoteShipping falló, o no había collaborator
   * inyectado) — el pedido se creó igual con shippingTotal 0 (el negocio absorbe
   * el flete, igual que el comportamiento legado). El caller debe loguearlo.
   */
  shippingQuoteFallback: boolean
}

/**
 * Use case: Crear un pedido y preparar el pago.
 *
 * Flujo para pasarelas online (WOMPI/MERCADO_PAGO):
 *   1. Para cada ítem: validar cantidad > 0, buscar el producto, verificar que esté activo,
 *      verificar que haya stock suficiente.
 *   2. Calcular el subtotal de productos sumando precio × cantidad de cada ítem.
 *   3. Si chargeShippingOnline: cotizar el flete (delegando a QuoteShipping, que ya
 *      resuelve peso/dimensiones reales y el umbral de envío gratis) y sumarlo al total
 *      — así Wompi/MercadoPago cobran producto + flete en un solo cargo. Cualquier falla
 *      al cotizar degrada a shippingTotal 0 (nunca bloquea el checkout).
 *   4. Crear la orden en la BD con estado PENDING.
 *   5. Llamar a la pasarela de pago para preparar la transacción — ya lee `order.total`
 *      (que incluye el flete si aplica), sin necesidad de tocar WompiService/MercadoPagoService.
 *   6. Retornar el pedido + los datos de la transacción (referencia, firma, etc.)
 *
 * IMPORTANTE: El stock NO se descuenta aquí para pagos online. Se descuenta en
 * ConfirmPayment cuando el webhook de la pasarela confirma que el pago fue APPROVED.
 * Razón: si se descontase aquí y el cliente abandona el pago, el stock quedaría
 * reducido incorrectamente.
 *
 * Flujo para COD (pago contra entrega):
 *   No hay pasarela ni webhook que confirme el pago — el pedido se confirma al
 *   crearse. Se inserta directamente con estado PAID y el stock se descuenta en
 *   la misma transacción (`createPaidOrder`), evitando que el pedido quede
 *   colgado en PENDING (sujeto al cleanup de pedidos abandonados). `payment` en
 *   el output es `null`: no hay datos de transacción de pasarela que devolver.
 *   El flete de COD nunca se cobra en línea (Vendelo lo recauda en efectivo
 *   directamente al entregar) — shippingTotal siempre queda en 0.
 *
 * Este use case recibe las dependencias como parámetros del constructor
 * (inyección de dependencias), lo que facilita las pruebas unitarias con mocks.
 * `quoteShipping` es opcional para no romper instanciaciones existentes de 3
 * argumentos que no necesitan cobrar flete en línea.
 */
export class CreateOrder {
  constructor(
    private readonly orderRepo: IOrderRepository,
    private readonly productRepo: IProductRepository,
    private readonly paymentService: IPaymentService,
    private readonly quoteShipping?: QuoteShipping,
    private readonly validateCoupon?: ValidateCoupon,
  ) {}

  async execute(input: CreateOrderUseCaseInput): Promise<Result<CreateOrderOutput>> {
    // 1. Validar stock y calcular el subtotal de productos
    const resolvedItems: Array<{
      productId: string
      quantity: number
      priceAtPurchase: number
      /** Solo para validación de cupón — se elimina antes de persistir. */
      _categoryId: string
      _parentCategoryId: string | null
    }> = []

    let productSubtotal = 0

    for (const item of input.items) {
      if (item.quantity <= 0) {
        return err(new AppError('VALIDATION_ERROR', 'La cantidad debe ser mayor a 0'))
      }

      const found = await this.productRepo.findById(item.productId)

      if (!found) {
        return err(new AppError('NOT_FOUND', `Producto "${item.productId}" no encontrado`))
      }
      if (!found.isActive) {
        return err(new AppError('VALIDATION_ERROR', `Producto "${found.name}" no está disponible`))
      }
      if (found.stock < item.quantity) {
        return err(
          new AppError(
            'STOCK_UNAVAILABLE',
            `Stock insuficiente para "${found.name}". Disponible: ${found.stock}`,
          ),
        )
      }

      resolvedItems.push({
        productId: found.id,
        quantity: item.quantity,
        priceAtPurchase: found.price,
        // Guardamos categoryId y parentCategoryId para la validación de cupón.
        // No forman parte de CreateOrderInput — son solo datos de trabajo locales.
        _categoryId: found.categoryId,
        _parentCategoryId: found.parentCategoryId ?? null,
      })
      productSubtotal += found.price * item.quantity
    }

    // 2. Validar y aplicar cupón si se proporcionó uno.
    let discountAmount = 0
    if (input.couponCode) {
      if (!this.validateCoupon) {
        return err(new AppError('INTERNAL_ERROR', 'Validación de cupón no disponible'))
      }
      const couponResult = await this.validateCoupon.execute({
        code: input.couponCode,
        userId: input.userId,
        items: resolvedItems.map(item => ({
          productId: item.productId,
          categoryId: item._categoryId,
          parentCategoryId: item._parentCategoryId,
          price: item.priceAtPurchase,
          quantity: item.quantity,
        })),
      })
      if (!couponResult.ok) return couponResult
      discountAmount = couponResult.value.discount
    }

    // 3. Cotizar el flete si corresponde, sumarlo al total cobrado en línea.
    // Cualquier motivo de no poder cotizar degrada a shippingTotal 0 en vez de
    // bloquear el checkout (el negocio absorbe el flete, comportamiento legado).
    // Retiro en tienda: el flete siempre es $0, sin importar chargeShippingOnline.
    let shippingTotal = 0
    let shippingQuoteFallback = false

    if (
      input.deliveryMethod !== 'STORE_PICKUP'
      && input.chargeShippingOnline
      && input.paymentProvider !== 'COD'
    ) {
      const cityCode = input.shippingAddress.cityCode
      const subdivisionCode = input.shippingAddress.subdivisionCode

      if (!cityCode || !subdivisionCode || !this.quoteShipping) {
        shippingQuoteFallback = true
      } else {
        const quoteResult = await this.quoteShipping.execute({
          shippingCityCode: cityCode,
          shippingSubdivisionCode: subdivisionCode,
          items: input.items,
          paymentMethod: 'EXTERNAL_PAYMENT',
        })

        if (!quoteResult.ok) {
          shippingQuoteFallback = true
        } else if (!quoteResult.value.freeShipping) {
          const quoted = quoteResult.value.quotedShippingTotal
          shippingTotal = input.maxShippingChargeCents !== undefined
            ? Math.min(quoted, input.maxShippingChargeCents)
            : quoted
        }
        // freeShipping true → shippingTotal queda en 0, correctamente (no es fallback)
      }
    }

    const total = Math.max(0, productSubtotal - discountAmount + shippingTotal)

    const createInput: CreateOrderInput = {
      userId: input.userId,
      items: resolvedItems.map(({ _categoryId: _c, _parentCategoryId: _p, ...item }) => item),
      shippingAddress: input.shippingAddress,
      buyer: input.buyer,
      paymentProvider: input.paymentProvider,
      deliveryMethod: input.deliveryMethod ?? 'HOME_DELIVERY',
      shippingTotal,
      total,
      couponCode: input.couponCode,
      discountAmount,
    }

    // COD: no hay pasarela que esperar — el pedido se crea ya PAID y con el
    // stock descontado en la misma transacción.
    if (input.paymentProvider === 'COD') {
      let order: Order
      try {
        order = await this.orderRepo.createPaidOrder(createInput)
      } catch (e) {
        return err(new AppError('INTERNAL_ERROR', 'Error al crear el pedido', e))
      }
      return ok({ order, payment: null, shippingQuoteFallback: false })
    }

    // 4. Crear orden en DB con estado PENDING
    let order: Order
    try {
      order = await this.orderRepo.create(createInput)
    } catch (e) {
      return err(new AppError('INTERNAL_ERROR', 'Error al crear el pedido', e))
    }

    // 5. Iniciar transacción en la pasarela — lee order.total, que ya incluye
    // el flete cuando corresponde.
    let paymentResult: PaymentResult
    try {
      paymentResult = await this.paymentService.createTransaction(order)
    } catch (e) {
      return err(new AppError('PAYMENT_ERROR', 'Error al iniciar el pago', e))
    }

    return ok({ order, payment: paymentResult, shippingQuoteFallback })
  }
}
