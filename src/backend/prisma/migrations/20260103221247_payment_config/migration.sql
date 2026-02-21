-- CreateTable
CREATE TABLE "PaymentConfig" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
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
    "cryptoMemo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
