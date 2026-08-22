import {
  Controller, Get, Post, Param, Body, HttpCode, Inject, Res, Logger,
  UnprocessableEntityException,
} from '@nestjs/common'
import type { Response } from 'express'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../auth/decorators/roles.decorator'
import { VendeloService } from '../infrastructure/services/VendeloService'
import { PrismaService } from '../infrastructure/database/prisma.service'
import {
  CreateShipments,
  ResolveShipmentException,
  IOrderRepository,
  IVendeloShippingPort,
} from '@motek/domain'
import { ORDER_REPOSITORY, VENDELO_SHIPPING_PORT } from '../infrastructure/injection-tokens'
import { ShippingAdminService } from './services/shipping-admin.service'
import { ParseVendeloIdPipe } from './pipes/parse-vendelo-id.pipe'
import { CreateShipmentsDto } from './dto/create-shipments.dto'
import { GenerateLabelsDto } from './dto/generate-labels.dto'
import { RequestPickupDto } from './dto/request-pickup.dto'
import { ResolveExceptionDto } from './dto/resolve-exception.dto'

@ApiTags('admin / vendelo')
@ApiBearerAuth('access-token')
@Roles('ADMIN')
@Controller('admin/vendelo')
export class VendeloController {
  private readonly logger = new Logger(VendeloController.name)

  constructor(
    private readonly vendeloService: VendeloService,
    private readonly prisma: PrismaService,
    private readonly shippingAdmin: ShippingAdminService,
    @Inject(ORDER_REPOSITORY) private readonly orderRepo: IOrderRepository,
    @Inject(VENDELO_SHIPPING_PORT) private readonly shippingPort: IVendeloShippingPort,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Smoke test: verifica conectividad y autenticación con Vendelo API' })
  async checkHealth() {
    const info = await this.vendeloService.checkAuth()
    return { ok: true, vendelo: info }
  }

  @Post('sync-cities')
  @HttpCode(200)
  @ApiOperation({ summary: 'Descarga todas las ciudades de Vendelo y las sincroniza en la BD local' })
  async syncCities() {
    const cities = await this.vendeloService.getAllCities()

    // Transacción atómica: si createMany falla, el deleteMany previo se revierte
    // y la tabla VendeloCity mantiene los datos anteriores — el checkout no se rompe
    await this.prisma.client.$transaction(async (tx) => {
      await tx.vendeloCity.deleteMany()
      await tx.vendeloCity.createMany({
        data: cities.map((c) => ({
          code: c.code,
          name: c.name,
          subdivisionCode: c.subdivision_code,
          countryCode: c.country_code ?? 'CO',
        })),
        skipDuplicates: true,
      })
    })

    return { synced: cities.length }
  }

  // ── Fase 4: Operaciones logísticas ──────────────────────────────────────────

  /**
   * Crea los envíos en Vendelo para los pedidos indicados.
   * Omite pedidos que aún no tienen vendeloOrderId (en cola de procesamiento).
   */
  @Post('create-shipments')
  @HttpCode(200)
  @ApiOperation({ summary: 'Crea envíos en Vendelo para los pedidos indicados (proceso asincrónico en Vendelo)' })
  async createShipments(@Body() dto: CreateShipmentsDto) {
    const useCase = new CreateShipments(this.orderRepo, this.shippingPort)
    const result = await useCase.execute({ orderIds: dto.orderIds })

    if (!result.ok) {
      this.logger.error(`createShipments failed: ${result.error.message}`)
      throw new UnprocessableEntityException(result.error.message)
    }

    return result.value
  }

  /**
   * Genera etiquetas PDF para los pedidos indicados.
   * Con output=URL (por defecto) retorna la URL temporal de Vendelo.
   * Con output=BASE64 descarga el PDF directamente desde el navegador.
   */
  @Post('generate-labels')
  @HttpCode(200)
  @ApiOperation({ summary: 'Genera etiquetas PDF de envío para los pedidos indicados' })
  async generateLabels(@Body() dto: GenerateLabelsDto, @Res() res: Response) {
    const result = await this.shippingAdmin.generateLabels(
      dto.orderIds,
      dto.format,
      dto.output ?? 'URL',
    )

    if (dto.output === 'BASE64' && result.data) {
      const buffer = Buffer.from(result.data, 'base64')
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="etiquetas-vendelo.pdf"',
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store',
      })
      return res.end(buffer)
    }

    return res.json({ url: result.data, skipped: result.skipped, order_ids: result.order_ids })
  }

  /** Lista novedades de envío paginadas. Soporta filtros por estado y fecha. */
  @Get('exceptions')
  @ApiOperation({ summary: 'Lista novedades de envío pendientes desde Vendelo (paginado)' })
  async getExceptions() {
    return this.shippingAdmin.getExceptions({ status: 'PENDING' })
  }

  /** Detalle de una novedad específica con possible_replies. */
  @Get('exceptions/:id')
  @ApiOperation({ summary: 'Detalle de una novedad de envío con las respuestas posibles' })
  async getException(@Param('id', ParseVendeloIdPipe) id: string) {
    return this.shippingAdmin.getException(id)
  }

  /**
   * Resuelve una novedad de transporte.
   * Solo acepta novedades en estado PENDING — la máquina de estados es
   * validada por el use case ResolveShipmentException en el dominio.
   */
  @Post('exceptions/:id/resolve')
  @HttpCode(200)
  @ApiOperation({ summary: 'Resuelve una novedad de transporte (solo si está en estado PENDING)' })
  async resolveException(@Param('id', ParseVendeloIdPipe) id: string, @Body() dto: ResolveExceptionDto) {
    const useCase = new ResolveShipmentException(this.shippingPort)
    const result = await useCase.execute({
      exceptionId: id,
      resolution: {
        type_id: dto.type_id,
        notes: dto.notes,
        delivery_date: dto.delivery_date,
        address: dto.address,
        collection_point_id: dto.collection_point_id,
      },
    })

    if (!result.ok) {
      this.logger.warn(`resolveException id=${id} rejected: ${result.error.message}`)
      throw new UnprocessableEntityException(result.error.message)
    }

    return result.value
  }

  /**
   * Solicita recolección de paquetes para los pedidos indicados.
   * Vendelo agrupa las recolecciones por dirección única de origen.
   */
  @Post('request-pickup')
  @HttpCode(200)
  @ApiOperation({ summary: 'Solicita recolección de paquetes para los pedidos indicados' })
  async requestPickup(@Body() dto: RequestPickupDto) {
    return this.shippingAdmin.requestPickup(dto.orderIds)
  }
}
