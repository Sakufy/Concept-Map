/**
 * PNG 导出：画布截图下载（照搬 React Flow 官方「Export Image」示例方案）。
 * - 用 html-to-image 的 `toPng` 截取 `.react-flow__viewport`（整画布内容层）
 * - 以所有节点边界 + 当前 viewport.zoom 计算导出尺寸，保证全图完整、不裁切
 */
import { getNodesBounds, type Node } from '@xyflow/react';
import type { Viewport } from './store/cmapStore';

/** 导出的最大宽度（px，防止超大图生成巨量像素） */
const MAX_WIDTH = 4096;

export async function exportCanvasToPng(
  nodes: Node[],
  viewport: Viewport,
  title: string,
  bounds?: { x: number; y: number; width: number; height: number },
): Promise<void> {
  if (nodes.length === 0) {
    throw new Error('画布是空的，先添加一些节点再导出');
  }
  const viewportEl = document.querySelector<HTMLElement>('.react-flow__viewport');
  if (!viewportEl) throw new Error('画布元素不存在');

  // 优先用 React Flow hook 的 getNodesBounds（支持嵌入式子节点 sub flows）；
  // 未提供时 fallback 到直接 import 版本（单测/无子节点场景）
  const b = bounds ?? getNodesBounds(nodes);
  const width = Math.min(b.width / viewport.zoom, MAX_WIDTH);
  const height = b.height / viewport.zoom;

  // 动态导入：html-to-image 仅在用户点「PNG」时才加载（减小首屏包体）
  const { toPng } = await import('html-to-image');
  const dataUrl = await toPng(viewportEl, {
    backgroundColor: '#ffffff',
    width,
    height,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${b.x}px, ${b.y}px) scale(${viewport.zoom})`,
    },
  });

  const a = document.createElement('a');
  a.download = `${title || '概念图'}.png`;
  a.href = dataUrl;
  a.click();
}
