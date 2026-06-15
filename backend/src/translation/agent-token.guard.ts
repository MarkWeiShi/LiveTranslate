import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

/** Guards the internal agent ingress + dev hooks with a shared secret header. */
@Injectable()
export class AgentTokenGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const token = req.headers['x-agent-token'];
    const expected = process.env.AGENT_INGRESS_TOKEN ?? 'dev_agent_token';
    if (token !== expected) {
      throw new UnauthorizedException({ code: 'BAD_AGENT_TOKEN', message: 'Invalid agent token' });
    }
    return true;
  }
}
