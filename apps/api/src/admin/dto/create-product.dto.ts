import {
  IsArray, IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { MotorcycleCompatibilityDto } from './motorcycle-compatibility.dto'

export class CreateProductDto {
  @ApiProperty() @IsString() @IsNotEmpty() name: string
  @ApiProperty() @IsString() @IsNotEmpty() slug: string
  @ApiProperty() @IsString() @IsNotEmpty() description: string
  @ApiProperty({ description: 'Precio en centavos COP', minimum: 0 }) @IsInt() @Min(0) price: number
  @ApiProperty({ minimum: 0 }) @IsInt() @Min(0) stock: number
  @ApiProperty() @IsString() @IsNotEmpty() sku: string
  @ApiProperty() @IsString() @IsNotEmpty() categoryId: string
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() isActive?: boolean
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) images?: string[]
  @ApiPropertyOptional({ description: 'Peso real embalado en kg (para cotización Vendelo)', minimum: 0 })
  @IsOptional() @IsNumber() @Min(0) weightKg?: number
  @ApiPropertyOptional({ description: 'Alto real embalado en cm', minimum: 0 })
  @IsOptional() @IsInt() @Min(0) heightCm?: number
  @ApiPropertyOptional({ description: 'Ancho real embalado en cm', minimum: 0 })
  @IsOptional() @IsInt() @Min(0) widthCm?: number
  @ApiPropertyOptional({ description: 'Largo real embalado en cm', minimum: 0 })
  @IsOptional() @IsInt() @Min(0) lengthCm?: number

  @ApiPropertyOptional({ type: [MotorcycleCompatibilityDto], description: 'Motos compatibles (marca/modelo/año)' })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MotorcycleCompatibilityDto)
  compatible?: MotorcycleCompatibilityDto[]
}
