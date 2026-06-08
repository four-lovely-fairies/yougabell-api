import { FeedbackRow } from './selects';

export function normalizeFeedbackNote(note: string | null | undefined) {
  const trimmed = note?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

export function buildFeedbackKeywordRows(note: string | null) {
  return normalizeMissionFeedbackKeywords(note).map((keyword, index) => ({
    rank: index + 1,
    keyword,
  }));
}

export function toMissionFeedbackResponse(feedback: FeedbackRow) {
  return {
    id: feedback.id,
    executionId: feedback.executionId,
    childReaction: feedback.childReaction,
    parentEnergy: feedback.parentEnergy,
    missionSatisfaction: feedback.missionSatisfaction,
    note: feedback.note,
    keywords: feedback.keywords.map((keyword) => keyword.keyword),
    createdAt: feedback.createdAt.toISOString(),
  };
}

function normalizeMissionFeedbackKeywords(note: string | null) {
  const trimmed = note?.trim() ?? '';

  if (!trimmed) {
    return [];
  }

  return trimmed
    .split(/[\n,\s]+/u)
    .map((keyword) => keyword.trim())
    .filter(Boolean)
    .map(normalizeKeyword)
    .filter(Boolean)
    .slice(0, 10);
}

function normalizeKeyword(keyword: string) {
  if (!keyword) {
    return '';
  }

  return /^[A-Za-z]+$/.test(keyword) ? keyword.toLowerCase() : keyword;
}
