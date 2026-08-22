import { IsArray, IsString, ArrayMinSize, ArrayMaxSize } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class RequestPickupDto {
  @ApiProperty({
    description: 'IDs internos de pedidos (nuestros UUIDs) para solicitar recolección',
    example: ['clx1234567890'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  orderIds!: string[]
}
