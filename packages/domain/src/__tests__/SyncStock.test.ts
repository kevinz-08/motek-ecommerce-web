import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SyncStock, isValidOptimunCode, normalizeProductName } from '@/domain/use-cases/products/SyncStock'
import type { IStockSyncRepository, StockSyncItem } from '@/domain/repositories/IInventorySyncRepository'
import type { Product } from '@/domain/entities/Product'

// ── Factories ─────────────────────────────────────────────────────────────────

function makeProduct(overrides?: Partial<Product>): Product {
  return {
    id:         'prod-1',
    name:       'CAPUCHON BUJIA XRE 300',
    slug:       'capuchon-bujia-xre-300',
    description: '',
    price:      2_500_000,
    stock:      1,
    sku:        '9-00017',
    images:     [],
    isActive:   true,
    weightKg:   null,
    heightCm:   null,
    widthCm:    null,
    lengthCm:   null,
    categoryId: 'cat-1',
    createdAt:  new Date('2025-01-01'),
    updatedAt:  new Date('2025-01-01'),
    ...overrides,
  }
}

function makeItem(overrides?: Partial<StockSyncItem>): StockSyncItem {
  return {
    codigo: '9-00017',
    nombre: 'CAPUCHON BUJIA XRE 300',
    stock:  5,
    detal:  2_500_000,
    ...overrides,
  }
}

function makeRepo(overrides?: Partial<IStockSyncRepository>): IStockSyncRepository {
  return {
    findBySkus:            vi.fn().mockResolvedValue(new Map()),
    findByNormalizedNames: vi.fn().mockResolvedValue(new Map()),
    bulkUpdateStockAndPrice: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SyncStock.execute', () => {
  let repo: IStockSyncRepository
  let useCase: SyncStock

  beforeEach(() => {
    repo = makeRepo()
    useCase = new SyncStock(repo)
  })

  // ── Validación de entrada ──────────────────────────────────────────────────

  it('retorna VALIDATION_ERROR si el array de items está vacío', async () => {
    const result = await useCase.execute([])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  it('no llama a ninguna query de repositorio si el array está vacío', async () => {
    await useCase.execute([])
    expect(repo.findBySkus).not.toHaveBeenCalled()
    expect(repo.findByNormalizedNames).not.toHaveBeenCalled()
    expect(repo.bulkUpdateStockAndPrice).not.toHaveBeenCalled()
  })

  // ── Match por SKU (Paso 1) ─────────────────────────────────────────────────

  it('actualiza stock y precio cuando el producto se encuentra por SKU', async () => {
    const product = makeProduct({ stock: 1, price: 2_000_000 })
    repo = makeRepo({
      findBySkus: vi.fn().mockResolvedValue(new Map([['9-00017', product]])),
    })
    useCase = new SyncStock(repo)

    const result = await useCase.execute([makeItem({ stock: 5, detal: 2_500_000 })])

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.updated).toBe(1)
    expect(result.value.unchanged).toBe(0)
    expect(repo.bulkUpdateStockAndPrice).toHaveBeenCalledWith([
      { productId: 'prod-1', stock: 5, price: 2_500_000 },
    ])
  })

  it('registra unchanged y no escribe en BD cuando stock y precio son idénticos', async () => {
    const product = makeProduct({ stock: 5, price: 2_500_000 })
    repo = makeRepo({
      findBySkus: vi.fn().mockResolvedValue(new Map([['9-00017', product]])),
    })
    useCase = new SyncStock(repo)

    const result = await useCase.execute([makeItem({ stock: 5, detal: 2_500_000 })])

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.updated).toBe(0)
    expect(result.value.unchanged).toBe(1)
    expect(repo.bulkUpdateStockAndPrice).not.toHaveBeenCalled()
  })

  it('actualiza solo stock cuando el precio no cambió', async () => {
    const product = makeProduct({ stock: 1, price: 2_500_000 })
    repo = makeRepo({
      findBySkus: vi.fn().mockResolvedValue(new Map([['9-00017', product]])),
    })
    useCase = new SyncStock(repo)

    const result = await useCase.execute([makeItem({ stock: 10, detal: 2_500_000 })])

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.updated).toBe(1)
    expect(repo.bulkUpdateStockAndPrice).toHaveBeenCalledWith([
      { productId: 'prod-1', stock: 10, price: 2_500_000 },
    ])
  })

  it('actualiza solo precio cuando el stock no cambió', async () => {
    const product = makeProduct({ stock: 5, price: 2_000_000 })
    repo = makeRepo({
      findBySkus: vi.fn().mockResolvedValue(new Map([['9-00017', product]])),
    })
    useCase = new SyncStock(repo)

    const result = await useCase.execute([makeItem({ stock: 5, detal: 2_500_000 })])

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.updated).toBe(1)
  })

  // ── DETAL = 0 (precio sin configurar en Optimun) ──────────────────────────

  it('no actualiza precio cuando DETAL es 0, pero sí actualiza stock', async () => {
    const product = makeProduct({ stock: 1, price: 2_500_000 })
    repo = makeRepo({
      findBySkus: vi.fn().mockResolvedValue(new Map([['9-00017', product]])),
    })
    useCase = new SyncStock(repo)

    const result = await useCase.execute([makeItem({ stock: 5, detal: 0 })])

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.skippedPrice).toContain('9-00017')
    expect(repo.bulkUpdateStockAndPrice).toHaveBeenCalledWith([
      { productId: 'prod-1', stock: 5, price: undefined },
    ])
  })

  it('no escribe en BD cuando DETAL es 0 y el stock tampoco cambió', async () => {
    const product = makeProduct({ stock: 5, price: 2_500_000 })
    repo = makeRepo({
      findBySkus: vi.fn().mockResolvedValue(new Map([['9-00017', product]])),
    })
    useCase = new SyncStock(repo)

    const result = await useCase.execute([makeItem({ stock: 5, detal: 0 })])

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.unchanged).toBe(1)
    expect(repo.bulkUpdateStockAndPrice).not.toHaveBeenCalled()
  })

  // ── Fallback por nombre (Paso 2) ──────────────────────────────────────────

  it('resuelve por nombre cuando el código llega corrupto (fecha auto-formateada)', async () => {
    const product = makeProduct()
    const normalizedName = normalizeProductName('CAPUCHON BUJIA XRE 300')
    repo = makeRepo({
      findBySkus:            vi.fn().mockResolvedValue(new Map()),
      findByNormalizedNames: vi.fn().mockResolvedValue(new Map([[normalizedName, product]])),
    })
    useCase = new SyncStock(repo)

    const result = await useCase.execute([
      makeItem({ codigo: 'ene-23', nombre: 'CAPUCHON BUJIA XRE 300', stock: 5 }),
    ])

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.fixedByNombre).toHaveLength(1)
    expect(result.value.fixedByNombre[0]).toMatchObject({
      codigoCorrupto: 'ene-23',
      nombreMatch:    'CAPUCHON BUJIA XRE 300',
    })
    expect(result.value.updated).toBe(1)
  })

  it('resuelve por nombre cuando el SKU tiene formato válido pero no existe en la web', async () => {
    const product = makeProduct()
    const normalizedName = normalizeProductName('CAPUCHON BUJIA XRE 300')
    repo = makeRepo({
      findBySkus:            vi.fn().mockResolvedValue(new Map()),
      findByNormalizedNames: vi.fn().mockResolvedValue(new Map([[normalizedName, product]])),
    })
    useCase = new SyncStock(repo)

    // Código con formato válido pero que no existe en la DB de la web
    const result = await useCase.execute([
      makeItem({ codigo: '9-00017', nombre: 'CAPUCHON BUJIA XRE 300', stock: 5 }),
    ])

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.fixedByNombre).toHaveLength(1)
  })

  it('no llama a findByNormalizedNames cuando todos los SKUs tienen match', async () => {
    const product = makeProduct()
    repo = makeRepo({
      findBySkus: vi.fn().mockResolvedValue(new Map([['9-00017', product]])),
    })
    useCase = new SyncStock(repo)

    await useCase.execute([makeItem()])

    expect(repo.findByNormalizedNames).not.toHaveBeenCalled()
  })

  it('no llama a findBySkus para items con código corrupto — va directo al fallback', async () => {
    const product = makeProduct()
    const normalizedName = normalizeProductName('CAPUCHON BUJIA XRE 300')
    repo = makeRepo({
      findBySkus:            vi.fn().mockResolvedValue(new Map()),
      findByNormalizedNames: vi.fn().mockResolvedValue(new Map([[normalizedName, product]])),
    })
    useCase = new SyncStock(repo)

    await useCase.execute([makeItem({ codigo: '44931' })])

    // findBySkus se llama con un array vacío (no hay códigos válidos)
    expect(repo.findBySkus).not.toHaveBeenCalled()
    expect(repo.findByNormalizedNames).toHaveBeenCalled()
  })

  // ── notFound ──────────────────────────────────────────────────────────────

  it('agrega a notFound cuando el producto no existe en la web por SKU ni por nombre', async () => {
    repo = makeRepo({
      findBySkus:            vi.fn().mockResolvedValue(new Map()),
      findByNormalizedNames: vi.fn().mockResolvedValue(new Map()),
    })
    useCase = new SyncStock(repo)

    const result = await useCase.execute([makeItem()])

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.notFound).toHaveLength(1)
    expect(result.value.notFound[0]).toMatchObject({ codigo: '9-00017', nombre: 'CAPUCHON BUJIA XRE 300' })
    expect(result.value.updated).toBe(0)
  })

  it('no llama a bulkUpdateStockAndPrice si todos los items están en notFound', async () => {
    repo = makeRepo({
      findBySkus:            vi.fn().mockResolvedValue(new Map()),
      findByNormalizedNames: vi.fn().mockResolvedValue(new Map()),
    })
    useCase = new SyncStock(repo)

    await useCase.execute([makeItem()])

    expect(repo.bulkUpdateStockAndPrice).not.toHaveBeenCalled()
  })

  // ── Comportamiento en batch ────────────────────────────────────────────────

  it('procesa correctamente un batch mixto: actualizado, sin cambios y no encontrado', async () => {
    const prod1 = makeProduct({ id: 'prod-1', sku: '9-00017', stock: 1, price: 2_500_000 })
    const prod2 = makeProduct({ id: 'prod-2', sku: '10-4009', stock: 5, price: 12_000_000 })

    repo = makeRepo({
      findBySkus: vi.fn().mockResolvedValue(new Map([
        ['9-00017', prod1],
        ['10-4009', prod2],
      ])),
      findByNormalizedNames: vi.fn().mockResolvedValue(new Map()),
    })
    useCase = new SyncStock(repo)

    const result = await useCase.execute([
      makeItem({ codigo: '9-00017',  stock: 10, detal: 2_500_000 }), // stock cambia → updated
      makeItem({ codigo: '10-4009', stock: 5,  detal: 12_000_000 }), // sin cambios → unchanged
      makeItem({ codigo: '9-99999', stock: 3,  detal: 5_000_000 }),  // no existe → notFound
    ])

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.updated).toBe(1)
    expect(result.value.unchanged).toBe(1)
    expect(result.value.notFound).toHaveLength(1)
  })

  it('hace máximo 3 queries a BD independiente del número de productos', async () => {
    const items: StockSyncItem[] = Array.from({ length: 100 }, (_, i) =>
      makeItem({ codigo: `9-${String(i).padStart(5, '0')}`, nombre: `PRODUCTO ${i}` }),
    )
    const skuMap = new Map(
      items.map(i => [i.codigo, makeProduct({ id: `prod-${i.codigo}`, sku: i.codigo, stock: 0 })]),
    )
    repo = makeRepo({ findBySkus: vi.fn().mockResolvedValue(skuMap) })
    useCase = new SyncStock(repo)

    await useCase.execute(items)

    expect(repo.findBySkus).toHaveBeenCalledTimes(1)
    expect(repo.findByNormalizedNames).not.toHaveBeenCalled()
    expect(repo.bulkUpdateStockAndPrice).toHaveBeenCalledTimes(1)
  })

  // ── Idempotencia ──────────────────────────────────────────────────────────

  it('es idempotente: ejecutar dos veces con el mismo export produce el mismo resultado', async () => {
    const product = makeProduct({ stock: 5, price: 2_500_000 })
    const skuMap = new Map([['9-00017', product]])

    repo = makeRepo({ findBySkus: vi.fn().mockResolvedValue(skuMap) })
    useCase = new SyncStock(repo)

    const item = makeItem({ stock: 5, detal: 2_500_000 })
    const result1 = await useCase.execute([item])
    const result2 = await useCase.execute([item])

    expect(result1.ok).toBe(true)
    expect(result2.ok).toBe(true)
    if (!result1.ok || !result2.ok) return
    expect(result1.value.updated).toBe(0)
    expect(result2.value.updated).toBe(0)
    expect(repo.bulkUpdateStockAndPrice).not.toHaveBeenCalled()
  })

  // ── Error de infraestructura ───────────────────────────────────────────────

  it('retorna INTERNAL_ERROR si bulkUpdateStockAndPrice lanza', async () => {
    const product = makeProduct({ stock: 0 })
    repo = makeRepo({
      findBySkus:              vi.fn().mockResolvedValue(new Map([['9-00017', product]])),
      bulkUpdateStockAndPrice: vi.fn().mockRejectedValue(new Error('DB timeout')),
    })
    useCase = new SyncStock(repo)

    const result = await useCase.execute([makeItem({ stock: 5 })])

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('INTERNAL_ERROR')
  })

  it('retorna INTERNAL_ERROR si findBySkus lanza', async () => {
    repo = makeRepo({
      findBySkus: vi.fn().mockRejectedValue(new Error('Connection refused')),
    })
    useCase = new SyncStock(repo)

    await expect(useCase.execute([makeItem()])).resolves.toMatchObject({
      ok: false,
    })
  })

  // ── Modo preview (apply: false) ────────────────────────────────────────────

  it('en modo preview calcula el reporte pero no escribe en BD', async () => {
    const product = makeProduct({ stock: 1, price: 2_000_000 })
    repo = makeRepo({
      findBySkus: vi.fn().mockResolvedValue(new Map([['9-00017', product]])),
    })
    useCase = new SyncStock(repo)

    const result = await useCase.execute([makeItem({ stock: 5, detal: 2_500_000 })], { apply: false })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.updated).toBe(1)
    expect(repo.bulkUpdateStockAndPrice).not.toHaveBeenCalled()
  })

  it('el reporte incluye updatedItems con valores antes/después', async () => {
    const product = makeProduct({ id: 'prod-1', sku: '9-00017', name: 'CAPUCHON BUJIA XRE 300', stock: 1, price: 2_000_000 })
    repo = makeRepo({
      findBySkus: vi.fn().mockResolvedValue(new Map([['9-00017', product]])),
    })
    useCase = new SyncStock(repo)

    const result = await useCase.execute([makeItem({ stock: 5, detal: 2_500_000 })], { apply: false })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.updatedItems).toEqual([{
      productId: 'prod-1',
      sku: '9-00017',
      name: 'CAPUCHON BUJIA XRE 300',
      oldStock: 1,
      newStock: 5,
      oldPrice: 2_000_000,
      newPrice: 2_500_000,
    }])
  })

  it('updatedItems reporta newPrice null cuando DETAL era 0', async () => {
    const product = makeProduct({ stock: 1, price: 2_500_000 })
    repo = makeRepo({
      findBySkus: vi.fn().mockResolvedValue(new Map([['9-00017', product]])),
    })
    useCase = new SyncStock(repo)

    const result = await useCase.execute([makeItem({ stock: 5, detal: 0 })])

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.updatedItems[0]?.newPrice).toBeNull()
  })

  // ── Reporte ───────────────────────────────────────────────────────────────

  it('el reporte incluye executedAt como Date y durationMs >= 0', async () => {
    const product = makeProduct()
    repo = makeRepo({
      findBySkus: vi.fn().mockResolvedValue(new Map([['9-00017', product]])),
    })
    useCase = new SyncStock(repo)

    const result = await useCase.execute([makeItem()])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.executedAt).toBeInstanceOf(Date)
    expect(result.value.durationMs).toBeGreaterThanOrEqual(0)
  })
})

// ── Pure helpers ──────────────────────────────────────────────────────────────

describe('isValidOptimunCode', () => {
  const valid = ['9-00017', '10-4009', '9-MSCPL', '6-CDIDTMN', '5-1002F', '9-002']
  const invalid = ['ene-23', '44931', '15/03/2024', 'abr-05', '01-01-2024', '', '9-', '-001']

  it.each(valid)('acepta código válido de Optimun: %s', code => {
    expect(isValidOptimunCode(code)).toBe(true)
  })

  it.each(invalid)('rechaza código inválido o corrupto: %s', code => {
    expect(isValidOptimunCode(code)).toBe(false)
  })
})

describe('normalizeProductName', () => {
  it('convierte a mayúsculas', () => {
    expect(normalizeProductName('capuchon bujia')).toBe('CAPUCHON BUJIA')
  })

  it('elimina tildes', () => {
    expect(normalizeProductName('RÁMAL ELÉCTRICO')).toBe('RAMAL ELECTRICO')
  })

  it('colapsa espacios múltiples', () => {
    expect(normalizeProductName('FILTRO  AIRE   BWS')).toBe('FILTRO AIRE BWS')
  })

  it('elimina espacios al inicio y al final', () => {
    expect(normalizeProductName('  BUJIA BOSCH  ')).toBe('BUJIA BOSCH')
  })

  it('produce el mismo resultado para variantes con/sin acento', () => {
    expect(normalizeProductName('RÁMAL')).toBe(normalizeProductName('RAMAL'))
  })
})
