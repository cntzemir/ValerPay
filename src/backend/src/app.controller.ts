import { Controller, Get, Req } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  health(@Req() req: any) {
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
