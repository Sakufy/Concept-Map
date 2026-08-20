/**
 * 画布工具栏（清爽版）：三段式卡片。
 * - 左组：视图工具（平移 / 框选）——纯图标 + tooltip，互斥单选
 * - 中组：选中节点样式面板（颜色 / 字号，仅单选节点时显示）
 * - 右组：编辑与视图操作（撤销 / 重做 / 焦点路径 / 整理 / 适应 / PNG 导出）
 * 缩放读数已移除（左下角由 React Flow 官方 <Controls> 承担）。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Panel, useReactFlow } from '@xyflow/react';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { useCmapStore, type ToolMode } from '../store/cmapStore';
import { applyAutoLayout } from '../layout';
import { NodeStylePanel } from './NodeStylePanel';
import { exportCanvasToPng } from '../exportImage';
import {
  IconDownload,
  IconHand,
  IconLayoutGrid,
  IconMaximize2,
  IconMousePointer2,
  IconRedo2,
  IconRoute,
  IconUndo2,
} from './icons';

const TOOL_OPTIONS: { mode: ToolMode; label: string; icon: React.ReactNode }[] = [
  { mode: 'pan', label: '平移', icon: <IconHand /> },
  { mode: 'select', label: '框选', icon: <IconMousePointer2 /> },
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

  /** PNG 导出失败提示（toast，避免 alert 打断） */
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 3000);
    return () => clearTimeout(t);
  }, [toastMsg]);

  /** 整理下拉（分层整理 / 整理并适应） */
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const layoutRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!layoutMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (layoutRef.current && !layoutRef.current.contains(e.target as Node)) {
        setLayoutMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLayoutMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [layoutMenuOpen]);

  /** dagre 一键分层布局：写回 doc 产生一步撤销历史（zundo 对 doc 做快照） */
  const handleAutoLayout = useCallback(
    (fit = false) => {
      setLayoutMenuOpen(false);
      const state = useCmapStore.getState();
      setDoc(applyAutoLayout(state.doc));
      if (fit) {
        requestAnimationFrame(() => fitView({ padding: 0.15, duration: 200 }));
      }
    },
    [setDoc, fitView],
  );

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
    fitView({ padding: 0.15, duration: 200 });
  }, [fitView]);

  /** PNG 导出：整画布截图下载（交作业/分享同学场景） */
  const handleExportPng = useCallback(async () => {
    try {
      const nodes = getNodes();
      // 用 hook 的 getNodesBounds：嵌入式子节点（sub flows）下边界计算才准确
      const bounds = getNodesBounds(nodes);
      await exportCanvasToPng(nodes, viewport, doc.title, bounds);
    } catch (err) {
      setToastMsg(err instanceof Error ? `导出失败：${err.message}` : '导出 PNG 失败');
    }
  }, [getNodes, getNodesBounds, viewport, doc.title]);

  return (
    <Panel position="top-center" className="cm-toolbar">
      {/* 左：视图工具（纯图标，互斥单选） */}
      <div className="cm-toolbar__group" role="group" aria-label="视图工具">
        {TOOL_OPTIONS.map((opt) => (
          <button
            key={opt.mode}
            type="button"
            className={`cm-toolbar__btn${toolMode === opt.mode ? ' is-active' : ''}`}
            title={opt.label}
            aria-label={opt.label}
            aria-pressed={toolMode === opt.mode}
            data-testid={`tool-${opt.mode}`}
            onClick={() => setToolMode(opt.mode)}
          >
            {opt.icon}
          </button>
        ))}
      </div>

      {/* 中：选中节点样式（仅单选节点时出现） */}
      {hasSelection && (
        <div className="cm-toolbar__group">
          <NodeStylePanel />
        </div>
      )}

      {/* 右：编辑与视图操作 */}
      <div className="cm-toolbar__group">
        <button
          type="button"
          className="cm-toolbar__btn"
          title="撤销 (Ctrl+Z)"
          aria-label="撤销"
          disabled={!canUndo}
          onClick={handleUndo}
        >
          <IconUndo2 />
          <span className="cm-toolbar__label">撤销</span>
          <kbd className="cm-toolbar__kbd">Z</kbd>
        </button>
        <button
          type="button"
          className="cm-toolbar__btn"
          title="重做 (Ctrl+Shift+Z)"
          aria-label="重做"
          disabled={!canRedo}
          onClick={handleRedo}
        >
          <IconRedo2 />
          <span className="cm-toolbar__label">重做</span>
          <kbd className="cm-toolbar__kbd">⇧Z</kbd>
        </button>

        <span className="cm-toolbar__split" aria-hidden />

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
          <IconRoute />
          <span className="cm-toolbar__label">{pathMode ? '路径中' : '路径'}</span>
        </button>

        {/* 整理：主按钮执行分层整理，右侧箭头展开下拉（分层 / 整理并适应） */}
        <div className="cm-toolbar__menu-wrap" ref={layoutRef}>
          <button
            type="button"
            className="cm-toolbar__btn"
            title="dagre 分层自动布局（可撤销）"
            disabled={doc.concepts.length === 0}
            data-testid="auto-layout-btn"
            onClick={() => handleAutoLayout(false)}
          >
            <IconLayoutGrid />
            <span className="cm-toolbar__label">整理</span>
          </button>
          <button
            type="button"
            className="cm-toolbar__caret"
            title="整理选项"
            aria-label="整理选项"
            aria-expanded={layoutMenuOpen}
            disabled={doc.concepts.length === 0}
            data-testid="auto-layout-caret"
            onClick={() => setLayoutMenuOpen((v) => !v)}
          >
            <IconChevronDownMini />
          </button>
          {layoutMenuOpen && (
            <div className="cm-toolbar__menu" role="menu">
              <button
                type="button"
                className="cm-toolbar__menu-item"
                onClick={() => handleAutoLayout(false)}
              >
                分层整理
                <span className="cm-toolbar__menu-hint">可撤销</span>
              </button>
              <button
                type="button"
                className="cm-toolbar__menu-item"
                onClick={() => handleAutoLayout(true)}
              >
                整理并适应
                <span className="cm-toolbar__menu-hint">重排后缩放视图</span>
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          className="cm-toolbar__btn"
          title="适应视图"
          onClick={handleFitView}
        >
          <IconMaximize2 />
          <span className="cm-toolbar__label">适应</span>
        </button>

        <span className="cm-toolbar__split" aria-hidden />

        <button
          type="button"
          className="cm-toolbar__btn"
          title="导出当前概念图为 PNG 图片"
          onClick={handleExportPng}
          data-testid="export-png-btn"
        >
          <IconDownload />
          <span className="cm-toolbar__label">PNG</span>
        </button>
      </div>

      {toastMsg && (
        <div className="cm-toast" role="status">
          {toastMsg}
        </div>
      )}
    </Panel>
  );
}

/** 整理下拉的小箭头（复用小尺寸 chevron） */
function IconChevronDownMini() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
