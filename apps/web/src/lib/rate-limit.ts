/**
 * Rate limiting is handled by NestJS ThrottlerGuard (@nestjs/throttler).
 *
 * All auth routes in apps/web call NestJS directly, so the limits below
 * are already enforced server-side before any DB or business logic runs:
 *
 *   POST /auth/register       → 5 req / 60 s
 *   POST /auth/login          → 10 req / 60 s
 *   POST /auth/forgot-password → 3 req / 900 s (15 min)
 *   POST /auth/reset-password  → 5 req / 60 s
 *
 * NestJS returns HTTP 429 on breach; callers in apps/web already handle it.
 *
 * This function is kept as a no-op to preserve the module interface for any
 * future callers that may need client-side pre-validation. It always returns
 * true (allow) because the real enforcement happens at the NestJS layer.
 */
export function checkRateLimit(
  _key: string,
  _limit: number,
  _windowMs: number,
): boolean {
  return true
}
