import { Type } from 'class-transformer'
import {
  IsArray, IsInt, IsNotEmpty, IsOptional, IsString,
  MaxLength, Min, ValidateNested,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class BenefitItemDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional() @IsString() @MaxLength(120)
  title?: string

  @ApiProperty({ maxLength: 500 })
  @IsString() @IsNotEmpty() @MaxLength(500)
  body: string

  @ApiProperty({ minimum: 0 })
  @IsInt() @Min(0)
  order: number
}

export class CompatibilityItemDto {
  @ApiProperty({ maxLength: 200 })
  @IsString() @IsNotEmpty() @MaxLength(200)
  body: string

  @ApiProperty({ minimum: 0 })
  @IsInt() @Min(0)
  order: number
}

export class UpsertProductDescriptionDto {
  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional() @IsString() @MaxLength(2000)
  generalDescription?: string

  @ApiProperty({ type: [BenefitItemDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => BenefitItemDto)
  benefits: BenefitItemDto[]

  @ApiProperty({ type: [CompatibilityItemDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => CompatibilityItemDto)
  compatibility: CompatibilityItemDto[]
}
