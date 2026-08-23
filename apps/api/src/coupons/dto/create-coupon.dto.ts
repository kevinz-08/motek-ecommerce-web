import {
  IsDateString, IsEnum, IsInt, IsOptional, IsString,
  Min, Max, IsNotEmpty, ValidateIf,
} from 'class-validator'
import { Transform } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateCouponDto {
  @ApiProperty({ description: 'Código del cupón — se convierte a mayúsculas automáticamente', example: 'HALLOWEEN20' })
  @IsString() @IsNotEmpty()
  @Transform(({ value }: { value: string }) => value?.toUpperCase().trim())
  code: string

  @ApiProperty({ enum: ['PERCENTAGE', 'FIXED'] })
  @IsEnum(['PERCENTAGE', 'FIXED'])
  type: 'PERCENTAGE' | 'FIXED'

  /**
   * PERCENTAGE: puntos base (1000 = 10.00%, max 10000 = 100%).
   * FIXED: centavos COP (mínimo 1 centavo).
   */
  @ApiProperty({ description: 'PERCENTAGE: puntos base (1000 = 10%). FIXED: centavos COP.' })
  @IsInt() @Min(1)
  value: number

  @ApiProperty({ enum: ['NONE', 'ONCE_PER_CUSTOMER', 'FIRST_PURCHASE'], default: 'NONE' })
  @IsEnum(['NONE', 'ONCE_PER_CUSTOMER', 'FIRST_PURCHASE'])
  restriction: 'NONE' | 'ONCE_PER_CUSTOMER' | 'FIRST_PURCHASE'

  @ApiProperty({ description: 'Fecha de expiración ISO 8601', example: '2025-10-31T23:59:59.000Z' })
  @IsDateString()
  expiresAt: string

  @ApiPropertyOptional({ description: 'ID de la categoría o subcategoría a la que aplica' })
  @IsOptional() @IsString() @IsNotEmpty()
  categoryId?: string

  @ApiPropertyOptional({ description: 'ID del producto específico al que aplica' })
  @IsOptional() @IsString() @IsNotEmpty()
  productId?: string
}
