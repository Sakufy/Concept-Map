/**
 * 登录 / 注册弹窗（邮箱+密码，Supabase Auth 官方用法）。
 * 未配置云端时按钮隐藏，不会渲染到该组件。
 */
import { useState } from 'react';
import { signInWithEmail, signUpWithEmail } from '../cloudSync';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export function LoginModal({ onClose, onSuccess }: Props) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signin') {
        await signInWithEmail(email.trim(), password);
      } else {
        await signUpWithEmail(email.trim(), password);
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败，请重试');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cm-modal__backdrop" onClick={onClose}>
      <div
        className="cm-modal"
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'signin' ? '登录' : '注册'}
        onClick={(e) => e.stopPropagation()}
      >
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
            />
          </label>
          {error && <p className="cm-modal__error" role="alert">{error}</p>}
          <div className="cm-modal__actions">
            <button type="submit" className="cm-modal__primary" disabled={busy}>
              {busy ? '请稍候…' : mode === 'signin' ? '登录' : '注册并登录'}
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
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setError(null);
            }}
          >
            {mode === 'signin' ? '注册' : '去登录'}
          </button>
        </p>
      </div>
    </div>
  );
}
