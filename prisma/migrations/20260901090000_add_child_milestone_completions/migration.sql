CREATE TABLE "public"."ChildMilestoneCompletion" (
    "id" UUID NOT NULL,
    "childId" UUID NOT NULL,
    "milestoneId" UUID NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChildMilestoneCompletion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChildMilestoneCompletion_childId_milestoneId_key"
ON "public"."ChildMilestoneCompletion"("childId", "milestoneId");

CREATE INDEX "ChildMilestoneCompletion_childId_completedAt_idx"
ON "public"."ChildMilestoneCompletion"("childId", "completedAt");

CREATE INDEX "ChildMilestoneCompletion_milestoneId_idx"
ON "public"."ChildMilestoneCompletion"("milestoneId");

ALTER TABLE "public"."ChildMilestoneCompletion"
ADD CONSTRAINT "ChildMilestoneCompletion_childId_fkey"
FOREIGN KEY ("childId") REFERENCES "public"."Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."ChildMilestoneCompletion"
ADD CONSTRAINT "ChildMilestoneCompletion_milestoneId_fkey"
FOREIGN KEY ("milestoneId") REFERENCES "public"."Milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
