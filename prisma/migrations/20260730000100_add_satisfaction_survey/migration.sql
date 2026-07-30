CREATE TABLE "SurveyPromptState" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "campaignKey" TEXT NOT NULL,
  "shownCount" INTEGER NOT NULL DEFAULT 0,
  "dismissedCount" INTEGER NOT NULL DEFAULT 0,
  "lastShownAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SurveyPromptState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SatisfactionSurveyResponse" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "campaignKey" TEXT NOT NULL,
  "discoverySource" TEXT NOT NULL,
  "experienceRating" INTEGER NOT NULL,
  "likedOptions" TEXT[],
  "improvementText" TEXT,
  "contact" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SatisfactionSurveyResponse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SurveyPromptState_userId_campaignKey_key" ON "SurveyPromptState"("userId", "campaignKey");
CREATE INDEX "SurveyPromptState_userId_idx" ON "SurveyPromptState"("userId");

CREATE UNIQUE INDEX "SatisfactionSurveyResponse_userId_campaignKey_key" ON "SatisfactionSurveyResponse"("userId", "campaignKey");
CREATE INDEX "SatisfactionSurveyResponse_userId_idx" ON "SatisfactionSurveyResponse"("userId");
CREATE INDEX "SatisfactionSurveyResponse_campaignKey_idx" ON "SatisfactionSurveyResponse"("campaignKey");

ALTER TABLE "SurveyPromptState"
  ADD CONSTRAINT "SurveyPromptState_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SatisfactionSurveyResponse"
  ADD CONSTRAINT "SatisfactionSurveyResponse_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
