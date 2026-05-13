import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender } from '@prisma/client';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';

const GENDERS = ['female', 'male'] as const satisfies Gender[];

export class UpdateChildDto {
  @ApiPropertyOptional({ example: '김유스', minLength: 1, maxLength: 30 })
  @IsOptional()
  @IsString()
  @Length(1, 30)
  name?: string;

  @ApiPropertyOptional({
    example: '2023-04-20',
    description: 'ISO date YYYY-MM-DD',
  })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({ enum: GENDERS })
  @IsOptional()
  @IsIn(GENDERS)
  gender?: Gender;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class ChildResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: '김유스' })
  name!: string;

  @ApiProperty({ example: '2023-04-20', description: 'ISO date YYYY-MM-DD' })
  birthDate!: string;

  @ApiProperty({ enum: GENDERS })
  gender!: Gender;

  @ApiProperty({ type: String, nullable: true })
  notes!: string | null;

  @ApiProperty({ type: String, nullable: true })
  avatarUrl!: string | null;

  @ApiProperty({ example: 0 })
  displayOrder!: number;
}
