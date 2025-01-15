/*
  Warnings:

  - You are about to drop the column `key` on the `SessionAnalytics` table. All the data in the column will be lost.
  - You are about to drop the column `recordedAt` on the `SessionAnalytics` table. All the data in the column will be lost.
  - You are about to drop the column `value` on the `SessionAnalytics` table. All the data in the column will be lost.
  - You are about to drop the column `roleId` on the `SessionParticipant` table. All the data in the column will be lost.
  - You are about to drop the column `passwordHash` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `ChatMessage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FileTransfer` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Permission` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Role` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "RoleType" AS ENUM ('HOST', 'CONTROLLER');

-- DropForeignKey
ALTER TABLE "ChatMessage" DROP CONSTRAINT "ChatMessage_senderId_fkey";

-- DropForeignKey
ALTER TABLE "ChatMessage" DROP CONSTRAINT "ChatMessage_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "FileTransfer" DROP CONSTRAINT "FileTransfer_receiverId_fkey";

-- DropForeignKey
ALTER TABLE "FileTransfer" DROP CONSTRAINT "FileTransfer_senderId_fkey";

-- DropForeignKey
ALTER TABLE "FileTransfer" DROP CONSTRAINT "FileTransfer_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "Permission" DROP CONSTRAINT "Permission_roleId_fkey";

-- DropForeignKey
ALTER TABLE "SessionParticipant" DROP CONSTRAINT "SessionParticipant_roleId_fkey";

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "expiresAt" DROP NOT NULL,
ALTER COLUMN "expiresAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SessionAnalytics" DROP COLUMN "key",
DROP COLUMN "recordedAt",
DROP COLUMN "value",
ADD COLUMN     "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "duration" INTEGER,
ADD COLUMN     "totalErrors" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalJoins" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalMessages" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SessionParticipant" DROP COLUMN "roleId",
ADD COLUMN     "role" "RoleType" NOT NULL DEFAULT 'CONTROLLER';

-- AlterTable
ALTER TABLE "User" DROP COLUMN "passwordHash";

-- DropTable
DROP TABLE "ChatMessage";

-- DropTable
DROP TABLE "FileTransfer";

-- DropTable
DROP TABLE "Permission";

-- DropTable
DROP TABLE "Role";

-- CreateTable
CREATE TABLE "ErrorLog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sessionId" UUID,
    "userId" UUID,
    "errorCode" VARCHAR(100) NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "occurredAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAnalytics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "totalSessions" INTEGER NOT NULL DEFAULT 0,
    "totalConnections" INTEGER NOT NULL DEFAULT 0,
    "lastActive" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAnalytics_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ErrorLog" ADD CONSTRAINT "ErrorLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErrorLog" ADD CONSTRAINT "ErrorLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAnalytics" ADD CONSTRAINT "UserAnalytics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
