import { Equals, IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'
import { Transform } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { CreateOrderDto } from './create-order.dto'

/**
 * Pedido creado sin sesión (guest checkout).
 *
 * Hereda todo lo del pedido autenticado y suma los datos que en el flujo con
 * cuenta salen de la sesión: email de contacto, nombre y consentimiento
 * explícito de políticas.
 *
 * `policiesAcceptedAt` se ignora deliberadamente para invitados: el timestamp lo
 * pone el servidor a partir de `acceptsPolicies`. Una marca de tiempo que elige
 * el cliente no sirve como evidencia ante una auditoría de la SIC.
 *
 * `paymentProvider` se hereda tal cual, con COD incluido en el enum: el rechazo
 * de COD sin cuenta lo hace el use case `CreateOrder` (paso 0), no el DTO. Una
 * sola fuente de verdad — redeclarar la propiedad acá solo para estrechar el
 * enum duplicaría la regla y dejaría dos mensajes distintos para el mismo caso.
 */
export class CreateGuestOrderDto extends CreateOrderDto {
  @ApiProperty({ example: 'cliente@ejemplo.com', description: 'Email al que se envía la confirmación y el enlace de seguimiento' })
  @IsEmail({}, { message: 'Ingresa un correo electrónico válido' })
  @Transform(({ value }: { value: string }) => value?.trim().toLowerCase())
  contactEmail: string

  @ApiProperty({ example: 'Carlos Pérez' })
  @IsString() @IsNotEmpty() @MinLength(2) @MaxLength(120)
  @Transform(({ value }: { value: string }) => value?.trim())
  guestName: string

  @ApiPropertyOptional({ example: '3001234567' })
  @IsOptional() @IsString() @MaxLength(30)
  guestPhone?: string

  @ApiProperty({
    description: 'Aceptación de T&C y Política de Privacidad. Obligatoria — el servidor sella la fecha.',
  })
  @IsBoolean()
  @Equals(true, { message: 'Debes aceptar los Términos y la Política de Privacidad para continuar' })
  acceptsPolicies: boolean

  @ApiPropertyOptional({ description: 'Consentimiento de comunicaciones de marketing — separado del de T&C (Ley 1581/2012)' })
  @IsOptional() @IsBoolean()
  marketingConsent?: boolean

  @ApiProperty({ description: 'Token del widget de Cloudflare Turnstile (cf-turnstile-response)' })
  @IsString() @IsNotEmpty({ message: 'Falta la verificación anti-robots' })
  captchaToken: string
}

/**
 * Petición de reenvío de enlaces de seguimiento.
 *
 * Solo pide el email: el endpoint responde siempre lo mismo exista o no, y los
 * enlaces viajan a la bandeja del dueño del correo. Pedir además el ID del
 * pedido no agregaría seguridad y sí fricción.
 */
export class RequestTrackingLinkDto {
  @ApiProperty({ example: 'cliente@ejemplo.com' })
  @IsEmail({}, { message: 'Ingresa un correo electrónico válido' })
  @Transform(({ value }: { value: string }) => value?.trim().toLowerCase())
  email: string

  @ApiProperty({ description: 'Token del widget de Cloudflare Turnstile' })
  @IsString() @IsNotEmpty({ message: 'Falta la verificación anti-robots' })
  captchaToken: string
}
