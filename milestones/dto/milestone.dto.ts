import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateMilestoneDto {
  @ApiProperty({ example: 'emotion' })
  @IsString()
  @Length(1, 64)
  categoryId!: string;

  @ApiProperty({ minimum: 0, example: 12 })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  ageMonthsFrom!: number;

  @ApiProperty({ minimum: 0, example: 18 })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  ageMonthsTo!: number;

  @ApiPropertyOptional({ example: '낯선 사람을 경계한다' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiProperty({ example: '낯선 환경·낯선 사람에 경계심을 보입니다.' })
  @IsString()
  @MaxLength(2000)
  description!: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  displayOrder?: number;
}

export class UpdateMilestoneDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 64)
  categoryId?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  ageMonthsFrom?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  ageMonthsTo?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  displayOrder?: number;
}

export class ListMilestonesQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({
    minimum: 0,
    description: '월령 N이 [ageMonthsFrom, ageMonthsTo] 범위 안인 마일스톤만',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  ageMonths?: number;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  pageSize?: number;
}

export class MilestoneResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  categoryId!: string;

  @ApiProperty()
  ageMonthsFrom!: number;

  @ApiProperty()
  ageMonthsTo!: number;

  @ApiProperty({ type: String, nullable: true })
  title!: string | null;

  @ApiProperty()
  description!: string;

  @ApiProperty({ type: Number, nullable: true })
  displayOrder!: number | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class ListMilestonesResponseDto {
  @ApiProperty({ type: MilestoneResponseDto, isArray: true })
  items!: MilestoneResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}
