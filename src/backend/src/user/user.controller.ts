import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  LedgerAccountType,
  RequestMethod,
  RequestStatus,
  RequestType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUserGuard } from '../auth/jwt-user.guard';
import { CurrentUser, CurrentUserData } from '../auth/current-user.decorator';

type RequestStatusFilter =
  | 'ALL'
  | 'NEW'
  | 'ASSIGNED'
  | 'APPROVED'
  | 'SENT'
  | 'COMPLETED'
  | 'REJECTED';

type PaymentConfig = {
  depositsEnabled: boolean;
  withdrawsEnabled: boolean;
  depositMethods: { BANK: boolean; CARD: boolean; CRYPTO: boolean };
  withdrawMethods: { BANK: boolean; CARD: boolean; CRYPTO: boolean };
  bank: {
    iban: string;
    recipient: string;
    description: string;
  };
  crypto: {
    network: string;
    address: string;
    memo: string;
  };
};

const DEFAULT_PAYMENT_CONFIG: PaymentConfig = {
  depositsEnabled: true,
  withdrawsEnabled: true,
  depositMethods: { BANK: true, CARD: true, CRYPTO: true },
  withdrawMethods: { BANK: true, CARD: true, CRYPTO: true },
  bank: {
    iban: 'TR00 0000 0000 0000 0000 0000 00',
    recipient: 'VALERPAY',
    description: '',
  },
  crypto: {
    network: 'TRC20',
    address: '',
    memo: '',
  },
};

type DepositBody = {
  method: RequestMethod;
  amountMinor: number;
  memo?: string | null;
  metadata?: any;
};

type WithdrawBody = {
  method: RequestMethod;
  amountMinor: number;
  memo?: string | null;
  metadata?: any;
};

@UseGuards(JwtUserGuard)
@Controller('user')
export class UserController {
  constructor(private readonly prisma: PrismaService) {}

  // =============== AUTH / USER HELPERS ===============

  private ensureUser(current: CurrentUserData | null) {
    if (!current) throw new UnauthorizedException('USER token gerekli');

    const c: any = current as any;
    const userId = c.userId ?? c.sub ?? c.id;
    const email = c.email;

    if (!userId || !email) {
      throw new UnauthorizedException('USER token gerekli');
    }

    return { userId: String(userId), email: String(email) };
  }

  private ensureMinAmount(amountMinor: number) {
    if (!Number.isFinite(amountMinor) || amountMinor < 1000) {
      throw new BadRequestException(
        'Minimum tutar 10.00 TL (amountMinor >= 1000)',
      );
    }
  }

  private async getAssetOrThrow(code: string) {
    const asset = await this.prisma.asset.findFirst({ where: { code } });
    if (!asset) throw new NotFoundException(`Asset not found: ${code}`);
    return asset;
  }

  // =============== PAYMENT CONFIG (appConfig JSON) ===============

  private async getPaymentConfig(): Promise<PaymentConfig> {
    const key = 'PAYMENT_CONFIG';

    const row = await this.prisma.appConfig.findUnique({ where: { key } });
    if (!row) {
      await this.prisma.appConfig.create({
        data: { key, value: DEFAULT_PAYMENT_CONFIG as any },
      });
      return DEFAULT_PAYMENT_CONFIG;
    }
    return row.value as any as PaymentConfig;
  }

  // =============== WALLET BALANCE HELPERLARI ===============

  private async getUserWalletBalanceMinor(
    userId: string,
    assetId: string,
  ): Promise<bigint> {
    const account = await this.prisma.ledgerAccount.findFirst({
      where: { type: LedgerAccountType.USER_WALLET, userId, assetId },
    });
    if (!account) return 0n;

    const grouped = await this.prisma.ledgerLine.groupBy({
      by: ['dc'],
      where: { accountId: account.id },
      _sum: { amountMinor: true },
    });

    let debit = 0n;
    let credit = 0n;

    for (const r of grouped) {
      const sum = BigInt(r._sum.amountMinor ?? 0);
      if (r.dc === 'DEBIT') debit += sum;
      if (r.dc === 'CREDIT') credit += sum;
    }

    return debit - credit;
  }

  private async getReservedWithdrawMinor(
    userId: string,
    assetId: string,
  ): Promise<bigint> {
    const agg = await this.prisma.request.aggregate({
      _sum: { amountMinor: true },
      where: {
        userId,
        assetId,
        type: RequestType.WITHDRAW,
        status: {
          in: [
            RequestStatus.NEW,
            RequestStatus.ASSIGNED,
            RequestStatus.APPROVED,
            RequestStatus.SENT,
          ],
        },
      },
    });

    return BigInt(agg._sum.amountMinor ?? 0);
  }

  private async getAvailableBalanceMinor(
    userId: string,
    assetId: string,
  ): Promise<bigint> {
    const balance = await this.getUserWalletBalanceMinor(userId, assetId);
    const reserved = await this.getReservedWithdrawMinor(userId, assetId);
    const available = balance - reserved;
    return available < 0n ? 0n : available;
  }

  @Get('me')
  async me(@CurrentUser() current: CurrentUserData | null) {
    const c = this.ensureUser(current);

    const user = await this.prisma.user.findUnique({
      where: { id: c.userId },
    });
    if (!user) throw new NotFoundException('User not found');

    return { id: user.id, email: user.email, createdAt: user.createdAt };
  }

  @Get('config/payments')
  async userGetPaymentConfig(@CurrentUser() current: CurrentUserData | null) {
    this.ensureUser(current);
    const cfg = await this.getPaymentConfig();
    return { ok: true, value: cfg };
  }

  @Get('balance')
  async balance(
    @CurrentUser() current: CurrentUserData | null,
    @Query('asset') assetCode = 'TL',
  ) {
    const c = this.ensureUser(current);
    const asset = await this.getAssetOrThrow(assetCode);

    const balanceMinor = await this.getUserWalletBalanceMinor(
      c.userId,
      asset.id,
    );

    return {
      email: c.email,
      asset: asset.code,
      balanceMinor: balanceMinor.toString(),
    };
  }

  @Get('requests')
  async listRequests(
    @CurrentUser() current: CurrentUserData | null,
    @Query('status') status: RequestStatusFilter = 'ALL',
  ) {
    const c = this.ensureUser(current);

    const whereStatus = status === 'ALL' ? {} : { status: status as any };

    const rows = await this.prisma.request.findMany({
      where: { userId: c.userId, ...whereStatus },
      include: { asset: { select: { code: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      method: r.method,
      asset: r.asset.code,
      amountMinor: r.amountMinor.toString(),
      status: r.status,
      createdAt: r.createdAt,
      memo: r.memo ?? null,
    }));
  }

  @Post('requests/deposit')
  async createDeposit(
    @CurrentUser() current: CurrentUserData | null,
    @Body() body: DepositBody,
  ) {
    const c = this.ensureUser(current);
    const asset = await this.getAssetOrThrow('TL');

    const cfg = await this.getPaymentConfig();
    if (!cfg.depositsEnabled) {
      throw new BadRequestException('Yatırım işlemleri şu an kapalı.');
    }

    if (!cfg.depositMethods[body.method]) {
      throw new BadRequestException(
        `Seçilen yatırım yöntemi şu anda kullanılamıyor: ${body.method}`,
      );
    }

    const amountMinor = Number(body.amountMinor);
    this.ensureMinAmount(amountMinor);

    const req = await this.prisma.request.create({
      data: {
        type: RequestType.DEPOSIT,
        method: body.method,
        amountMinor: BigInt(amountMinor),
        status: RequestStatus.NEW,
        memo: body.memo ?? null,
        userId: c.userId,
        assetId: asset.id,
        metadataJson: body.metadata ? JSON.stringify(body.metadata) : null,
      },
    });

    return { ok: true, id: req.id };
  }

  @Post('requests/withdraw')
  async createWithdraw(
    @CurrentUser() current: CurrentUserData | null,
    @Body() body: WithdrawBody,
  ) {
    const c = this.ensureUser(current);
    const asset = await this.getAssetOrThrow('TL');

    const cfg = await this.getPaymentConfig();
    if (!cfg.withdrawsEnabled) {
      throw new BadRequestException('Çekim işlemleri şu an kapalı.');
    }

    if (!cfg.withdrawMethods[body.method]) {
      throw new BadRequestException(
        `Seçilen çekim yöntemi şu anda kullanılamıyor: ${body.method}`,
      );
    }

    const amountMinor = Number(body.amountMinor);
    this.ensureMinAmount(amountMinor);

    const available = await this.getAvailableBalanceMinor(c.userId, asset.id);
    if (BigInt(amountMinor) > available) {
      throw new BadRequestException(
        `Yetersiz bakiye. Kullanılabilir: ${(Number(available) / 100).toFixed(
          2,
        )} TL`,
      );
    }

    const req = await this.prisma.request.create({
      data: {
        type: RequestType.WITHDRAW,
        method: body.method,
        amountMinor: BigInt(amountMinor),
        status: RequestStatus.NEW,
        memo: body.memo ?? null,
        userId: c.userId,
        assetId: asset.id,
        metadataJson: body.metadata ? JSON.stringify(body.metadata) : null,
      },
    });

    return { ok: true, id: req.id };
  }
}
