import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class RegisterDto {
  @ApiProperty() @IsString() @IsNotEmpty() name: string
  @ApiProperty() @IsEmail() email: string
  @ApiProperty({ minLength: 8 }) @IsString() @MinLength(8) password: string
}
