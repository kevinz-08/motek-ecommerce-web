import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UpsertProductDescription } from '@/domain/use-cases/products/UpsertProductDescription'
import type { IProductRepository } from '@/domain/repositories/IProductRepository'
import type { IProductDescriptionRepository } from '@/domain/repositories/IProductDescriptionRepository'
import type { Product } from '@/domain/entities/Product'
import type { ProductDescription, UpsertDescriptionInput } from '@/domain/entities/ProductDescription'

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

function makeInput(overrides?: Partial<UpsertDescriptionInput>): UpsertDescriptionInput {
  return {
    productId: 'prod-1',
    benefits: [],
    compatibility: [],
    ...overrides,
  }
}

function makeDescription(overrides?: Partial<ProductDescription>): ProductDescription {
  return {
    id: 'desc-1',
    productId: 'prod-1',
    benefits: [],
    compatibility: [],
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    ...overrides,
  }
}

function makeProductRepo(overrides?: Partial<IProductRepository>): IProductRepository {
  return {
    findById:      vi.fn().mockResolvedValue(makeProduct()),
    findBySlug:    vi.fn(),
    findBySku:     vi.fn(),
    findAll:       vi.fn(),
    findLowStock:  vi.fn(),
    save:          vi.fn(),
    update:        vi.fn(),
    updateStock:   vi.fn(),
    decrementStock: vi.fn(),
    softDelete:    vi.fn(),
    restore:       vi.fn(),
    findDeleted:   vi.fn(),
    ...overrides,
  }
}

function makeDescRepo(overrides?: Partial<IProductDescriptionRepository>): IProductDescriptionRepository {
  return {
    findByProductId: vi.fn(),
    upsert:          vi.fn().mockResolvedValue(makeDescription()),
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('UpsertProductDescription.execute', () => {
  let productRepo: IProductRepository
  let descRepo: IProductDescriptionRepository
  let useCase: UpsertProductDescription

  beforeEach(() => {
    productRepo = makeProductRepo()
    descRepo = makeDescRepo()
    useCase = new UpsertProductDescription(productRepo, descRepo)
  })

  // ── Producto no encontrado ────────────────────────────────────────────────

  it('retorna NOT_FOUND si el producto no existe', async () => {
    productRepo = makeProductRepo({ findById: vi.fn().mockResolvedValue(null) })
    useCase = new UpsertProductDescription(productRepo, descRepo)

    const result = await useCase.execute(makeInput())

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
    expect(descRepo.upsert).not.toHaveBeenCalled()
  })

  // ── Beneficios ────────────────────────────────────────────────────────────

  it('retorna VALIDATION_ERROR si hay más de 10 beneficios', async () => {
    const benefits = Array.from({ length: 11 }, (_, i) => ({ body: `Beneficio ${i}`, order: i }))
    const result = await useCase.execute(makeInput({ benefits }))

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(descRepo.upsert).not.toHaveBeenCalled()
  })

  it('retorna VALIDATION_ERROR si algún beneficio tiene body vacío', async () => {
    const result = await useCase.execute(makeInput({ benefits: [{ body: '   ', order: 0 }] }))

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(descRepo.upsert).not.toHaveBeenCalled()
  })

  it('acepta exactamente 10 beneficios', async () => {
    const benefits = Array.from({ length: 10 }, (_, i) => ({ body: `Beneficio ${i}`, order: i }))
    const result = await useCase.execute(makeInput({ benefits }))

    expect(result.ok).toBe(true)
    expect(descRepo.upsert).toHaveBeenCalled()
  })

  // ── Compatibilidad ────────────────────────────────────────────────────────

  it('retorna VALIDATION_ERROR si hay más de 30 ítems de compatibilidad', async () => {
    const compatibility = Array.from({ length: 31 }, (_, i) => ({ body: `Moto ${i}`, order: i }))
    const result = await useCase.execute(makeInput({ compatibility }))

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(descRepo.upsert).not.toHaveBeenCalled()
  })

  it('retorna VALIDATION_ERROR si algún ítem de compatibilidad tiene body vacío', async () => {
    const result = await useCase.execute(makeInput({ compatibility: [{ body: '', order: 0 }] }))

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(descRepo.upsert).not.toHaveBeenCalled()
  })

  it('acepta exactamente 30 ítems de compatibilidad', async () => {
    const compatibility = Array.from({ length: 30 }, (_, i) => ({ body: `Honda CB${i}`, order: i }))
    const result = await useCase.execute(makeInput({ compatibility }))

    expect(result.ok).toBe(true)
    expect(descRepo.upsert).toHaveBeenCalled()
  })

  it('no valida compatibilidad si el error ya vino de beneficios (corta en el primer error)', async () => {
    const benefits = Array.from({ length: 11 }, (_, i) => ({ body: `Beneficio ${i}`, order: i }))
    const compatibility = [{ body: '', order: 0 }] // también inválido
    const result = await useCase.execute(makeInput({ benefits, compatibility }))

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toContain('beneficios')
  })

  // ── Caso feliz ────────────────────────────────────────────────────────────

  it('llama a descRepo.upsert con el input completo (beneficios + compatibilidad) y retorna el resultado', async () => {
    const benefits = [{ body: 'Alta durabilidad', order: 0 }]
    const compatibility = [{ body: 'Honda CB160F 2020-2023', order: 0 }]
    const input = makeInput({ benefits, compatibility, generalDescription: 'Descripción larga' })
    const upserted = makeDescription({
      benefits: [{ id: 'b1', body: 'Alta durabilidad', order: 0 }],
      compatibility: [{ id: 'c1', body: 'Honda CB160F 2020-2023', order: 0 }],
    })
    descRepo = makeDescRepo({ upsert: vi.fn().mockResolvedValue(upserted) })
    useCase = new UpsertProductDescription(productRepo, descRepo)

    const result = await useCase.execute(input)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toEqual(upserted)
    expect(descRepo.upsert).toHaveBeenCalledWith(input)
  })

  it('acepta listas vacías de beneficios y compatibilidad (limpia ambas)', async () => {
    const result = await useCase.execute(makeInput())

    expect(result.ok).toBe(true)
    expect(descRepo.upsert).toHaveBeenCalledWith(makeInput())
  })
})
