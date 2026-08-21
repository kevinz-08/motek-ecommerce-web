import { Type } from 'class-transformer'
import {
  ArrayMaxSize, IsArray, IsInt, IsString, Min, ValidateNested,
} from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class ReorderBannerItemDto {
  @ApiProperty()
  @IsString()
  id: string

  @ApiProperty({ minimum: 0 })
  @IsInt() @Min(0)
  order: number
}

export class ReorderHeroBannersDto {
  @ApiProperty({ type: [ReorderBannerItemDto], description: 'Máximo de banners activos permitidos a la vez' })
  @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => ReorderBannerItemDto)
  items: ReorderBannerItemDto[]
}
