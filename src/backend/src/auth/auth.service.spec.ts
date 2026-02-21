import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import crypto from 'crypto';
import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getHello(): string {
    return 'Hello World!';
  }
}
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService (unit)', () => {
  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    adminUser: {
      findUnique: jest.fn(),
    },
  } as unknown as PrismaService;

  const jwtMock = {
    signAsync: jest.fn(),
  } as unknown as JwtService;

  let service: AuthService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new AuthService(prismaMock, jwtMock);
  });

  describe('registerUser', () => {
    it('rejects missing email/password', async () => {
      await expect(
        service.registerUser({ email: '', password: '' } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects invalid email', async () => {
      await expect(
        service.registerUser({ email: 'invalid', password: 'x' } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects existing user', async () => {
      (prismaMock.user.findUnique as any).mockResolvedValue({ id: 'u1' });

      await expect(
        service.registerUser({ email: 'a@b.com', password: 'x' } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates user and returns token', async () => {
      (prismaMock.user.findUnique as any).mockResolvedValue(null);
      (prismaMock.user.create as any).mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
      });
      (jwtMock.signAsync as any).mockResolvedValue('token');

      const out = await service.registerUser({
        email: 'A@B.COM',
        password: 'pw',
      } as any);

      expect(out.accessToken).toBe('token');
      expect(out.user.email).toBe('a@b.com');
      expect(prismaMock.user.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('loginUser', () => {
    it('rejects missing credentials', async () => {
      await expect(
        service.loginUser({ email: '', password: '' } as any),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects unknown user', async () => {
      (prismaMock.user.findUnique as any).mockResolvedValue(null);

      await expect(
        service.loginUser({ email: 'a@b.com', password: 'pw' } as any),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects wrong password', async () => {
      (prismaMock.user.findUnique as any).mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        passwordHash: 'not',
      });

      await expect(
        service.loginUser({ email: 'a@b.com', password: 'pw' } as any),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('returns token on correct password', async () => {
      const hash = crypto.createHash('sha256').update('pw').digest('hex');

      (prismaMock.user.findUnique as any).mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        passwordHash: hash,
      });
      (jwtMock.signAsync as any).mockResolvedValue('token');

      const out = await service.loginUser({
        email: 'a@b.com',
        password: 'pw',
      } as any);

      expect(out.accessToken).toBe('token');
      expect(out.user.id).toBe('u1');
    });
  });

  describe('loginAdmin', () => {
    it('rejects unknown admin', async () => {
      (prismaMock.adminUser.findUnique as any).mockResolvedValue(null);

      await expect(
        service.loginAdmin({ email: 'a@b.com', password: 'pw' } as any),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
