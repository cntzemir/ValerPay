import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

function fakeHash(pw: string) {
  return crypto.createHash('sha256').update(pw).digest('hex');
}

async function main() {
  console.log('Seeding started...');

  //
  // --- ASSET ---
  //
  const tl = await prisma.asset.upsert({
    where: { code: 'TL' },
    update: {},
    create: {
      code: 'TL',
      type: 'FIAT',
      decimals: 2,
    },
  });

  //
  // --- ADMINS ---
  //
  const admin = await prisma.adminUser.upsert({
    where: { email: 'admin@local.test' },
    update: {},
    create: {
      email: 'admin@local.test',
      passwordHash: fakeHash('Admin123!'),
      role: 'ADMIN',
    },
  });

  await prisma.adminUser.upsert({
    where: { email: 'root@local.test' },
    update: {},
    create: {
      email: 'root@local.test',
      passwordHash: fakeHash('Root123!'),
      role: 'SUPER_ADMIN',
    },
  });

  //
  // --- USER ---
  //
  const user = await prisma.user.upsert({
    where: { email: 'gerard@local.test' },
    update: {},
    create: {
      email: 'gerard@local.test',
      passwordHash: fakeHash('User123!'),
    },
  });

  //
  // --- LEDGER ACCOUNTS ---
  //

  const existingSystemCash = await prisma.ledgerAccount.findFirst({
    where: {
      type: 'SYSTEM_CASH',
      assetId: tl.id,
      userId: null,
    },
  });

  if (!existingSystemCash) {
    await prisma.ledgerAccount.create({
      data: {
        type: 'SYSTEM_CASH',
        assetId: tl.id,
        userId: null,
      },
    });
  }

  await prisma.ledgerAccount.upsert({
    where: {
      type_assetId_userId: {
        type: 'USER_WALLET',
        assetId: tl.id,
        userId: user.id,
      },
    },
    update: {},
    create: {
      type: 'USER_WALLET',
      assetId: tl.id,
      userId: user.id,
    },
  });

  await prisma.request.deleteMany({
    where: { userId: user.id },
  });

  await prisma.request.createMany({
    data: [
      {
        type: 'DEPOSIT',
        method: 'BANK',
        assetId: tl.id,
        amountMinor: 150000n,
        status: 'NEW',
        userId: user.id,
        memo: 'Örnek banka yatırma',
      },
      {
        type: 'WITHDRAW',
        method: 'CARD',
        assetId: tl.id,
        amountMinor: 25000n,
        status: 'NEW',
        userId: user.id,
        memo: 'Örnek kart çekim',
      },
    ],
  });

  console.log('Seed finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
