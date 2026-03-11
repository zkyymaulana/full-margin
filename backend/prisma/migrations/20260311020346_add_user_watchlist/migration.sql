-- CreateTable
CREATE TABLE "UserWatchlist" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "coinId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserWatchlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserWatchlist_userId_idx" ON "UserWatchlist"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserWatchlist_userId_coinId_key" ON "UserWatchlist"("userId", "coinId");

-- AddForeignKey
ALTER TABLE "UserWatchlist" ADD CONSTRAINT "UserWatchlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWatchlist" ADD CONSTRAINT "UserWatchlist_coinId_fkey" FOREIGN KEY ("coinId") REFERENCES "Coin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
