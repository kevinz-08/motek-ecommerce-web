import { IsEnum } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'] })
  @IsEnum(['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'])
  status: 'PENDING' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'
}
