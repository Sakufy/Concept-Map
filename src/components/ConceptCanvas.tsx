import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  Controls,
  useReactFlow,
  MarkerType,
  ConnectionMode,
  useStore,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type OnConnectStart,
  type NodeChange,
  type EdgeChange,
  type OnNodeDrag,
  type OnBeforeDelete,
} from '@xyflow/react';
import { shallow } from 'zustand/shallow';
import { useCmapStore } from '../store/cmapStore';
import { findFocusPath, type FocusPathResult } from '../path';
import { findClosestEdgePoints, type RectLike } from '../geometry';
import { ConceptNode } from './ConceptNode';
import { LinkingPhraseNode } from './LinkingPhraseNode';
import { ConnectionEdge, type ConnectionEdgeData } from './ConnectionEdge';
import { CanvasToolbar } from './CanvasToolbar';
import { MapStats } from './MapStats';

/**
 * 渲染层：概念节点 + 连词节点（独立小节点，对齐 Lynkage 最终形态）
 * + 连接线（命题由「概念→连词」「连词→概念」两段组成）。
 * 数据层保持三元组结构，此处做「渲染模型 ↔ 数据模型」的双向映射。
 */

/** 模块级注册（React Flow 要求 nodeTypes / edgeTypes 引用稳定） */
const nodeTypes: NodeTypes = { concept: ConceptNode, linkingPhrase: LinkingPhraseNode };
const edgeTypes: EdgeTypes = { connection: ConnectionEdge };

/** 节点/连词的路径角色（连线清晰度专项：焦点路径高亮 / 其余淡化） */
export type PathRole = 'on-path' | 'dimmed' | undefined;

/** 焦点路径视图态（纯视图，不进撤销历史；result 为 BFS 结果或 null） */
export type PathViewState = {
  mode: boolean;
  rootId: string | null;
  targetId: string | null;
  result: FocusPathResult | null;
};

function toFlowNodes(
  concepts: ReturnType<typeof useCmapStore.getState>['doc']['concepts'],
  linkingPhrases: ReturnType<typeof useCmapStore.getState>['doc']['linkingPhrases'],
  selectedNodeIds: string[],
  pathState: PathViewState,
): Node[] {
  const parentIds = new Set(
    concepts.filter((c) => c.parentId !== null).map((c) => c.parentId as string),
  );
  // 完整路径存在 → 非路径元素整体淡化；否则（仅起点选中）只高亮起点提示
  const roleOf = (id: string): PathRole => {
    if (pathState.result) return pathState.result.nodeIds.has(id) ? 'on-path' : 'dimmed';
    if (pathState.mode && pathState.rootId === id) return 'on-path';
    return undefined;
  };
  const conceptNodes: Node[] = concepts.map((c) => {
    // 嵌入式子节点：React Flow 原生 parentId + extent:'parent'（数据层存相对父坐标）。
    // extent 让常规拖拽约束在父节点内；Alt 拖出/换父在 drag stop 按指针位置判定。
    const isChild = c.parentId !== null;
    const flowNode: Node = {
      id: c.id,
      type: 'concept',
      position: { x: c.x, y: c.y },
      // 尺寸不传入（React Flow 自动测量）：节点框随内容自适应
      // （官方 auto-size 模式：实测尺寸 measured 驱动连线与布局，文本变化自动跟随）
      selected: selectedNodeIds.includes(c.id),
      data: {
        text: c.text,
        fill: c.style.fill,
        borderColor: c.style.borderColor,
        fontSize: c.style.fontSize,
        embedded: isChild,
        hasChildren: parentIds.has(c.id),
        pathRole: roleOf(c.id),
      },
    };
    if (isChild) {
      flowNode.parentId = c.parentId as string;
      flowNode.extent = 'parent';
    }
    return flowNode;
  });
  const lpNodes: Node[] = linkingPhrases.map((lp) => ({
    id: lp.id,
    type: 'linkingPhrase',
    position: { x: lp.x, y: lp.y },
    // 同概念节点：不传尺寸，随文字自适应
    selected: selectedNodeIds.includes(lp.id),
    data: {
      text: lp.text,
      fill: lp.style.fill,
      borderColor: lp.style.borderColor,
      fontSize: lp.style.fontSize,
      pathRole: roleOf(lp.id),
    },
  }));
  return [...conceptNodes, ...lpNodes];
}

function toFlowEdges(
  connections: ReturnType<typeof useCmapStore.getState>['doc']['connections'],
  selectedEdgeId: string | null,
  pathState: PathViewState,
  rectOf?: (id: string) => RectLike | null,
): Edge[] {
  const pathInfo = pathState.result;
  const pathEdgeSet = pathInfo ? new Set(pathInfo.edgeIds) : null;
  const dimAll = pathInfo !== null;
  return connections.map((conn) => {
    const isPath = pathEdgeSet?.has(conn.id) ?? false;
    const isDimmed = dimAll && !isPath;
    const pathOrder = isPath ? (pathInfo?.edgeIds.indexOf(conn.id) ?? 0) + 1 : null;
    // 动态吸附端点：两端节点矩形均可用时按「边界上最短距离」计算起止点
    // （连接线最短吸附专项）；任一端未测量完成时返回 null，走 React Flow 默认 Handle。
    let points: ConnectionEdgeData['points'] = null;
    if (rectOf) {
      const a = rectOf(conn.fromId);
      const b = rectOf(conn.toId);
      if (a && b) {
        const { sx, sy, tx, ty } = findClosestEdgePoints(a, b);
        points = { sx, sy, tx, ty };
      }
    }
    return {
      id: conn.id,
      source: conn.fromId,
      target: conn.toId,
      type: 'connection',
      selected: conn.id === selectedEdgeId,
      data: {
        viaId: conn.viaId,
        isPath,
        isDimmed,
        pathOrder,
        points,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: isPath ? '#2563eb' : isDimmed ? '#cbd5e1' : '#c3cbda',
        width: 14,
        height: 14,
      },
    };
  });
}

export function ConceptCanvas() {
  const {
    doc,
    addConcept,
    addConnection,
    setViewport,
    toolMode,
    selectedNodeIds,
    selectedEdgeId,
    pathMode,
    pathRootId,
    pathTargetId,
  } = useCmapStore();
  const { screenToFlowPosition, getInternalNode, fitView } = useReactFlow();
  // 订阅 React Flow 内部节点（含实测尺寸与绝对坐标）。
  // 注意：nodeLookup 是原地 mutate 的 Map（引用不变），直接订阅 Map 引用不会在测量/位置
  // 更新时触发重渲染；官方模式（useNodes / useInternalNode 同款）是「选择器返回节点数组 +
  // shallow 逐元素比较」——内部节点对象被替换（测量/位置更新）时数组元素变化才触发重算。
  const internalNodes = useStore(
    useCallback((s) => Array.from(s.nodeLookup.values()), []),
    shallow,
  );
  // 记录连接开始时的修饰键状态（Ctrl/Cmd+Shift → 直连，不创建连词）
  const directConnectRef = useRef(false);
  // Alt 键状态（嵌入式节点拖入/拖出；keydown/keyup 跟踪，drag stop 时判断）
  const altRef = useRef(false);
  // 主题：深色/浅色背景（写入 doc.config，随文档持久化）
  const isDark = doc.config.theme === 'dark';

  // dev 模式下暴露 store，方便浏览器冒烟脚本直接操作数据而无需模拟大量 UI 交互
  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as { __cmapStore?: typeof useCmapStore }).__cmapStore = useCmapStore;
    }
  }, []);

  // 节点尺寸随内容异步测量：等全部节点测量完成后重新 fit 一次，
  // 否则首屏 fitView 会把未测量（0 尺寸）的节点算错视口
  useEffect(() => {
    let raf = 0;
    const tryFit = () => {
      const d = useCmapStore.getState().doc;
      const all = [...d.concepts, ...d.linkingPhrases];
      if (all.length === 0) return;
      const ready = all.every((n) => {
        const internal = getInternalNode(n.id);
        return internal != null && (internal.measured?.width ?? 0) > 0;
      });
      if (ready) {
        fitView({ padding: 0.1, duration: 0 });
      } else {
        raf = requestAnimationFrame(tryFit);
      }
    };
    raf = requestAnimationFrame(tryFit);
    return () => cancelAnimationFrame(raf);
  }, [fitView, getInternalNode]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Alt') altRef.current = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Alt') altRef.current = false;
    };
    const blur = () => {
      altRef.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  // 焦点路径视图态：BFS 沿有向 connection 找最短路径（含连词节点），纯视图不进撤销历史
  const pathState: PathViewState = useMemo(() => {
    const base = { mode: pathMode, rootId: pathRootId, targetId: pathTargetId };
    if (!pathMode || !pathRootId || !pathTargetId) return { ...base, result: null };
    return { ...base, result: findFocusPath(doc, pathRootId, pathTargetId) };
  }, [doc, pathMode, pathRootId, pathTargetId]);

  const nodes = useMemo(
    () => toFlowNodes(doc.concepts, doc.linkingPhrases, selectedNodeIds, pathState),
    [doc.concepts, doc.linkingPhrases, selectedNodeIds, pathState],
  );
  // 内部节点按 id 建索引（数组随测量/位置更新变化 → 触发 edges 重算）
  const internalById = useMemo(
    () => new Map(internalNodes.map((n) => [n.id, n])),
    [internalNodes],
  );
  // 取某节点当前的实测矩形（绝对坐标 + 实测尺寸）；未测量完成返回 null
  const rectOf = useCallback(
    (id: string): RectLike | null => {
      const n = internalById.get(id);
      if (!n) return null;
      const w = n.measured?.width ?? 0;
      const h = n.measured?.height ?? 0;
      if (!w || !h) return null;
      const pos = n.internals?.positionAbsolute;
      if (!pos) return null;
      return { x: pos.x, y: pos.y, w, h };
    },
    [internalById],
  );
  const edges = useMemo(
    () => toFlowEdges(doc.connections, selectedEdgeId, pathState, rectOf),
    [doc.connections, selectedEdgeId, pathState, rectOf],
  );

  const onNodesChange: OnNodesChange = useCallback((changes: NodeChange[]) => {
    const state = useCmapStore.getState();
    const { concepts, linkingPhrases } = state.doc;
    const isLp = (id: string) => linkingPhrases.some((lp) => lp.id === id);
    const isConcept = (id: string) => concepts.some((c) => c.id === id);

    // 选中变化（单击/框选/Ctrl+多选）→ 累积到集合后一次性同步，支持多选
    let selectionChanged = false;
    const selectedSet = new Set(state.selectedNodeIds);
    for (const change of changes) {
      if (change.type === 'select') {
        selectionChanged = true;
        if (change.selected) {
          selectedSet.add(change.id);
        } else {
          selectedSet.delete(change.id);
        }
      }
    }
    if (selectionChanged) {
      state.setSelectedNodeIds([...selectedSet]);
    }

    for (const change of changes) {
      // 位置变化（拖拽）→ 同步回数据层（概念或连词）
      if (change.type === 'position' && change.position) {
        if (isLp(change.id)) {
          state.updateLinkingPhrasePosition(change.id, change.position.x, change.position.y);
        } else if (isConcept(change.id)) {
          state.updateConcept(change.id, { x: change.position.x, y: change.position.y });
        }
      }
      // 删除（Delete/Backspace）→ 走 store 级联清理
      if (change.type === 'remove') {
        if (isLp(change.id)) {
          state.removeLinkingPhrases([change.id]);
        } else if (isConcept(change.id)) {
          state.removeConcepts([change.id]);
        }
      }
    }
  }, []);

  const onEdgesChange: OnEdgesChange = useCallback((changes: EdgeChange[]) => {
    for (const change of changes) {
      // 选中变化（单击连线）→ 同步 store.selectedEdgeId（单选）
      if (change.type === 'select') {
        const state = useCmapStore.getState();
        if (change.selected) {
          state.setSelectedEdgeId(change.id);
        } else if (state.selectedEdgeId === change.id) {
          state.setSelectedEdgeId(null);
        }
      }
      // 删除（Delete/Backspace）→ 整条命题（两段边 + 连词）级联删除
      if (change.type === 'remove') {
        useCmapStore.getState().removeConnections([change.id]);
      }
    }
  }, []);

  const onConnectStart: OnConnectStart = useCallback((event) => {
    // 记录 Ctrl/Cmd + Shift 修饰键（直连：不创建连词）
    directConnectRef.current = (event.ctrlKey || event.metaKey) && event.shiftKey;
  }, []);

  const onConnect: OnConnect = useCallback(
    (params) => {
      // Loose 模式 + 四边全 source Handle：方向恒为「起点节点 → 终点节点」
      const conn = addConnection(params.source, params.target, {
        withLinkingPhrase: !directConnectRef.current,
      });
      directConnectRef.current = false; // 复位
      // 新建连词即编辑（对齐「新建概念即编辑」）：选中新连词并进入编辑态
      if (conn.viaId) {
        const state = useCmapStore.getState();
        state.setSelectedNodeId(conn.viaId);
        state.setEditingLpId(conn.viaId);
      }
    },
    [addConnection],
  );

  // ---- 嵌入式节点：Alt + 拖拽 拖入/拖出父节点（对齐 Lynkage） ----
  // 子节点始终带 extent:'parent'（拖拽约束在父节点内），拖入/拖出在 drag stop 按指针位置判定，
  // 避免拖拽中途改节点属性触发 React Flow 重新初始化（error#015 警告）。
  // 撤销历史合并：拖拽（含 Alt 嵌套处理）期间 zundo 暂停记录，结束后只写回一条「拖前」快照，
  // 让一次拖拽 = 一步 Ctrl+Z，而不是每次 position change 一步历史（否则 100 步 limit 被拖拽吃光）。
  const dragStartDocRef = useRef<ReturnType<typeof useCmapStore.getState>['doc'] | null>(null);
  const onNodeDragStart: OnNodeDrag = useCallback(() => {
    dragStartDocRef.current = useCmapStore.getState().doc;
    useCmapStore.temporal.getState().pause();
  }, []);

  const onNodeDragStop: OnNodeDrag = useCallback(
    (event, node, nodes) => {
      const state = useCmapStore.getState();

      // 多选拖拽不做嵌套/提升处理（保持整体移动语义）
      if (nodes.length === 1 && altRef.current) {
        const concept = state.doc.concepts.find((c) => c.id === node.id);
        const internal = getInternalNode(node.id);
        if (concept && internal) {
          // 指针的 flow 坐标：extent 约束期间节点位置≠指针位置，用它判断"拖出到哪"
          // （TouchEvent 无 clientX，Alt 为桌面端交互，取首触点兜底）
          const clientX = 'clientX' in event ? event.clientX : (event.touches[0]?.clientX ?? 0);
          const clientY = 'clientY' in event ? event.clientY : (event.touches[0]?.clientY ?? 0);
          const pos = screenToFlowPosition({ x: clientX, y: clientY });
          // 父节点命中测试用 React Flow 实测尺寸（数据层 w/h 已随自动测量过期）
          const parentSizeOf = (p: (typeof state.doc.concepts)[number]) => {
            const internal = getInternalNode(p.id);
            return {
              w: internal?.measured?.width ?? p.w,
              h: internal?.measured?.height ?? p.h,
            };
          };
          let target: (typeof state.doc.concepts)[number] | undefined;
          for (const p of state.doc.concepts) {
            if (p.id === concept.id || p.parentId !== null) continue;
            const size = parentSizeOf(p);
            if (pos.x >= p.x && pos.x <= p.x + size.w && pos.y >= p.y && pos.y <= p.y + size.h) {
              target = p;
              break;
            }
          }

          if (concept.parentId) {
            // 已是子节点：Alt 拖到其他顶层概念 → 换父；拖到空白 → 提升为顶层（放到指针处）
            if (target && target.id !== concept.parentId) {
              state.setConceptParent(concept.id, target.id, undefined, parentSizeOf(target));
            } else if (!target) {
              state.setConceptParent(concept.id, null, pos);
            }
            // 指针仍在原父节点内：extent 已约束位置，无需处理
          } else if (target) {
            // 顶层节点：Alt 拖入父节点
            state.setConceptParent(concept.id, target.id, undefined, parentSizeOf(target));
          }
        }
      }

      // 撤销历史合并（见 onNodeDragStart 注释）：
      // 1) pause 中把 doc 写回「拖前」引用（不记录）；2) resume；3) 写回「拖后」最终引用。
      // zundo 记录的是「set 前状态」，因此最终只追加一条「拖前」快照，undo 一次回到拖前。
      const docBefore = dragStartDocRef.current;
      const docFinal = useCmapStore.getState().doc;
      dragStartDocRef.current = null;
      useCmapStore.temporal.getState().pause(); // 兜底：确保合并期间仍处于暂停
      if (docBefore && docBefore !== docFinal) {
        state.setDoc(docBefore);
        useCmapStore.temporal.getState().resume();
        state.setDoc(docFinal);
      } else {
        // 拖拽无实际变化（点击未移动）：仅恢复跟踪
        useCmapStore.temporal.getState().resume();
      }
    },
    [getInternalNode, screenToFlowPosition],
  );

  // 删除父节点时保留其子节点（React Flow 默认会级联删除子节点，这里过滤掉）
  const onBeforeDelete: OnBeforeDelete = useCallback(async ({ nodes: toDelete, edges }) => {
    const { doc } = useCmapStore.getState();
    const deletedParentIds = new Set(toDelete.map((n) => n.id));
    const childIds = new Set(
      doc.concepts
        .filter((c) => c.parentId !== null && deletedParentIds.has(c.parentId))
        .map((c) => c.id),
    );
    return { nodes: toDelete.filter((n) => !childIds.has(n.id)), edges };
  }, []);

  const handlePaneClick = useCallback(() => {
    const state = useCmapStore.getState();
    state.setSelectedNodeIds([]);
    state.setSelectedEdgeId(null);
    // 焦点路径模式下点击空白：清空选择重新开始（保持路径模式）
    if (state.pathMode) state.clearPathSelection();
  }, []);

  // 焦点路径模式下的节点点击：第一次设起点，第二次设终点（再点其他节点替换终点）
  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    const state = useCmapStore.getState();
    if (!state.pathMode) return;
    if (!state.pathRootId) {
      state.setPathRoot(node.id);
    } else if (node.id === state.pathRootId) {
      state.setPathTarget(null); // 点击起点 → 取消终点选择，重新选终点
    } else {
      state.setPathTarget(node.id);
    }
  }, []);

  const handleDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      // React Flow 无 pane 级 onDoubleClick，该 prop 经 `...rest` 透传到 wrapper div，
      // 双击节点会冒泡至此，需跳过（编辑交给 onNodeDoubleClick）
      const target = event.target as HTMLElement;
      if (target.closest('.react-flow__node')) return;

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const concept = addConcept(position.x, position.y);
      // 新建即编辑：选中 + 进入文本编辑态
      useCmapStore.getState().setSelectedNodeId(concept.id);
      useCmapStore.getState().setEditingId(concept.id);
    },
    [addConcept, screenToFlowPosition],
  );

  const handleNodeDoubleClick = useCallback((_event: React.MouseEvent, node: Node) => {
    const state = useCmapStore.getState();
    const isLp = state.doc.linkingPhrases.some((lp) => lp.id === node.id);
    state.setSelectedNodeId(node.id);
    if (isLp) {
      state.setEditingLpId(node.id);
    } else {
      state.setEditingId(node.id);
    }
  }, []);

  // 移动端双击（double-tap）建节点：触摸不派发 dblclick，按通用模式手动检测
  const lastTapRef = useRef<{ t: number; x: number; y: number } | null>(null);
  const handlePaneTouchStart = useCallback(
    (event: React.TouchEvent) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      const now = Date.now();
      const prev = lastTapRef.current;
      if (
        prev &&
        now - prev.t < 300 &&
        Math.hypot(touch.clientX - prev.x, touch.clientY - prev.y) < 30
      ) {
        lastTapRef.current = null;
        const target = event.target as HTMLElement;
        if (target.closest('.react-flow__node')) return;
        const position = screenToFlowPosition({ x: touch.clientX, y: touch.clientY });
        const concept = addConcept(position.x, position.y);
        useCmapStore.getState().setSelectedNodeId(concept.id);
        useCmapStore.getState().setEditingId(concept.id);
      } else {
        lastTapRef.current = { t: now, x: touch.clientX, y: touch.clientY };
      }
    },
    [addConcept, screenToFlowPosition],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onConnectStart={onConnectStart}
      // 嵌入式节点：Alt+拖拽 拖入/拖出；删除父节点时子节点提升为顶层
      onNodeDragStart={onNodeDragStart}
      onNodeDragStop={onNodeDragStop}
      onBeforeDelete={onBeforeDelete}
      // 整节点可拖线：Loose 模式允许任意 Handle 作为起点/终点；connectionRadius 加大吸附容错
      connectionMode={ConnectionMode.Loose}
      connectionRadius={24}
      connectionLineStyle={{ stroke: '#93c5fd', strokeWidth: 1.5, strokeDasharray: '6 4' }}
      onPaneClick={handlePaneClick}
      onDoubleClick={handleDoubleClick}
      onTouchStart={handlePaneTouchStart}
      onNodeClick={handleNodeClick}
      onNodeDoubleClick={handleNodeDoubleClick}
      onMove={(_event, viewport) => setViewport(viewport)}
      // 路径模式需要可靠地点击节点设起点/终点，临时禁用节点拖拽与画布平移拖拽，
      // 避免 React Flow 把 click 识别为拖拽起始而吞掉 onNodeClick。
      nodesDraggable={!pathMode}
      panOnDrag={toolMode === 'pan' && !pathMode}
      selectionOnDrag={toolMode === 'select' && !pathMode}
      panOnScroll={false}
      zoomOnScroll
      zoomOnPinch
      zoomOnDoubleClick={false}
      minZoom={0.2}
      maxZoom={2.5}
      fitView
      deleteKeyCode={['Backspace', 'Delete']}
      className={`cm-canvas${isDark ? ' is-dark' : ''}`}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={28}
        size={1.2}
        color={isDark ? '#334155' : '#d8dde5'}
      />
      <MiniMap
        pannable
        zoomable
        className="cm-canvas__minimap"
        nodeColor={(node) => {
          const concept = doc.concepts.find((c) => c.id === node.id);
          if (concept) return concept.style.fill;
          return '#94a3b8'; // 连词节点：灰色
        }}
        maskColor={isDark ? 'rgba(15, 23, 42, 0.5)' : 'rgba(15, 23, 42, 0.06)'}
      />
      <Controls showInteractive={false} />
      <CanvasToolbar />
      <MapStats />
    </ReactFlow>
  );
}
