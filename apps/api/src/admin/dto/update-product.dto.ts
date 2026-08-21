import { IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { MotorcycleCompatibilityDto } from './motorcycle-compatibility.dto'

export class UpdateProductDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string
  @ApiPropertyOptional() @IsOptional() @IsString() slug?: string
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) price?: number
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) stock?: number
  @ApiPropertyOptional() @IsOptional() @IsString() sku?: string
  @ApiPropertyOptional() @IsOptional() @IsString() categoryId?: string
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) images?: string[]
  @ApiPropertyOptional({ description: 'Peso real embalado en kg (para cotización Vendelo)', minimum: 0 })
  @IsOptional() @IsNumber() @Min(0) weightKg?: number
  @ApiPropertyOptional({ description: 'Alto real embalado en cm', minimum: 0 })
  @IsOptional() @IsInt() @Min(0) heightCm?: number
  @ApiPropertyOptional({ description: 'Ancho real embalado en cm', minimum: 0 })
  @IsOptional() @IsInt() @Min(0) widthCm?: number
  @ApiPropertyOptional({ description: 'Largo real embalado en cm', minimum: 0 })
  @IsOptional() @IsInt() @Min(0) lengthCm?: number

  @ApiPropertyOptional({ type: [MotorcycleCompatibilityDto], description: 'Motos compatibles (marca/modelo/año) — reemplaza la lista completa' })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MotorcycleCompatibilityDto)
  compatible?: MotorcycleCompatibilityDto[]
}
