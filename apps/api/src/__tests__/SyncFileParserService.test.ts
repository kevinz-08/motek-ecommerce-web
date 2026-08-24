import { describe, it, expect, beforeEach } from 'vitest'
import { BadRequestException } from '@nestjs/common'
import * as XLSX from 'xlsx'
import { SyncFileParserService } from '../infrastructure/services/SyncFileParserService'

// ── Fixtures ──────────────────────────────────────────────────────────────────

type DataRow = [string, string, string, string, number, number, number, number, number, number]

// 10 empty strings — forces aoa_to_sheet to create a real row for blank lines,
// preserving 0-based indices so ROW.HEADERS=1 and ROW.DATA_START=3 stay correct.
const BLANK_ROW = Array(10).fill('') as string[]

const HEADER_ROW = [
  '',
  'CÒDIGO',          // B — Optimun exports with accent (CÒDIGO)
  'NOMBRE PRODUCTO',
  'PRESENTACIÒN',
  'EXISTENCIAS',
  'COSTO',
  'DISTRIBUIDOR',
  'MAYORISTA',
  'MRT',
  'DETAL',
]

/**
 * Builds an .xlsx Buffer that mirrors the exact Optimun export layout:
 *   Row 1 (index 0): blank
 *   Row 2 (index 1): column headers
 *   Row 3 (index 2): blank separator
 *   Row 4+ (index 3+): product data
 */
function buildXlsx(dataRows: DataRow[]): Buffer {
  const sheet = XLSX.utils.aoa_to_sheet([
    BLANK_ROW,     // row 1: blank (must have cells so aoa_to_sheet preserves the index)
    HEADER_ROW,    // row 2: headers
    BLANK_ROW,     // row 3: blank separator
    ...dataRows,
  ])

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, 'Hoja1')
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}

const VALID_ROW: DataRow = [
  '',          // col A — always blank
  '9-00017',  // col B — CÓDIGO
  'CAPUCHON BUJIA XRE 300',  // col C — NOMBRE PRODUCTO
  'UNIDAD',   // col D — PRESENTACIÓN
  1,          // col E — EXISTENCIAS
  10115,      // col F — COSTO
  21250,      // col G — DISTRIBUIDOR
  22500,      // col H — MAYORISTA
  0,          // col I — MRT
  25000,      // col J — DETAL (pesos COP)
]

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SyncFileParserService.parse', () => {
  let service: SyncFileParserService

  beforeEach(() => {
    service = new SyncFileParserService()
  })

  // ── Happy path ──────────────────────────────────────────────────────────────

  it('parsea correctamente los 4 campos requeridos de una fila válida', () => {
    const buffer = buildXlsx([VALID_ROW])
    const [row] = service.parse(buffer)

    expect(row.codigo).toBe('9-00017')
    expect(row.nombre).toBe('CAPUCHON BUJIA XRE 300')
    expect(row.stock).toBe(1)
    expect(row.detal).toBe(2_500_000) // 25000 pesos × 100 = centavos
  })

  it('convierte DETAL de pesos a centavos COP (× 100)', () => {
    const row: DataRow = [...VALID_ROW]
    row[9] = 120000 // $120.000 COP
    const [result] = service.parse(buildXlsx([row]))
    expect(result.detal).toBe(12_000_000)
  })

  it('parsea múltiples filas y preserva el orden', () => {
    const row1: DataRow = [...VALID_ROW]
    const row2: DataRow = [...VALID_ROW]
    row1[1] = '9-00017'
    row2[1] = '10-4009'

    const results = service.parse(buildXlsx([row1, row2]))
    expect(results).toHaveLength(2)
    expect(results[0]!.codigo).toBe('9-00017')
    expect(results[1]!.codigo).toBe('10-4009')
  })

  it('ignora columnas que no son CÓDIGO, NOMBRE, EXISTENCIAS ni DETAL', () => {
    const [result] = service.parse(buildXlsx([VALID_ROW]))
    expect(result).toStrictEqual({
      codigo: '9-00017',
      nombre: 'CAPUCHON BUJIA XRE 300',
      stock: 1,
      detal: 2_500_000,
    })
  })

  // ── Limpieza de strings ─────────────────────────────────────────────────────

  it('aplica trim al CÓDIGO con trailing spaces (artefacto de Optimun)', () => {
    const row: DataRow = [...VALID_ROW]
    row[1] = '9-00017         ' as string
    const [result] = service.parse(buildXlsx([row]))
    expect(result.codigo).toBe('9-00017')
  })

  it('aplica trim al NOMBRE con trailing spaces', () => {
    const row: DataRow = [...VALID_ROW]
    row[2] = 'CAPUCHON BUJIA XRE 300                            ' as string
    const [result] = service.parse(buildXlsx([row]))
    expect(result.nombre).toBe('CAPUCHON BUJIA XRE 300')
  })

  // ── Valores numéricos en borde ──────────────────────────────────────────────

  it('acepta EXISTENCIAS = 0 (producto sin stock)', () => {
    const row: DataRow = [...VALID_ROW]
    row[4] = 0
    const [result] = service.parse(buildXlsx([row]))
    expect(result.stock).toBe(0)
  })

  it('acepta DETAL = 0 y lo convierte a 0 centavos (sin multiplicación inválida)', () => {
    const row: DataRow = [...VALID_ROW]
    row[9] = 0
    const [result] = service.parse(buildXlsx([row]))
    expect(result.detal).toBe(0)
  })

  it('trata EXISTENCIAS no numérico como 0', () => {
    const row: DataRow = [...VALID_ROW]
    ;(row as unknown[])[4] = 'N/A'
    const [result] = service.parse(buildXlsx([row]))
    expect(result.stock).toBe(0)
  })

  it('trata DETAL no numérico como 0 centavos', () => {
    const row: DataRow = [...VALID_ROW]
    ;(row as unknown[])[9] = 'N/A'
    const [result] = service.parse(buildXlsx([row]))
    expect(result.detal).toBe(0)
  })

  it('trata EXISTENCIAS negativo como 0 (nunca stock negativo en la web)', () => {
    const row: DataRow = [...VALID_ROW]
    row[4] = -5
    const [result] = service.parse(buildXlsx([row]))
    expect(result.stock).toBe(0)
  })

  // ── Filas ignoradas ─────────────────────────────────────────────────────────

  it('ignora filas con CÓDIGO vacío (filas de separador en el export)', () => {
    const emptyRow: DataRow = ['', '', 'NOMBRE SIN CÓDIGO', 'UNIDAD', 5, 0, 0, 0, 0, 10000]
    const results = service.parse(buildXlsx([VALID_ROW, emptyRow]))
    expect(results).toHaveLength(1)
    expect(results[0]!.codigo).toBe('9-00017')
  })

  it('no cuenta filas de separador vacías hacia el mínimo de productos', () => {
    const rows: DataRow[] = [
      VALID_ROW,
      ['', '', '', '', 0, 0, 0, 0, 0, 0], // vacía
      ['', '', '', '', 0, 0, 0, 0, 0, 0], // vacía
    ]
    const results = service.parse(buildXlsx(rows))
    expect(results).toHaveLength(1)
  })

  // ── isValidCode ─────────────────────────────────────────────────────────────

  describe('isValidCode', () => {
    const validCodes = ['9-00017', '10-4009', '9-MSCPL', '6-CDIDTMN', '5-1002F', '9-002']
    const corruptedCodes = ['ene-23', '44931', '15/03/2024', 'abr-05', '01-01-2024', '']

    it.each(validCodes)('acepta código válido: %s', (code) => {
      expect(service.isValidCode(code)).toBe(true)
    })

    it.each(corruptedCodes)('rechaza código corrupto/fecha: %s', (code) => {
      expect(service.isValidCode(code)).toBe(false)
    })
  })

  // ── Seguridad y validación estructural ──────────────────────────────────────

  it('lanza BadRequestException si el buffer supera 5 MB', () => {
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1)
    expect(() => service.parse(oversized)).toThrow(BadRequestException)
  })

  it('lanza BadRequestException si el buffer no es un .xlsx válido', () => {
    const garbage = Buffer.from('esto no es un xlsx')
    expect(() => service.parse(garbage)).toThrow(BadRequestException)
  })

  it('lanza BadRequestException si el buffer es un CSV disfrazado de xlsx', () => {
    // SheetJS can read CSVs but the parsed sheet has no matching headers
    const csv = Buffer.from('COD,NOMBRE,STOCK\n9-001,PRODUCTO,5')
    expect(() => service.parse(csv)).toThrow(BadRequestException)
  })

  it('lanza BadRequestException si falta la columna DETAL', () => {
    const wb = XLSX.utils.book_new()
    // Header sin DETAL — el parser no puede encontrar los 4 encabezados requeridos
    const headerRow = [
      'CÒDIGO', 'NOMBRE PRODUCTO', 'PRESENTACIÒN', 'EXISTENCIAS',
      'COSTO', 'DISTRIBUIDOR', 'MAYORISTA', 'MRT',
    ]
    const ws = XLSX.utils.aoa_to_sheet([headerRow, [...VALID_ROW].slice(0, 8)])
    XLSX.utils.book_append_sheet(wb, ws, 'Hoja1')
    const buffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))

    expect(() => service.parse(buffer)).toThrow(BadRequestException)
    expect(() => service.parse(buffer)).toThrow(/DETAL/)
  })

  it('lanza BadRequestException si el header de EXISTENCIAS es incorrecto', () => {
    const wb = XLSX.utils.book_new()
    // STOCK en lugar de EXISTENCIAS — el parser reporta cuál falta
    const wrongHeader = ['CÒDIGO', 'NOMBRE PRODUCTO', 'PRESENTACIÒN', 'STOCK', 'COSTO', 'DISTRIBUIDOR', 'MAYORISTA', 'MRT', 'DETAL']
    const ws = XLSX.utils.aoa_to_sheet([wrongHeader, VALID_ROW])
    XLSX.utils.book_append_sheet(wb, ws, 'Hoja1')
    const buffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))

    expect(() => service.parse(buffer)).toThrow(BadRequestException)
    expect(() => service.parse(buffer)).toThrow(/EXISTENCIAS/)
  })

  it('lanza BadRequestException si no hay ninguna fila con CÓDIGO válido', () => {
    const allEmpty: DataRow[] = [
      ['', '', 'SOLO NOMBRE', 'UNIDAD', 1, 0, 0, 0, 0, 10000],
      ['', '', 'OTRO NOMBRE', 'UNIDAD', 2, 0, 0, 0, 0, 20000],
    ]
    expect(() => service.parse(buildXlsx(allEmpty))).toThrow(BadRequestException)
  })

  it('incluye el nombre del header faltante en el mensaje de error', () => {
    const wb = XLSX.utils.book_new()
    // CLAVE en lugar de CÓDIGO — el parser dice que falta "CODIGO"
    const wrongHeader = ['CLAVE', 'NOMBRE PRODUCTO', 'PRESENTACIÒN', 'EXISTENCIAS', 'COSTO', 'DISTRIBUIDOR', 'MAYORISTA', 'MRT', 'DETAL']
    const ws = XLSX.utils.aoa_to_sheet([wrongHeader, VALID_ROW])
    XLSX.utils.book_append_sheet(wb, ws, 'Hoja1')
    const buffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))

    expect(() => service.parse(buffer)).toThrow(/CODIGO/)
  })

  // ── Tolerancia de acentos en headers ────────────────────────────────────────

  it('acepta CÓDIGO con acento (CÒDIGO) en el header — formato real de Optimun', () => {
    // El export real usa CÒDIGO con acento en la O; el parser debe normalizarlo
    expect(() => service.parse(buildXlsx([VALID_ROW]))).not.toThrow()
  })

  it('parsea correctamente cuando los headers están en la fila 1 (sin fila en blanco inicial)', () => {
    // Algunos exports de Optimun omiten la primera fila en blanco
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([
      HEADER_ROW,  // row 0: headers — sin fila en blanco previa
      BLANK_ROW,   // row 1: separador
      VALID_ROW,   // row 2: datos
    ])
    XLSX.utils.book_append_sheet(wb, ws, 'Hoja1')
    const buffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))

    const [result] = service.parse(buffer)
    expect(result.codigo).toBe('9-00017')
    expect(result.detal).toBe(2_500_000)
  })
})
