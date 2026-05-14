import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { AuthenticatedUser, RequestWithUser } from './auth.types';

export type AuthenticatedRequest = Request & RequestWithUser;

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly jwks = createRemoteJWKSet(
    new URL(requireEnv('SUPABASE_JWKS_URL')),
  );
  private readonly issuer = `${requireEnv('SUPABASE_URL')}/auth/v1`;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & Partial<RequestWithUser>>();
    const token = getBearerToken(req);

    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
      });
      if (!payload.sub) {
        throw new UnauthorizedException('Missing JWT subject');
      }
      req.user = {
        id: payload.sub,
        email: typeof payload.email === 'string' ? payload.email : undefined,
      } satisfies AuthenticatedUser;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid access token');
    }
  }
}

function getBearerToken(req: Request): string {
  const auth = req.headers.authorization;
  if (!auth) throw new UnauthorizedException('Missing authorization header');
  const [scheme, token] = auth.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new UnauthorizedException('Invalid authorization header');
  }
  return token;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
}
