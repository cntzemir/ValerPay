import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type CurrentAdminData = {
  sub: string;          
  email: string;
  role?: string;        
};

export const CurrentAdmin = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): CurrentAdminData | null => {
    const req = ctx.switchToHttp().getRequest<any>();
    const user = req.user as CurrentAdminData | undefined;

    if (!user) {
      return null;
    }

    if (
      user.role &&
      user.role !== 'ADMIN' &&
      user.role !== 'SUPER_ADMIN'
    ) {
      return null;
    }

    return user;
  },
);