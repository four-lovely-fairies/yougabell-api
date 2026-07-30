import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { isAllowlistedAdminEmail } from './admin-allowlist';
import { RequestWithUser } from './auth.types';

/**
 * 운영자 접근 가드. 다음 중 하나면 통과:
 *  - Supabase `app_metadata.role === 'admin'`
 *  - 인증된 이메일이 `ADMIN_ALLOWED_EMAILS` allowlist에 포함
 *
 * allowlist는 admin(웹) middleware와 같은 env를 공유한다 — Supabase app_metadata를
 * 건드리지 않고 이메일 추가만으로 운영자(마케터 등)를 붙일 수 있도록.
 *
 * 반드시 JwtAuthGuard 뒤에 배치해야 한다(req.user가 채워진 상태 전제).
 */
@Injectable()
export class AdminRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Partial<RequestWithUser>>();

    if (req.user?.role === 'admin') {
      return true;
    }

    if (isAllowlistedAdminEmail(req.user?.email)) {
      return true;
    }

    throw new ForbiddenException('Admin access is required');
  }
}
