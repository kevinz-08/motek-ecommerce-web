/**
 * Patrón Result<T, E> para manejo de errores sin excepciones.
 *
 * En lugar de hacer throw new Error(...), los use cases retornan un Result.
 * El caller verifica `result.ok` antes de acceder al valor.
 *
 * Ventajas sobre excepciones:
 *  - El tipo de error es visible en la firma de la función (no hay sorpresas)
 *  - TypeScript obliga a manejar ambos casos (ok y error)
 *  - Los errores son datos, no flujo de control especial
 *
 * Ejemplo de uso:
 * ```typescript
 * const result = await new ListProducts(repo).execute(filters)
 * if (!result.ok) {
 *   return Response.json({ error: result.error.message }, { status: 500 })
 * }
 * return Response.json(result.value)  // TypeScript sabe que value existe aquí
 * ```
 *
 * El segundo parámetro `E` por defecto es `AppError`.
 * Se puede usar `Result<Product>` o `Result<Product, SomeCustomError>`.
 */
export type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E }

/**
 * Construye un Result exitoso.
 * @param value - El valor resultante de la operación
 */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value }
}

/**
 * Construye un Result de error.
 * @param error - El error que ocurrió
 */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error }
}

/**
 * Códigos de error del dominio.
 * Cada code tiene un significado específico que los API routes mapean a un HTTP status:
 *
 *   NOT_FOUND         → 404
 *   VALIDATION_ERROR  → 422
 *   UNAUTHORIZED      → 401
 *   FORBIDDEN         → 403
 *   PAYMENT_ERROR     → 502
 *   STOCK_UNAVAILABLE → 409
 *   INTERNAL_ERROR    → 500
 */
export type AppErrorCode =
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'PAYMENT_ERROR'
  | 'STOCK_UNAVAILABLE'
  | 'INTERNAL_ERROR'

/**
 * Error estructurado del dominio.
 * Extiende Error de JavaScript para ser compatible con catch blocks.
 *
 * Ejemplo:
 * ```typescript
 * return err(new AppError('NOT_FOUND', `Producto "${slug}" no encontrado`))
 * return err(new AppError('STOCK_UNAVAILABLE', `Stock insuficiente para "${name}"`, { available: 3 }))
 * ```
 */
export class AppError extends Error {
  constructor(
    /** Código de error — usado para mapear al HTTP status correcto en API routes */
    public readonly code: AppErrorCode,
    /** Mensaje legible por humanos — se puede mostrar al usuario */
    message: string,
    /** Información adicional de contexto — solo para logs internos, nunca al cliente */
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
  }
}
