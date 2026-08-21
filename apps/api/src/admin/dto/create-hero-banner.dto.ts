import {
  IsInt, IsNotEmpty, IsOptional, IsString, Matches, Min, MaxLength,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateHeroBannerDto {
  @ApiProperty({ maxLength: 80 })
  @IsString() @IsNotEmpty() @MaxLength(80)
  title: string

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional() @IsString() @MaxLength(200)
  description?: string

  @ApiPropertyOptional({ maxLength: 40 })
  @IsOptional() @IsString() @MaxLength(40)
  ctaLabel?: string

  @ApiPropertyOptional({ description: 'Ruta relativa del sitio o URL completa' })
  @IsOptional() @IsString()
  @Matches(/^(\/|https?:\/\/)/, { message: 'ctaUrl debe ser una ruta relativa o una URL completa' })
  ctaUrl?: string

  @ApiProperty({ description: 'URL optimizada (secure_url) devuelta por /admin/banners/upload-image' })
  @IsString() @IsNotEmpty()
  imageUrl: string

  @ApiProperty({ description: 'public_id de Cloudinary devuelto por /admin/banners/upload-image' })
  @IsString() @IsNotEmpty()
  imagePublicId: string

  @ApiPropertyOptional({ description: 'URL optimizada (secure_url) del recurso mobile — opcional, cae a imageUrl si no se define' })
  @IsOptional() @IsString()
  imageUrlMobile?: string

  @ApiPropertyOptional({ description: 'public_id de Cloudinary del recurso mobile' })
  @IsOptional() @IsString()
  imagePublicIdMobile?: string

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional() @IsInt() @Min(0)
  order?: number
}
