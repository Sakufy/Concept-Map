import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useCmapStore } from '../store/cmapStore';
import { createEmptyDocument } from '../types/cmap';
import { DocTitle } from './DocTitle';

describe('DocTitle 概念图重命名', () => {
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

  it('渲染标题按钮（非编辑态）', () => {
    render(<DocTitle title="我的图" />);
    expect(screen.getByTestId('doc-title')).toBeInTheDocument();
    expect(screen.getByText('我的图')).toBeInTheDocument();
  });

  it('点击进入编辑，输入新标题回车提交到 store', async () => {
    render(<DocTitle title="旧标题" />);
    await userEvent.click(screen.getByTestId('doc-title'));
    const input = screen.getByTestId('doc-title-input');
    await userEvent.clear(input);
    await userEvent.type(input, '新标题');
    await userEvent.keyboard('{Enter}');
    expect(useCmapStore.getState().doc.title).toBe('新标题');
    // 提交后回到按钮态
    expect(screen.queryByTestId('doc-title-input')).not.toBeInTheDocument();
  });

  it('Escape 取消编辑，不写入 store', async () => {
    useCmapStore.setState({ doc: { ...useCmapStore.getState().doc, title: '原始' } });
    render(<DocTitle title="原始" />);
    await userEvent.click(screen.getByTestId('doc-title'));
    const input = screen.getByTestId('doc-title-input');
    await userEvent.clear(input);
    await userEvent.type(input, '不保存');
    await userEvent.keyboard('{Escape}');
    expect(useCmapStore.getState().doc.title).toBe('原始');
    expect(screen.queryByTestId('doc-title-input')).not.toBeInTheDocument();
  });

  it('空文本提交回退默认名', async () => {
    render(<DocTitle title="旧标题" />);
    await userEvent.click(screen.getByTestId('doc-title'));
    const input = screen.getByTestId('doc-title-input');
    await userEvent.clear(input);
    await userEvent.keyboard('{Enter}');
    expect(useCmapStore.getState().doc.title).toBe('未命名概念图');
  });
});
