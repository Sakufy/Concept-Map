/**
 * Supabase Auth 错误中文化（纯函数，便于单测）。
 * 覆盖邮箱+密码注册/登录/邮箱确认的主流程常见错误；
 * 匹配策略：优先按 error.code，其次按 message 关键词兜底，均未命中时返回原文。
 */

const FALLBACK = '操作失败，请重试';

interface MaybeAuthError {
  message?: unknown;
  code?: unknown;
}

export function translateAuthError(err: unknown): string {
  const e = err as MaybeAuthError | null | undefined;
  const code = typeof e?.code === 'string' ? e.code.toLowerCase() : '';
  const raw = e?.message ? String(e.message) : '';
  const msg = raw.toLowerCase();

  if (code === 'invalid_credentials' || msg.includes('invalid login credentials')) {
    return '邮箱或密码不正确';
  }
  if (code === 'email_not_confirmed' || msg.includes('email not confirmed')) {
    return '邮箱尚未确认，请先查收注册邮件并点击确认链接';
  }
  if (code === 'user_already_exists' || msg.includes('already registered')) {
    return '该邮箱已注册，请直接登录';
  }
  if (code === 'weak_password' || msg.includes('at least 6 characters')) {
    return '密码至少需要 6 位';
  }
  if (
    msg.includes('invalid email') ||
    msg.includes('invalid format') ||
    msg.includes('not a valid email') ||
    msg.includes('is invalid')
  ) {
    return '邮箱格式不正确';
  }
  if (
    code === 'rate_limit' ||
    msg.includes('rate limit') ||
    msg.includes('too many requests') ||
    msg.includes('only request this once every')
  ) {
    return '操作过于频繁，请稍后再试';
  }
  if (msg.includes('user not found')) {
    return '账号不存在，请先注册';
  }
  return raw || FALLBACK;
}

/** 判断错误是否为「邮箱未确认」（用于登录失败时提供重新发送确认邮件的引导） */
export function isEmailUnconfirmedError(err: unknown): boolean {
  const e = err as MaybeAuthError | null | undefined;
  const code = typeof e?.code === 'string' ? e.code.toLowerCase() : '';
  const msg = e?.message ? String(e.message).toLowerCase() : '';
  return code === 'email_not_confirmed' || msg.includes('email not confirmed');
}
