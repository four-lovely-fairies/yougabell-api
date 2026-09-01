export type RoadmapCategoryId =
  | 'social'
  | 'language'
  | 'cognitive'
  | 'physical';

export const ROADMAP_CATEGORY_ORDER: RoadmapCategoryId[] = [
  'social',
  'language',
  'cognitive',
  'physical',
];

/**
 * CDC Act Early 공식 체크포인트 월령 (기획 문서 §7 결정).
 * 본 리스트가 월령 탭의 후보 집합. 시드되지 않은 월령은 가장 가까운 하단으로 보정.
 */
export const CDC_CHECKPOINTS: readonly number[] = [
  2, 4, 6, 9, 12, 15, 18, 24, 30, 36, 48, 60,
];

export const MONTH_TAB_WINDOW = 5;

/**
 * 운영 월령 상하한 (기획 문서 §7 결정). 음수·초과 입력은 clamp.
 */
export const AGE_MONTH_MIN = 0;
export const AGE_MONTH_MAX = 84;

export type RoadmapResponse = {
  child: {
    id: string;
    name: string;
    ageMonths: number;
    ageLabel: string;
  };
  stage: {
    id: string;
    name: string;
    summary: string;
  } | null;
  targetMonth: number;
  monthTabs: number[];
  monthTabRange: {
    prev: number | null;
    next: number | null;
  };
  milestonesByCategory: RoadmapCategoryGroup[];
  sourceTooltip: {
    text: string;
  };
};

export type RoadmapCategoryGroup = {
  categoryId: RoadmapCategoryId;
  categoryLabel: string;
  iconKey: string;
  items: RoadmapMilestoneItem[];
};

export type RoadmapMilestoneItem = {
  id: string;
  description: string;
  completed: boolean;
  completedAt: string | null;
  sources: { citation: string; url: string | null }[];
};

export type MilestoneCompletionResponse = {
  milestoneId: string;
  completed: boolean;
  completedAt: string | null;
};
