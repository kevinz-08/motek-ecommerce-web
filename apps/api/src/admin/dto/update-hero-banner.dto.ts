import {
  IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Min, MaxLength,
} from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class UpdateHeroBannerDto {
  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(80)
  title?: string

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

  @ApiPropertyOptional()
  @IsOptional() @IsString() @IsNotEmpty()
  imageUrl?: string

  @ApiPropertyOptional()
  @IsOptional() @IsString() @IsNotEmpty()
  imagePublicId?: string

  @ApiPropertyOptional({ description: 'URL del recurso mobile. Enviar null para quitarlo (cae a imageUrl).', nullable: true })
  @IsOptional() @IsString()
  imageUrlMobile?: string | null

  @ApiPropertyOptional({ description: 'public_id de Cloudinary del recurso mobile', nullable: true })
  @IsOptional() @IsString()
  imagePublicIdMobile?: string | null

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional() @IsInt() @Min(0)
  order?: number

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  isActive?: boolean
}
