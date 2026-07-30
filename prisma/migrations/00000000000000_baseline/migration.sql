-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."CardAction" AS ENUM ('none', 'start_mission', 'open_link', 'follow_up');

-- CreateEnum
CREATE TYPE "public"."ChatRole" AS ENUM ('user', 'assistant');

-- CreateEnum
CREATE TYPE "public"."ConsentSource" AS ENUM ('user_action', 'backfill');

-- CreateEnum
CREATE TYPE "public"."ConsentType" AS ENUM ('service', 'privacy', 'marketing');

-- CreateEnum
CREATE TYPE "public"."Gender" AS ENUM ('female', 'male');

-- CreateEnum
CREATE TYPE "public"."InterestId" AS ENUM ('working_parent', 'home_care', 'language', 'social', 'physical', 'cognition');

-- CreateEnum
CREATE TYPE "public"."KnowledgeSource" AS ENUM ('cdc', 'mohw', 'internal');

-- CreateEnum
CREATE TYPE "public"."MentalCareStatus" AS ENUM ('in_progress', 'paused', 'completed', 'early_completed');

-- CreateEnum
CREATE TYPE "public"."MissionExecutionStatus" AS ENUM ('in_progress', 'paused', 'completed', 'early_completed', 'cancelled');

-- CreateEnum
CREATE TYPE "public"."NotificationActionType" AS ENUM ('none', 'open_home', 'open_mission', 'open_roadmap', 'open_chat', 'open_report', 'url');

-- CreateEnum
CREATE TYPE "public"."NotificationPreferenceType" AS ENUM ('play_10min', 'weekly_report');

-- CreateEnum
CREATE TYPE "public"."NotificationPriority" AS ENUM ('normal', 'high');

-- CreateEnum
CREATE TYPE "public"."NotificationSlot" AS ENUM ('morning', 'afternoon', 'evening', 'night', 'custom');

-- CreateEnum
CREATE TYPE "public"."NotificationTargetType" AS ENUM ('mission', 'mission_execution', 'weekly_report', 'child', 'chat_session', 'url');

-- CreateEnum
CREATE TYPE "public"."NotificationType" AS ENUM ('mission_reminder', 'mission_feedback', 'weekly_report_ready', 'roadmap_update', 'mental_check_reminder', 'chat_follow_up', 'system_notice');

-- CreateEnum
CREATE TYPE "public"."PushPlatform" AS ENUM ('ios', 'android', 'web');

-- CreateEnum
CREATE TYPE "public"."Weekday" AS ENUM ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun');

-- CreateEnum
CREATE TYPE "public"."WorkStatus" AS ENUM ('working', 'full_time_caregiver');

-- CreateTable
CREATE TABLE "public"."BatteryCheckRecommendation" (
    "id" UUID NOT NULL,
    "batteryCheckId" UUID NOT NULL,
    "categoryId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BatteryCheckRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChatMessage" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "role" "public"."ChatRole" NOT NULL,
    "content" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tokensUsed" INTEGER,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChatMessageTag" (
    "id" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "tag" TEXT NOT NULL,

    CONSTRAINT "ChatMessageTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChatSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Child" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "birthDate" DATE NOT NULL,
    "gender" "public"."Gender" NOT NULL,
    "notes" TEXT DEFAULT '없음',
    "avatarUrl" TEXT,
    "displayOrder" INTEGER NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Child_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GrowthStage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ageMonthsFrom" INTEGER NOT NULL,
    "ageMonthsTo" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,

    CONSTRAINT "GrowthStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GrowthStageSideTag" (
    "growthStageId" TEXT NOT NULL,
    "sideTagId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,

    CONSTRAINT "GrowthStageSideTag_pkey" PRIMARY KEY ("growthStageId","sideTagId")
);

-- CreateTable
CREATE TABLE "public"."ImprovementTip" (
    "id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "quote" TEXT,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImprovementTip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ImprovementTipItem" (
    "id" UUID NOT NULL,
    "tipId" UUID NOT NULL,
    "rank" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "iconEmoji" TEXT,

    CONSTRAINT "ImprovementTipItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InspirationQuote" (
    "id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "author" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspirationQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InspirationQuoteTag" (
    "id" UUID NOT NULL,
    "quoteId" UUID NOT NULL,
    "tag" TEXT NOT NULL,

    CONSTRAINT "InspirationQuoteTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."KnowledgeChunk" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "tokenCount" INTEGER,
    "embedding" vector(768),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."KnowledgeDocument" (
    "id" UUID NOT NULL,
    "source" "public"."KnowledgeSource" NOT NULL,
    "sourceUrl" TEXT,
    "title" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'ko',
    "license" TEXT NOT NULL,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MentalBatteryCheck" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "level" INTEGER NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MentalBatteryCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MentalCareCategory" (
    "id" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL,

    CONSTRAINT "MentalCareCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MentalCareContent" (
    "id" UUID NOT NULL,
    "categoryId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentalCareContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MentalCareExecution" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "batteryCheckId" UUID,
    "contentId" UUID NOT NULL,
    "status" "public"."MentalCareStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "actualDurationSeconds" INTEGER,

    CONSTRAINT "MentalCareExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MessageCard" (
    "id" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "actionType" "public"."CardAction",
    "actionPayload" JSONB,

    CONSTRAINT "MessageCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MessageRetrieval" (
    "id" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "chunkId" UUID NOT NULL,
    "similarity" DOUBLE PRECISION NOT NULL,
    "rank" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageRetrieval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Milestone" (
    "id" UUID NOT NULL,
    "categoryId" TEXT NOT NULL,
    "ageMonthsFrom" INTEGER NOT NULL,
    "ageMonthsTo" INTEGER NOT NULL,
    "title" TEXT,
    "description" TEXT NOT NULL,
    "displayOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MilestoneCategory" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "iconKey" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,

    CONSTRAINT "MilestoneCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MilestoneSource" (
    "id" UUID NOT NULL,
    "milestoneId" UUID NOT NULL,
    "citation" TEXT NOT NULL,
    "url" TEXT,
    "note" TEXT,

    CONSTRAINT "MilestoneSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Mission" (
    "id" UUID NOT NULL,
    "categoryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "shortTitle" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "effect" TEXT NOT NULL,
    "subThemeLabel" TEXT,
    "recommendedAgeMonthsMin" INTEGER,
    "recommendedAgeMonthsMax" INTEGER,
    "thumbnailUrl" TEXT,
    "videoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "goal" TEXT,
    "parentingStyleId" TEXT,

    CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MissionExecution" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "childId" UUID NOT NULL,
    "missionId" UUID NOT NULL,
    "status" "public"."MissionExecutionStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "actualDurationSeconds" INTEGER,
    "wasEarlyCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "activeSegmentStartedAt" TIMESTAMP(3),
    "elapsedSeconds" INTEGER NOT NULL DEFAULT 0,
    "pausedAt" TIMESTAMP(3),

    CONSTRAINT "MissionExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MissionFeedback" (
    "id" UUID NOT NULL,
    "executionId" UUID NOT NULL,
    "childReaction" INTEGER NOT NULL,
    "parentEnergy" INTEGER NOT NULL,
    "missionSatisfaction" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissionFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MissionFeedbackKeyword" (
    "id" UUID NOT NULL,
    "feedbackId" UUID NOT NULL,
    "rank" INTEGER NOT NULL,
    "keyword" TEXT NOT NULL,

    CONSTRAINT "MissionFeedbackKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MissionSource" (
    "id" UUID NOT NULL,
    "missionId" UUID NOT NULL,
    "citation" TEXT NOT NULL,
    "url" TEXT,
    "note" TEXT,

    CONSTRAINT "MissionSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MissionTag" (
    "id" UUID NOT NULL,
    "missionId" UUID NOT NULL,
    "tag" TEXT NOT NULL,

    CONSTRAINT "MissionTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "childId" UUID,
    "type" "public"."NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "actionType" "public"."NotificationActionType" NOT NULL,
    "targetType" "public"."NotificationTargetType",
    "targetId" UUID,
    "targetUrl" TEXT,
    "priority" "public"."NotificationPriority" NOT NULL DEFAULT 'normal',
    "readAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NotificationPreference" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "public"."NotificationPreferenceType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "time" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PeerInsight" (
    "id" UUID NOT NULL,
    "ageMonthsFrom" INTEGER NOT NULL,
    "ageMonthsTo" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "statPercent" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeerInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SourceLink" (
    "id" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "title" TEXT,

    CONSTRAINT "SourceLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "birthDate" DATE,
    "gender" "public"."Gender",
    "workStatus" "public"."WorkStatus",
    "notificationSlot" "public"."NotificationSlot",
    "notificationTime" TEXT,
    "onboardedAt" TIMESTAMP(3),
    "parentingStyleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletionReason" TEXT,
    "interests" "public"."InterestId"[] DEFAULT ARRAY[]::"public"."InterestId"[],

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserConsent" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "public"."ConsentType" NOT NULL,
    "agreed" BOOLEAN NOT NULL,
    "version" TEXT NOT NULL,
    "source" "public"."ConsentSource" NOT NULL DEFAULT 'user_action',
    "note" TEXT,
    "agreedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserPushToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "deviceId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" "public"."PushPlatform" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPushToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WeeklyReport" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "childId" UUID NOT NULL,
    "weekStart" DATE NOT NULL,
    "weekEnd" DATE NOT NULL,
    "headline" TEXT NOT NULL,
    "headlineBody" TEXT,
    "totalMissionDurationSeconds" INTEGER NOT NULL DEFAULT 0,
    "childPositiveReactionRate" DOUBLE PRECISION NOT NULL,
    "psychologicalEnergy" INTEGER NOT NULL,
    "aiActionSuggestion" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aiCompletionTokens" INTEGER,
    "aiGeneratedAt" TIMESTAMP(3),
    "aiPromptTokens" INTEGER,

    CONSTRAINT "WeeklyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WeeklyReportBestMoment" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "label" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,

    CONSTRAINT "WeeklyReportBestMoment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WeeklyReportDay" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "weekday" "public"."Weekday" NOT NULL,
    "completedCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WeeklyReportDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WeeklyReportImprovementTip" (
    "reportId" UUID NOT NULL,
    "tipId" UUID NOT NULL,
    "rank" INTEGER NOT NULL,

    CONSTRAINT "WeeklyReportImprovementTip_pkey" PRIMARY KEY ("reportId","tipId")
);

-- CreateTable
CREATE TABLE "public"."WeeklyReportKeyword" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "rank" INTEGER NOT NULL,
    "keyword" TEXT NOT NULL,

    CONSTRAINT "WeeklyReportKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BatteryCheckRecommendation_batteryCheckId_categoryId_key" ON "public"."BatteryCheckRecommendation"("batteryCheckId" ASC, "categoryId" ASC);

-- CreateIndex
CREATE INDEX "BatteryCheckRecommendation_batteryCheckId_idx" ON "public"."BatteryCheckRecommendation"("batteryCheckId" ASC);

-- CreateIndex
CREATE INDEX "ChatMessage_sessionId_sentAt_idx" ON "public"."ChatMessage"("sessionId" ASC, "sentAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessageTag_messageId_tag_key" ON "public"."ChatMessageTag"("messageId" ASC, "tag" ASC);

-- CreateIndex
CREATE INDEX "ChatMessageTag_tag_idx" ON "public"."ChatMessageTag"("tag" ASC);

-- CreateIndex
CREATE INDEX "ChatSession_userId_updatedAt_idx" ON "public"."ChatSession"("userId" ASC, "updatedAt" ASC);

-- CreateIndex
CREATE INDEX "Child_userId_deletedAt_displayOrder_idx" ON "public"."Child"("userId" ASC, "deletedAt" ASC, "displayOrder" ASC);

-- CreateIndex
CREATE INDEX "Child_userId_idx" ON "public"."Child"("userId" ASC);

-- CreateIndex
CREATE INDEX "ImprovementTip_category_idx" ON "public"."ImprovementTip"("category" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ImprovementTipItem_tipId_rank_key" ON "public"."ImprovementTipItem"("tipId" ASC, "rank" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "InspirationQuoteTag_quoteId_tag_key" ON "public"."InspirationQuoteTag"("quoteId" ASC, "tag" ASC);

-- CreateIndex
CREATE INDEX "InspirationQuoteTag_tag_idx" ON "public"."InspirationQuoteTag"("tag" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeChunk_documentId_chunkIndex_key" ON "public"."KnowledgeChunk"("documentId" ASC, "chunkIndex" ASC);

-- CreateIndex
CREATE INDEX "KnowledgeChunk_documentId_idx" ON "public"."KnowledgeChunk"("documentId" ASC);

-- CreateIndex
CREATE INDEX "KnowledgeDocument_source_idx" ON "public"."KnowledgeDocument"("source" ASC);

-- CreateIndex
CREATE INDEX "MentalBatteryCheck_userId_checkedAt_idx" ON "public"."MentalBatteryCheck"("userId" ASC, "checkedAt" ASC);

-- CreateIndex
CREATE INDEX "MentalCareContent_categoryId_idx" ON "public"."MentalCareContent"("categoryId" ASC);

-- CreateIndex
CREATE INDEX "MentalCareExecution_contentId_idx" ON "public"."MentalCareExecution"("contentId" ASC);

-- CreateIndex
CREATE INDEX "MentalCareExecution_userId_startedAt_idx" ON "public"."MentalCareExecution"("userId" ASC, "startedAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "MessageCard_messageId_order_key" ON "public"."MessageCard"("messageId" ASC, "order" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "MessageRetrieval_messageId_chunkId_key" ON "public"."MessageRetrieval"("messageId" ASC, "chunkId" ASC);

-- CreateIndex
CREATE INDEX "MessageRetrieval_messageId_idx" ON "public"."MessageRetrieval"("messageId" ASC);

-- CreateIndex
CREATE INDEX "Milestone_categoryId_ageMonthsFrom_ageMonthsTo_idx" ON "public"."Milestone"("categoryId" ASC, "ageMonthsFrom" ASC, "ageMonthsTo" ASC);

-- CreateIndex
CREATE INDEX "MilestoneSource_milestoneId_idx" ON "public"."MilestoneSource"("milestoneId" ASC);

-- CreateIndex
CREATE INDEX "Mission_categoryId_recommendedAgeMonthsMin_recommendedAgeMo_idx" ON "public"."Mission"("categoryId" ASC, "recommendedAgeMonthsMin" ASC, "recommendedAgeMonthsMax" ASC);

-- CreateIndex
CREATE INDEX "MissionExecution_childId_startedAt_idx" ON "public"."MissionExecution"("childId" ASC, "startedAt" ASC);

-- CreateIndex
CREATE INDEX "MissionExecution_missionId_idx" ON "public"."MissionExecution"("missionId" ASC);

-- CreateIndex
CREATE INDEX "MissionExecution_userId_startedAt_idx" ON "public"."MissionExecution"("userId" ASC, "startedAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "MissionFeedback_executionId_key" ON "public"."MissionFeedback"("executionId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "MissionFeedbackKeyword_feedbackId_rank_key" ON "public"."MissionFeedbackKeyword"("feedbackId" ASC, "rank" ASC);

-- CreateIndex
CREATE INDEX "MissionFeedbackKeyword_keyword_idx" ON "public"."MissionFeedbackKeyword"("keyword" ASC);

-- CreateIndex
CREATE INDEX "MissionSource_missionId_idx" ON "public"."MissionSource"("missionId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "MissionTag_missionId_tag_key" ON "public"."MissionTag"("missionId" ASC, "tag" ASC);

-- CreateIndex
CREATE INDEX "MissionTag_tag_idx" ON "public"."MissionTag"("tag" ASC);

-- CreateIndex
CREATE INDEX "Notification_childId_idx" ON "public"."Notification"("childId" ASC);

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "public"."Notification"("userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "public"."Notification"("userId" ASC, "readAt" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "NotificationPreference_userId_idx" ON "public"."NotificationPreference"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_type_key" ON "public"."NotificationPreference"("userId" ASC, "type" ASC);

-- CreateIndex
CREATE INDEX "PeerInsight_ageMonthsFrom_ageMonthsTo_idx" ON "public"."PeerInsight"("ageMonthsFrom" ASC, "ageMonthsTo" ASC);

-- CreateIndex
CREATE INDEX "SourceLink_messageId_idx" ON "public"."SourceLink"("messageId" ASC);

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "public"."User"("deletedAt" ASC);

-- CreateIndex
CREATE INDEX "UserConsent_userId_type_agreedAt_idx" ON "public"."UserConsent"("userId" ASC, "type" ASC, "agreedAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "UserPushToken_userId_deviceId_key" ON "public"."UserPushToken"("userId" ASC, "deviceId" ASC);

-- CreateIndex
CREATE INDEX "UserPushToken_userId_idx" ON "public"."UserPushToken"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReport_childId_weekStart_key" ON "public"."WeeklyReport"("childId" ASC, "weekStart" ASC);

-- CreateIndex
CREATE INDEX "WeeklyReport_userId_weekStart_idx" ON "public"."WeeklyReport"("userId" ASC, "weekStart" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReportBestMoment_reportId_order_key" ON "public"."WeeklyReportBestMoment"("reportId" ASC, "order" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReportDay_reportId_weekday_key" ON "public"."WeeklyReportDay"("reportId" ASC, "weekday" ASC);

-- CreateIndex
CREATE INDEX "WeeklyReportImprovementTip_tipId_idx" ON "public"."WeeklyReportImprovementTip"("tipId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReportKeyword_reportId_rank_key" ON "public"."WeeklyReportKeyword"("reportId" ASC, "rank" ASC);

-- AddForeignKey
ALTER TABLE "public"."BatteryCheckRecommendation" ADD CONSTRAINT "BatteryCheckRecommendation_batteryCheckId_fkey" FOREIGN KEY ("batteryCheckId") REFERENCES "public"."MentalBatteryCheck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BatteryCheckRecommendation" ADD CONSTRAINT "BatteryCheckRecommendation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."MentalCareCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatMessage" ADD CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatMessageTag" ADD CONSTRAINT "ChatMessageTag_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "public"."ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatSession" ADD CONSTRAINT "ChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Child" ADD CONSTRAINT "Child_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GrowthStageSideTag" ADD CONSTRAINT "GrowthStageSideTag_growthStageId_fkey" FOREIGN KEY ("growthStageId") REFERENCES "public"."GrowthStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GrowthStageSideTag" ADD CONSTRAINT "GrowthStageSideTag_sideTagId_fkey" FOREIGN KEY ("sideTagId") REFERENCES "public"."GrowthStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ImprovementTipItem" ADD CONSTRAINT "ImprovementTipItem_tipId_fkey" FOREIGN KEY ("tipId") REFERENCES "public"."ImprovementTip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InspirationQuoteTag" ADD CONSTRAINT "InspirationQuoteTag_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "public"."InspirationQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MentalBatteryCheck" ADD CONSTRAINT "MentalBatteryCheck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MentalCareContent" ADD CONSTRAINT "MentalCareContent_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."MentalCareCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MentalCareExecution" ADD CONSTRAINT "MentalCareExecution_batteryCheckId_fkey" FOREIGN KEY ("batteryCheckId") REFERENCES "public"."MentalBatteryCheck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MentalCareExecution" ADD CONSTRAINT "MentalCareExecution_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "public"."MentalCareContent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MentalCareExecution" ADD CONSTRAINT "MentalCareExecution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MessageCard" ADD CONSTRAINT "MessageCard_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "public"."ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MessageRetrieval" ADD CONSTRAINT "MessageRetrieval_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "public"."KnowledgeChunk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MessageRetrieval" ADD CONSTRAINT "MessageRetrieval_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "public"."ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Milestone" ADD CONSTRAINT "Milestone_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."MilestoneCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MilestoneSource" ADD CONSTRAINT "MilestoneSource_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "public"."Milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Mission" ADD CONSTRAINT "Mission_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."MilestoneCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MissionExecution" ADD CONSTRAINT "MissionExecution_childId_fkey" FOREIGN KEY ("childId") REFERENCES "public"."Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MissionExecution" ADD CONSTRAINT "MissionExecution_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "public"."Mission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MissionExecution" ADD CONSTRAINT "MissionExecution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MissionFeedback" ADD CONSTRAINT "MissionFeedback_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "public"."MissionExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MissionFeedbackKeyword" ADD CONSTRAINT "MissionFeedbackKeyword_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "public"."MissionFeedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MissionSource" ADD CONSTRAINT "MissionSource_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "public"."Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MissionTag" ADD CONSTRAINT "MissionTag_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "public"."Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_childId_fkey" FOREIGN KEY ("childId") REFERENCES "public"."Child"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SourceLink" ADD CONSTRAINT "SourceLink_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "public"."ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserConsent" ADD CONSTRAINT "UserConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserPushToken" ADD CONSTRAINT "UserPushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WeeklyReport" ADD CONSTRAINT "WeeklyReport_childId_fkey" FOREIGN KEY ("childId") REFERENCES "public"."Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WeeklyReport" ADD CONSTRAINT "WeeklyReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WeeklyReportBestMoment" ADD CONSTRAINT "WeeklyReportBestMoment_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "public"."WeeklyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WeeklyReportDay" ADD CONSTRAINT "WeeklyReportDay_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "public"."WeeklyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WeeklyReportImprovementTip" ADD CONSTRAINT "WeeklyReportImprovementTip_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "public"."WeeklyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WeeklyReportImprovementTip" ADD CONSTRAINT "WeeklyReportImprovementTip_tipId_fkey" FOREIGN KEY ("tipId") REFERENCES "public"."ImprovementTip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WeeklyReportKeyword" ADD CONSTRAINT "WeeklyReportKeyword_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "public"."WeeklyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

