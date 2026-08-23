import { BadGatewayException, Body, Controller, HttpCode, Logger, Post } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Public } from '../auth/decorators/public.decorator'
import { ResendEmailService } from '../infrastructure/services/ResendEmailService'
import { CreateContactDto } from './dto/create-contact.dto'

@ApiTags('contact')
@Controller('contact')
export class ContactController {
  private readonly logger = new Logger(ContactController.name)

  constructor(private readonly emailService: ResendEmailService) {}

  /**
   * Formulario de PQR (Contáctanos) — envía el mensaje al correo de soporte.
   * @Public(): no requiere sesión, cualquier visitante debe poder escribir.
   * Throttle más estricto que el global (100/min) para frenar spam sin captcha.
   */
  @Public()
  @Post()
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Envía un mensaje de PQR al correo de soporte' })
  async create(@Body() dto: CreateContactDto) {
    try {
      await this.emailService.sendContactMessage(dto)
    } catch (e) {
      this.logger.error(`Error enviando mensaje de contacto email=${dto.email}: ${e}`)
      throw new BadGatewayException('No se pudo enviar el mensaje. Intenta de nuevo más tarde.')
    }
    return { ok: true }
  }
}
