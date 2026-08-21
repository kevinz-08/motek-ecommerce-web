import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

/** Entrada estructurada de compatibilidad moto — reemplaza el registro completo en cada save. */
export class MotorcycleCompatibilityDto {
  @ApiProperty({ example: 'Yamaha' })
  @IsString() @IsNotEmpty()
  brand: string

  @ApiProperty({ example: 'FZ25' })
  @IsString() @IsNotEmpty()
  model: string

  @ApiPropertyOptional({ description: 'null = aplica a todos los años del modelo', minimum: 1980, maximum: 2100 })
  @IsOptional() @IsInt() @Min(1980) @Max(2100)
  year?: number
}
