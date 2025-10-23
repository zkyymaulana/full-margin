/*
  Warnings:

  - You are about to drop the `Signal` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Signal" DROP CONSTRAINT "Signal_userId_fkey";

-- DropTable
DROP TABLE "public"."Signal";
