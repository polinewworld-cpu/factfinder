-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accountHolder" TEXT,
ADD COLUMN     "bankAccount" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "writerTitle" TEXT;

-- CreateTable
CREATE TABLE "WriterIdImage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "blobName" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WriterIdImage_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "WriterIdImage" ADD CONSTRAINT "WriterIdImage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

