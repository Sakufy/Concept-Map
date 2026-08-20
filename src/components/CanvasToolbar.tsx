import { useCallback } from 'react';
import { Panel, useReactFlow } from '@xyflow/react';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { useCmapStore, type ToolMode } from '../store/cmapStore';
import { applyAutoLayout } from '../layout';
import { NodeStylePanel } from './NodeStylePanel';
import { exportCanvasToPng } from '../exportImage';

const TOOL_OPTIONS: { mode: ToolMode; label: string; icon: string }[] = [
  { mode: 'pan', label: '平移', icon: '✋' },
  { mode: 'select', label: '框选', icon: '▭' },
];

export function CanvasToolbar() {
  const toolMode = useCmapStore((s) => s.toolMode);
  const setToolMode = useCmapStore((s) => s.setToolMode);
  const viewport = useCmapStore((s) => s.viewport);
  // 任意选中（概念/连词）即显示样式面板；面板内部按节点类型分发
  const hasSelection = useCmapStore((s) => s.selectedNodeIds.length > 0);
  const pathMode = useCmapStore((s) => s.pathMode);
  const setDoc = useCmapStore((s) => s.setDoc);
  const { fitView, getNodes, getNodesBounds } = useReactFlow();
  const doc = useCmapStore((s) => s.doc);

  /** dagre 一键分层布局：写回 doc 产生一步撤销历史（zundo 对 doc 做快照） */
  const handleAutoLayout = useCallback(() => {
    const state = useCmapStore.getState();
    setDoc(applyAutoLayout(state.doc));
  }, [setDoc]);

  /** 焦点路径模式：点击节点选起点 → 选终点，高亮最短路径 + 顺序编号 */
  const handleTogglePathMode = useCallback(() => {
    useCmapStore.getState().setPathMode(!useCmapStore.getState().pathMode);
  }, []);

  // 撤销/重做（zundo temporal：官方 React 用法 —— zustand/traditional 将 vanilla temporal store 转为 hook）
  const canUndo = useStoreWithEqualityFn(
    useCmapStore.temporal,
    (s) => s.pastStates.length > 0,
  );
  const canRedo = useStoreWithEqualityFn(
    useCmapStore.temporal,
    (s) => s.futureStates.length > 0,
  );
  const handleUndo = useCallback(() => useCmapStore.temporal.getState().undo(), []);
  const handleRedo = useCallback(() => useCmapStore.temporal.getState().redo(), []);

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.2, duration: 200 });
  }, [fitView]);

  /** PNG 导出：整画布截图下载（交作业/分享同学场景） */
  const handleExportPng = useCallback(async () => {
    try {
      const nodes = getNodes();
      // 用 hook 的 getNodesBounds：嵌入式子节点（sub flows）下边界计算才准确
      const bounds = getNodesBounds(nodes);
      await exportCanvasToPng(nodes, viewport, doc.title, bounds);
    } catch (err) {
      alert(err instanceof Error ? err.message : '导出 PNG 失败');
    }
  }, [getNodes, getNodesBounds, viewport, doc.title]);

  return (
    <Panel position="top-center" className="cm-toolbar">
      <div className="cm-toolbar__group">
        {TOOL_OPTIONS.map((opt) => (
          <button
            key={opt.mode}
            type="button"
            className={`cm-toolbar__btn${toolMode === opt.mode ? ' is-active' : ''}`}
            title={opt.label}
            aria-pressed={toolMode === opt.mode}
            onClick={() => setToolMode(opt.mode)}
          >
            <span className="cm-toolbar__icon" aria-hidden>
              {opt.icon}
            </span>
            <span className="cm-toolbar__label">{opt.label}</span>
          </button>
        ))}
        <button
          type="button"
          className={`cm-toolbar__btn${pathMode ? ' is-active' : ''}`}
          title={
            pathMode
              ? '焦点路径模式：依次点击起点与终点节点，高亮最短路径'
              : '焦点路径：高亮从起点到终点的最短路径并编号'
          }
          aria-pressed={pathMode}
          data-testid="path-mode-btn"
          onClick={handleTogglePathMode}
        >
          <span className="cm-toolbar__icon" aria-hidden>
            ⚡
          </span>
          <span className="cm-toolbar__label">{pathMode ? '路径中' : '路径'}</span>
        </button>
      </div>
      {hasSelection && (
        <div className="cm-toolbar__group">
          <NodeStylePanel />
        </div>
      )}
      <div className="cm-toolbar__group">
        <button
          type="button"
          className="cm-toolbar__btn"
          title="撤销 (Ctrl+Z)"
          aria-label="撤销"
          disabled={!canUndo}
          onClick={handleUndo}
        >
          <span className="cm-toolbar__icon" aria-hidden>
            ↩
          </span>
          <span className="cm-toolbar__label">撤销</span>
        </button>
        <button
          type="button"
          className="cm-toolbar__btn"
          title="重做 (Ctrl+Shift+Z)"
          aria-label="重做"
          disabled={!canRedo}
          onClick={handleRedo}
        >
          <span className="cm-toolbar__icon" aria-hidden>
            ↪
          </span>
          <span className="cm-toolbar__label">重做</span>
        </button>
      </div>
      <div className="cm-toolbar__group">
        <button
          type="button"
          className="cm-toolbar__btn"
          title="dagre 分层自动布局（可撤销）"
          disabled={doc.concepts.length === 0}
          data-testid="auto-layout-btn"
          onClick={handleAutoLayout}
        >
          <span className="cm-toolbar__icon" aria-hidden>
            ▦
          </span>
          <span className="cm-toolbar__label">整理</span>
        </button>
        <button
          type="button"
          className="cm-toolbar__btn"
          title="适应视图"
          onClick={handleFitView}
        >
          <span className="cm-toolbar__icon" aria-hidden>
            ⤢
          </span>
          <span className="cm-toolbar__label">适应</span>
        </button>
        <button
          type="button"
          className="cm-toolbar__btn"
          title="导出当前概念图为 PNG 图片"
          onClick={handleExportPng}
          data-testid="export-png-btn"
        >
          <span className="cm-toolbar__icon" aria-hidden>
            ⤓
          </span>
          <span className="cm-toolbar__label">PNG</span>
        </button>
        <span className="cm-toolbar__zoom">{Math.round(viewport.zoom * 100)}%</span>
      </div>
    </Panel>
  );
}
