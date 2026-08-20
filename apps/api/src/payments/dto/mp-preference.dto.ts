import { IsString } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class MpPreferenceDto {
  @ApiProperty({ description: 'ID del pedido para el que se crea la preferencia de MP' })
  @IsString()
  orderId: string
}
