import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class UpdateCategoryDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString() @IsNotEmpty() @MinLength(2) @MaxLength(80)
  name?: string

  @ApiPropertyOptional()
  @IsOptional() @IsString() @IsNotEmpty() @MinLength(2) @MaxLength(80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'El slug solo puede contener letras minúsculas, números y guiones',
  })
  slug?: string

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(500)
  description?: string

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  imageUrl?: string

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  parentId?: string | null
}
