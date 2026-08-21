import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger'
import { IStockSyncRepository, StockSyncItem, SyncReport, SyncStock } from '@motek/domain'
import { Roles } from '../auth/decorators/roles.decorator'
import { INVENTORY_REPOSITORY } from '../infrastructure/injection-tokens'
import { SyncFileParserService } from '../infrastructure/services/SyncFileParserService'
import { ApplySyncDto } from './dto/apply-sync.dto'

// Keeps HTTP status mapping local to this layer — the domain never speaks HTTP.
const DOMAIN_TO_HTTP: Record<string, number> = {
  VALIDATION_ERROR: HttpStatus.UNPROCESSABLE_ENTITY,
  NOT_FOUND:        HttpStatus.NOT_FOUND,
  INTERNAL_ERROR:   HttpStatus.INTERNAL_SERVER_ERROR,
}

// 5 MB ceiling — matches the parser's internal MAX_FILE_BYTES so the interceptor
// rejects oversized files before the parser even reads the buffer.
const MAX_FILE_BYTES = 5 * 1024 * 1024

@ApiTags('admin / sync')
@ApiBearerAuth('access-token')
@Roles('ADMIN')
@Controller('admin/sync')
export class AdminSyncController {
  private readonly logger = new Logger(AdminSyncController.name)

  constructor(
    @Inject(INVENTORY_REPOSITORY) private readonly syncRepo: IStockSyncRepository,
    private readonly parser: SyncFileParserService,
  ) {}

  /**
   * Calcula el diff de stock y precio entre el export de Optimun y la web —
   * SIN escribir en BD. El admin revisa el reporte y confirma con `POST /stock/apply`.
   *
   * Acepta el archivo .xlsx generado por Optimun (exportación estándar de inventario).
   * Solo considera productos existentes en la web — nunca crea ni elimina.
   */
  @Post('stock/preview')
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Calcular el diff de stock/precio desde export de Optimun (.xlsx), sin aplicar' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'Export .xlsx de Optimun' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }),
  )
  async previewStock(
    @UploadedFile() file: { buffer: Buffer; originalname: string } | undefined,
  ): Promise<SyncReport> {
    if (!file?.buffer) {
      throw new BadRequestException('Se requiere un archivo .xlsx en el campo "file"')
    }

    const rawRows = this.parser.parse(file.buffer)

    const items: StockSyncItem[] = rawRows.map(r => ({
      codigo: r.codigo,
      nombre: r.nombre,
      stock:  r.stock,
      detal:  r.detal,
    }))

    const result = await new SyncStock(this.syncRepo).execute(items, { apply: false })

    if (!result.ok) {
      const status = DOMAIN_TO_HTTP[result.error.code] ?? HttpStatus.INTERNAL_SERVER_ERROR
      throw new HttpException(result.error.message, status)
    }

    return result.value
  }

  /**
   * Confirma y escribe en BD los cambios previamente calculados por `POST /stock/preview`.
   * El cliente reenvía los `updatedItems` del reporte (mapeados a productId/stock/price) —
   * esta ruta no vuelve a leer el .xlsx.
   */
  @Post('stock/apply')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aplicar los cambios de stock/precio confirmados por el admin' })
  async applyStock(@Body() dto: ApplySyncDto): Promise<{ appliedCount: number }> {
    try {
      await this.syncRepo.bulkUpdateStockAndPrice(dto.updates)
    } catch (e) {
      throw new HttpException(
        e instanceof Error ? e.message : 'Error al escribir actualizaciones de stock en la BD',
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }

    this.invalidateProductCache()

    return { appliedCount: dto.updates.length }
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private invalidateProductCache(): void {
    const frontendUrl = process.env['FRONTEND_URL'] ?? 'http://localhost:3000'
    const secret = process.env['INTERNAL_API_SECRET']

    if (!secret) {
      this.logger.warn('INTERNAL_API_SECRET no configurado — cache no invalidado tras sync')
      return
    }

    fetch(`${frontendUrl}/api/admin/revalidate`, {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-internal-secret': secret,
      },
      body: JSON.stringify({ tags: ['products', 'catalog', 'home'] }),
    }).catch((e: unknown) => {
      this.logger.warn(
        `Revalidación de caché fallida (best-effort): ${e instanceof Error ? e.message : String(e)}`,
      )
    })
  }
}
