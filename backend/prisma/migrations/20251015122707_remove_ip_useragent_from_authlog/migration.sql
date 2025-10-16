/*
  Warnings:

  - You are about to drop the column `ipAddress` on the `AuthLog` table. All the data in the column will be lost.
  - You are about to drop the column `userAgent` on the `AuthLog` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "AuthLog" DROP COLUMN "ipAddress",
DROP COLUMN "userAgent";
