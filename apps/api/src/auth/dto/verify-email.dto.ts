import { IsEmail, IsString, Matches } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class VerifyEmailDto {
  @ApiProperty() @IsEmail() email: string
  @ApiProperty({ example: '482931' }) @IsString() @Matches(/^\d{6}$/, { message: 'El código debe ser de 6 dígitos' }) code: string
}
