import { LedgerService } from './ledger.service';
import { PrismaService } from '../prisma/prisma.service';

describe('LedgerService (unit)', () => {
  const prismaMock = {
    ledgerLine: {
      groupBy: jest.fn(),
    },
  } as unknown as PrismaService;

  let service: LedgerService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new LedgerService(prismaMock);
  });

  it('should compute DEBIT - CREDIT correctly', async () => {
    (prismaMock.ledgerLine.groupBy as any).mockResolvedValue([
      { dc: 'DEBIT', _sum: { amountMinor: 300 } },
      { dc: 'CREDIT', _sum: { amountMinor: 120 } },
    ]);

    const bal = await service.getUserWalletBalance('u1', 'asset1');
    expect(bal).toBe(180n);
  });

  it('should handle empty result', async () => {
    (prismaMock.ledgerLine.groupBy as any).mockResolvedValue([]);
    const bal = await service.getUserWalletBalance('u1', 'asset1');
    expect(bal).toBe(0n);
  });

  it('should treat missing sums as zero', async () => {
    (prismaMock.ledgerLine.groupBy as any).mockResolvedValue([{ dc: 'DEBIT', _sum: { amountMinor: null } }]);
    const bal = await service.getUserWalletBalance('u1', 'asset1');
    expect(bal).toBe(0n);
  });
});
