import { IsArray, IsNotEmpty, IsInt, IsString, Min, ValidateNested, IsOptional } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'
import { Transform } from 'class-transformer'

export class ValidateCouponItemDto {
  @ApiProperty() @IsString() @IsNotEmpty() productId: string
  @ApiProperty() @IsString() @IsNotEmpty() categoryId: string
  @ApiProperty({ nullable: true }) @IsOptional() @IsString() parentCategoryId: string | null
  @ApiProperty() @IsInt() @Min(1) price: number
  @ApiProperty() @IsInt() @Min(1) quantity: number
}

export class ValidateCouponDto {
  @ApiProperty({ example: 'HALLOWEEN20' })
  @IsString() @IsNotEmpty()
  @Transform(({ value }: { value: string }) => value?.toUpperCase().trim())
  code: string

  @ApiProperty({ type: [ValidateCouponItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ValidateCouponItemDto)
  items: ValidateCouponItemDto[]
}
