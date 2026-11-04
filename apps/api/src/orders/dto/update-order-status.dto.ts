import { IsEnum } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: ['PENDING', 'PAID', 'AWAITING_DEPOSIT', 'COD_CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'] })
  @IsEnum(['PENDING', 'PAID', 'AWAITING_DEPOSIT', 'COD_CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'])
  status: 'PENDING' | 'PAID' | 'AWAITING_DEPOSIT' | 'COD_CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'
}
