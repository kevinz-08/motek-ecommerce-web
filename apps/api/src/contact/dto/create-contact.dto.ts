import { IsEmail, IsEnum, IsString, Length } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export type PqrType = 'PETICION' | 'QUEJA' | 'RECLAMO' | 'SUGERENCIA'

export class CreateContactDto {
  @ApiProperty()
  @IsString()
  @Length(2, 100, { message: 'El nombre debe tener entre 2 y 100 caracteres' })
  name: string

  @ApiProperty()
  @IsEmail({}, { message: 'Ingresa un correo electrónico válido' })
  email: string

  @ApiProperty({ enum: ['PETICION', 'QUEJA', 'RECLAMO', 'SUGERENCIA'] })
  @IsEnum(['PETICION', 'QUEJA', 'RECLAMO', 'SUGERENCIA'])
  type: PqrType

  @ApiProperty()
  @IsString()
  @Length(10, 2000, { message: 'El mensaje debe tener entre 10 y 2000 caracteres' })
  message: string
}
