import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactFlowProvider } from '@xyflow/react';
import { ConceptNode } from './ConceptNode';
import { useCmapStore } from '../store/cmapStore';
import { createEmptyDocument } from '../types/cmap';

const baseProps = {
  id: 'c-1',
  data: {
    text: '概念A',
    fill: '#e3f2fd',
    borderColor: '#1976d2',
    fontSize: 16,
  },
  selected: false,
  type: 'concept',
  position: { x: 0, y: 0 },
} as unknown as Parameters<typeof ConceptNode>[0];

function seedStore() {
  useCmapStore.setState({
    doc: createEmptyDocument(),
    selectedNodeIds: [],
    editingId: null,
    viewport: { x: 0, y: 0, zoom: 1 },
  });
  // 让 store 中存在 id='c-1' 的节点（updateConceptText 依赖 doc 中的节点）
  const c = useCmapStore.getState().addConcept(0, 0, '概念A');
  useCmapStore.setState((s) => ({
    doc: { ...s.doc, concepts: s.doc.concepts.map((n) => (n.id === c.id ? { ...n, id: 'c-1' } : n)) },
  }));
}

// Handle 组件依赖 ReactFlowProvider 上下文，单独渲染节点时需包裹
function renderNode(props = baseProps) {
  return render(
    <ReactFlowProvider>
      <ConceptNode {...props} />
    </ReactFlowProvider>,
  );
}

describe('ConceptNode 概念节点组件', () => {
  beforeEach(seedStore);

  it('非编辑态渲染文本', () => {
    renderNode();
    expect(screen.getByText('概念A')).toBeInTheDocument();
    expect(document.querySelector('.cm-node__text')?.getAttribute('contenteditable')).toBe('false');
  });

  it('选中态加 is-selected class', () => {
    renderNode({ ...baseProps, selected: true });
    expect(document.querySelector('.cm-node')?.classList.contains('is-selected')).toBe(true);
  });

  it('渲染四边拖线热区（4 个 connectable Handle，id=top/bottom/left/right）', () => {
    renderNode();
    const handles = document.querySelectorAll('.cm-node__handle');
    expect(handles).toHaveLength(4);
    const ids = Array.from(handles).map((h) => h.getAttribute('data-handleid')).sort();
    expect(ids).toEqual(['bottom', 'left', 'right', 'top']);
    // Loose 模式下四边均可作为拖线起点/终点
    handles.forEach((h) => {
      expect(h.classList.contains('react-flow__handle')).toBe(true);
      // 全部为 source 类型（避免 Loose 模式 target 起点的方向反转）
      expect(h.classList.contains('source')).toBe(true);
    });
  });

  it('editingId 匹配时进入编辑态并聚焦', () => {
    useCmapStore.getState().setEditingId('c-1');
    renderNode();
    const el = document.querySelector('.cm-node__text');
    expect(el?.getAttribute('contenteditable')).toBe('true');
    expect(el?.classList.contains('nodrag')).toBe(true);
    expect(document.activeElement).toBe(el);
  });

  it('输入文本后回车提交到 store 并退出编辑', async () => {
    useCmapStore.getState().setEditingId('c-1');
    const user = userEvent.setup();
    renderNode();
    const el = document.querySelector<HTMLDivElement>('.cm-node__text')!;
    // 编辑态由 effect 填入文本并全选，这里直接清空后输入新文本
    el.textContent = '氧气的性质';
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(useCmapStore.getState().doc.concepts[0].text).toBe('氧气的性质');
    });
    expect(useCmapStore.getState().editingId).toBeNull();
  });

  it('Shift+Enter 不提交（插入换行）', async () => {
    useCmapStore.getState().setEditingId('c-1');
    const user = userEvent.setup();
    renderNode();
    const el = document.querySelector<HTMLDivElement>('.cm-node__text')!;
    el.textContent = '第一行';
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    expect(useCmapStore.getState().editingId).toBe('c-1');
  });

  it('失焦提交文本', () => {
    useCmapStore.getState().setEditingId('c-1');
    renderNode();
    const el = document.querySelector<HTMLDivElement>('.cm-node__text')!;
    el.textContent = '失焦提交';
    fireEvent.blur(el);
    expect(useCmapStore.getState().doc.concepts[0].text).toBe('失焦提交');
    expect(useCmapStore.getState().editingId).toBeNull();
  });

  it('空文本提交时保持 ??? 占位', async () => {
    useCmapStore.getState().setEditingId('c-1');
    const user = userEvent.setup();
    renderNode();
    const el = document.querySelector<HTMLDivElement>('.cm-node__text')!;
    el.textContent = '   ';
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(useCmapStore.getState().doc.concepts[0].text).toBe('???');
    });
  });

  it('Escape 取消编辑不提交', async () => {
    useCmapStore.getState().setEditingId('c-1');
    const user = userEvent.setup();
    renderNode();
    const el = document.querySelector<HTMLDivElement>('.cm-node__text')!;
    el.textContent = '不要保存我';
    await user.keyboard('{Escape}');
    expect(useCmapStore.getState().editingId).toBeNull();
    expect(useCmapStore.getState().doc.concepts[0].text).toBe('概念A');
  });
});
