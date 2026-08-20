import { describe, it, expect } from 'vitest';
import { translateAuthError, isEmailUnconfirmedError } from './authErrors';

describe('translateAuthError（Supabase Auth 错误中文化）', () => {
  it('凭据错误 → 邮箱或密码不正确', () => {
    expect(translateAuthError({ message: 'Invalid login credentials', code: 'invalid_credentials' })).toBe(
      '邮箱或密码不正确',
    );
    expect(translateAuthError({ message: 'Invalid login credentials' })).toBe('邮箱或密码不正确');
  });

  it('邮箱未确认（message 与 code 两种形态）→ 提示查收确认邮件', () => {
    expect(translateAuthError({ message: 'Email not confirmed', code: 'email_not_confirmed' })).toContain(
      '邮箱尚未确认',
    );
    expect(translateAuthError(new Error('Email not confirmed'))).toContain('邮箱尚未确认');
  });

  it('邮箱已注册 → 请直接登录', () => {
    expect(translateAuthError({ message: 'User already registered', code: 'user_already_exists' })).toBe(
      '该邮箱已注册，请直接登录',
    );
  });

  it('密码过短 → 至少 6 位', () => {
    expect(translateAuthError({ message: 'Password should be at least 6 characters', code: 'weak_password' })).toBe(
      '密码至少需要 6 位',
    );
  });

  it('邮箱格式错误 → 邮箱格式不正确', () => {
    expect(translateAuthError({ message: 'Unable to validate email address: invalid format' })).toBe(
      '邮箱格式不正确',
    );
    // Supabase 拒绝 example.com 等域名时的实际报错形态
    expect(translateAuthError({ message: 'Email address "x@example.com" is invalid' })).toBe('邮箱格式不正确');
  });

  it('限流 → 操作过于频繁', () => {
    expect(translateAuthError({ message: 'Email rate limit exceeded', code: 'rate_limit' })).toBe(
      '操作过于频繁，请稍后再试',
    );
  });

  it('用户不存在 → 请先注册', () => {
    expect(translateAuthError({ message: 'User not found' })).toBe('账号不存在，请先注册');
  });

  it('未知错误保留原文，无原文用兜底文案', () => {
    expect(translateAuthError({ message: 'Something unexpected happened' })).toBe('Something unexpected happened');
    expect(translateAuthError(null)).toBe('操作失败，请重试');
  });
});

describe('isEmailUnconfirmedError', () => {
  it('命中邮箱未确认错误', () => {
    expect(isEmailUnconfirmedError({ message: 'Email not confirmed', code: 'email_not_confirmed' })).toBe(true);
    expect(isEmailUnconfirmedError(new Error('Email not confirmed'))).toBe(true);
  });

  it('非未确认错误返回 false', () => {
    expect(isEmailUnconfirmedError({ message: 'Invalid login credentials' })).toBe(false);
    expect(isEmailUnconfirmedError(null)).toBe(false);
  });
});
