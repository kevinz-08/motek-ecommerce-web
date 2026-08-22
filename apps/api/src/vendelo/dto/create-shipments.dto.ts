import { IsArray, IsString, ArrayMinSize, ArrayMaxSize } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CreateShipmentsDto {
  @ApiProperty({
    description: 'IDs internos de pedidos (nuestros UUIDs) para los cuales crear envíos en Vendelo',
    example: ['clx1234567890', 'clx0987654321'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  orderIds!: string[]
}
