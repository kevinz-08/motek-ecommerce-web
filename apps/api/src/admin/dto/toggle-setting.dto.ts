import { IsBoolean } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class ToggleSettingDto {
  @ApiProperty() @IsBoolean() enabled: boolean
}
