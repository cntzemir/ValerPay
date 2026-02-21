// apps/api/src/ledger/ledger.service.ts
import { Injectable } from '@nestjs/common';
import { LedgerAccountType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserWalletBalance(userId: string, assetId: string): Promise<bigint> {
    const rows = await this.prisma.ledgerLine.groupBy({
      by: ['dc'],
      where: {
        account: {
          type: LedgerAccountType.USER_WALLET,
          assetId,
          userId,
        },
      },
      _sum: { amountMinor: true },
    });

    let debit = 0n;
    let credit = 0n;

    for (const r of rows) {
      const sum = BigInt(r._sum?.amountMinor ?? 0);
      if (r.dc === 'DEBIT') debit += sum;
      else if (r.dc === 'CREDIT') credit += sum;
    }

    return debit - credit;
  }
}
