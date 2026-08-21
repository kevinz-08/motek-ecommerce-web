import { Type } from 'class-transformer'
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class StockSyncUpdateDto {
  @ApiProperty() @IsString() productId!: string
  @ApiProperty({ minimum: 0 }) @IsInt() @Min(0) stock!: number
  @ApiProperty({ minimum: 0, required: false }) @IsOptional() @IsInt() @Min(0) price?: number
}

/** Payload de confirmación — el admin envía de vuelta los `updatedItems` calculados por el preview. */
export class ApplySyncDto {
  @ApiProperty({ type: [StockSyncUpdateDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StockSyncUpdateDto)
  updates!: StockSyncUpdateDto[]
}
