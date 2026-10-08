-- AlterTable
ALTER TABLE "User" ADD COLUMN     "legacyClaimEmail" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_legacyClaimEmail_key" ON "User"("legacyClaimEmail");

