import { IsInt, Max, Min } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class UpdateCodDepositDto {
  @ApiProperty({ description: 'Anticipo pre-envío de contraentrega en centavos COP. 0 = desactivado.' })
  @IsInt() @Min(0) @Max(50_000_000)
  amountCents: number
}
