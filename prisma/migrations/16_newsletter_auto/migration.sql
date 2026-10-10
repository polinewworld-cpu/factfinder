-- AlterTable
ALTER TABLE "SiteConfig" ADD COLUMN     "gmailSender" TEXT,
ADD COLUMN     "gmailToken" TEXT,
ADD COLUMN     "newsletterAuto" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "newsletterSkipWeek" TEXT;

-- AlterTable
ALTER TABLE "NewsletterSend" ADD COLUMN     "auto" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "failedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'SENT',
ADD COLUMN     "subject" TEXT,
ADD COLUMN     "weekKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSend_weekKey_key" ON "NewsletterSend"("weekKey");


-- 첫 자동 발송은 다음 주(10-17)부터 — 오늘(10-10 토) 배포 직후 지메일을 연결하자마자 나가지 않게, 먼저 [나에게 테스트 발송]으로 확인 (2026-10-10)
UPDATE "SiteConfig" SET "newsletterSkipWeek" = '2026-10-10' WHERE "id" = 'singleton';
