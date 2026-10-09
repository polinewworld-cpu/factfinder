-- AlterTable: 애드센스 자동광고 설정 (관리자 광고 관리 → 애드센스 탭)
ALTER TABLE "SiteConfig" ADD COLUMN "adsenseEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "adsenseOnHome" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "adsenseOnArticle" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "adsenseOnOther" BOOLEAN NOT NULL DEFAULT true;
