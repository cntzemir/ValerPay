import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type CurrentUserData = {
  userId: string;
  email: string;
  role: 'ADMIN' | 'USER';
};

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): CurrentUserData | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.user ?? null;
  },
);
