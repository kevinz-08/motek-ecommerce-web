import {
  IsArray, IsEnum, IsInt, IsNotEmpty, IsString,
  ArrayMinSize, ArrayMaxSize, Matches, Max, Min, ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'

export class QuoteShippingItemDto {
  @ApiProperty() @IsString() @IsNotEmpty() productId: string

  @ApiProperty({ minimum: 1, maximum: 99 })
  @IsInt() @Min(1) @Max(99)
  quantity: number
}

export class QuoteShippingDto {
  @ApiProperty({ description: 'Código DIVIPOLA de 8 dígitos del destino', example: '11001000' })
  @IsString()
  @Matches(/^\d{8}$/, { message: 'shippingCityCode debe ser un código DIVIPOLA de 8 dígitos' })
  shippingCityCode: string

  @ApiProperty({ description: 'Código de subdivisión de 2 dígitos', example: '11' })
  @IsString()
  @Matches(/^\d{2}$/, { message: 'shippingSubdivisionCode debe tener 2 dígitos' })
  shippingSubdivisionCode: string

  @ApiProperty({ type: [QuoteShippingItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => QuoteShippingItemDto)
  items: QuoteShippingItemDto[]

  @ApiProperty({ enum: ['COD', 'EXTERNAL_PAYMENT'] })
  @IsEnum(['COD', 'EXTERNAL_PAYMENT'])
  paymentMethod: 'COD' | 'EXTERNAL_PAYMENT'
}
