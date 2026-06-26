-- CreateTable
CREATE TABLE "Attribution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "externalId" TEXT,
    "username" TEXT,
    "startParam" TEXT,
    "userId" TEXT,
    "raw" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Attribution_source_idx" ON "Attribution"("source");
