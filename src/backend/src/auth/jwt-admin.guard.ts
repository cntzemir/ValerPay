import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';


@Injectable()
export class JwtAdminGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    if (err || !user) {
      throw err ?? new UnauthorizedException('Unauthorized');
    }

    if (String(user.role) === 'USER') {
      throw new UnauthorizedException('ADMIN token gerekli');
    }

    return user;
  }
}
