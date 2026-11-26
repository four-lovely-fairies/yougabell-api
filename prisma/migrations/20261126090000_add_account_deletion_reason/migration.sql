-- 계정 탈퇴 사유 설문. User와 FK 없이 보관 (User row가 물리 삭제돼도 통계는 남긴다).
CREATE TYPE "public"."AccountDeletionReasonCode" AS ENUM (
    'rarely_use',
    'not_helpful',
    'hard_to_use',
    'privacy',
    'other'
);

CREATE TABLE "public"."AccountDeletionReason" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "reason" "public"."AccountDeletionReasonCode" NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountDeletionReason_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AccountDeletionReason_reason_createdAt_idx"
ON "public"."AccountDeletionReason"("reason", "createdAt");

CREATE INDEX "AccountDeletionReason_userId_idx"
ON "public"."AccountDeletionReason"("userId");

-- API(Prisma)로만 접근한다. Supabase 공개 API로는 읽고 쓰지 못하게 RLS를 켜고 정책은 두지 않는다.
ALTER TABLE "public"."AccountDeletionReason" ENABLE ROW LEVEL SECURITY;
