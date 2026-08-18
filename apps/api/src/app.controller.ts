import { Controller, Get } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'
import { Public } from './auth/decorators/public.decorator'
import { PrismaService } from './infrastructure/database/prisma.service'

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  @Public()
  @SkipThrottle()
  @ApiOperation({ summary: 'Health check — verifica que el proceso y la DB estén operativos' })
  async health() {
    // If this throws, the exception bubbles to HttpExceptionFilter → 500 to Railway
    await this.prisma.client.$queryRaw`SELECT 1`
    return { status: 'ok', db: 'ok', uptime: process.uptime() }
  }
}
