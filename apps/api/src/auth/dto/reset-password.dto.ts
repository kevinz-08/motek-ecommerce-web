import { IsString, MinLength, MaxLength } from 'class-validator'

export class ResetPasswordDto {
  @IsString()
  token: string

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(72, { message: 'La contraseña no puede superar 72 caracteres' })
  password: string
}
