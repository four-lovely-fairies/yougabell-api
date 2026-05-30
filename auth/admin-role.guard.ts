import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { RequestWithUser } from './auth.types';

@Injectable()
export class AdminRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Partial<RequestWithUser>>();

    if (req.user?.role !== 'admin') {
      throw new ForbiddenException('Admin role is required');
    }

    return true;
  }
}
