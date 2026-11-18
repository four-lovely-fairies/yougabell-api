-- 친구 초대(레퍼럴) — docs/features/20261118-referral.md
ALTER TYPE "public"."NotificationType" ADD VALUE 'referral_joined';

ALTER TABLE "public"."User" ADD COLUMN "referralCode" TEXT;

CREATE UNIQUE INDEX "User_referralCode_key"
ON "public"."User"("referralCode");

CREATE TABLE "public"."Referral" (
    "id" UUID NOT NULL,
    "inviterId" UUID NOT NULL,
    "inviteeId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Referral_inviteeId_key"
ON "public"."Referral"("inviteeId");

CREATE INDEX "Referral_inviterId_createdAt_idx"
ON "public"."Referral"("inviterId", "createdAt");

ALTER TABLE "public"."Referral"
ADD CONSTRAINT "Referral_inviterId_fkey"
FOREIGN KEY ("inviterId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."Referral"
ADD CONSTRAINT "Referral_inviteeId_fkey"
FOREIGN KEY ("inviteeId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "public"."ReferralRewardClaim" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "inviteCount" INTEGER NOT NULL,
    "privacyAgreedAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralRewardClaim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferralRewardClaim_userId_key"
ON "public"."ReferralRewardClaim"("userId");

CREATE INDEX "ReferralRewardClaim_sentAt_createdAt_idx"
ON "public"."ReferralRewardClaim"("sentAt", "createdAt");

ALTER TABLE "public"."ReferralRewardClaim"
ADD CONSTRAINT "ReferralRewardClaim_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- API(Prisma)만 직접 접속한다. Supabase 공개 API로는 읽고 쓰지 못하게 RLS를 켜고 정책은 두지 않는다.
ALTER TABLE "public"."Referral" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ReferralRewardClaim" ENABLE ROW LEVEL SECURITY;
