-- CreateEnum
CREATE TYPE "PhotoSource" AS ENUM ('KOGL', 'PARTY', 'PUBLIC_DOMAIN', 'CC', 'OWN', 'AI_RECON', 'AI_GEN');

-- AlterTable
ALTER TABLE "Photo" ADD COLUMN     "credit" TEXT,
ADD COLUMN     "license" TEXT,
ADD COLUMN     "photographer" TEXT,
ADD COLUMN     "sourceType" "PhotoSource",
ADD COLUMN     "sourceUrl" TEXT,
ADD COLUMN     "takenAt" TIMESTAMP(3),
ADD COLUMN     "viaArticleUrl" TEXT;

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT,
    "affiliation" TEXT,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoUsage" (
    "id" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "firstUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PersonToPhoto" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Person_name_key" ON "Person"("name");

-- CreateIndex
CREATE INDEX "PhotoUsage_firstUsedAt_idx" ON "PhotoUsage"("firstUsedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PhotoUsage_photoId_articleId_key" ON "PhotoUsage"("photoId", "articleId");

-- CreateIndex
CREATE UNIQUE INDEX "_PersonToPhoto_AB_unique" ON "_PersonToPhoto"("A", "B");

-- CreateIndex
CREATE INDEX "_PersonToPhoto_B_index" ON "_PersonToPhoto"("B");

-- AddForeignKey
ALTER TABLE "PhotoUsage" ADD CONSTRAINT "PhotoUsage_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoUsage" ADD CONSTRAINT "PhotoUsage_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PersonToPhoto" ADD CONSTRAINT "_PersonToPhoto_A_fkey" FOREIGN KEY ("A") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PersonToPhoto" ADD CONSTRAINT "_PersonToPhoto_B_fkey" FOREIGN KEY ("B") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- 기본 상황 태그 (편집장이 더 추가 가능)
INSERT INTO "PhotoTag" ("id", "name") VALUES
  (gen_random_uuid()::text, '기자회견'),
  (gen_random_uuid()::text, '회의'),
  (gen_random_uuid()::text, '현장'),
  (gen_random_uuid()::text, '프로필')
ON CONFLICT ("name") DO NOTHING;
