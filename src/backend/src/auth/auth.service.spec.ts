import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
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

  it('registerUser should reject missing email/password', async () => {
    await expect(service.registerUser({ email: '', password: '' } as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('registerUser should reject invalid email', async () => {
    await expect(service.registerUser({ email: 'invalid', password: 'x' } as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('registerUser should reject existing user', async () => {
    (prismaMock.user.findUnique as any).mockResolvedValue({ id: 'u1' });
    await expect(service.registerUser({ email: 'a@b.com', password: 'x' } as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('registerUser should create user and return token', async () => {
    (prismaMock.user.findUnique as any).mockResolvedValue(null);
    (prismaMock.user.create as any).mockResolvedValue({ id: 'u1', email: 'a@b.com' });
    (jwtMock.signAsync as any).mockResolvedValue('token');

    const out = await service.registerUser({ email: 'A@B.COM', password: 'pw' } as any);

    expect(out.accessToken).toBe('token');
    expect(out.user.email).toBe('a@b.com');
    expect(prismaMock.user.create).toHaveBeenCalled();
  });

  it('loginUser should reject missing credentials', async () => {
    await expect(service.loginUser({ email: '', password: '' } as any)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('loginUser should reject unknown user', async () => {
    (prismaMock.user.findUnique as any).mockResolvedValue(null);
    await expect(service.loginUser({ email: 'a@b.com', password: 'pw' } as any)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('loginUser should reject wrong password', async () => {
    (prismaMock.user.findUnique as any).mockResolvedValue({ id: 'u1', email: 'a@b.com', passwordHash: 'not' });
    await expect(service.loginUser({ email: 'a@b.com', password: 'pw' } as any)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('loginUser should return token on correct password', async () => {
    const crypto = await import('crypto');
    const hash = crypto.createHash('sha256').update('pw').digest('hex');

    (prismaMock.user.findUnique as any).mockResolvedValue({ id: 'u1', email: 'a@b.com', passwordHash: hash });
    (jwtMock.signAsync as any).mockResolvedValue('token');

    const out = await service.loginUser({ email: 'a@b.com', password: 'pw' } as any);
    expect(out.accessToken).toBe('token');
    expect(out.user.id).toBe('u1');
  });

  it('loginAdmin should reject unknown admin', async () => {
    (prismaMock.adminUser.findUnique as any).mockResolvedValue(null);
    await expect(service.loginAdmin({ email: 'a@b.com', password: 'pw' } as any)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
