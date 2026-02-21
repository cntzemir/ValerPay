import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

export interface RequestContextRequest extends Request {
  clientIp?: string;
  clientUserAgent?: string;
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: RequestContextRequest, res: Response, next: NextFunction) {
    const forwarded = req.headers['x-forwarded-for'];

    let ip: string | undefined;
    if (Array.isArray(forwarded)) {
      ip = forwarded[0];
    } else if (typeof forwarded === 'string') {
      ip = forwarded.split(',')[0].trim();
    } else {
      ip = req.socket.remoteAddress ?? undefined;
    }

    req.clientIp = ip;
    req.clientUserAgent = (req.headers['user-agent'] as string | undefined) ?? undefined;

    next();
  }
}
