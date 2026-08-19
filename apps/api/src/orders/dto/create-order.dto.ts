import {
  IsArray, IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional,
  IsString, Matches, Min, MinLength, ValidateNested, ValidateIf,
} from 'class-validator'
import { Type, Transform } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class ShippingAddressDto {
  @ApiProperty() @IsString() @IsNotEmpty() fullName: string
  @ApiProperty() @IsString() @IsNotEmpty() address: string
  @ApiProperty() @IsString() @IsNotEmpty() city: string
  @ApiPropertyOptional() @IsOptional() @IsString() department?: string
  @ApiProperty() @IsString() @IsNotEmpty() phone: string
  @ApiPropertyOptional() @IsOptional() @IsString() cityCode?: string
  @ApiPropertyOptional() @IsOptional() @IsString() subdivisionCode?: string
  @ApiPropertyOptional() @IsOptional() @IsString() postalCode?: string
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string
}

export class BuyerInfoDto {
  @ApiProperty({ enum: ['CC', 'CE', 'NIT', 'PASAPORTE'] })
  @IsEnum(['CC', 'CE', 'NIT', 'PASAPORTE'])
  idType: 'CC' | 'CE' | 'NIT' | 'PASAPORTE'

  /**
   * Acepta:
   *   CC/CE/PASAPORTE → solo dígitos (CC) o alfanumérico (CE/PASAPORTE), 5-20 caracteres.
   *   NIT             → dígitos con dígito de verificación opcional separado por guion.
   * La validación de coherencia tipo↔formato se hace en el use case con un mensaje claro,
   * acá solo cortamos casos obvios.
   */
  @ApiProperty({ minLength: 5, example: '1000123456' })
  @IsString() @IsNotEmpty() @MinLength(5)
  @Matches(/^[a-zA-Z0-9-]+$/, { message: 'idNumber solo puede contener letras, números y guiones' })
  idNumber: string

  @ApiPropertyOptional({ description: 'Razón social — obligatoria cuando idType === NIT' })
  @ValidateIf((o: BuyerInfoDto) => o.idType === 'NIT')
  @IsString() @IsNotEmpty()
  @ValidateIf((o: BuyerInfoDto) => o.idType !== 'NIT')
  @IsOptional()
  businessName?: string
}

export class OrderItemDto {
  @ApiProperty() @IsString() @IsNotEmpty() productId: string
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) quantity: number
}

export class CreateOrderDto {
  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[]

  @ApiProperty()
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress: ShippingAddressDto

  @ApiProperty({ type: BuyerInfoDto })
  @ValidateNested()
  @Type(() => BuyerInfoDto)
  buyer: BuyerInfoDto

  @ApiProperty({ enum: ['WOMPI', 'MERCADO_PAGO', 'COD'] })
  @IsEnum(['WOMPI', 'MERCADO_PAGO', 'COD'])
  paymentProvider: 'WOMPI' | 'MERCADO_PAGO' | 'COD'

  @ApiPropertyOptional({
    enum: ['HOME_DELIVERY', 'STORE_PICKUP'],
    description: 'Método de entrega. STORE_PICKUP anula el flete y excluye el pedido de Vendelo. Default: HOME_DELIVERY.',
  })
  @IsOptional()
  @IsEnum(['HOME_DELIVERY', 'STORE_PICKUP'])
  deliveryMethod?: 'HOME_DELIVERY' | 'STORE_PICKUP'

  @ApiPropertyOptional({ description: 'ISO timestamp del momento en que el usuario aceptó las políticas en el checkout' })
  @IsOptional()
  @IsDateString()
  policiesAcceptedAt?: string

  @ApiPropertyOptional({ description: 'Código de cupón de descuento a aplicar en el pedido', example: 'HALLOWEEN20' })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: string }) => value?.toUpperCase().trim())
  couponCode?: string
}
