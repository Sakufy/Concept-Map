/**
 * 头部概念图标题：点击进入重命名（input），Enter / 失焦提交，Escape 取消，空文本回退默认名。
 * 提交走 store.setDocTitle（参与撤销历史 + 自动保存同步本地/云端）。
 */
import { useRef, useState } from 'react';
import { useCmapStore } from '../store/cmapStore';

export function DocTitle({ title }: { title: string }) {
  const setDocTitle = useCmapStore((s) => s.setDocTitle);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setValue(title);
    setEditing(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  };

  const commit = () => {
    if (!editing) return;
    setEditing(false);
    setDocTitle(value);
  };

  const cancel = () => setEditing(false);

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="app-header__title-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          else if (e.key === 'Escape') cancel();
        }}
        data-testid="doc-title-input"
        aria-label="重命名概念图"
      />
    );
  }

  return (
    <button
      type="button"
      className="app-header__title"
      onClick={startEdit}
      title="点击重命名概念图"
      data-testid="doc-title"
    >
      <span className="app-header__title-text">{title}</span>
      <span className="app-header__title-edit" aria-hidden="true">
        ✎
      </span>
    </button>
  );
}
