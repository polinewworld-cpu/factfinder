-- CreateEnum
CREATE TYPE "InboxStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "lastCollectedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Photo" ADD COLUMN     "hash" TEXT;

-- AlterTable
ALTER TABLE "SiteConfig" ADD COLUMN     "photoCollectAt" TIMESTAMP(3),
ADD COLUMN     "photoCollectMinutes" INTEGER NOT NULL DEFAULT 60;

-- CreateTable
CREATE TABLE "PhotoInbox" (
    "id" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "thumbUrl" TEXT NOT NULL,
    "pageUrl" TEXT,
    "viaArticleUrl" TEXT,
    "title" TEXT,
    "caption" TEXT,
    "provider" TEXT,
    "sourceType" "PhotoSource" NOT NULL,
    "license" TEXT,
    "credit" TEXT,
    "takenAt" TIMESTAMP(3),
    "peopleIds" TEXT,
    "hash" TEXT,
    "status" "InboxStatus" NOT NULL DEFAULT 'PENDING',
    "photoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "PhotoInbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PhotoInbox_imageUrl_key" ON "PhotoInbox"("imageUrl");

-- CreateIndex
CREATE UNIQUE INDEX "PhotoInbox_hash_key" ON "PhotoInbox"("hash");

-- CreateIndex
CREATE INDEX "PhotoInbox_status_createdAt_idx" ON "PhotoInbox"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Photo_hash_key" ON "Photo"("hash");

