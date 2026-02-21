import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';

type RequestWithContext = Request & {
  clientIp?: string | null;
  clientUserAgent?: string | null;
};

@Controller()
export class AppController {
  @Get()
  getHello(): string {
    return 'Hello World!';
  }

  @Get('health')
  health(@Req() req: RequestWithContext) {
    const ip = req?.clientIp ?? null;
    const userAgent = req?.clientUserAgent ?? null;

    return {
      ok: true,
      ip,
      userAgent,
      time: new Date().toISOString(),
    };
  }
}
