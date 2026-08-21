import { Controller, Get, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../auth/decorators/roles.decorator'
import { EmailQueueService } from '../infrastructure/services/EmailQueueService'

@ApiTags('admin / emails')
@ApiBearerAuth('access-token')
@Roles('ADMIN')
@Controller('admin/emails')
export class AdminEmailsController {
  constructor(private readonly emailQueue: EmailQueueService) {}

  @Get('failed')
  @ApiOperation({ summary: 'Últimos 50 emails fallidos en la cola de reintentos' })
  async failed(@Query('limit') limit?: string) {
    const take = Math.min(parseInt(limit ?? '50', 10) || 50, 200)
    return this.emailQueue.findFailed(take)
  }
}
