/*
  Warnings:

  - You are about to drop the `LedgerTransaction` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `ledgerTransactionId` on the `LedgerEntry` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "LedgerTransaction_requestId_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "LedgerTransaction";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LedgerEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT,
    "memo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accountId" TEXT,
    CONSTRAINT "LedgerEntry_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LedgerEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_LedgerEntry" ("accountId", "createdAt", "id", "memo", "requestId") SELECT "accountId", "createdAt", "id", "memo", "requestId" FROM "LedgerEntry";
DROP TABLE "LedgerEntry";
ALTER TABLE "new_LedgerEntry" RENAME TO "LedgerEntry";
CREATE UNIQUE INDEX "LedgerEntry_requestId_key" ON "LedgerEntry"("requestId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
