import { useEffect, useRef } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { useCmapStore } from '../store/cmapStore';

/** 概念节点渲染数据（由 toFlowNodes 从三元组数据层映射） */
export type ConceptNodeData = {
  text: string;
  fill: string;
  borderColor: string;
  fontSize: number;
  /** 是否为嵌入式子节点（渲染为缩小版 chip） */
  embedded: boolean;
  /** 是否包含子节点（父节点提示标记） */
  hasChildren: boolean;
  /** 焦点路径角色：'on-path' 高亮 / 'dimmed' 淡化 / undefined 常态 */
  pathRole?: 'on-path' | 'dimmed' | undefined;
};

export type ConceptNodeType = Node<ConceptNodeData, 'concept'>;

/**
 * 概念节点：圆角矩形 + contentEditable 文本。
 * - 编辑态由 store.editingId 驱动（新建即编辑 / 双击节点进入编辑）
 * - 编辑态加 `nodrag` class，避免与 React Flow 拖拽冲突
 * - Enter 提交、Shift+Enter 换行、Escape 取消、失焦提交
 *
 * 连接热区（对齐 Lynkage `cmp-entity-drag-line-area` 整节点拖线）：
 * 四边各放一个 source Handle，CSS 将命中热区从 10px 圆点扩大到整条边带，
 * 配合 `ConnectionMode.Loose` 从节点任意边缘拖出连线。四边全 source 可避免
 * Loose 模式下 target 起点被 React Flow 反转方向的问题，连线方向恒等于
 * 「起点节点 → 终点节点」。Loose 模式下手柄节点（源码 `isValidHandle` 会
 * 在吸附时同时考虑 source+target handle），因此无需单独 target 入方向。
 */
export function ConceptNode({ id, data, selected }: NodeProps<ConceptNodeType>) {
  const editing = useCmapStore((s) => s.editingId === id);
  const setEditingId = useCmapStore((s) => s.setEditingId);
  const updateConcept = useCmapStore((s) => s.updateConcept);
  const setEditModalTarget = useCmapStore((s) => s.setEditModalTarget);
  const textRef = useRef<HTMLDivElement>(null);

  // 右键 → 弹窗编辑长文本（Lynkage 对齐：Markdown / LaTeX 在弹窗内编辑）
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setEditModalTarget({ type: 'concept', id });
  };

  // 嵌入式子节点 → 缩小版 chip；父节点 → 虚线边框提示包含子节点
  const cls = [
    'cm-node',
    selected ? 'is-selected' : '',
    editing ? 'is-editing' : '',
    data.embedded ? 'cm-node--embedded' : '',
    data.hasChildren ? 'cm-node--has-children' : '',
    data.pathRole === 'on-path' ? 'is-path' : '',
    data.pathRole === 'dimmed' ? 'is-dimmed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  // 进入编辑态：填入当前文本 + focus + 全选
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
    // 真实浏览器用 innerText（保留换行）；jsdom 无 innerText 时回退 textContent
    const raw = textRef.current?.innerText ?? textRef.current?.textContent ?? '';
    // 空文本保持 "???" 占位
    const text = raw.trim() === '' ? '???' : raw.trimEnd();
    if (text !== data.text) {
      updateConcept(id, { text });
    }
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingId(null); // 取消编辑，丢弃输入
    }
    // Shift+Enter 走默认行为插入换行
  };

  return (
    <div
      className={cls}
      style={{ background: data.fill, borderColor: data.borderColor, fontSize: data.fontSize }}
      onContextMenu={handleContextMenu}
    >
      {/* 连接热区：四边 source Handle，CSS 扩大为整条边带（Loose 模式下均可拖出/吸附） */}
      <Handle id="top" type="source" position={Position.Top} className="cm-node__handle cm-node__handle--top" />
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
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        className="cm-node__handle cm-node__handle--right"
      />
      <div
        ref={textRef}
        className={`cm-node__text${editing ? ' is-editing nodrag' : ''}`}
        contentEditable={editing}
        suppressContentEditableWarning
        onKeyDown={handleKeyDown}
        onBlur={commit}
      >
        {!editing && data.text}
      </div>
    </div>
  );
}
