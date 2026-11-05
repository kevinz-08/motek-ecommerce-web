import { describe, it, expect, vi } from 'vitest'
import { DuplicateProduct } from '@/domain/use-cases/products/DuplicateProduct'
import { buildDuplicateIdentity } from '@/domain/shared/duplicateIdentity'
import type { IProductRepository, IProductDuplicator } from '@/domain/repositories/IProductRepository'
import type { Product } from '@/domain/entities/Product'

function makeProduct(overrides?: Partial<Product>): Product {
  return {
    id: 'prod-1',
    name: 'Pastillas Brembo',
    slug: 'pastillas-brembo',
    description: 'desc',
    price: 8_500_000,
    stock: 7,
    sku: 'FRE-001',
    images: ['https://res.cloudinary.com/x/a.jpg'],
    isActive: true,
    weightKg: null,
    heightCm: null,
    widthCm: null,
    lengthCm: null,
    categoryId: 'cat-1',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    ...overrides,
  }
}

function makeRepo(source: Product | null, createDuplicate: IProductDuplicator['createDuplicate']) {
  return {
    findById: vi.fn().mockResolvedValue(source),
    createDuplicate: vi.fn(createDuplicate),
  } as unknown as IProductRepository & IProductDuplicator & {
    createDuplicate: ReturnType<typeof vi.fn>
  }
}

describe('buildDuplicateIdentity', () => {
  const src = { name: 'Pastillas Brembo', slug: 'pastillas-brembo', sku: 'FRE-001' }

  it('intento 1 agrega el sufijo simple', () => {
    expect(buildDuplicateIdentity(src, 1)).toEqual({
      name: 'Pastillas Brembo (Copia)',
      slug: 'pastillas-brembo-copia',
      sku: 'FRE-001-COPIA',
    })
  })

  it('intento ≥ 2 numera la copia', () => {
    expect(buildDuplicateIdentity(src, 3)).toEqual({
      name: 'Pastillas Brembo (Copia 3)',
      slug: 'pastillas-brembo-copia-3',
      sku: 'FRE-001-COPIA-3',
    })
  })

  it('no encadena sufijos al duplicar una copia', () => {
    const copy = { name: 'Pastillas Brembo (Copia 2)', slug: 'pastillas-brembo-copia-2', sku: 'FRE-001-COPIA-2' }
    expect(buildDuplicateIdentity(copy, 1)).toEqual(buildDuplicateIdentity(src, 1))
  })
})

describe('DuplicateProduct', () => {
  it('crea la copia con la identidad del primer intento', async () => {
    const created = makeProduct({ id: 'prod-2', isActive: false, stock: 0 })
    const repo = makeRepo(makeProduct(), async () => created)

    const result = await new DuplicateProduct(repo).execute('prod-1')

    expect(result).toEqual({ ok: true, value: created })
    expect(repo.createDuplicate).toHaveBeenCalledWith('prod-1', {
      name: 'Pastillas Brembo (Copia)',
      slug: 'pastillas-brembo-copia',
      sku: 'FRE-001-COPIA',
    })
  })

  it('NOT_FOUND si el producto no existe', async () => {
    const repo = makeRepo(null, async () => 'CONFLICT')
    const result = await new DuplicateProduct(repo).execute('nope')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
    expect(repo.createDuplicate).not.toHaveBeenCalled()
  })

  it('NOT_FOUND si el producto está en la papelera', async () => {
    const repo = makeRepo(makeProduct({ deletedAt: new Date() }), async () => 'CONFLICT')
    const result = await new DuplicateProduct(repo).execute('prod-1')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
    expect(repo.createDuplicate).not.toHaveBeenCalled()
  })

  it('NOT_FOUND si el origen desaparece entre la lectura y la copia', async () => {
    const repo = makeRepo(makeProduct(), async () => null)
    const result = await new DuplicateProduct(repo).execute('prod-1')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
  })

  it('reintenta con el siguiente número ante CONFLICT', async () => {
    const created = makeProduct({ id: 'prod-3', isActive: false, stock: 0 })
    const repo = makeRepo(makeProduct(), async (_id, identity) =>
      identity.slug === 'pastillas-brembo-copia-3' ? created : 'CONFLICT',
    )

    const result = await new DuplicateProduct(repo).execute('prod-1')

    expect(result.ok).toBe(true)
    expect(repo.createDuplicate).toHaveBeenCalledTimes(3)
  })

  it('INTERNAL_ERROR al agotar los intentos', async () => {
    const repo = makeRepo(makeProduct(), async () => 'CONFLICT')
    const result = await new DuplicateProduct(repo).execute('prod-1')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('INTERNAL_ERROR')
    expect(repo.createDuplicate).toHaveBeenCalledTimes(10)
  })

  it('INTERNAL_ERROR si el repositorio lanza', async () => {
    const repo = makeRepo(makeProduct(), async () => {
      throw new Error('db down')
    })
    const result = await new DuplicateProduct(repo).execute('prod-1')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('INTERNAL_ERROR')
  })
})
