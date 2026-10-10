-- AlterTable
ALTER TABLE "Banner" ADD COLUMN     "ctaLabel" TEXT,
ADD COLUMN     "videoUrl" TEXT;


-- 웰컴퓨터 메인 배너(3번째 칸): 누르면 소개 영상 + [웰컴퓨터 블로그 구경가기] (2026-10-10 사장님 요청)
UPDATE "Banner" SET "videoUrl" = '/ads/wellcomputer-2026-10.mp4', "ctaLabel" = '웰컴퓨터 블로그 구경가기' WHERE "id" = 'cmv23dpqo002xu6j80cjidz7t';
