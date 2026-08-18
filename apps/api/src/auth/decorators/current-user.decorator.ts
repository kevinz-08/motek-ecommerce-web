import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { JwtUser } from '../strategies/jwt.strategy'

export { JwtUser }

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUser => {
    return ctx.switchToHttp().getRequest().user as JwtUser
  },
)
