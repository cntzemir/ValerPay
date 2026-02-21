import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
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
import { JwtAdminGuard } from '../auth/jwt-admin.guard';
import { CurrentAdmin } from '../auth/current-admin.decorator';
import type { CurrentAdminData } from '../auth/current-admin.decorator';

type RequestTab = 'all' | 'mine';

// ===================== PAYMENT CONFIG DTO =====================

type MethodFlags = Record<RequestMethod, boolean>;

type PaymentConfigDto = {
  depositsEnabled: boolean;
  withdrawsEnabled: boolean;
  depositMethods: MethodFlags;
  withdrawMethods: MethodFlags;
  bank: {
    iban: string;
    recipient: string;
    description: string | null;
  };
  crypto: {
    network: string;
    address: string;
    memo: string | null;
  };
};

type PaymentConfigUpdateDto = Partial<PaymentConfigDto>;

const DEFAULT_PAYMENT_CONFIG: PaymentConfigDto = {
  depositsEnabled: true,
  withdrawsEnabled: true,
  depositMethods: {
    BANK: true,
    CARD: true,
    CRYPTO: true,
  },
  withdrawMethods: {
    BANK: true,
    CARD: true,
    CRYPTO: true,
  },
  bank: {
    iban: 'TR00 0000 0000 0000 0000 0000 00',
    recipient: 'VALERPAY',
    description: null,
  },
  crypto: {
    network: 'TRC20',
    address: '0x0000000000000000000000000000000000000000',
    memo: null,
  },
};

@UseGuards(JwtAdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  // ===================== AUTH HELPERS =====================

  private ensureAdmin(current: CurrentAdminData | null): CurrentAdminData {
    if (!current) throw new UnauthorizedException('Admin token gerekli');
    return current;
  }

  private getAdminId(current: CurrentAdminData): string {
    const c: any = current as any;
    const id = c.adminId ?? c.adminUserId ?? c.id ?? c.userId ?? c.sub;
    if (!id) throw new UnauthorizedException('Admin id token içinde bulunamadı');
    return String(id);
  }

  // ===================== CONFIG (PAYMENTS) =====================

  private PAYMENT_CONFIG_KEY = 'PAYMENT_CONFIG';

  private deepMerge<T>(base: T, patch: Partial<T> | undefined | null): T {
    if (patch === null || patch === undefined) return base;
    if (typeof base !== 'object' || base === null) return patch as any;
    if (typeof patch !== 'object' || patch === null) return patch as any;
    if (Array.isArray(base) || Array.isArray(patch)) return patch as any;

    const out: any = { ...(base as any) };
    for (const k of Object.keys(patch as any)) {
      const pv = (patch as any)[k];
      const bv = (base as any)[k];
      out[k] = this.deepMerge(bv, pv);
    }
    return out;
  }

  private async getPaymentConfig(): Promise<PaymentConfigDto> {
    const key = this.PAYMENT_CONFIG_KEY;

    const row = await this.prisma.appConfig.findUnique({
      where: { key },
    });

    if (!row) {
      await this.prisma.appConfig.create({
        data: {
          key,
          value: DEFAULT_PAYMENT_CONFIG as any,
        },
      });
      return DEFAULT_PAYMENT_CONFIG;
    }

    const fromDb = (row.value ?? {}) as Partial<PaymentConfigDto>;
    return this.deepMerge(DEFAULT_PAYMENT_CONFIG, fromDb);
  }

  @Get('config/payments')
  async adminGetPaymentConfig(
    @CurrentAdmin() current: CurrentAdminData | null,
  ) {
    this.ensureAdmin(current);
    const cfg = await this.getPaymentConfig();
    return { ok: true, value: cfg };
  }

  @Post('config/payments')
  async adminUpdatePaymentConfig(
    @CurrentAdmin() current: CurrentAdminData | null,
    @Body() body: PaymentConfigUpdateDto,
  ) {
    this.ensureAdmin(current);

    const key = this.PAYMENT_CONFIG_KEY;
    const oldCfg = await this.getPaymentConfig();
    const nextCfg = this.deepMerge(oldCfg, body);

    await this.prisma.appConfig.upsert({
      where: { key },
      create: { key, value: nextCfg as any },
      update: { value: nextCfg as any },
    });

    return { ok: true, value: nextCfg };
  }

  private parseLimit(limit: string, def = 50, max = 200) {
    const n = Number(limit);
    if (!Number.isFinite(n) || n <= 0) return def;
    return Math.min(Math.max(Math.floor(n), 1), max);
  }

  private parseDateYYYYMMDD(s?: string, endOfDay = false): Date | null {
    if (!s) return null;
    const d = new Date(s + (endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z'));
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }

  private async getAssetOrThrow(code: string) {
    const asset = await this.prisma.asset.findFirst({ where: { code } });
    if (!asset) throw new NotFoundException(`Asset not found: ${code}`);
    return asset;
  }

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
  private async getSystemCashBalanceMinor(assetId: string): Promise<bigint> {
    const grouped = await this.prisma.ledgerLine.groupBy({
      by: ['dc'],
      where: {
        account: { type: LedgerAccountType.SYSTEM_CASH, assetId },
      },
      _sum: { amountMinor: true },
    });

    let debit = 0n;
    let credit = 0n;
    for (const r of grouped) {
      const sum = BigInt(r._sum.amountMinor ?? 0);
      if (r.dc === 'DEBIT') debit += sum;
      if (r.dc === 'CREDIT') credit += sum;
    }

    return credit - debit;
  }

  private async getOrCreateUserWalletAccount(userId: string, assetId: string) {
    let acc = await this.prisma.ledgerAccount.findUnique({
      where: {
        type_assetId_userId: {
          type: LedgerAccountType.USER_WALLET,
          assetId,
          userId,
        },
      },
    });

    if (!acc) {
      acc = await this.prisma.ledgerAccount.create({
        data: { type: LedgerAccountType.USER_WALLET, assetId, userId },
      });
    }
    return acc;
  }

  private async getOrCreateSystemCashAccount(assetId: string) {
    let acc = await this.prisma.ledgerAccount.findFirst({
      where: { type: LedgerAccountType.SYSTEM_CASH, assetId, userId: null },
    });

    if (!acc) {
      acc = await this.prisma.ledgerAccount.create({
        data: { type: LedgerAccountType.SYSTEM_CASH, assetId, userId: null },
      });
    }
    return acc;
  }
  private async postUserLedgerLines(params: {
    requestId: string;
    userId: string;
    assetId: string;
    amountMinor: bigint;
    type: RequestType;
  }) {
    const { requestId, userId, assetId, amountMinor, type } = params;
    const exists = await this.prisma.ledgerEntry.findFirst({
      where: { requestId },
    });
    if (exists) {
      throw new BadRequestException('Bu talep için ledger zaten yazılmış.');
    }

    const userWallet = await this.getOrCreateUserWalletAccount(
      userId,
      assetId,
    );
    const systemCash = await this.getOrCreateSystemCashAccount(assetId);

    const lines =
      type === RequestType.DEPOSIT
        ? [
            { accountId: userWallet.id, dc: 'DEBIT', amountMinor },
            { accountId: systemCash.id, dc: 'CREDIT', amountMinor },
          ]
        : [
            { accountId: userWallet.id, dc: 'CREDIT', amountMinor },
            { accountId: systemCash.id, dc: 'DEBIT', amountMinor },
          ];

    await this.prisma.ledgerEntry.create({
      data: {
        requestId,
        memo: `${type} ${requestId}`,
        lines: { create: lines },
      },
    });
  }

  private async writeAdminLog(params: {
    adminId: string;
    requestId?: string | null;
    action: string;
    fromStatus?: RequestStatus | null;
    toStatus?: RequestStatus | null;
    note?: string | null;
  }) {
    const { adminId, requestId, action, fromStatus, toStatus, note } = params;

    await this.prisma.adminActionLog.create({
      data: {
        adminId,
        requestId: requestId ?? null,
        action,
        fromStatus: fromStatus ?? null,
        toStatus: toStatus ?? null,
        note: note ?? null,
      },
    });
  }

  @Get('requests')
  async listRequests(
    @CurrentAdmin() current: CurrentAdminData | null,
    @Query('tab') tab: RequestTab = 'all',
    @Query('q') q?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit = '50',
  ) {
    const admin = this.ensureAdmin(current);
    const adminId = this.getAdminId(admin);

    const take = this.parseLimit(limit, 50, 100);
    const where: any = {};

    if (tab === 'all') {
      where.status = RequestStatus.NEW;
      where.assignedToId = null;
    } else {
      where.assignedToId = adminId;
      where.status = {
        in: [
          RequestStatus.ASSIGNED,
          RequestStatus.APPROVED,
          RequestStatus.SENT,
        ],
      };
    }

    if (q && q.trim()) {
      const search = q.trim();
      where.OR = [
        { id: { contains: search } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const rows = await this.prisma.request.findMany({
      where,
      include: { user: true, asset: true, assignedTo: true },
      orderBy: { createdAt: 'desc' },
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    const nextCursor = rows.length === take ? rows[rows.length - 1].id : null;

    const value = rows.map((r) => ({
      id: r.id,
      userEmail: r.user.email,
      method: r.method,
      type: r.type,
      asset: r.asset.code,
      amountMinor: r.amountMinor.toString(),
      status: r.status,
      updatedAt: r.updatedAt.toISOString(),
      assignedTo: r.assignedTo?.email ?? null,
      memo: r.memo ?? null,
    }));

    return { value, Count: value.length, nextCursor };
  }

  @Get('requests/:id')
  async getRequest(
    @CurrentAdmin() current: CurrentAdminData | null,
    @Param('id') id: string,
  ) {
    this.ensureAdmin(current);

    const r = await this.prisma.request.findUnique({
      where: { id },
      include: { user: true, asset: true, assignedTo: true },
    });
    if (!r) throw new NotFoundException('Talep bulunamadı');

    return {
      id: r.id,
      userEmail: r.user.email,
      method: r.method,
      type: r.type,
      asset: r.asset.code,
      amountMinor: r.amountMinor.toString(),
      status: r.status,
      updatedAt: r.updatedAt.toISOString(),
      assignedTo: r.assignedTo?.email ?? null,
      memo: r.memo ?? null,
      metadataJson: r.metadataJson ?? null,
    };
  }

  @Post('requests/:id/claim')
  async claim(
    @CurrentAdmin() current: CurrentAdminData | null,
    @Param('id') id: string,
  ) {
    const admin = this.ensureAdmin(current);
    const adminId = this.getAdminId(admin);

    const req = await this.prisma.request.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Talep bulunamadı');

    if (req.status !== RequestStatus.NEW) {
      if (
        req.assignedToId === adminId &&
        req.status === RequestStatus.ASSIGNED
      ) {
        return { ok: true, status: req.status };
      }
      throw new BadRequestException('Bu talep claim edilemez.');
    }

    const updated = await this.prisma.request.update({
      where: { id },
      data: { status: RequestStatus.ASSIGNED, assignedToId: adminId },
    });

    await this.writeAdminLog({
      adminId,
      requestId: id,
      action: 'CLAIM',
      fromStatus: req.status,
      toStatus: RequestStatus.ASSIGNED,
    });

    return { ok: true, status: updated.status };
  }

  @Post('requests/:id/approve')
  async approve(
    @CurrentAdmin() current: CurrentAdminData | null,
    @Param('id') id: string,
  ) {
    const admin = this.ensureAdmin(current);
    const adminId = this.getAdminId(admin);

    const req = await this.prisma.request.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Talep bulunamadı');

    if (req.status !== RequestStatus.ASSIGNED) {
      throw new BadRequestException('Sadece ASSIGNED talepler onaylanabilir.');
    }
    if (req.assignedToId !== adminId) {
      throw new BadRequestException('Bu talep size atanmış değil.');
    }

    const updated = await this.prisma.request.update({
      where: { id },
      data: { status: RequestStatus.APPROVED },
    });

    await this.writeAdminLog({
      adminId,
      requestId: id,
      action: 'APPROVE',
      fromStatus: req.status,
      toStatus: RequestStatus.APPROVED,
    });

    return { ok: true, status: updated.status };
  }

  @Post('requests/:id/reject')
  async reject(
    @CurrentAdmin() current: CurrentAdminData | null,
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    const admin = this.ensureAdmin(current);
    const adminId = this.getAdminId(admin);

    const req = await this.prisma.request.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Talep bulunamadı');

    if (req.status !== RequestStatus.ASSIGNED) {
      throw new BadRequestException('Sadece ASSIGNED talepler reddedilebilir.');
    }
    if (req.assignedToId !== adminId) {
      throw new BadRequestException('Bu talep size atanmış değil.');
    }

    const updated = await this.prisma.request.update({
      where: { id },
      data: { status: RequestStatus.REJECTED, memo: reason ?? req.memo },
    });

    await this.writeAdminLog({
      adminId,
      requestId: id,
      action: 'REJECT',
      fromStatus: req.status,
      toStatus: RequestStatus.REJECTED,
      note: reason ?? null,
    });

    return { ok: true, status: updated.status };
  }

  @Post('requests/:id/send')
  async send(
    @CurrentAdmin() current: CurrentAdminData | null,
    @Param('id') id: string,
  ) {
    const admin = this.ensureAdmin(current);
    const adminId = this.getAdminId(admin);

    const req = await this.prisma.request.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Talep bulunamadı');

    if (req.type !== RequestType.WITHDRAW) {
      throw new BadRequestException('SEND sadece WITHDRAW için.');
    }
    if (req.status !== RequestStatus.APPROVED) {
      throw new BadRequestException('WITHDRAW için önce APPROVED olmalı.');
    }
    if (req.assignedToId !== adminId) {
      throw new BadRequestException('Bu talep size atanmış değil.');
    }

    const updated = await this.prisma.request.update({
      where: { id },
      data: { status: RequestStatus.SENT },
    });

    await this.writeAdminLog({
      adminId,
      requestId: id,
      action: 'SEND',
      fromStatus: req.status,
      toStatus: RequestStatus.SENT,
    });

    return { ok: true, status: updated.status };
  }

  @Post('requests/:id/request-sms')
  async requestSms(
    @CurrentAdmin() current: CurrentAdminData | null,
    @Param('id') id: string,
  ) {
    const admin = this.ensureAdmin(current);
    const adminId = this.getAdminId(admin);

    const req = await this.prisma.request.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Talep bulunamadı');

    if (req.type !== RequestType.DEPOSIT || req.method !== RequestMethod.CARD) {
      throw new BadRequestException('SMS sadece CARD DEPOSIT için.');
    }
    if (req.status !== RequestStatus.APPROVED) {
      throw new BadRequestException(
        'CARD DEPOSIT SMS için önce APPROVED olmalı.',
      );
    }
    if (req.assignedToId !== adminId) {
      throw new BadRequestException('Bu talep size atanmış değil.');
    }

    const updated = await this.prisma.request.update({
      where: { id },
      data: { status: RequestStatus.SENT },
    });

    await this.writeAdminLog({
      adminId,
      requestId: id,
      action: 'SMS_REQUEST',
      fromStatus: req.status,
      toStatus: RequestStatus.SENT,
    });

    return { ok: true, status: updated.status };
  }

  @Post('requests/:id/complete')
  async complete(
    @CurrentAdmin() current: CurrentAdminData | null,
    @Param('id') id: string,
  ) {
    const admin = this.ensureAdmin(current);
    const adminId = this.getAdminId(admin);

    const req = await this.prisma.request.findUnique({
      where: { id },
      include: { asset: true },
    });
    if (!req) throw new NotFoundException('Talep bulunamadı');

    if (req.assignedToId !== adminId) {
      throw new BadRequestException('Bu talep size atanmış değil.');
    }

    if (req.type === RequestType.WITHDRAW) {
      if (req.status !== RequestStatus.SENT) {
        throw new BadRequestException(
          'WITHDRAW sadece SENT durumundan COMPLETED olur.',
        );
      }
    } else {
      if (req.method === RequestMethod.CARD) {
        if (req.status !== RequestStatus.SENT) {
          throw new BadRequestException(
            'CARD DEPOSIT sadece SENT (sms beklenen) durumundan COMPLETED olur.',
          );
        }
      } else {
        if (req.status !== RequestStatus.APPROVED) {
          throw new BadRequestException(
            'DEPOSIT sadece APPROVED durumundan COMPLETED olur.',
          );
        }
      }
    }

    await this.postUserLedgerLines({
      requestId: req.id,
      userId: req.userId,
      assetId: req.assetId,
      amountMinor: req.amountMinor,
      type: req.type,
    });

    const updated = await this.prisma.request.update({
      where: { id },
      data: { status: RequestStatus.COMPLETED },
    });

    await this.writeAdminLog({
      adminId,
      requestId: id,
      action: 'COMPLETE',
      fromStatus: req.status,
      toStatus: RequestStatus.COMPLETED,
    });

    return { ok: true, status: updated.status };
  }
  @Post('users/:email/requests/withdraw')
  async adminCreateWithdrawForUser(
    @CurrentAdmin() current: CurrentAdminData | null,
    @Param('email') email: string,
    @Body()
    body: {
      amountMinor: number;
      method: RequestMethod;
      memo?: string | null;
      metadata?: any;
    },
  ) {
    const admin = this.ensureAdmin(current);
    const adminId = this.getAdminId(admin);

    const cfg = await this.getPaymentConfig();
    if (!cfg.withdrawsEnabled) {
      throw new BadRequestException('Çekim işlemleri şu an kapalı.');
    }
    if (!cfg.withdrawMethods[body.method]) {
      throw new BadRequestException(`Çekim yöntemi kapalı: ${body.method}`);
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');

    const asset = await this.getAssetOrThrow('TL');

    const amountMinor = Number(body.amountMinor);
    if (!Number.isFinite(amountMinor) || amountMinor < 1000) {
      throw new BadRequestException(
        'Minimum tutar 10.00 TL (amountMinor >= 1000)',
      );
    }

    const available = await this.getAvailableBalanceMinor(user.id, asset.id);
    if (BigInt(amountMinor) > available) {
      throw new BadRequestException(
        `Yetersiz bakiye. Kullanılabilir: ${(
          Number(available) / 100
        ).toFixed(2)} TL`,
      );
    }

    const req = await this.prisma.request.create({
      data: {
        type: RequestType.WITHDRAW,
        method: body.method,
        amountMinor: BigInt(amountMinor),
        status: RequestStatus.NEW,
        memo: body.memo ?? null,
        userId: user.id,
        assetId: asset.id,
        metadataJson: body.metadata ? JSON.stringify(body.metadata) : null,
      },
    });

    await this.writeAdminLog({
      adminId,
      requestId: req.id,
      action: 'ADMIN_CREATE_WITHDRAW',
      fromStatus: null,
      toStatus: RequestStatus.NEW,
      note: `user=${email}`,
    });

    return { ok: true, id: req.id };

    
  }
  private extractToken(q: string, key: 'status' | 'action') {
    const re = new RegExp(`\\b${key}:([A-Z_]+)\\b`, 'g');
    const m = re.exec(q);
    if (!m) return { value: null as string | null, rest: q.trim() };
    const value = m[1];
    const rest = q.replace(re, '').replace(/\s+/g, ' ').trim();
    return { value, rest };
  }

  @Get('logs')
  async listLogs(
    @CurrentAdmin() current: CurrentAdminData | null,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
    @Query('my') my?: string,
    @Query('status') status?: string,
    @Query('action') action?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit = '100',
  ) {
    const admin = this.ensureAdmin(current);
    const adminId = this.getAdminId(admin);

    const take = this.parseLimit(limit, 100, 200);

    const where: any = {};

    const gte = this.parseDateYYYYMMDD(from, false);
    const lte = this.parseDateYYYYMMDD(to, true);
    if (gte || lte) {
      where.createdAt = {};
      if (gte) where.createdAt.gte = gte;
      if (lte) where.createdAt.lte = lte;
    }

    if (my === '1') where.adminId = adminId;

    let free = (q ?? '').trim();

    const stTok = this.extractToken(free, 'status');
    free = stTok.rest;
    const acTok = this.extractToken(free, 'action');
    free = acTok.rest;

    const finalStatus = (status ?? stTok.value) || null;
    const finalAction = (action ?? acTok.value) || null;

    if (finalStatus && finalStatus !== 'ALL') {
      where.toStatus = finalStatus as any;
    }

    if (finalAction && finalAction !== 'ALL') {
      where.action = finalAction;
    }

    if (free) {
      where.OR = [
        { action: { contains: free, mode: 'insensitive' } },
        { note: { contains: free, mode: 'insensitive' } },
        { requestId: { contains: free } },
        { admin: { email: { contains: free, mode: 'insensitive' } } },
        {
          request: {
            user: { email: { contains: free, mode: 'insensitive' } },
          },
        },
      ];
    }

    const rows = await this.prisma.adminActionLog.findMany({
      where,
      include: {
        admin: true,
        request: { include: { user: true, asset: true } },
      },
      orderBy: { createdAt: 'desc' },
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    const nextCursor = rows.length === take ? rows[rows.length - 1].id : null;

    const value = rows.map((l) => ({
      id: l.id,
      createdAt: l.createdAt.toISOString(),
      adminEmail: l.admin.email,
      action: l.action,
      requestId: l.requestId ?? null,
      fromStatus: l.fromStatus ?? null,
      toStatus: l.toStatus ?? null,
      note: l.note ?? null,
      userEmail: l.request?.user?.email ?? null,
      requestType: l.request?.type ?? null,
      requestMethod: l.request?.method ?? null,
      requestStatusAtLogTime: l.toStatus ?? l.fromStatus ?? null,
      requestAmountMinor: l.request?.amountMinor?.toString() ?? null,
      requestAsset: l.request?.asset?.code ?? null,
    }));

    return { value, Count: value.length, nextCursor };
  }


  @Get('ledger/entries')
  async listLedgerEntries(
    @CurrentAdmin() current: CurrentAdminData | null,
    @Query('limit') limit = '50',
  ) {
    this.ensureAdmin(current);
    const take = this.parseLimit(limit, 50, 200);

    const entries = await this.prisma.ledgerEntry.findMany({
      include: {
        request: { include: { user: true, asset: true } },
        lines: {
          include: {
            account: { include: { asset: true, user: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take,
    });

    const value = entries.map((e) => ({
      id: e.id,
      requestId: e.requestId ?? null,
      memo: e.memo ?? null,
      createdAt: e.createdAt.toISOString(),
      request: e.request
        ? {
            id: e.request.id,
            type: e.request.type,
            method: e.request.method,
            status: e.request.status,
            userEmail: e.request.user.email,
            asset: e.request.asset.code,
            amountMinor: e.request.amountMinor.toString(),
          }
        : null,
      lines: e.lines.map((l) => ({
        dc: l.dc,
        amountMinor: l.amountMinor.toString(),
        accountType: l.account.type,
        asset: l.account.asset.code,
        userEmail: l.account.user?.email ?? null,
      })),
    }));

    return { value, Count: value.length };
  }
  @Get('reports/daily')
  async dailyReport(@CurrentAdmin() current: CurrentAdminData | null) {
    this.ensureAdmin(current);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const assetTL = await this.prisma.asset.findFirst({
      where: { code: 'TL' },
    });

    let totalDepositsMinor = 0n;
    let totalWithdrawsMinor = 0n;
    let systemCashMinor = 0n;

    if (assetTL) {
      const depAgg = await this.prisma.request.aggregate({
        where: {
          type: RequestType.DEPOSIT,
          status: RequestStatus.COMPLETED,
          createdAt: { gte: today, lt: tomorrow },
          assetId: assetTL.id,
        },
        _sum: { amountMinor: true },
      });

      const wdAgg = await this.prisma.request.aggregate({
        where: {
          type: RequestType.WITHDRAW,
          status: RequestStatus.COMPLETED,
          createdAt: { gte: today, lt: tomorrow },
          assetId: assetTL.id,
        },
        _sum: { amountMinor: true },
      });

      totalDepositsMinor = BigInt(depAgg._sum.amountMinor ?? 0);
      totalWithdrawsMinor = BigInt(wdAgg._sum.amountMinor ?? 0);

      systemCashMinor = await this.getSystemCashBalanceMinor(assetTL.id);
    }

    const pendingCount = await this.prisma.request.count({
      where: {
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

    const completedCount = await this.prisma.request.count({
      where: { status: RequestStatus.COMPLETED },
    });

    return {
      generatedAt: new Date().toISOString(),
      totalDepositsMinor: totalDepositsMinor.toString(),
      totalWithdrawsMinor: totalWithdrawsMinor.toString(),
      pendingCount,
      completedCount,
      systemCashMinor: systemCashMinor.toString(),
    };
  }
}


  