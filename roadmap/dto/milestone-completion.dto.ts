import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsUUID } from 'class-validator';

export class SetMilestoneCompletionDto {
  @ApiProperty({ format: 'uuid', description: '체크 상태를 저장할 자녀 ID' })
  @IsUUID()
  childId!: string;

  @ApiProperty({ description: '체크 여부', example: true })
  @IsBoolean()
  completed!: boolean;
}

export class MilestoneCompletionResponseDto {
  @ApiProperty({ format: 'uuid' })
  milestoneId!: string;

  @ApiProperty({ example: true })
  completed!: boolean;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    example: '2026-09-01T09:00:00.000Z',
  })
  completedAt!: string | null;
}
