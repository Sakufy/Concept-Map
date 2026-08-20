/**
 * 连词节点（Linking Phrase）—— 独立小节点，对齐 Lynkage 最终形态。
 * 位于两条 Connection 之间，可拖动、可编辑、可再被连线（四边 source handle）。
 */
import { useEffect, useRef } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { useCmapStore } from '../store/cmapStore';

export type LinkingPhraseNodeData = {
  text: string;
  fill: string;
  borderColor: string;
  fontSize: number;
  /** 焦点路径角色：'on-path' 高亮 / 'dimmed' 淡化 / undefined 常态 */
  pathRole?: 'on-path' | 'dimmed' | undefined;
};
export type LinkingPhraseNodeType = Node<LinkingPhraseNodeData, 'linkingPhrase'>;

export function LinkingPhraseNode({ id, data, selected }: NodeProps<LinkingPhraseNodeType>) {
  const editing = useCmapStore((s) => s.editingLpId === id);
  const setEditingLpId = useCmapStore((s) => s.setEditingLpId);
  const updateLinkingPhraseText = useCmapStore((s) => s.updateLinkingPhraseText);
  const setEditModalTarget = useCmapStore((s) => s.setEditModalTarget);
  const textRef = useRef<HTMLDivElement>(null);

  // 右键 → 弹窗编辑长文本
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setEditModalTarget({ type: 'linkingPhrase', id });
  };

  // 进入编辑态：填入当前文本 + focus + 全选（对齐 ConceptNode 成熟实现）
  // 注意：React Flow 节点测量完成前 visibility:hidden，hidden 元素 focus 无效，
  // 因此用 rAF 重试直到节点可见再聚焦。
  useEffect(() => {
    if (!editing) return;
    const el = textRef.current;
    if (!el) return;
    el.textContent = data.text;
    let attempts = 0;
    const tryFocusAndSelect = () => {
      el.focus();
      if (document.activeElement !== el) {
        if (attempts < 30) {
          attempts++;
          requestAnimationFrame(tryFocusAndSelect);
        }
        return;
      }
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    };
    tryFocusAndSelect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const commit = () => {
    const raw = textRef.current?.innerText ?? textRef.current?.textContent ?? '';
    const text = raw.trim() === '' ? '???' : raw.trimEnd();
    if (text !== data.text) updateLinkingPhraseText(id, text);
    setEditingLpId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingLpId(null); // 取消编辑，丢弃输入（对齐概念节点行为）
    }
    e.stopPropagation();
  };

  const cls = [
    'cm-lp',
    selected ? 'is-selected' : '',
    data.pathRole === 'on-path' ? 'is-path' : '',
    data.pathRole === 'dimmed' ? 'is-dimmed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={cls}
      style={{
        background: data.fill,
        borderColor: data.borderColor,
        fontSize: data.fontSize,
      }}
      onContextMenu={handleContextMenu}
    >
      <Handle
        id="top"
        type="source"
        position={Position.Top}
        className="cm-node__handle cm-node__handle--top"
      />
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        className="cm-node__handle cm-node__handle--right"
      />
      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        className="cm-node__handle cm-node__handle--bottom"
      />
      <Handle
        id="left"
        type="source"
        position={Position.Left}
        className="cm-node__handle cm-node__handle--left"
      />
      <div
        ref={textRef}
        className={`cm-lp__text${editing ? ' is-editing nodrag' : ''}`}
        contentEditable={editing}
        suppressContentEditableWarning
        onDoubleClick={() => setEditingLpId(id)}
        onKeyDown={handleKeyDown}
        onBlur={commit}
      >
        {!editing && data.text}
      </div>
    </div>
  );
}
