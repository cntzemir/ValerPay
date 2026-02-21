import { RequestContextMiddleware } from './request-context.middleware';

describe('RequestContextMiddleware (unit)', () => {
  it('should prefer x-forwarded-for header (string)', () => {
    const mw = new RequestContextMiddleware();
    const req: any = {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8', 'user-agent': 'ua' },
      socket: { remoteAddress: '9.9.9.9' },
    };

    mw.use(req, {} as any, () => {});
    expect(req.clientIp).toBe('1.2.3.4');
    expect(req.clientUserAgent).toBe('ua');
  });

  it('should fall back to socket.remoteAddress', () => {
    const mw = new RequestContextMiddleware();
    const req: any = {
      headers: {},
      socket: { remoteAddress: '9.9.9.9' },
    };

    mw.use(req, {} as any, () => {});
    expect(req.clientIp).toBe('9.9.9.9');
  });
});
