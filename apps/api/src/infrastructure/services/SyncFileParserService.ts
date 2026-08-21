import { Injectable, BadRequestException, Logger } from '@nestjs/common'
import * as XLSX from 'xlsx'

// ── Types ─────────────────────────────────────────────────────────────────────

export type RawStockRow = {
  readonly codigo: string
  readonly nombre: string
  readonly stock: number
  readonly detal: number // centavos COP (ya convertido desde pesos)
}

type ColumnMap = {
  readonly CODIGO: number
  readonly NOMBRE: number
  readonly EXISTENCIAS: number
  readonly DETAL: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

// Normalised labels to find — column positions are discovered at runtime.
const LABEL = {
  CODIGO:      'CODIGO',
  NOMBRE:      'NOMBRE PRODUCTO',
  EXISTENCIAS: 'EXISTENCIAS',
  DETAL:       'DETAL',
} as const

// Optimun codes are always: {digits}-{alphanumeric+}, with no second dash.
// e.g. 9-00017, 10-4009, 9-MSCPL, 6-CDIDTMN
// The $ anchor is critical: without it, dates like "01-01-2024" pass because
// "01" matches \d+ and "0" matches [A-Za-z0-9] before the second dash.
const VALID_CODE_RE = /^\d+-[A-Za-z0-9]+$/

// A full Optimun catalog (~750 rows) is well under 1 MB when exported.
// 5 MB is a generous ceiling that still rejects obvious non-Excel uploads.
const MAX_FILE_BYTES = 5 * 1024 * 1024

// Extend the sheet range to at least this many columns so COM-exported files
// that truncate usedRange early don't drop rightmost data columns (e.g. DETAL).
const MIN_SHEET_COLS = 20

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function normalizeHeader(s: string): string {
  return stripAccents(s).toUpperCase().trim()
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class SyncFileParserService {
  private readonly logger = new Logger(SyncFileParserService.name)

  /**
   * Parses an Optimun-exported .xlsx buffer into typed stock rows.
   * Throws BadRequestException for any structural or size violation.
   *
   * Guarantees:
   * - All string fields are trimmed.
   * - `detal` is in centavos COP (pesos × 100).
   * - `stock` and `detal` are non-negative integers (0 if unparseable).
   * - Rows with empty CÓDIGO are silently skipped.
   */
  parse(buffer: Buffer): RawStockRow[] {
    this.assertSize(buffer)

    const sheet = this.loadSheet(buffer)

    const allRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
    })

    const { rowIndex: headerRowIndex, cols } = this.locateHeaders(allRows)

    const result: RawStockRow[] = []

    for (let i = headerRowIndex + 1; i < allRows.length; i++) {
      const row = allRows[i] as unknown[]
      const codigo = String(row[cols.CODIGO] ?? '').trim()

      if (!codigo) continue

      result.push({
        codigo,
        nombre: String(row[cols.NOMBRE] ?? '').trim(),
        stock:  this.toSafeInt(row[cols.EXISTENCIAS]),
        detal:  this.toSafeInt(row[cols.DETAL]) * 100,
      })
    }

    if (result.length === 0) {
      throw new BadRequestException(
        'El archivo no contiene filas de producto válidas',
      )
    }

    this.logger.log(`Parsed ${result.length} rows from Optimun export`)
    return result
  }

  /**
   * Returns true for codes that follow the Optimun format ({digits}-{alnum}).
   * Codes that fail this check are likely date values auto-formatted by Excel.
   * Exported so the use-case layer can use it without coupling to infrastructure.
   */
  isValidCode(code: string): boolean {
    return VALID_CODE_RE.test(code)
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private assertSize(buffer: Buffer): void {
    if (buffer.byteLength > MAX_FILE_BYTES) {
      throw new BadRequestException(
        `El archivo supera el límite de ${MAX_FILE_BYTES / 1024 / 1024} MB`,
      )
    }
  }

  private loadSheet(buffer: Buffer): XLSX.WorkSheet {
    let workbook: XLSX.WorkBook
    try {
      workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false })
    } catch {
      throw new BadRequestException('El archivo no es un .xlsx válido')
    }

    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      throw new BadRequestException('El archivo .xlsx no contiene hojas')
    }

    const sheet = workbook.Sheets[sheetName]!

    // COM-exported files truncate usedRange at the last non-empty column they
    // detect, silently dropping rightmost columns. Extend to MIN_SHEET_COLS so
    // SheetJS always reads all potential data columns regardless of how Optimun
    // generated the file.
    const ref = sheet['!ref']
    if (ref) {
      const range = XLSX.utils.decode_range(ref)
      if (range.e.c < MIN_SHEET_COLS - 1) {
        range.e.c = MIN_SHEET_COLS - 1
        sheet['!ref'] = XLSX.utils.encode_range(range)
      }
    }

    return sheet
  }

  /**
   * Scans the first 5 rows for a row that contains all 4 required headers
   * (CODIGO, NOMBRE PRODUCTO, EXISTENCIAS, DETAL) in ANY column and ANY order.
   * Returns the row index and discovered column positions.
   *
   * This makes the parser layout-agnostic: it works regardless of which column
   * each field occupies, how many blank rows precede the header row, or whether
   * Optimun adds/removes leading columns between export versions.
   *
   * If no row has all 4 headers, reports what is missing from the best candidate
   * row (the one with the most matching headers found).
   */
  private locateHeaders(rows: unknown[][]): { rowIndex: number; cols: ColumnMap } {
    type Candidate = { rowIndex: number; found: Partial<Record<keyof ColumnMap, number>>; count: number }
    let best: Candidate = { rowIndex: -1, found: {}, count: 0 }

    for (let r = 0; r < Math.min(rows.length, 5); r++) {
      const row = (rows[r] ?? []) as unknown[]
      const found: Partial<Record<keyof ColumnMap, number>> = {}

      for (let c = 0; c < row.length; c++) {
        const h = normalizeHeader(String(row[c] ?? ''))
        if (h === LABEL.CODIGO)           found.CODIGO      = c
        else if (h === LABEL.NOMBRE)      found.NOMBRE      = c
        else if (h === LABEL.EXISTENCIAS) found.EXISTENCIAS = c
        else if (h === LABEL.DETAL)       found.DETAL       = c
      }

      const count = Object.keys(found).length

      if (count === 4) {
        return { rowIndex: r, cols: found as ColumnMap }
      }

      if (count > best.count) {
        best = { rowIndex: r, found, count }
      }
    }

    const missingLabels = (Object.keys(LABEL) as Array<keyof typeof LABEL>)
      .filter(k => best.found[k] === undefined)
      .map(k => `"${LABEL[k]}"`)

    throw new BadRequestException(
      `No se encontraron todos los encabezados requeridos en las primeras 5 filas. ` +
      `Faltantes: ${missingLabels.join(', ')}. ` +
      `Verifica que sea el export estándar de Optimun (.xlsx).`,
    )
  }

  private toSafeInt(value: unknown): number {
    const n = parseInt(String(value ?? '0'), 10)
    return isNaN(n) || n < 0 ? 0 : n
  }
}
