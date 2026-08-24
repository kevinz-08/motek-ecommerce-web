import 'reflect-metadata'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BadRequestException, HttpException } from '@nestjs/common'
import { Test } from '@nestjs/testing'

vi.mock('@motek/database', () => ({ prisma: { client: {} } }))

import { AdminSyncController } from '../admin/admin-sync.controller'
import { SyncFileParserService } from '../infrastructure/services/SyncFileParserService'
import { INVENTORY_REPOSITORY } from '../infrastructure/injection-tokens'
import type { RawStockRow } from '../infrastructure/services/SyncFileParserService'
import type { SyncReport } from '@motek/domain'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PARSED_ROW: RawStockRow = {
  codigo: '9-00017',
  nombre: 'CAPUCHON BUJIA XRE 300',
  stock:  5,
  detal:  2_500_000,
}

const SYNC_REPORT: SyncReport = {
  updated:       1,
  unchanged:     0,
  notFound:      [],
  fixedByNombre: [],
  skippedPrice:  [],
  updatedItems:  [],
  executedAt:    new Date(),
  durationMs:    12,
}

function makeFile(buffer = Buffer.from('xlsx-data')): { buffer: Buffer; originalname: string } {
  return { buffer, originalname: 'STOCK.xlsx' }
}

// ── Mocks de dependencias ─────────────────────────────────────────────────────

function makeSyncRepo(overrides?: Record<string, unknown>) {
  return {
    findBySkus:              vi.fn().mockResolvedValue(new Map()),
    findByNormalizedNames:   vi.fn().mockResolvedValue(new Map()),
    bulkUpdateStockAndPrice: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function makeParser(rows: RawStockRow[] = [PARSED_ROW]) {
  return { parse: vi.fn().mockReturnValue(rows) }
}

async function buildController(
  parserMock = makeParser(),
  syncRepoMock = makeSyncRepo(),
) {
  const module = await Test.createTestingModule({
    controllers: [AdminSyncController],
    providers: [
      { provide: SyncFileParserService,  useValue: parserMock },
      { provide: INVENTORY_REPOSITORY,   useValue: syncRepoMock },
    ],
  }).compile()

  return {
    controller: module.get(AdminSyncController),
    parser:     parserMock,
    syncRepo:   syncRepoMock,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AdminSyncController.previewStock', () => {
  beforeEach(() => { vi.clearAllMocks() })

  // ── Validación del archivo ─────────────────────────────────────────────────

  it('lanza BadRequestException si no se adjunta ningún archivo', async () => {
    const { controller } = await buildController()
    await expect(controller.previewStock(undefined)).rejects.toThrow(BadRequestException)
  })

  it('lanza BadRequestException si el file está presente pero sin buffer', async () => {
    const { controller } = await buildController()
    const badFile = { buffer: undefined as unknown as Buffer, originalname: 'test.xlsx' }
    await expect(controller.previewStock(badFile)).rejects.toThrow(BadRequestException)
  })

  it('propaga BadRequestException del parser cuando el archivo es inválido', async () => {
    const parser = { parse: vi.fn().mockImplementation(() => { throw new BadRequestException('Columna inválida') }) }
    const { controller } = await buildController(parser)

    await expect(controller.previewStock(makeFile())).rejects.toThrow(BadRequestException)
    await expect(controller.previewStock(makeFile())).rejects.toThrow('Columna inválida')
  })

  // ── Flujo exitoso ──────────────────────────────────────────────────────────

  it('retorna el SyncReport cuando la sincronización es exitosa', async () => {
    const product = {
      id: 'prod-1', name: 'CAPUCHON BUJIA XRE 300', slug: 'capuchon', description: '',
      price: 2_000_000, stock: 1, sku: '9-00017', images: [], isActive: true,
      categoryId: 'cat-1', createdAt: new Date(), updatedAt: new Date(),
    }
    const syncRepo = makeSyncRepo({
      findBySkus: vi.fn().mockResolvedValue(new Map([['9-00017', product]])),
    })
    const { controller } = await buildController(makeParser(), syncRepo)

    const result = await controller.previewStock(makeFile())

    expect(result.updated).toBe(1)
    expect(result.notFound).toHaveLength(0)
  })

  it('llama al parser con el buffer exacto del archivo recibido', async () => {
    const buf = Buffer.from('real-xlsx-bytes')
    const syncRepo = makeSyncRepo({
      findBySkus: vi.fn().mockResolvedValue(new Map()),
      findByNormalizedNames: vi.fn().mockResolvedValue(new Map()),
    })
    const parser = makeParser([])
    // parser returns [] but use case needs items → will return VALIDATION_ERROR
    // so we need at least one item; override to avoid that edge case
    parser.parse.mockReturnValue([PARSED_ROW])

    const syncRepoFull = makeSyncRepo({
      findBySkus: vi.fn().mockResolvedValue(new Map()),
      findByNormalizedNames: vi.fn().mockResolvedValue(new Map()),
    })
    const { controller } = await buildController(parser, syncRepoFull)

    await controller.previewStock({ buffer: buf, originalname: 'test.xlsx' })

    expect(parser.parse).toHaveBeenCalledWith(buf)
  })

  it('mapea RawStockRow a StockSyncItem correctamente antes de llamar al use case', async () => {
    const product = {
      id: 'prod-1', name: 'CAPUCHON BUJIA XRE 300', slug: 'capuchon', description: '',
      price: 2_500_000, stock: 5, sku: '9-00017', images: [], isActive: true,
      categoryId: 'cat-1', createdAt: new Date(), updatedAt: new Date(),
    }
    const syncRepo = makeSyncRepo({
      findBySkus: vi.fn().mockResolvedValue(new Map([['9-00017', product]])),
    })
    const { controller } = await buildController(makeParser([PARSED_ROW]), syncRepo)

    const result = await controller.previewStock(makeFile())

    // Stock y precio idénticos al producto → unchanged, no write
    expect(result.unchanged).toBe(1)
    expect(syncRepo.bulkUpdateStockAndPrice).not.toHaveBeenCalled()
  })

  // ── Manejo de errores del dominio ──────────────────────────────────────────

  it('lanza HttpException 422 cuando el use case retorna VALIDATION_ERROR', async () => {
    // Use case returns VALIDATION_ERROR when items array is empty
    const parser = { parse: vi.fn().mockReturnValue([]) }
    const { controller } = await buildController(parser)

    try {
      await controller.previewStock(makeFile())
      expect.fail('debería haber lanzado')
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException)
      expect((e as HttpException).getStatus()).toBe(422)
    }
  })

  it('lanza HttpException 500 cuando el use case retorna INTERNAL_ERROR', async () => {
    const syncRepo = makeSyncRepo({
      findBySkus: vi.fn().mockRejectedValue(new Error('DB timeout')),
    })
    const { controller } = await buildController(makeParser(), syncRepo)

    try {
      await controller.previewStock(makeFile())
      expect.fail('debería haber lanzado')
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException)
      expect((e as HttpException).getStatus()).toBe(500)
    }
  })

  // ── Reporte completo ───────────────────────────────────────────────────────

  it('el reporte incluye notFound para productos del export sin match en la web', async () => {
    const syncRepo = makeSyncRepo({
      findBySkus:            vi.fn().mockResolvedValue(new Map()),
      findByNormalizedNames: vi.fn().mockResolvedValue(new Map()),
    })
    const { controller } = await buildController(makeParser(), syncRepo)

    const result = await controller.previewStock(makeFile())

    expect(result.notFound).toHaveLength(1)
    expect(result.notFound[0]).toMatchObject({ codigo: '9-00017' })
  })

  it('el reporte incluye fixedByNombre cuando el código es corrupto pero el nombre matchea', async () => {
    const corruptRow: RawStockRow = { ...PARSED_ROW, codigo: 'ene-23' }
    const product = {
      id: 'prod-1', name: 'CAPUCHON BUJIA XRE 300', slug: 'capuchon', description: '',
      price: 2_000_000, stock: 0, sku: '9-00017', images: [], isActive: true,
      categoryId: 'cat-1', createdAt: new Date(), updatedAt: new Date(),
    }
    const normalizedName = 'CAPUCHON BUJIA XRE 300'
    const syncRepo = makeSyncRepo({
      findBySkus:            vi.fn().mockResolvedValue(new Map()),
      findByNormalizedNames: vi.fn().mockResolvedValue(new Map([[normalizedName, product]])),
    })
    const { controller } = await buildController(makeParser([corruptRow]), syncRepo)

    const result = await controller.previewStock(makeFile())

    expect(result.fixedByNombre).toHaveLength(1)
    expect(result.fixedByNombre[0]).toMatchObject({ codigoCorrupto: 'ene-23' })
    expect(result.updated).toBe(1)
  })

  it('el reporte incluye skippedPrice para productos con DETAL = 0', async () => {
    const zeroDetalRow: RawStockRow = { ...PARSED_ROW, detal: 0 }
    const product = {
      id: 'prod-1', name: 'CAPUCHON BUJIA XRE 300', slug: 'capuchon', description: '',
      price: 2_500_000, stock: 5, sku: '9-00017', images: [], isActive: true,
      categoryId: 'cat-1', createdAt: new Date(), updatedAt: new Date(),
    }
    const syncRepo = makeSyncRepo({
      findBySkus: vi.fn().mockResolvedValue(new Map([['9-00017', product]])),
    })
    const { controller } = await buildController(makeParser([zeroDetalRow]), syncRepo)

    const result = await controller.previewStock(makeFile())

    expect(result.skippedPrice).toContain('9-00017')
  })

  // ── Idempotencia ──────────────────────────────────────────────────────────

  it('ejecutar dos veces el mismo archivo produce el mismo resultado', async () => {
    const product = {
      id: 'prod-1', name: 'CAPUCHON BUJIA XRE 300', slug: 'capuchon', description: '',
      price: 2_500_000, stock: 5, sku: '9-00017', images: [], isActive: true,
      categoryId: 'cat-1', createdAt: new Date(), updatedAt: new Date(),
    }
    const syncRepo = makeSyncRepo({
      findBySkus: vi.fn().mockResolvedValue(new Map([['9-00017', product]])),
    })
    const { controller } = await buildController(makeParser(), syncRepo)

    const r1 = await controller.previewStock(makeFile())
    const r2 = await controller.previewStock(makeFile())

    expect(r1.updated).toBe(r2.updated)
    expect(r1.unchanged).toBe(r2.unchanged)
    expect(syncRepo.bulkUpdateStockAndPrice).not.toHaveBeenCalled()
  })

  // ── previewStock nunca escribe en BD ───────────────────────────────────────

  it('previewStock nunca llama a bulkUpdateStockAndPrice, incluso con cambios detectados', async () => {
    const product = {
      id: 'prod-1', name: 'CAPUCHON BUJIA XRE 300', slug: 'capuchon', description: '',
      price: 2_000_000, stock: 1, sku: '9-00017', images: [], isActive: true,
      categoryId: 'cat-1', createdAt: new Date(), updatedAt: new Date(),
    }
    const syncRepo = makeSyncRepo({
      findBySkus: vi.fn().mockResolvedValue(new Map([['9-00017', product]])),
    })
    const { controller } = await buildController(makeParser(), syncRepo)

    const result = await controller.previewStock(makeFile())

    expect(result.updated).toBe(1)
    expect(result.updatedItems).toHaveLength(1)
    expect(syncRepo.bulkUpdateStockAndPrice).not.toHaveBeenCalled()
  })
})

describe('AdminSyncController.applyStock', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('escribe las actualizaciones confirmadas en BD y retorna appliedCount', async () => {
    const syncRepo = makeSyncRepo()
    const { controller } = await buildController(makeParser(), syncRepo)

    const result = await controller.applyStock({
      updates: [{ productId: 'prod-1', stock: 5, price: 2_500_000 }],
    })

    expect(syncRepo.bulkUpdateStockAndPrice).toHaveBeenCalledWith([
      { productId: 'prod-1', stock: 5, price: 2_500_000 },
    ])
    expect(result).toEqual({ appliedCount: 1 })
  })

  it('lanza HttpException 500 si bulkUpdateStockAndPrice falla', async () => {
    const syncRepo = makeSyncRepo({
      bulkUpdateStockAndPrice: vi.fn().mockRejectedValue(new Error('DB timeout')),
    })
    const { controller } = await buildController(makeParser(), syncRepo)

    await expect(
      controller.applyStock({ updates: [{ productId: 'prod-1', stock: 5 }] }),
    ).rejects.toThrow(HttpException)
  })
})
