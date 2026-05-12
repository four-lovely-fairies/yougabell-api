import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { AuthenticatedUser, RequestWithUser } from './auth.types';

@Injectable()
export class JwksAuthGuard implements CanActivate {
  private readonly jwks = createRemoteJWKSet(
    new URL(getRequiredEnv('SUPABASE_JWKS_URL')),
  );
  private readonly issuer = `${getRequiredEnv('SUPABASE_URL')}/auth/v1`;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & Partial<RequestWithUser>>();
    const token = getBearerToken(request);

    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
      });

      if (!payload.sub) {
        throw new UnauthorizedException('Missing JWT subject');
      }

      request.user = {
        id: payload.sub,
        email: typeof payload.email === 'string' ? payload.email : undefined,
      } satisfies AuthenticatedUser;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid access token');
    }
  }
}

function getBearerToken(request: Request): string {
  const authorization = request.headers.authorization;
  if (!authorization) {
    throw new UnauthorizedException('Missing authorization header');
  }

  const [scheme, token] = authorization.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new UnauthorizedException('Invalid authorization header');
  }

  return token;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}
