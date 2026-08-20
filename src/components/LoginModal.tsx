/**
 * 登录 / 注册弹窗（邮箱+密码，Supabase Auth 官方用法）。
 * 覆盖「注册 → 邮箱确认 → 登录」完整闭环：
 * - 注册：密码二次确认；项目开启邮件确认时展示「请查收确认邮件」成功态（非错误）
 * - 登录：错误中文化；邮箱未确认时引导重新发送确认邮件
 * - 支持从登录态 / 确认态重新发送确认邮件
 * 未配置云端时按钮隐藏，不会渲染到该组件。
 */
import { useState } from 'react';
import { signInWithEmail, signUpWithEmail, resendConfirmationEmail } from '../cloudSync';
import { translateAuthError, isEmailUnconfirmedError } from '../authErrors';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

type Mode = 'signin' | 'signup' | 'confirm';

export function LoginModal({ onClose, onSuccess }: Props) {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  /** 登录失败是否为「邮箱未确认」（基于原始错误判断，用于显示重发引导） */
  const [unconfirmed, setUnconfirmed] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setInfo(null);
    setUnconfirmed(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setInfo(null);
    setUnconfirmed(false);

    if (mode === 'signup' && password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'signin') {
        await signInWithEmail(email.trim(), password);
        onSuccess();
      } else {
        const result = await signUpWithEmail(email.trim(), password);
        if (result.needConfirm) {
          setMode('confirm');
          setInfo(`确认邮件已发送到 ${email.trim()}，请查收并点击邮件中的确认链接完成验证。`);
        } else {
          onSuccess();
        }
      }
    } catch (err) {
      setError(translateAuthError(err));
      setUnconfirmed(isEmailUnconfirmedError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    if (resending) return;
    setResending(true);
    setError(null);
    setInfo(null);
    try {
      await resendConfirmationEmail(email.trim());
      setInfo(`确认邮件已重新发送到 ${email.trim()}，请查收。`);
    } catch (err) {
      setError(translateAuthError(err));
    } finally {
      setResending(false);
    }
  };

  // 登录失败且为「邮箱未确认」时，提供重发确认邮件入口
  const showResendHint = mode === 'signin' && unconfirmed;

  return (
    <div className="cm-modal__backdrop" onClick={onClose}>
      <div
        className="cm-modal"
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'signin' ? '登录' : mode === 'signup' ? '注册' : '邮箱确认'}
        onClick={(e) => e.stopPropagation()}
      >
        {mode === 'confirm' ? (
          <>
            <h3 className="cm-modal__title">请确认邮箱</h3>
            <div className="cm-modal__body">
              {info && (
                <p className="cm-modal__success" role="status">
                  {info}
                </p>
              )}
              <p className="cm-modal__note">
                如果几分钟内没有收到，请检查垃圾邮件文件夹；也可以重新发送一封确认邮件。
              </p>
            </div>
            <div className="cm-modal__actions">
              <button
                type="button"
                className="cm-modal__primary"
                onClick={handleResend}
                disabled={resending}
                data-testid="resend-btn"
              >
                {resending ? '发送中…' : '重新发送确认邮件'}
              </button>
              <button type="button" className="cm-modal__ghost" onClick={onClose}>
                关闭
              </button>
            </div>
            {error && (
              <p className="cm-modal__error" role="alert">
                {error}
              </p>
            )}
            <p className="cm-modal__switch">
              已确认完成？
              <button type="button" className="cm-modal__link" onClick={() => switchMode('signin')}>
                去登录
              </button>
            </p>
          </>
        ) : (
          <>
            <h3 className="cm-modal__title">{mode === 'signin' ? '登录账号' : '注册账号'}</h3>
            <form onSubmit={handleSubmit} className="cm-modal__form">
              <label className="cm-modal__field">
                <span>邮箱</span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  data-testid="email-input"
                />
              </label>
              <label className="cm-modal__field">
                <span>密码</span>
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 6 位"
                  data-testid="password-input"
                />
              </label>
              {mode === 'signup' && (
                <label className="cm-modal__field">
                  <span>确认密码</span>
                  <input
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="再次输入密码"
                    data-testid="confirm-password-input"
                  />
                </label>
              )}
              {error && (
                <div>
                  <p className="cm-modal__error" role="alert">
                    {error}
                  </p>
                  {showResendHint && (
                    <button
                      type="button"
                      className="cm-modal__link"
                      onClick={handleResend}
                      disabled={resending}
                      data-testid="resend-hint-btn"
                    >
                      {resending ? '发送中…' : '重新发送确认邮件'}
                    </button>
                  )}
                </div>
              )}
              <div className="cm-modal__actions">
                <button type="submit" className="cm-modal__primary" disabled={busy}>
                  {busy ? '请稍候…' : mode === 'signin' ? '登录' : '注册'}
                </button>
                <button type="button" className="cm-modal__ghost" onClick={onClose}>
                  取消
                </button>
              </div>
            </form>
            <p className="cm-modal__switch">
              {mode === 'signin' ? '还没有账号？' : '已有账号？'}
              <button
                type="button"
                className="cm-modal__link"
                onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
              >
                {mode === 'signin' ? '注册' : '去登录'}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
