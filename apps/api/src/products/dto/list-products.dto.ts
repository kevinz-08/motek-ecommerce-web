import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'
import { Transform, Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class ListProductsQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() categorySlug?: string
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) minPrice?: number
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) maxPrice?: number
  @ApiPropertyOptional() @IsOptional() @Transform(({ value }) => value === 'true') @IsBoolean() inStock?: boolean
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number
  @ApiPropertyOptional({ default: 12 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number
}
