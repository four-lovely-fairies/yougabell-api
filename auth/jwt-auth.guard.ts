import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user: { id: string };
}

/**
 * 인증 가드.
 *
 * TODO(auth): Supabase JWT 검증 구현. 현재는 placeholder로
 * `x-user-id` 헤더(UUID)를 받아서 `req.user`에 주입.
 * 실 배포 전 다음으로 교체:
 *   - Authorization: Bearer <token>
 *   - SUPABASE_JWT_SECRET 으로 검증 (jose/jsonwebtoken)
 *   - User 도메인 row lazy-create
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = req.headers['x-user-id'];

    if (typeof userId !== 'string' || !this.isUuid(userId)) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED' });
    }

    req.user = { id: userId };
    return true;
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    );
  }
}
