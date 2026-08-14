/**
 * Barrel del paquete @motek/domain.
 *
 * Exporta toda la capa de dominio: entidades, interfaces de repositorio,
 * contratos de servicios, use cases y la abstracción Result<T,E>.
 *
 * Regla: este paquete no importa NADA externo (ni Prisma, ni Next, ni fetch).
 * Solo TypeScript puro. Los consumidores (apps/web, apps/api) inyectan
 * las implementaciones concretas.
 */

// ── Entidades ────────────────────────────────────────────────────────────────
export * from './entities/Category'
export * from './entities/Coupon'
export * from './entities/Order'
export * from './entities/Product'
export * from './entities/ProductDescription'
export * from './entities/RecipientTrust'
export * from './entities/Shipment'
export * from './entities/ShipmentException'
export * from './entities/User'

// ── Interfaces de repositorio ────────────────────────────────────────────────
export * from './repositories/ICouponRepository'
export * from './repositories/IInventorySyncRepository'
export * from './repositories/IOrderRepository'
export * from './repositories/IProductDescriptionRepository'
export * from './repositories/IProductRepository'
export * from './repositories/IShipmentRepository'
export * from './repositories/IVendeloShippingPort'
export * from './repositories/IUserRepository'

// ── Contratos de servicios ───────────────────────────────────────────────────
export * from './services/IAlertNotificationPort'
export * from './services/IPaymentService'
export * from './services/IRecipientTrustStrategy'

// ── Shared ───────────────────────────────────────────────────────────────────
export * from './shared/Result'
export * from './shared/constants'

// ── Use cases ────────────────────────────────────────────────────────────────
export * from './use-cases/coupons/ValidateCoupon'
export * from './use-cases/orders/ConfirmPayment'
export * from './use-cases/orders/CreateOrder'
export * from './use-cases/orders/SyncShipmentStatus'
export * from './use-cases/products/GetProductBySlug'
export * from './use-cases/products/ListProducts'
export * from './use-cases/products/SyncStock'
export * from './use-cases/products/UpdateStock'
export * from './use-cases/products/UpsertProductDescription'
export * from './use-cases/shipping/CreateShipments'
export * from './use-cases/shipping/QuoteShipping'
export * from './use-cases/shipping/ResolveShipmentException'
