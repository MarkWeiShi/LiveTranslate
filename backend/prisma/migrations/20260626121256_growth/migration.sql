-- CreateTable
CREATE TABLE "GrowthProfile" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Bond" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userLo" TEXT NOT NULL,
    "userHi" TEXT NOT NULL,
    "intimacy" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Family" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "FamilyMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "familyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contribution" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE UNIQUE INDEX "Bond_userLo_userHi_key" ON "Bond"("userLo", "userHi");

-- CreateIndex
CREATE INDEX "FamilyMember_userId_idx" ON "FamilyMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyMember_familyId_userId_key" ON "FamilyMember"("familyId", "userId");
