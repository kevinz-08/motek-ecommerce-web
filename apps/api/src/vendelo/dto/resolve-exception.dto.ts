import {
  IsInt, IsString, IsOptional, Min, MaxLength, Matches,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class ResolveExceptionDto {
  @ApiProperty({
    description: 'ID del tipo de resolución (obtenido del campo possible_replies[].type_id de la novedad)',
    example: 1,
  })
  @IsInt()
  @Min(0)
  type_id!: number

  @ApiProperty({
    description: 'Notas adicionales sobre la resolución',
    maxLength: 500,
    example: 'El cliente confirmó nueva dirección de entrega',
  })
  @IsString()
  @MaxLength(500)
  notes!: string

  @ApiPropertyOptional({
    description: 'Fecha de entrega alternativa en formato YYYY-MM-DD',
    example: '2026-06-15',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'delivery_date debe tener formato YYYY-MM-DD' })
  delivery_date?: string

  @ApiPropertyOptional({
    description: 'Dirección alternativa de entrega',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string

  @ApiPropertyOptional({
    description: 'ID del punto Droop de Coordinadora para entrega en punto de recogida',
  })
  @IsOptional()
  @IsString()
  collection_point_id?: string
}
