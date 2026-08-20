import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useCmapStore } from '../store/cmapStore';
import { createEmptyDocument } from '../types/cmap';
import { NodeEditModal } from './NodeEditModal';

describe('NodeEditModal 右键弹窗编辑', () => {
  beforeEach(() => {
    useCmapStore.setState({
      doc: createEmptyDocument(),
      selectedNodeIds: [],
      selectedEdgeId: null,
      editingId: null,
      editingLpId: null,
      editModalTarget: null,
    });
    useCmapStore.temporal.getState().clear();
  });

  function seedConcept(text = '光合作用') {
    const c = useCmapStore.getState().addConcept(0, 0, text);
    useCmapStore.getState().setEditModalTarget({ type: 'concept', id: c.id });
    return c;
  }

  it('打开弹窗显示节点文本，可编辑并保存', async () => {
    const user = userEvent.setup();
    const c = seedConcept('光合作用');
    render(<NodeEditModal />);

    const area = screen.getByTestId('edit-modal-area') as HTMLTextAreaElement;
    expect(area.value).toBe('光合作用');

    await user.clear(area);
    await user.type(area, '光合作用\n- 光反应\n- 暗反应');
    await user.click(screen.getByTestId('edit-modal-save'));

    const updated = useCmapStore.getState().doc.concepts.find((x) => x.id === c.id)!;
    expect(updated.text).toBe('光合作用\n- 光反应\n- 暗反应');
    expect(useCmapStore.getState().editModalTarget).toBeNull();
  });

  it('预览 tab 渲染 Markdown', async () => {
    const user = userEvent.setup();
    seedConcept('**加粗** 和 `代码`');
    render(<NodeEditModal />);

    await user.click(screen.getByText('预览'));
    expect(screen.getByTestId('edit-modal-preview')).toBeInTheDocument();
    expect(screen.getByText('加粗').tagName).toBe('STRONG');
  });

  it('取消关闭弹窗且不修改文本', async () => {
    const user = userEvent.setup();
    const c = seedConcept('原始文本');
    render(<NodeEditModal />);

    const area = screen.getByTestId('edit-modal-area') as HTMLTextAreaElement;
    await user.clear(area);
    await user.type(area, '改过的文本');
    await user.click(screen.getByTestId('edit-modal-cancel'));

    const doc = useCmapStore.getState().doc;
    expect(doc.concepts.find((x) => x.id === c.id)!.text).toBe('原始文本');
    expect(useCmapStore.getState().editModalTarget).toBeNull();
  });

  it('空文本保存时回退为 ???', async () => {
    const user = userEvent.setup();
    const c = seedConcept('会被清空');
    render(<NodeEditModal />);

    const area = screen.getByTestId('edit-modal-area') as HTMLTextAreaElement;
    await user.clear(area);
    await user.click(screen.getByTestId('edit-modal-save'));

    const updated = useCmapStore.getState().doc.concepts.find((x) => x.id === c.id)!;
    expect(updated.text).toBe('???');
  });

  it('未设置目标时不渲染', () => {
    render(<NodeEditModal />);
    expect(screen.queryByTestId('edit-modal-area')).toBeNull();
  });
});
