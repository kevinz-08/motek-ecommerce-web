import {
  IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, Min, IsNotEmpty,
} from 'class-validator'
import { Transform } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class UpdateCouponDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString() @IsNotEmpty()
  @Transform(({ value }: { value: string }) => value?.toUpperCase().trim())
  code?: string

  @ApiPropertyOptional({ enum: ['PERCENTAGE', 'FIXED'] })
  @IsOptional() @IsEnum(['PERCENTAGE', 'FIXED'])
  type?: 'PERCENTAGE' | 'FIXED'

  @ApiPropertyOptional()
  @IsOptional() @IsInt() @Min(1)
  value?: number

  @ApiPropertyOptional({ enum: ['NONE', 'ONCE_PER_CUSTOMER', 'FIRST_PURCHASE'] })
  @IsOptional() @IsEnum(['NONE', 'ONCE_PER_CUSTOMER', 'FIRST_PURCHASE'])
  restriction?: 'NONE' | 'ONCE_PER_CUSTOMER' | 'FIRST_PURCHASE'

  @ApiPropertyOptional()
  @IsOptional() @IsDateString()
  expiresAt?: string

  @ApiPropertyOptional({ description: 'null para limpiar el scope de categoría' })
  @IsOptional() @IsString()
  categoryId?: string | null

  @ApiPropertyOptional({ description: 'null para limpiar el scope de producto' })
  @IsOptional() @IsString()
  productId?: string | null

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  isActive?: boolean
}
