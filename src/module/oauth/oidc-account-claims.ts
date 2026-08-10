import type { User } from '@/entity';

export function oidcAccountClaims(user: User, scope: string) {
  const scopes = new Set(scope.split(' ').filter(Boolean));
  return {
    sub: String(user.id),
    ...(scopes.has('profile')
      ? { nickname: user.nickname, picture: user.avatar }
      : {}),
    ...(scopes.has('email')
      ? {
          email: user.email,
          email_verified: user.emailVerifiedAt != null,
        }
      : {}),
  };
}
