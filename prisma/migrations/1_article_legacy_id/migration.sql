-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "legacyId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Article_legacyId_key" ON "Article"("legacyId");

