import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

// Sadece tip olarak kullanıyoruz (decorator içinde değil) => sorun yok
import type { LoginDto, RegisterDto } from './auth.controller';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}


  private hashPassword(plain: string): string {
    return crypto.createHash('sha256').update(plain).digest('hex');
  }

  private async signToken(payload: any): Promise<string> {
    return this.jwt.signAsync(payload);
  }


  async registerUser(body: RegisterDto) {
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? '';

    if (!email || !password) {
      throw new BadRequestException('Email ve şifre zorunlu.');
    }

    if (!email.includes('@')) {
      throw new BadRequestException('Geçersiz email.');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      throw new BadRequestException('Bu email ile kullanıcı zaten var.');
    }

    const passwordHash = this.hashPassword(password);

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
      },
    });

    const payload = {
      sub: user.id,
      email: user.email,
      role: 'USER' as const,
    };

    const accessToken = await this.signToken(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
      },
    };
  }


  async loginUser(body: LoginDto) {
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? '';

    if (!email || !password) {
      throw new UnauthorizedException('Geçersiz email veya şifre.');
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Geçersiz email veya şifre.');
    }

    const hash = this.hashPassword(password);
    if (hash !== user.passwordHash) {
      throw new UnauthorizedException('Geçersiz email veya şifre.');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: 'USER' as const,
    };

    const accessToken = await this.signToken(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
      },
    };
  }


  async loginAdmin(body: LoginDto) {
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? '';

    if (!email || !password) {
      throw new UnauthorizedException('Geçersiz email veya şifre.');
    }

    const admin = await this.prisma.adminUser.findUnique({
      where: { email },
    });

    if (!admin) {
      throw new UnauthorizedException('Geçersiz email veya şifre.');
    }

    const hash = this.hashPassword(password);
    if (hash !== admin.passwordHash) {
      throw new UnauthorizedException('Geçersiz email veya şifre.');
    }

    const payload = {
      sub: admin.id,
      email: admin.email,
      role: admin.role, 
    };

    const accessToken = await this.signToken(payload);

    return {
      accessToken,
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
      },
    };
  }
}
