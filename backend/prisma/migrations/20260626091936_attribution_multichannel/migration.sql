/*
  Warnings:

  - Added the required column `channel` to the `Attribution` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "FunnelEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channel" TEXT NOT NULL,
    "ref" TEXT,
    "stage" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Attribution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT,
    "channel" TEXT NOT NULL,
    "externalId" TEXT,
    "username" TEXT,
    "startParam" TEXT,
    "ref" TEXT,
    "campaign" TEXT,
    "medium" TEXT,
    "userId" TEXT,
    "raw" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Attribution" ("createdAt", "externalId", "id", "raw", "source", "startParam", "userId", "username", "verified") SELECT "createdAt", "externalId", "id", "raw", "source", "startParam", "userId", "username", "verified" FROM "Attribution";
DROP TABLE "Attribution";
ALTER TABLE "new_Attribution" RENAME TO "Attribution";
CREATE INDEX "Attribution_channel_idx" ON "Attribution"("channel");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "FunnelEvent_channel_stage_idx" ON "FunnelEvent"("channel", "stage");
