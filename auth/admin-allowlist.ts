/**
 * 운영자 이메일 allowlist. admin(웹)과 동일한 `ADMIN_ALLOWED_EMAILS` env를
 * 공유해 프론트 게이트와 API 가드가 한 소스로 정렬된다.
 * 값: 쉼표로 구분된 이메일 목록. 대소문자·공백 무시.
 */
export function parseAdminAllowlist(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.length > 0),
  );
}

export function isAllowlistedAdminEmail(email: string | undefined): boolean {
  if (!email) return false;
  const allowlist = parseAdminAllowlist(process.env.ADMIN_ALLOWED_EMAILS);
  return allowlist.has(email.trim().toLowerCase());
}
