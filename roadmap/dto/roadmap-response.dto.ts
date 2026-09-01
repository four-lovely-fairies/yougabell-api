import { ApiProperty } from '@nestjs/swagger';
import { ROADMAP_CATEGORY_ORDER } from '../roadmap.types';

export class RoadmapChildDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: '김유스' })
  name!: string;

  @ApiProperty({ example: 4, minimum: 0 })
  ageMonths!: number;

  @ApiProperty({ example: '4개월 차' })
  ageLabel!: string;
}

export class RoadmapStageDto {
  @ApiProperty({ example: 'self-formation' })
  id!: string;

  @ApiProperty({ example: '자아 형성기' })
  name!: string;

  @ApiProperty()
  summary!: string;
}

export class RoadmapMonthTabRangeDto {
  @ApiProperty({
    type: Number,
    nullable: true,
    example: null,
    description: '좌 chevron 이동 대상. null이면 비활성.',
  })
  prev!: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 15,
    description: '우 chevron 이동 대상. null이면 비활성.',
  })
  next!: number | null;
}

export class RoadmapMilestoneSourceDto {
  @ApiProperty({ example: 'CDC' })
  citation!: string;

  @ApiProperty({ type: String, nullable: true })
  url!: string | null;
}

export class RoadmapMilestoneItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    example: '말을 걸거나 들어 올리면 차분해진다. 상대의 얼굴을 바라본다.',
  })
  description!: string;

  @ApiProperty({ example: true, description: '해당 자녀의 체크 여부' })
  completed!: boolean;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: '체크 시각. 미체크면 null.',
  })
  completedAt!: string | null;

  @ApiProperty({ type: [RoadmapMilestoneSourceDto] })
  sources!: RoadmapMilestoneSourceDto[];
}

export class RoadmapCategoryGroupDto {
  @ApiProperty({ enum: ROADMAP_CATEGORY_ORDER })
  categoryId!: (typeof ROADMAP_CATEGORY_ORDER)[number];

  @ApiProperty({ example: '사회성' })
  categoryLabel!: string;

  @ApiProperty({ example: 'groups' })
  iconKey!: string;

  @ApiProperty({ type: [RoadmapMilestoneItemDto] })
  items!: RoadmapMilestoneItemDto[];
}

export class RoadmapSourceTooltipDto {
  @ApiProperty({
    example:
      'CDC, AAP, 국민건강보험, 보건복지부 등 세계 소아과 전문의들이 가장 많이 참고하는 데이터를 바탕으로 설계된 발달 지표입니다.',
  })
  text!: string;
}

export class RoadmapResponseDto {
  @ApiProperty({ type: RoadmapChildDto })
  child!: RoadmapChildDto;

  @ApiProperty({ type: RoadmapStageDto, nullable: true })
  stage!: RoadmapStageDto | null;

  @ApiProperty({
    example: 4,
    description: '조회된 (보정 후) 대상 월령',
  })
  targetMonth!: number;

  @ApiProperty({
    type: [Number],
    example: [2, 4, 6, 9, 12],
    description: '월령 탭에 노출할 5개 CDC 체크포인트',
  })
  monthTabs!: number[];

  @ApiProperty({ type: RoadmapMonthTabRangeDto })
  monthTabRange!: RoadmapMonthTabRangeDto;

  @ApiProperty({ type: [RoadmapCategoryGroupDto] })
  milestonesByCategory!: RoadmapCategoryGroupDto[];

  @ApiProperty({ type: RoadmapSourceTooltipDto })
  sourceTooltip!: RoadmapSourceTooltipDto;
}
