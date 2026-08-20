import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Node } from '@xyflow/react';

const { toPngMock } = vi.hoisted(() => ({
  toPngMock: vi.fn(),
}));
vi.mock('html-to-image', () => ({
  toPng: (...args: unknown[]) => toPngMock(...args),
}));

import { exportCanvasToPng } from './exportImage';

const sampleNodes: Node[] = [
  { id: 'c1', type: 'concept', position: { x: 100, y: 50 }, data: { text: 'A' } },
  { id: 'c2', type: 'concept', position: { x: 400, y: 250 }, data: { text: 'B' } },
];

describe('PNG 导出', () => {
  beforeEach(() => {
    toPngMock.mockReset();
    document.body.innerHTML = '<div class="react-flow__viewport"></div>';
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('空画布时抛出可读错误', async () => {
    await expect(exportCanvasToPng([], { x: 0, y: 0, zoom: 1 }, '空图')).rejects.toThrow('画布是空的');
    expect(toPngMock).not.toHaveBeenCalled();
  });

  it('按节点边界 + 当前 zoom 计算导出尺寸并触发下载', async () => {
    toPngMock.mockResolvedValue('data:image/png;base64,xxx');
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await exportCanvasToPng(sampleNodes, { x: -20, y: -10, zoom: 2 }, '我的图');

    // 节点边界：宽 400-100=300，高 250-50=200；除以 zoom 2 → 150×100
    const [, opts] = toPngMock.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(opts.width).toBe(150);
    expect(opts.height).toBe(100);
    const style = opts.style as Record<string, string>;
    expect(style.transform).toBe('translate(100px, 50px) scale(2)');
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('导出的下载文件名包含地图标题', async () => {
    toPngMock.mockResolvedValue('data:image/png;base64,xxx');
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      // 捕获文件名
      (globalThis as unknown as { __lastDownload?: string }).__lastDownload = this.download;
    });

    await exportCanvasToPng(sampleNodes, { x: 0, y: 0, zoom: 1 }, '生物概念图');
    expect((globalThis as unknown as { __lastDownload?: string }).__lastDownload).toBe('生物概念图.png');
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});
