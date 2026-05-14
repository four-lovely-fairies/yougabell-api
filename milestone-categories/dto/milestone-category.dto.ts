import { ApiProperty } from '@nestjs/swagger';

export class MilestoneCategoryResponseDto {
  @ApiProperty({ example: 'emotion' })
  id!: string;

  @ApiProperty({ example: '정서' })
  label!: string;

  @ApiProperty({ example: 'heart' })
  iconKey!: string;

  @ApiProperty({ example: '#FFB3C7' })
  color!: string;

  @ApiProperty({ example: 0 })
  displayOrder!: number;
}
