import { Injectable } from '@nestjs/common'
import type { CityCoverage, ICityCoverageRepository } from '@motek/domain'
import { PrismaService } from '../database/prisma.service'

/**
 * Cobertura de Vendelo por ciudad, sobre el catálogo local `VendeloCity`
 * (sincronizado con POST /admin/vendelo/sync-cities).
 */
@Injectable()
export class PrismaCityCoverageRepository implements ICityCoverageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByCityCode(cityCode: string): Promise<CityCoverage | null> {
    const city = await this.prisma.client.vendeloCity.findUnique({
      where: { code: cityCode },
      select: { serviceStatus: true, serviceUnavailableMessage: true },
    })
    if (!city) return null
    return {
      serviceStatus: city.serviceStatus === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE',
      unavailableMessage: city.serviceUnavailableMessage,
    }
  }
}
