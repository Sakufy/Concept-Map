import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactFlowProvider } from '@xyflow/react';
import { LinkingPhraseNode } from './LinkingPhraseNode';
import { useCmapStore } from '../store/cmapStore';
import { createEmptyDocument } from '../types/cmap';

const baseProps = {
  id: 'lp-1',
  data: {
    text: '???',
    fill: '#f1f5f9',
    borderColor: '#94a3b8',
    fontSize: 13,
  },
  selected: false,
  type: 'linkingPhrase',
  position: { x: 40, y: 65 },
} as unknown as Parameters<typeof LinkingPhraseNode>[0];

// store 中创建一个真实连词，并把 id 固定为 'lp-1'（updateLinkingPhraseText 依赖 doc 中的连词）
function seedStore() {
  useCmapStore.setState({
    doc: createEmptyDocument(),
    selectedNodeIds: [],
    selectedEdgeId: null,
    editingId: null,
    editingLpId: null,
    viewport: { x: 0, y: 0, zoom: 1 },
  });
  const { addConcept, addConnection } = useCmapStore.getState();
  const a = addConcept(0, 0, 'A');
  const b = addConcept(0, 100, 'B');
  const conn = addConnection(a.id, b.id);
  useCmapStore.setState((s) => ({
    doc: {
      ...s.doc,
      linkingPhrases: s.doc.linkingPhrases.map((n) =>
        n.id === conn.viaId ? { ...n, id: 'lp-1' } : n,
      ),
    },
  }));
}

// Handle 组件依赖 ReactFlowProvider 上下文，单独渲染节点时需包裹
function renderLp(props = baseProps) {
  return render(
    <ReactFlowProvider>
      <LinkingPhraseNode {...props} />
    </ReactFlowProvider>,
  );
}

describe('LinkingPhraseNode 连词节点组件', () => {
  beforeEach(seedStore);

  it('非编辑态渲染文本', () => {
    renderLp();
    expect(screen.getByText('???')).toBeInTheDocument();
    expect(document.querySelector('.cm-lp__text')?.getAttribute('contenteditable')).toBe('false');
  });

  it('editingLpId 匹配时进入编辑态并聚焦', () => {
    useCmapStore.getState().setEditingLpId('lp-1');
    renderLp();
    const el = document.querySelector('.cm-lp__text');
    expect(el?.getAttribute('contenteditable')).toBe('true');
    expect(el?.classList.contains('nodrag')).toBe(true);
    expect(document.activeElement).toBe(el);
  });

  it('双击进入编辑态', () => {
    renderLp();
    fireEvent.doubleClick(document.querySelector('.cm-lp__text')!);
    expect(document.querySelector('.cm-lp__text')?.getAttribute('contenteditable')).toBe('true');
    expect(useCmapStore.getState().editingLpId).toBe('lp-1');
  });

  it('编辑态填回当前文本（双击后不出现空框）', () => {
    // 回归：修复前编辑态渲染空内容且不填回 data.text，双击后文字消失
    renderLp({ ...baseProps, data: { ...baseProps.data, text: '导致' } });
    fireEvent.doubleClick(document.querySelector('.cm-lp__text')!);
    expect(document.querySelector('.cm-lp__text')?.textContent).toBe('导致');
  });

  it('输入文本后回车提交到 store 并退出编辑', async () => {
    useCmapStore.getState().setEditingLpId('lp-1');
    const user = userEvent.setup();
    renderLp();
    const el = document.querySelector<HTMLDivElement>('.cm-lp__text')!;
    el.textContent = '导致';
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(useCmapStore.getState().doc.linkingPhrases[0].text).toBe('导致');
    });
    expect(useCmapStore.getState().editingLpId).toBeNull();
  });

  it('空文本提交时保持 ??? 占位', async () => {
    useCmapStore.getState().setEditingLpId('lp-1');
    const user = userEvent.setup();
    renderLp();
    const el = document.querySelector<HTMLDivElement>('.cm-lp__text')!;
    el.textContent = '   ';
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(useCmapStore.getState().doc.linkingPhrases[0].text).toBe('???');
    });
  });

  it('Escape 取消编辑不提交（对齐概念节点）', async () => {
    useCmapStore.getState().setEditingLpId('lp-1');
    const user = userEvent.setup();
    renderLp();
    const el = document.querySelector<HTMLDivElement>('.cm-lp__text')!;
    el.textContent = '不要保存我';
    await user.keyboard('{Escape}');
    expect(useCmapStore.getState().editingLpId).toBeNull();
    expect(useCmapStore.getState().doc.linkingPhrases[0].text).toBe('???');
  });
});
