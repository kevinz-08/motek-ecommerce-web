import { IsInt, Min } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class UpdateStockDto {
  @ApiProperty({ minimum: 0 }) @IsInt() @Min(0) stock: number
}
