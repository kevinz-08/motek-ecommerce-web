import { IsEmail } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class ResendOtpDto {
  @ApiProperty() @IsEmail() email: string
}
