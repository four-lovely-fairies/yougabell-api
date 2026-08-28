-- Existing onboarded accounts are treated as having already seen the nudge.
-- Accounts completing onboarding after this migration keep NULL until their first home entry.
ALTER TABLE "User"
ADD COLUMN "homeNotificationNudgeShownAt" TIMESTAMP(3);

UPDATE "User"
SET "homeNotificationNudgeShownAt" = COALESCE("onboardedAt", "createdAt", CURRENT_TIMESTAMP)
WHERE "onboardedAt" IS NOT NULL;
