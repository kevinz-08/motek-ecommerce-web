import { IsEmail } from 'class-validator'

export class SessionTokenDto {
  @IsEmail()
  email: string
}
