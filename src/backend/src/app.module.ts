import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { AdminController } from './admin/admin.controller';
import { AuthController } from './auth/auth.controller';
import { UserController } from './user/user.controller';

import { AuthService } from './auth/auth.service';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { JwtStrategy } from './auth/jwt.strategy';

import { RequestContextMiddleware } from './common/request-context.middleware';
import { LedgerService } from './ledger/ledger.service';
import { PrismaService } from './prisma/prisma.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [AppController, AdminController, UserController, AuthController],
  providers: [
    AppService,
    LedgerService,
    PrismaService,
    AuthService,
    JwtStrategy,
    JwtAuthGuard,
  ],
  exports: [LedgerService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}