import { IsArray, IsString, IsIn, IsOptional, ArrayMinSize, ArrayMaxSize } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

const VALID_FORMATS = ['LETTER_2PP', 'LABEL_10x10', 'LABEL_10x15'] as const
const VALID_OUTPUTS = ['URL', 'BASE64'] as const

export class GenerateLabelsDto {
  @ApiProperty({
    description: 'IDs internos de pedidos (nuestros UUIDs)',
    example: ['clx1234567890'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  orderIds!: string[]

  @ApiProperty({
    description: 'Formato de la etiqueta PDF',
    enum: VALID_FORMATS,
    example: 'LETTER_2PP',
  })
  @IsIn(VALID_FORMATS)
  format!: 'LETTER_2PP' | 'LABEL_10x10' | 'LABEL_10x15'

  @ApiPropertyOptional({
    description: 'Tipo de salida: URL (por defecto) o BASE64 para descarga directa',
    enum: VALID_OUTPUTS,
    default: 'URL',
  })
  @IsOptional()
  @IsIn(VALID_OUTPUTS)
  output?: 'URL' | 'BASE64'
}
