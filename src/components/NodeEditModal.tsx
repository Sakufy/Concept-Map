/**
 * 右键弹窗编辑（对齐 Lynkage「长文本编辑 → 右键 → 弹窗编辑」）：
 * - 纯文本 textarea 编辑 + Markdown 预览 tab（react-markdown 渲染，成熟方案）
 * - 保存写入 store 的 concept / linkingPhrase 文本；空文本保持 "???"
 * - Ctrl+Enter 保存、Esc 取消、点击遮罩取消
 * - LaTeX / 表格渲染后置
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useCmapStore } from '../store/cmapStore';

export function NodeEditModal() {
  const target = useCmapStore((s) => s.editModalTarget);
  const doc = useCmapStore((s) => s.doc);
  const updateConcept = useCmapStore((s) => s.updateConcept);
  const updateLinkingPhraseText = useCmapStore((s) => s.updateLinkingPhraseText);
  const setEditModalTarget = useCmapStore((s) => s.setEditModalTarget);

  const [draft, setDraft] = useState('');
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const areaRef = useRef<HTMLTextAreaElement>(null);

  // 目标变化时载入当前文本（打开 / 切换目标）
  const sourceText = useMemo(() => {
    if (!target) return '';
    if (target.type === 'concept') return doc.concepts.find((c) => c.id === target.id)?.text ?? '';
    return doc.linkingPhrases.find((lp) => lp.id === target.id)?.text ?? '';
  }, [target, doc.concepts, doc.linkingPhrases]);

  useEffect(() => {
    if (target) {
      setDraft(sourceText);
      setTab('edit');
      // 打开后聚焦 textarea
      requestAnimationFrame(() => areaRef.current?.focus());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.id]);

  if (!target) return null;

  const close = () => setEditModalTarget(null);

  const commit = () => {
    const text = draft.trim() === '' ? '???' : draft.trimEnd();
    if (text !== sourceText) {
      if (target.type === 'concept') updateConcept(target.id, { text });
      else updateLinkingPhraseText(target.id, text);
    }
    close();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      commit();
    }
    // Esc 取消
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  return (
    <div className="cm-modal__backdrop" onClick={close}>
      <div
        className="cm-modal cm-edit"
        role="dialog"
        aria-modal="true"
        aria-label="编辑节点文本"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cm-edit__tabs">
          <button
            type="button"
            className={`cm-edit__tab${tab === 'edit' ? ' is-active' : ''}`}
            onClick={() => setTab('edit')}
          >
            编辑
          </button>
          <button
            type="button"
            className={`cm-edit__tab${tab === 'preview' ? ' is-active' : ''}`}
            onClick={() => setTab('preview')}
          >
            预览
          </button>
          <span className="cm-edit__hint">支持 Markdown · Ctrl+Enter 保存</span>
        </div>

        {tab === 'edit' ? (
          <textarea
            ref={areaRef}
            className="cm-edit__area"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            data-testid="edit-modal-area"
          />
        ) : (
          <div className="cm-edit__preview" data-testid="edit-modal-preview">
            <ReactMarkdown>{draft}</ReactMarkdown>
          </div>
        )}

        <div className="cm-modal__actions">
          <button type="button" className="cm-modal__primary" onClick={commit} data-testid="edit-modal-save">
            保存
          </button>
          <button type="button" className="cm-modal__ghost" onClick={close} data-testid="edit-modal-cancel">
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
