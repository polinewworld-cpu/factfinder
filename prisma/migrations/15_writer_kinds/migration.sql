-- CreateEnum
CREATE TYPE "WriterKind" AS ENUM ('NONMEMBER', 'RETURNING', 'GHOST');

-- DropIndex
DROP INDEX "User_nickname_key";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "writerKind" "WriterKind";


-- 기존 로그인 없는 필자 분류 (2026-10-10 사장님): 지정한 4명은 비회원 기자, 나머지는 유령기자(관리 화면에서 종류 바꾸기 가능)
UPDATE "User" SET "writerKind" = 'GHOST' WHERE "email" LIKE '%@legacy.invalid';
UPDATE "User" SET "writerKind" = 'NONMEMBER'
  WHERE "email" LIKE '%@legacy.invalid' AND COALESCE("nickname", "name") IN ('김성훈', '박병석', '고초록', '김만흠');
