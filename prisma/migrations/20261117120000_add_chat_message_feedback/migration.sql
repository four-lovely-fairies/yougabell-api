CREATE TABLE "public"."ChatMessageFeedback" (
    "id" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "helpful" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatMessageFeedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChatMessageFeedback_messageId_key"
ON "public"."ChatMessageFeedback"("messageId");

CREATE INDEX "ChatMessageFeedback_helpful_updatedAt_idx"
ON "public"."ChatMessageFeedback"("helpful", "updatedAt");

CREATE INDEX "ChatMessageFeedback_userId_idx"
ON "public"."ChatMessageFeedback"("userId");

ALTER TABLE "public"."ChatMessageFeedback"
ADD CONSTRAINT "ChatMessageFeedback_messageId_fkey"
FOREIGN KEY ("messageId") REFERENCES "public"."ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."ChatMessageFeedback"
ADD CONSTRAINT "ChatMessageFeedback_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- API(Prisma)만 직접 접속한다. Supabase 공개 API로는 읽고 쓰지 못하게 RLS를 켜고 정책은 두지 않는다.
ALTER TABLE "public"."ChatMessageFeedback" ENABLE ROW LEVEL SECURITY;
