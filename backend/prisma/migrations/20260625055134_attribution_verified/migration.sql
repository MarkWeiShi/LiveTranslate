-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Attribution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "externalId" TEXT,
    "username" TEXT,
    "startParam" TEXT,
    "userId" TEXT,
    "raw" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Attribution" ("createdAt", "externalId", "id", "raw", "source", "startParam", "userId", "username") SELECT "createdAt", "externalId", "id", "raw", "source", "startParam", "userId", "username" FROM "Attribution";
DROP TABLE "Attribution";
ALTER TABLE "new_Attribution" RENAME TO "Attribution";
CREATE INDEX "Attribution_source_idx" ON "Attribution"("source");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
