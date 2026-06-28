-- CreateTable
CREATE TABLE "Withdrawal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Wallet" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "diamonds" INTEGER NOT NULL DEFAULT 0,
    "earnings" INTEGER NOT NULL DEFAULT 0,
    "trialSecondsLeft" INTEGER NOT NULL DEFAULT 420,
    "subscriptionTier" TEXT NOT NULL DEFAULT 'NONE',
    "subscriptionExpiry" DATETIME,
    CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Wallet" ("diamonds", "subscriptionExpiry", "subscriptionTier", "trialSecondsLeft", "userId") SELECT "diamonds", "subscriptionExpiry", "subscriptionTier", "trialSecondsLeft", "userId" FROM "Wallet";
DROP TABLE "Wallet";
ALTER TABLE "new_Wallet" RENAME TO "Wallet";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Withdrawal_userId_idx" ON "Withdrawal"("userId");
