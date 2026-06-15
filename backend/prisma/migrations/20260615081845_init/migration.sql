-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "helloTalkUserId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "nativeLanguage" TEXT NOT NULL,
    "learningLanguages" TEXT NOT NULL DEFAULT '[]',
    "languageLevel" TEXT,
    "gender" TEXT NOT NULL,
    "region" TEXT,
    "timezone" TEXT,
    "bio" TEXT,
    "interests" TEXT NOT NULL DEFAULT '[]',
    "realPersonVerified" BOOLEAN NOT NULL DEFAULT false,
    "trustScore" INTEGER NOT NULL DEFAULT 50,
    "intent" TEXT NOT NULL DEFAULT 'SOCIAL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Wallet" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "diamonds" INTEGER NOT NULL DEFAULT 0,
    "trialSecondsLeft" INTEGER NOT NULL DEFAULT 420,
    "subscriptionTier" TEXT NOT NULL DEFAULT 'NONE',
    "subscriptionExpiry" DATETIME,
    CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CallSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "callerId" TEXT NOT NULL,
    "calleeId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "translationOn" BOOLEAN NOT NULL DEFAULT true,
    "startedAt" DATETIME,
    "endedAt" DATETIME,
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "translatedSec" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Gift" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "callId" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "giftType" TEXT NOT NULL,
    "diamonds" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Friendship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userIdA" TEXT NOT NULL,
    "userIdB" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACCEPTED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Block" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "blockedUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reporterId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "callId" TEXT,
    "reason" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RiskEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "callId" TEXT,
    "type" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "snippet" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_helloTalkUserId_key" ON "User"("helloTalkUserId");

-- CreateIndex
CREATE INDEX "CallSession_callerId_idx" ON "CallSession"("callerId");

-- CreateIndex
CREATE INDEX "CallSession_calleeId_idx" ON "CallSession"("calleeId");

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_userIdA_userIdB_key" ON "Friendship"("userIdA", "userIdB");

-- CreateIndex
CREATE UNIQUE INDEX "Block_userId_blockedUserId_key" ON "Block"("userId", "blockedUserId");
