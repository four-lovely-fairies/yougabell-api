-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('female', 'male');

-- CreateEnum
CREATE TYPE "PushPlatform" AS ENUM ('ios', 'android', 'web');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('mission_reminder', 'mission_feedback', 'weekly_report_ready', 'roadmap_update', 'mental_check_reminder', 'chat_follow_up', 'system_notice');

-- CreateEnum
CREATE TYPE "NotificationActionType" AS ENUM ('none', 'open_home', 'open_mission', 'open_roadmap', 'open_chat', 'open_report', 'url');

-- CreateEnum
CREATE TYPE "NotificationTargetType" AS ENUM ('mission', 'mission_execution', 'weekly_report', 'child', 'chat_session', 'url');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('normal', 'high');

-- CreateEnum
CREATE TYPE "MentalCareStatus" AS ENUM ('in_progress', 'paused', 'completed', 'early_completed');

-- CreateEnum
CREATE TYPE "MissionExecutionStatus" AS ENUM ('in_progress', 'paused', 'completed', 'early_completed', 'cancelled');

-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('user', 'assistant');

-- CreateEnum
CREATE TYPE "CardAction" AS ENUM ('none', 'start_mission', 'open_link', 'follow_up');

-- CreateEnum
CREATE TYPE "Weekday" AS ENUM ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "birthDate" DATE NOT NULL,
    "gender" "Gender" NOT NULL,
    "weekdayHoursWithChild" DOUBLE PRECISION,
    "weekendHoursWithChild" DOUBLE PRECISION,
    "parentingStyleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPushToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "deviceId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" "PushPlatform" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPushToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Child" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "birthDate" DATE NOT NULL,
    "gender" "Gender" NOT NULL,
    "notes" TEXT DEFAULT '없음',
    "avatarUrl" TEXT,
    "displayOrder" INTEGER NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Child_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "childId" UUID,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "actionType" "NotificationActionType" NOT NULL,
    "targetType" "NotificationTargetType",
    "targetId" UUID,
    "targetUrl" TEXT,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'normal',
    "readAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentalBatteryCheck" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "level" INTEGER NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MentalBatteryCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatteryCheckRecommendation" (
    "id" UUID NOT NULL,
    "batteryCheckId" UUID NOT NULL,
    "categoryId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BatteryCheckRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentalCareCategory" (
    "id" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL,

    CONSTRAINT "MentalCareCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentalCareContent" (
    "id" UUID NOT NULL,
    "categoryId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentalCareContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentalCareExecution" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "batteryCheckId" UUID,
    "contentId" UUID NOT NULL,
    "status" "MentalCareStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "actualDurationSeconds" INTEGER,

    CONSTRAINT "MentalCareExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilestoneCategory" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "iconKey" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,

    CONSTRAINT "MilestoneCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
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
CREATE TABLE "MilestoneSource" (
    "id" UUID NOT NULL,
    "milestoneId" UUID NOT NULL,
    "citation" TEXT NOT NULL,
    "url" TEXT,
    "note" TEXT,

    CONSTRAINT "MilestoneSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrowthStage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ageMonthsFrom" INTEGER NOT NULL,
    "ageMonthsTo" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,

    CONSTRAINT "GrowthStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrowthStageSideTag" (
    "growthStageId" TEXT NOT NULL,
    "sideTagId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,

    CONSTRAINT "GrowthStageSideTag_pkey" PRIMARY KEY ("growthStageId","sideTagId")
);

-- CreateTable
CREATE TABLE "PeerInsight" (
    "id" UUID NOT NULL,
    "ageMonthsFrom" INTEGER NOT NULL,
    "ageMonthsTo" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "statPercent" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeerInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mission" (
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

    CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionTag" (
    "id" UUID NOT NULL,
    "missionId" UUID NOT NULL,
    "tag" TEXT NOT NULL,

    CONSTRAINT "MissionTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionExecution" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "childId" UUID NOT NULL,
    "missionId" UUID NOT NULL,
    "status" "MissionExecutionStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "actualDurationSeconds" INTEGER,
    "wasEarlyCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MissionExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionFeedback" (
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
CREATE TABLE "MissionFeedbackKeyword" (
    "id" UUID NOT NULL,
    "feedbackId" UUID NOT NULL,
    "rank" INTEGER NOT NULL,
    "keyword" TEXT NOT NULL,

    CONSTRAINT "MissionFeedbackKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "role" "ChatRole" NOT NULL,
    "content" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessageTag" (
    "id" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "tag" TEXT NOT NULL,

    CONSTRAINT "ChatMessageTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageCard" (
    "id" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "actionType" "CardAction",
    "actionPayload" JSONB,

    CONSTRAINT "MessageCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceLink" (
    "id" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "title" TEXT,

    CONSTRAINT "SourceLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyReport" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "childId" UUID NOT NULL,
    "weekStart" DATE NOT NULL,
    "weekEnd" DATE NOT NULL,
    "headline" TEXT NOT NULL,
    "totalMissionDurationSeconds" INTEGER NOT NULL DEFAULT 0,
    "childPositiveReactionRate" DOUBLE PRECISION NOT NULL,
    "bestMomentTitle" TEXT,
    "bestMomentBody" TEXT,
    "psychologicalEnergy" INTEGER NOT NULL,
    "aiActionSuggestion" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyReportDay" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "weekday" "Weekday" NOT NULL,
    "completedCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WeeklyReportDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyReportKeyword" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "rank" INTEGER NOT NULL,
    "keyword" TEXT NOT NULL,

    CONSTRAINT "WeeklyReportKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyReportImprovementTip" (
    "reportId" UUID NOT NULL,
    "tipId" UUID NOT NULL,
    "rank" INTEGER NOT NULL,

    CONSTRAINT "WeeklyReportImprovementTip_pkey" PRIMARY KEY ("reportId","tipId")
);

-- CreateTable
CREATE TABLE "ImprovementTip" (
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
CREATE TABLE "ImprovementTipItem" (
    "id" UUID NOT NULL,
    "tipId" UUID NOT NULL,
    "rank" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "iconEmoji" TEXT,

    CONSTRAINT "ImprovementTipItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspirationQuote" (
    "id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "author" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspirationQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspirationQuoteTag" (
    "id" UUID NOT NULL,
    "quoteId" UUID NOT NULL,
    "tag" TEXT NOT NULL,

    CONSTRAINT "InspirationQuoteTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserPushToken_userId_idx" ON "UserPushToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPushToken_userId_deviceId_key" ON "UserPushToken"("userId", "deviceId");

-- CreateIndex
CREATE INDEX "Child_userId_idx" ON "Child"("userId");

-- CreateIndex
CREATE INDEX "Child_userId_deletedAt_displayOrder_idx" ON "Child"("userId", "deletedAt", "displayOrder");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_childId_idx" ON "Notification"("childId");

-- CreateIndex
CREATE INDEX "MentalBatteryCheck_userId_checkedAt_idx" ON "MentalBatteryCheck"("userId", "checkedAt");

-- CreateIndex
CREATE INDEX "BatteryCheckRecommendation_batteryCheckId_idx" ON "BatteryCheckRecommendation"("batteryCheckId");

-- CreateIndex
CREATE UNIQUE INDEX "BatteryCheckRecommendation_batteryCheckId_categoryId_key" ON "BatteryCheckRecommendation"("batteryCheckId", "categoryId");

-- CreateIndex
CREATE INDEX "MentalCareContent_categoryId_idx" ON "MentalCareContent"("categoryId");

-- CreateIndex
CREATE INDEX "MentalCareExecution_userId_startedAt_idx" ON "MentalCareExecution"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "MentalCareExecution_contentId_idx" ON "MentalCareExecution"("contentId");

-- CreateIndex
CREATE INDEX "Milestone_categoryId_ageMonthsFrom_ageMonthsTo_idx" ON "Milestone"("categoryId", "ageMonthsFrom", "ageMonthsTo");

-- CreateIndex
CREATE INDEX "MilestoneSource_milestoneId_idx" ON "MilestoneSource"("milestoneId");

-- CreateIndex
CREATE INDEX "PeerInsight_ageMonthsFrom_ageMonthsTo_idx" ON "PeerInsight"("ageMonthsFrom", "ageMonthsTo");

-- CreateIndex
CREATE INDEX "Mission_categoryId_recommendedAgeMonthsMin_recommendedAgeMo_idx" ON "Mission"("categoryId", "recommendedAgeMonthsMin", "recommendedAgeMonthsMax");

-- CreateIndex
CREATE INDEX "MissionTag_tag_idx" ON "MissionTag"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "MissionTag_missionId_tag_key" ON "MissionTag"("missionId", "tag");

-- CreateIndex
CREATE INDEX "MissionExecution_userId_startedAt_idx" ON "MissionExecution"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "MissionExecution_childId_startedAt_idx" ON "MissionExecution"("childId", "startedAt");

-- CreateIndex
CREATE INDEX "MissionExecution_missionId_idx" ON "MissionExecution"("missionId");

-- CreateIndex
CREATE UNIQUE INDEX "MissionFeedback_executionId_key" ON "MissionFeedback"("executionId");

-- CreateIndex
CREATE INDEX "MissionFeedbackKeyword_keyword_idx" ON "MissionFeedbackKeyword"("keyword");

-- CreateIndex
CREATE UNIQUE INDEX "MissionFeedbackKeyword_feedbackId_rank_key" ON "MissionFeedbackKeyword"("feedbackId", "rank");

-- CreateIndex
CREATE INDEX "ChatSession_userId_updatedAt_idx" ON "ChatSession"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "ChatMessage_sessionId_sentAt_idx" ON "ChatMessage"("sessionId", "sentAt");

-- CreateIndex
CREATE INDEX "ChatMessageTag_tag_idx" ON "ChatMessageTag"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessageTag_messageId_tag_key" ON "ChatMessageTag"("messageId", "tag");

-- CreateIndex
CREATE UNIQUE INDEX "MessageCard_messageId_order_key" ON "MessageCard"("messageId", "order");

-- CreateIndex
CREATE INDEX "SourceLink_messageId_idx" ON "SourceLink"("messageId");

-- CreateIndex
CREATE INDEX "WeeklyReport_userId_weekStart_idx" ON "WeeklyReport"("userId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReport_childId_weekStart_key" ON "WeeklyReport"("childId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReportDay_reportId_weekday_key" ON "WeeklyReportDay"("reportId", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReportKeyword_reportId_rank_key" ON "WeeklyReportKeyword"("reportId", "rank");

-- CreateIndex
CREATE INDEX "WeeklyReportImprovementTip_tipId_idx" ON "WeeklyReportImprovementTip"("tipId");

-- CreateIndex
CREATE INDEX "ImprovementTip_category_idx" ON "ImprovementTip"("category");

-- CreateIndex
CREATE UNIQUE INDEX "ImprovementTipItem_tipId_rank_key" ON "ImprovementTipItem"("tipId", "rank");

-- CreateIndex
CREATE INDEX "InspirationQuoteTag_tag_idx" ON "InspirationQuoteTag"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "InspirationQuoteTag_quoteId_tag_key" ON "InspirationQuoteTag"("quoteId", "tag");

-- AddForeignKey
ALTER TABLE "UserPushToken" ADD CONSTRAINT "UserPushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Child" ADD CONSTRAINT "Child_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentalBatteryCheck" ADD CONSTRAINT "MentalBatteryCheck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatteryCheckRecommendation" ADD CONSTRAINT "BatteryCheckRecommendation_batteryCheckId_fkey" FOREIGN KEY ("batteryCheckId") REFERENCES "MentalBatteryCheck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatteryCheckRecommendation" ADD CONSTRAINT "BatteryCheckRecommendation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MentalCareCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentalCareContent" ADD CONSTRAINT "MentalCareContent_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MentalCareCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentalCareExecution" ADD CONSTRAINT "MentalCareExecution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentalCareExecution" ADD CONSTRAINT "MentalCareExecution_batteryCheckId_fkey" FOREIGN KEY ("batteryCheckId") REFERENCES "MentalBatteryCheck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentalCareExecution" ADD CONSTRAINT "MentalCareExecution_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "MentalCareContent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MilestoneCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneSource" ADD CONSTRAINT "MilestoneSource_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrowthStageSideTag" ADD CONSTRAINT "GrowthStageSideTag_growthStageId_fkey" FOREIGN KEY ("growthStageId") REFERENCES "GrowthStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrowthStageSideTag" ADD CONSTRAINT "GrowthStageSideTag_sideTagId_fkey" FOREIGN KEY ("sideTagId") REFERENCES "GrowthStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MilestoneCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionTag" ADD CONSTRAINT "MissionTag_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionExecution" ADD CONSTRAINT "MissionExecution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionExecution" ADD CONSTRAINT "MissionExecution_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionExecution" ADD CONSTRAINT "MissionExecution_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionFeedback" ADD CONSTRAINT "MissionFeedback_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "MissionExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionFeedbackKeyword" ADD CONSTRAINT "MissionFeedbackKeyword_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "MissionFeedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessageTag" ADD CONSTRAINT "ChatMessageTag_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageCard" ADD CONSTRAINT "MessageCard_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceLink" ADD CONSTRAINT "SourceLink_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReport" ADD CONSTRAINT "WeeklyReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReport" ADD CONSTRAINT "WeeklyReport_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReportDay" ADD CONSTRAINT "WeeklyReportDay_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "WeeklyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReportKeyword" ADD CONSTRAINT "WeeklyReportKeyword_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "WeeklyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReportImprovementTip" ADD CONSTRAINT "WeeklyReportImprovementTip_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "WeeklyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReportImprovementTip" ADD CONSTRAINT "WeeklyReportImprovementTip_tipId_fkey" FOREIGN KEY ("tipId") REFERENCES "ImprovementTip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprovementTipItem" ADD CONSTRAINT "ImprovementTipItem_tipId_fkey" FOREIGN KEY ("tipId") REFERENCES "ImprovementTip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspirationQuoteTag" ADD CONSTRAINT "InspirationQuoteTag_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "InspirationQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
