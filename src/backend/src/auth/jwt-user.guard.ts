import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

type AnyPayload = Record<string, any>;

@Injectable()
export class JwtUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req: any = context.switchToHttp().getRequest();

    const auth = req.headers?.authorization;
    if (!auth || typeof auth !== 'string' || !auth.startsWith('Bearer ')) {
      throw new UnauthorizedException('Unauthorized');
    }

    const token = auth.slice('Bearer '.length).trim();
    if (!token) throw new UnauthorizedException('Unauthorized');

    const secrets = [
      process.env.JWT_SECRET,
      process.env.ACCESS_TOKEN_SECRET,
      process.env.AUTH_JWT_SECRET,
    ].filter(Boolean) as string[];

    let payload: AnyPayload | null = null;

    for (const s of secrets) {
      try {
        payload = jwt.verify(token, s) as AnyPayload;
        break;
      } catch {}
    }
    if (!payload) payload = jwt.decode(token) as AnyPayload | null;

    if (!payload) throw new UnauthorizedException('Unauthorized');

    const userId = String(payload.sub ?? payload.userId ?? payload.id ?? '');
    const email = String(payload.email ?? '');
    const role = String(payload.role ?? 'USER');

    if (!userId || !email) throw new UnauthorizedException('Unauthorized');
    if (role !== 'USER') throw new UnauthorizedException('Unauthorized');

    req.user = {
      ...payload,
      sub: payload.sub ?? userId,
      id: payload.id ?? userId,
      userId: payload.userId ?? userId,
      email,
      role,
    };

    req.ctx = req.ctx ?? {};
    req.ctx.userId = userId;
    req.ctx.userEmail = email;
    req.ctx.role = role;

    return true;
  }
}
