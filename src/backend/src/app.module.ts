import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";

import { AdminController } from "./admin/admin.controller";
import { UserController } from "./user/user.controller";
import { AuthController } from "./auth/auth.controller";

import { PrismaService } from "./prisma/prisma.service";
import { AuthService } from "./auth/auth.service";
import { JwtStrategy } from "./auth/jwt.strategy";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";

import { RequestContextMiddleware } from "./common/request-context.middleware";
import { LedgerService } from "./ledger/ledger.service";

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? "dev-secret-change-me",
      signOptions: { expiresIn: "1h" },
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
    consumer.apply(RequestContextMiddleware).forRoutes("*");
  }
}