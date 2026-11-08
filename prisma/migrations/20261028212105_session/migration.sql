/*
  Warnings:

  - You are about to drop the column `endsAt` on the `Session` table. All the data in the column will be lost.
  - You are about to drop the column `location` on the `Session` table. All the data in the column will be lost.
  - You are about to drop the column `meetingUrl` on the `Session` table. All the data in the column will be lost.
  - You are about to drop the column `programId` on the `Session` table. All the data in the column will be lost.
  - You are about to drop the column `startsAt` on the `Session` table. All the data in the column will be lost.
  - Added the required column `expiresAt` to the `Session` table without a default value. This is not possible if the table is not empty.
  - Added the required column `refreshTokenHash` to the `Session` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Session` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_programId_fkey";

-- DropIndex
DROP INDEX "Session_programId_startsAt_idx";

-- AlterTable
ALTER TABLE "Session" DROP COLUMN "endsAt",
DROP COLUMN "location",
DROP COLUMN "meetingUrl",
DROP COLUMN "programId",
DROP COLUMN "startsAt",
ADD COLUMN     "expiresAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "refreshTokenHash" TEXT NOT NULL,
ADD COLUMN     "revokedAt" TIMESTAMP(3),
ADD COLUMN     "userAgent" TEXT,
ADD COLUMN     "userId" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "Details_Session" (
    "id" SERIAL NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "meetingUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "programId" INTEGER NOT NULL,

    CONSTRAINT "Details_Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Details_Session_programId_startsAt_idx" ON "Details_Session"("programId", "startsAt");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Details_Session" ADD CONSTRAINT "Details_Session_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;
