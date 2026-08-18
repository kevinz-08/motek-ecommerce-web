import { Injectable } from '@nestjs/common'
import { createHash, randomInt, timingSafeEqual } from 'crypto'
import { PrismaService } from '../infrastructure/database/prisma.service'

export type OtpVerifyResult = 'success' | 'invalid_or_expired' | 'too_many_attempts'

const OTP_EXPIRY_MS = 10 * 60 * 1_000
const MAX_ATTEMPTS = 5

function hashCode(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

@Injectable()
export class OtpService {
  constructor(private readonly prisma: PrismaService) {}

  async generateAndSave(userId: string): Promise<string> {
    const rawCode = String(randomInt(100_000, 1_000_000))
    const codeHash = hashCode(rawCode)
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS)

    await this.prisma.client.emailOtp.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    })

    await this.prisma.client.emailOtp.create({
      data: { userId, codeHash, expiresAt },
    })

    return rawCode
  }

  async verify(userId: string, rawCode: string): Promise<OtpVerifyResult> {
    const record = await this.prisma.client.emailOtp.findFirst({
      where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    })

    if (!record) return 'invalid_or_expired'

    if (record.attempts >= MAX_ATTEMPTS) return 'too_many_attempts'

    const inputHash = hashCode(rawCode)
    const isMatch = timingSafeStringEqual(inputHash, record.codeHash)

    if (!isMatch) {
      await this.prisma.client.emailOtp.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      })
      return 'invalid_or_expired'
    }

    await this.prisma.client.emailOtp.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    })

    return 'success'
  }
}
