import { IsNotEmpty, IsOptional, IsString, IsUrl, Matches, MaxLength, MinLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateCategoryDto {
  @ApiProperty({ example: 'Sistema Eléctrico' })
  @IsString() @IsNotEmpty() @MinLength(2) @MaxLength(80)
  name: string

  @ApiProperty({ example: 'sistema-electrico' })
  @IsString() @IsNotEmpty() @MinLength(2) @MaxLength(80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'El slug solo puede contener letras minúsculas, números y guiones',
  })
  slug: string

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(500)
  description?: string

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  imageUrl?: string

  @ApiPropertyOptional({ description: 'ID de la categoría padre (null = categoría raíz)' })
  @IsOptional() @IsString()
  parentId?: string
}
