-- AlterTable
ALTER TABLE "WeeklyReport" ADD COLUMN "headlineBody" TEXT;

-- AlterTable
ALTER TABLE "WeeklyReport" DROP COLUMN "bestMomentTitle",
DROP COLUMN "bestMomentBody";

-- CreateTable
CREATE TABLE "WeeklyReportBestMoment" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "label" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,

    CONSTRAINT "WeeklyReportBestMoment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReportBestMoment_reportId_order_key" ON "WeeklyReportBestMoment"("reportId", "order");

-- AddForeignKey
ALTER TABLE "WeeklyReportBestMoment" ADD CONSTRAINT "WeeklyReportBestMoment_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "WeeklyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
