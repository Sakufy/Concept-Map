import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { useCmapStore } from './store/cmapStore';
import { createEmptyDocument } from './types/cmap';

describe('App 外壳', () => {
  beforeEach(() => {
    useCmapStore.setState({
      doc: createEmptyDocument(),
      selectedNodeIds: [],
      selectedEdgeId: null,
      editingId: null,
      editingLpId: null,
      viewport: { x: 0, y: 0, zoom: 1 },
    });
    useCmapStore.temporal.getState().clear();
  });

  it('渲染标题栏与画布容器', () => {
    render(<App />);
    expect(screen.getByText('未命名概念图')).toBeInTheDocument();
    // React Flow 画布容器
    expect(document.querySelector('.react-flow')).not.toBeNull();
    // 网格背景
    expect(document.querySelector('.react-flow__background')).not.toBeNull();
    // minimap
    expect(document.querySelector('.react-flow__minimap')).not.toBeNull();
  });

  it('渲染画布工具栏（平移/框选/撤销/重做/适应）', () => {
    render(<App />);
    expect(screen.getByTitle('平移')).toBeInTheDocument();
    expect(screen.getByTitle('框选')).toBeInTheDocument();
    expect(screen.getByTitle('撤销 (Ctrl+Z)')).toBeInTheDocument();
    expect(screen.getByTitle('重做 (Ctrl+Shift+Z)')).toBeInTheDocument();
    expect(screen.getByTitle('适应视图')).toBeInTheDocument();
  });

  it('初始撤销/重做按钮禁用，产生编辑后可撤销', async () => {
    const user = userEvent.setup();
    render(<App />);
    const undoBtn = screen.getByTitle('撤销 (Ctrl+Z)');
    const redoBtn = screen.getByTitle('重做 (Ctrl+Shift+Z)');
    expect(undoBtn).toBeDisabled();
    expect(redoBtn).toBeDisabled();

    fireEvent.dblClick(document.querySelector('.react-flow__pane')!, { clientX: 300, clientY: 200 });
    expect(useCmapStore.getState().doc.concepts).toHaveLength(1);
    expect(undoBtn).toBeEnabled();

    await user.click(undoBtn);
    expect(useCmapStore.getState().doc.concepts).toHaveLength(0);
    expect(redoBtn).toBeEnabled();

    await user.click(redoBtn);
    expect(useCmapStore.getState().doc.concepts).toHaveLength(1);
  });

  it('渲染保存状态与导入导出按钮（导入导出收进 ⋯ 聚合菜单）', () => {
    render(<App />);
    expect(screen.getByText('已保存')).toBeInTheDocument();
    // 低频 I/O 操作收拢在 ⋯ 菜单中，展开后可见
    fireEvent.click(screen.getByTestId('more-menu-btn'));
    expect(screen.getByTitle('导出当前概念图为 JSON 文件')).toBeInTheDocument();
    expect(screen.getByTitle('从 JSON 文件导入概念图')).toBeInTheDocument();
  });

  it('工具栏模式切换生效', async () => {
    const user = userEvent.setup();
    render(<App />);
    const selectBtn = screen.getByTitle('框选');
    await user.click(selectBtn);
    expect(useCmapStore.getState().toolMode).toBe('select');
    expect(selectBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('双击画布空白创建概念节点并进入编辑态', () => {
    render(<App />);
    const pane = document.querySelector('.react-flow__pane')!;
    fireEvent.dblClick(pane, { clientX: 300, clientY: 200 });

    const s = useCmapStore.getState();
    expect(s.doc.concepts).toHaveLength(1);
    expect(s.selectedNodeIds).toEqual([s.doc.concepts[0].id]);
    expect(s.editingId).toBe(s.doc.concepts[0].id);
    // 新建即编辑
    expect(document.querySelector('.cm-node__text')?.getAttribute('contenteditable')).toBe('true');
  });

  it('双击已有节点进入编辑态，不新建节点', () => {
    render(<App />);
    const pane = document.querySelector('.react-flow__pane')!;
    // 先创建并提交一个节点
    fireEvent.dblClick(pane, { clientX: 300, clientY: 200 });
    fireEvent.keyDown(document.querySelector('.cm-node__text')!, { key: 'Enter' });
    const created = useCmapStore.getState().doc.concepts[0];

    // 双击该节点（事件冒泡到 wrapper div 的 onDoubleClick）
    fireEvent.dblClick(document.querySelector('.react-flow__node')!, { clientX: 300, clientY: 200 });

    const s = useCmapStore.getState();
    expect(s.doc.concepts).toHaveLength(1); // 不再新建节点
    expect(s.editingId).toBe(created.id); // 进入该节点编辑态
  });

  it('选中节点后色板切换节点颜色', async () => {
    const user = userEvent.setup();
    render(<App />);
    fireEvent.dblClick(document.querySelector('.react-flow__pane')!, { clientX: 300, clientY: 200 });
    expect(useCmapStore.getState().doc.concepts).toHaveLength(1);

    // 双击后节点已选中 → 色板可见
    const green = screen.getByRole('button', { name: '绿' });
    await user.click(green);
    expect(useCmapStore.getState().doc.concepts[0].style.fill).toBe('#e8f5e9');
  });

  it('编辑态回车提交退出编辑，节点保留在 store', async () => {
    render(<App />);
    fireEvent.dblClick(document.querySelector('.react-flow__pane')!, { clientX: 300, clientY: 200 });
    const concept = useCmapStore.getState().doc.concepts[0];
    expect(useCmapStore.getState().doc.concepts).toHaveLength(1);
    expect(useCmapStore.getState().editingId).toBe(concept.id);

    fireEvent.keyDown(document.querySelector('.cm-node__text')!, { key: 'Enter' });
    expect(useCmapStore.getState().editingId).toBeNull();
    expect(useCmapStore.getState().doc.concepts).toHaveLength(1);
    // 删除的键盘交互在 playwright 实测；此处验证 store 层级联删除
    useCmapStore.getState().removeConcepts([concept.id]);
    expect(useCmapStore.getState().doc.concepts).toHaveLength(0);
    expect(useCmapStore.getState().selectedNodeIds).toEqual([]);
    expect(useCmapStore.getState().editingId).toBeNull();
  });

  it('底部统计栏展示概念/连词/连接计数并随编辑更新', () => {
    render(<App />);
    // 初始空图：0 概念
    expect(screen.getByText('概念')).toBeInTheDocument();
    const numEls = document.querySelectorAll('.cm-stats__num');
    expect(numEls).toHaveLength(3);

    fireEvent.dblClick(document.querySelector('.react-flow__pane')!, { clientX: 300, clientY: 200 });
    const s = useCmapStore.getState();
    expect(s.doc.concepts).toHaveLength(1);
    // 统计数字来自 store，直接断言渲染出的数字
    expect(document.querySelectorAll('.cm-stats__num')[0]?.textContent).toBe('1');
  });

  it('主题切换按钮切换深色/浅色并写入 doc.config', async () => {
    const user = userEvent.setup();
    render(<App />);
    const themeBtn = screen.getByRole('button', { name: '切换主题' });
    expect(useCmapStore.getState().doc.config.theme).toBe('default');
    expect(themeBtn).toHaveAttribute('aria-pressed', 'false');

    await user.click(themeBtn);
    expect(useCmapStore.getState().doc.config.theme).toBe('dark');
    expect(themeBtn).toHaveAttribute('aria-pressed', 'true');

    await user.click(themeBtn);
    expect(useCmapStore.getState().doc.config.theme).toBe('default');
  });

  it('选中概念节点后 A+/A- 调节字号', async () => {
    const user = userEvent.setup();
    render(<App />);
    fireEvent.dblClick(document.querySelector('.react-flow__pane')!, { clientX: 300, clientY: 200 });
    expect(useCmapStore.getState().doc.concepts[0].style.fontSize).toBe(16);

    await user.click(screen.getByRole('button', { name: '增大字号' }));
    expect(useCmapStore.getState().doc.concepts[0].style.fontSize).toBe(18);

    await user.click(screen.getByRole('button', { name: '减小字号' }));
    expect(useCmapStore.getState().doc.concepts[0].style.fontSize).toBe(16);
  });

  it('选中连词节点后样式面板作用于连词（配色+字号）', async () => {
    const user = userEvent.setup();
    // 预置：两个概念 + 一条带连词的命题
    const s = useCmapStore.getState();
    const a = s.addConcept(0, 0, 'A');
    const b = s.addConcept(300, 0, 'B');
    s.addConnection(a.id, b.id);
    const lp = useCmapStore.getState().doc.linkingPhrases[0];
    useCmapStore.getState().setSelectedNodeId(lp.id);

    render(<App />);
    // 连词默认字号 13
    expect(screen.getByText('A+')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '绿' }));
    expect(useCmapStore.getState().doc.linkingPhrases[0].style.fill).toBe('#e8f5e9');

    await user.click(screen.getByRole('button', { name: '增大字号' }));
    expect(useCmapStore.getState().doc.linkingPhrases[0].style.fontSize).toBe(14);
  });
});
