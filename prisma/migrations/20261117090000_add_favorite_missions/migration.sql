CREATE TABLE "public"."FavoriteMission" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "missionId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoriteMission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FavoriteMission_userId_missionId_key"
ON "public"."FavoriteMission"("userId", "missionId");

CREATE INDEX "FavoriteMission_userId_createdAt_idx"
ON "public"."FavoriteMission"("userId", "createdAt");

CREATE INDEX "FavoriteMission_missionId_idx"
ON "public"."FavoriteMission"("missionId");

ALTER TABLE "public"."FavoriteMission"
ADD CONSTRAINT "FavoriteMission_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."FavoriteMission"
ADD CONSTRAINT "FavoriteMission_missionId_fkey"
FOREIGN KEY ("missionId") REFERENCES "public"."Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
