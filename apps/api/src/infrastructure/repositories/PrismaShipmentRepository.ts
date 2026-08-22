import { Injectable } from '@nestjs/common'
import {
  IShipmentRepository,
  ShipmentUpdateFields,
  AtomicStatusUpdateResult,
  Shipment,
  ShipmentStatus,
} from '@motek/domain'
import { PrismaService } from '../database/prisma.service'

type PrismaShipmentRow = {
  id: string
  orderId: string
  status: string
  trackingNumber: string | null
  carrier: string | null
  labelUrl: string | null
  createdAt: Date
  updatedAt: Date
}

function toDomain(row: PrismaShipmentRow): Shipment {
  return {
    id: row.id,
    orderId: row.orderId,
    status: row.status as ShipmentStatus,
    trackingNumber: row.trackingNumber,
    carrier: row.carrier,
    labelUrl: row.labelUrl,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

@Injectable()
export class PrismaShipmentRepository implements IShipmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByOrderId(orderId: string): Promise<Shipment | null> {
    const row = await this.prisma.client.shipment.findUnique({ where: { orderId } })
    return row ? toDomain(row) : null
  }

  async upsert(orderId: string, fields: ShipmentUpdateFields): Promise<Shipment> {
    const row = await this.prisma.client.shipment.upsert({
      where: { orderId },
      create: {
        orderId,
        status: fields.status,
        trackingNumber: fields.trackingNumber ?? null,
        carrier: fields.carrier ?? null,
        labelUrl: fields.labelUrl ?? null,
      },
      update: {
        status: fields.status,
        trackingNumber: fields.trackingNumber ?? null,
        carrier: fields.carrier ?? null,
        labelUrl: fields.labelUrl ?? null,
      },
    })
    return toDomain(row)
  }

  async atomicUpdateStatus(
    orderId: string,
    from: ShipmentStatus,
    to: ShipmentStatus,
    extra?: Pick<ShipmentUpdateFields, 'trackingNumber' | 'carrier' | 'labelUrl'>,
  ): Promise<AtomicStatusUpdateResult> {
    // UPDATE WHERE status = from → si otro worker ya cambió el status, rowsAffected = 0
    const result = await this.prisma.client.shipment.updateMany({
      where: { orderId, status: from },
      data: {
        status: to,
        ...(extra?.trackingNumber !== undefined && { trackingNumber: extra.trackingNumber }),
        ...(extra?.carrier !== undefined && { carrier: extra.carrier }),
        ...(extra?.labelUrl !== undefined && { labelUrl: extra.labelUrl }),
      },
    })
    return { applied: result.count > 0 }
  }
}
