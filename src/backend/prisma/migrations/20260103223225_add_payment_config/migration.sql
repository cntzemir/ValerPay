-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PaymentConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "depositsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "withdrawsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "bankDepositEnabled" BOOLEAN NOT NULL DEFAULT true,
    "cardDepositEnabled" BOOLEAN NOT NULL DEFAULT true,
    "cryptoDepositEnabled" BOOLEAN NOT NULL DEFAULT true,
    "bankWithdrawEnabled" BOOLEAN NOT NULL DEFAULT true,
    "cardWithdrawEnabled" BOOLEAN NOT NULL DEFAULT true,
    "cryptoWithdrawEnabled" BOOLEAN NOT NULL DEFAULT true,
    "bankIban" TEXT,
    "bankRecipient" TEXT,
    "bankDescription" TEXT,
    "cryptoNetwork" TEXT,
    "cryptoAddress" TEXT,
    "cryptoMemo" TEXT
);
INSERT INTO "new_PaymentConfig" ("bankDepositEnabled", "bankDescription", "bankIban", "bankRecipient", "bankWithdrawEnabled", "cardDepositEnabled", "cardWithdrawEnabled", "createdAt", "cryptoAddress", "cryptoDepositEnabled", "cryptoMemo", "cryptoNetwork", "cryptoWithdrawEnabled", "depositsEnabled", "id", "updatedAt", "withdrawsEnabled") SELECT "bankDepositEnabled", "bankDescription", "bankIban", "bankRecipient", "bankWithdrawEnabled", "cardDepositEnabled", "cardWithdrawEnabled", "createdAt", "cryptoAddress", "cryptoDepositEnabled", "cryptoMemo", "cryptoNetwork", "cryptoWithdrawEnabled", "depositsEnabled", "id", "updatedAt", "withdrawsEnabled" FROM "PaymentConfig";
DROP TABLE "PaymentConfig";
ALTER TABLE "new_PaymentConfig" RENAME TO "PaymentConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
