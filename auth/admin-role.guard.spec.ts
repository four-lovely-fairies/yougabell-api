import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminRoleGuard } from './admin-role.guard';
import { AuthenticatedUser } from './auth.types';

function contextForUser(
  user: Partial<AuthenticatedUser> | undefined,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

void describe('AdminRoleGuard', () => {
  afterEach(() => {
    delete process.env.ADMIN_ALLOWED_EMAILS;
  });

  void it('allows a user with the admin role', () => {
    const guard = new AdminRoleGuard();
    assert.equal(
      guard.canActivate(contextForUser({ id: 'u1', role: 'admin' })),
      true,
    );
  });

  void it('allows an allowlisted email regardless of role', () => {
    process.env.ADMIN_ALLOWED_EMAILS =
      'Dev@yougabell.com, marketer@yougabell.com';
    const guard = new AdminRoleGuard();
    assert.equal(
      guard.canActivate(
        contextForUser({ id: 'u2', email: 'MARKETER@yougabell.com' }),
      ),
      true,
    );
  });

  void it('rejects a non-admin, non-allowlisted user', () => {
    process.env.ADMIN_ALLOWED_EMAILS = 'dev@yougabell.com';
    const guard = new AdminRoleGuard();
    assert.throws(
      () =>
        guard.canActivate(
          contextForUser({ id: 'u3', email: 'user@example.com' }),
        ),
      ForbiddenException,
    );
  });

  void it('rejects when no user is present', () => {
    const guard = new AdminRoleGuard();
    assert.throws(
      () => guard.canActivate(contextForUser(undefined)),
      ForbiddenException,
    );
  });
});
