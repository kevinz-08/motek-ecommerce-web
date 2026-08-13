import { IStockSyncRepository, StockSyncItem, StockSyncUpdate } from '@/domain/repositories/IInventorySyncRepository'
import { Product } from '@/domain/entities/Product'
import { Result, ok, err, AppError } from '@/domain/shared/Result'

// ── Pure helpers (exported for reuse in infrastructure layer) ─────────────────

/**
 * Devuelve true para códigos con el formato real de Optimun: {dígitos}-{alfanumérico}.
 * Ejemplos válidos:   9-00017 | 10-4009 | 9-MSCPL | 6-CDIDTMN
 * Ejemplos corruptos: ene-23  | 44931   | 15/03/2024 | 01-01-2024
 *
 * El $ al final es crítico: sin él, "01-01-2024" pasa porque "01" y "0" coinciden
 * antes del segundo guión.
 */
export function isValidOptimunCode(code: string): boolean {
  return /^\d+-[A-Za-z0-9]+$/.test(code)
}

/**
 * Normaliza un nombre de producto para comparación accent-insensitive.
 * Aplica la misma transformación que la implementación del repositorio en BD.
 */
export function normalizeProductName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Output types ──────────────────────────────────────────────────────────────

export type SyncReport = {
  /** Productos cuyo stock o precio fue modificado en esta ejecución. */
  readonly updated: number
  /** Productos encontrados pero sin cambios reales — no se escribió en BD. */
  readonly unchanged: number
  /** Productos del export de Optimun sin match en la web (no se crean). */
  readonly notFound: ReadonlyArray<{ codigo: string; nombre: string }>
  /**
   * Productos cuyo CÓDIGO llegó corrupto o sin match, pero se resolvieron
   * por NOMBRE PRODUCTO como fallback.
   */
  readonly fixedByNombre: ReadonlyArray<{ codigoCorrupto: string; nombreMatch: string }>
  /**
   * SKUs donde DETAL era 0 en Optimun — el precio en la web no se tocó.
   * Permite auditar qué productos tienen precio sin configurar en el local.
   */
  readonly skippedPrice: ReadonlyArray<string>
  /**
   * Detalle de cada producto que cambió (o cambiaría, en modo preview) —
   * incluye valores antes/después para mostrar en el reporte al admin.
   * `newPrice: null` significa que el precio no se tocó (DETAL era 0).
   */
  readonly updatedItems: ReadonlyArray<{
    productId: string
    sku: string
    name: string
    oldStock: number
    newStock: number
    oldPrice: number
    newPrice: number | null
  }>
  readonly executedAt: Date
  readonly durationMs: number
}

// ── Use case ──────────────────────────────────────────────────────────────────

/**
 * Sincroniza stock y precio de los productos de la web con el export de Optimun.
 *
 * Garantías:
 *   - **Solo actualiza, nunca crea ni elimina.** Los productos del export sin match
 *     en la web quedan en notFound[]; los productos de la web sin presencia en el
 *     export no se tocan.
 *   - **Idempotente.** Ejecutar dos veces el mismo export produce el mismo resultado.
 *   - **Verificación en dos pasos.** Primero busca por CÓDIGO (SKU). Si no hay match
 *     (código corrupto o SKU desalineado entre sistemas), reintenta por NOMBRE PRODUCTO
 *     normalizado.
 *   - **DETAL = 0 nunca sobreescribe el precio.** Productos sin precio configurado
 *     en Optimun no mutan el precio de la web.
 *   - **Batch-first.** Máximo 3 queries a BD por ejecución, independiente del número
 *     de productos en el export.
 *   - **Modo preview.** Con `{ apply: false }` calcula el reporte completo sin
 *     escribir en BD — permite que el admin revise los cambios antes de confirmarlos.
 */
export class SyncStock {
  constructor(private readonly syncRepo: IStockSyncRepository) {}

  async execute(
    items: StockSyncItem[],
    options?: { apply?: boolean },
  ): Promise<Result<SyncReport>> {
    const apply = options?.apply ?? true

    if (items.length === 0) {
      return err(new AppError('VALIDATION_ERROR', 'No se recibieron ítems para sincronizar'))
    }

    const startedAt = Date.now()

    // ── Paso 1: separar códigos válidos de corruptos ───────────────────────────
    const [validCodeItems, corruptedCodeItems] = partition(items, i =>
      isValidOptimunCode(i.codigo),
    )

    // ── Paso 2: batch lookup por SKU (una sola query) ─────────────────────────
    let skuMap: Map<string, Product>
    try {
      skuMap =
        validCodeItems.length > 0
          ? await this.syncRepo.findBySkus(validCodeItems.map(i => i.codigo))
          : new Map<string, Product>()
    } catch (e) {
      return err(new AppError('INTERNAL_ERROR', 'Error al consultar productos por SKU', e))
    }

    // ── Paso 3: batch lookup por nombre para los que no tuvieron match por SKU ─
    const needsNameFallback = [
      ...corruptedCodeItems,
      ...validCodeItems.filter(i => !skuMap.has(i.codigo)),
    ]

    let nameMap: Map<string, Product>
    try {
      nameMap =
        needsNameFallback.length > 0
          ? await this.syncRepo.findByNormalizedNames(
              needsNameFallback.map(i => normalizeProductName(i.nombre)),
            )
          : new Map<string, Product>()
    } catch (e) {
      return err(new AppError('INTERNAL_ERROR', 'Error al consultar productos por nombre', e))
    }

    // ── Paso 4: resolver cada ítem y acumular reporte ─────────────────────────
    const report = {
      updated:        0,
      unchanged:      0,
      notFound:       [] as { codigo: string; nombre: string }[],
      fixedByNombre:  [] as { codigoCorrupto: string; nombreMatch: string }[],
      skippedPrice:   [] as string[],
      updatedItems:   [] as SyncReport['updatedItems'][number][],
    }

    const updates: StockSyncUpdate[] = []

    for (const item of items) {
      const { product, resolvedByNombre } = this.resolveProduct(item, skuMap, nameMap)

      if (!product) {
        report.notFound.push({ codigo: item.codigo, nombre: item.nombre })
        continue
      }

      if (resolvedByNombre) {
        report.fixedByNombre.push({
          codigoCorrupto: item.codigo,
          nombreMatch:    item.nombre,
        })
      }

      const newPrice = item.detal > 0 ? item.detal : undefined

      if (newPrice === undefined) {
        report.skippedPrice.push(product.sku)
      }

      const stockChanged = product.stock !== item.stock
      const priceChanged = newPrice !== undefined && product.price !== newPrice

      if (!stockChanged && !priceChanged) {
        report.unchanged++
        continue
      }

      updates.push({ productId: product.id, stock: item.stock, price: newPrice })
      report.updatedItems.push({
        productId: product.id,
        sku:       product.sku,
        name:      product.name,
        oldStock:  product.stock,
        newStock:  item.stock,
        oldPrice:  product.price,
        newPrice:  newPrice ?? null,
      })
      report.updated++
    }

    // ── Paso 5: escribir en BD (una sola transacción) ─────────────────────────
    // En modo preview (apply: false) el reporte se calcula igual pero no se
    // persiste — el admin decide si confirma con una llamada posterior.
    if (apply && updates.length > 0) {
      try {
        await this.syncRepo.bulkUpdateStockAndPrice(updates)
      } catch (e) {
        return err(
          new AppError('INTERNAL_ERROR', 'Error al escribir actualizaciones de stock en la BD', e),
        )
      }
    }

    return ok({
      ...report,
      executedAt: new Date(),
      durationMs: Date.now() - startedAt,
    })
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private resolveProduct(
    item: StockSyncItem,
    skuMap:  Map<string, Product>,
    nameMap: Map<string, Product>,
  ): { product: Product | null; resolvedByNombre: boolean } {
    const bySkу = skuMap.get(item.codigo) ?? null
    if (bySkу) return { product: bySkу, resolvedByNombre: false }

    const byName = nameMap.get(normalizeProductName(item.nombre)) ?? null
    return { product: byName, resolvedByNombre: byName !== null }
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function partition<T>(arr: T[], predicate: (x: T) => boolean): [T[], T[]] {
  const pass: T[] = []
  const fail: T[] = []
  for (const x of arr) {
    if (predicate(x)) pass.push(x)
    else fail.push(x)
  }
  return [pass, fail]
}
