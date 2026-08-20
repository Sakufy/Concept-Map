/**
 * 概念地图全局状态（Zustand）
 *
 * 撤销/重做：使用 zundo temporal middleware（zustand 生态标准 undo/redo 方案，照搬官方用法）——
 * 只对 doc 做快照，limit 100 步。组件通过 useCmapStore.temporal 读取 past/future。
 */
import { create } from 'zustand';
// 撤销/重做：zundo（zustand 生态的标准 undo/redo middleware，成熟方案照搬）
import { temporal } from 'zundo';
import {
  createEmptyDocument,
  genId,
  type CmapConfig,
  type CmapDocument,
  type Concept,
  type Connection,
  type LinkingPhrase,
} from '../types/cmap';
import { absolutePosition, getAnchor } from '../geometry';

/** 概念节点默认样式 */
export const DEFAULT_CONCEPT_STYLE = {
  fill: '#e3f2fd',
  borderColor: '#1976d2',
  fontSize: 16,
};

/** 连词节点默认样式（Lynkage 风格胶囊） */
export const DEFAULT_LP_STYLE = {
  fill: '#ffffff',
  borderColor: '#94a3b8',
  fontSize: 13,
};

/** 嵌入式子节点尺寸（比父节点小一号，Lynkage 嵌入式节点同样为缩小版） */
export const EMBEDDED_CONCEPT_W = 120;
export const EMBEDDED_CONCEPT_H = 48;

export type ToolMode = 'pan' | 'select';
export type Viewport = { x: number; y: number; zoom: number };

export interface CmapState {
  doc: CmapDocument;
  /** 当前选中的节点 id 集合（单击/框选/Ctrl+多选，概念与连词统一） */
  selectedNodeIds: string[];
  /** 当前选中的连接线 */
  selectedEdgeId: string | null;
  /** 正在编辑文本的节点 id（概念或连词，与 editingLpId 互斥） */
  editingId: string | null;
  /** 正在编辑文本的连词 id（与 editingId 互斥） */
  editingLpId: string | null;
  /** 右键弹窗编辑目标（概念或连词节点） */
  editModalTarget: { type: 'concept' | 'linkingPhrase'; id: string } | null;
  toolMode: ToolMode;
  viewport: Viewport;
  /** 焦点路径模式（连线清晰度专项）：激活后点选起点 → 终点，高亮最短路径并编号 */
  pathMode: boolean;
  /** 焦点路径起点（视图态，不进撤销历史） */
  pathRootId: string | null;
  /** 焦点路径终点（视图态，不进撤销历史） */
  pathTargetId: string | null;

  setDoc: (doc: CmapDocument) => void;
  /** 重命名当前概念图（更新 doc.title，参与撤销历史与自动保存） */
  setDocTitle: (title: string) => void;
  setConfig: (patch: Partial<CmapConfig>) => void;
  addConcept: (x: number, y: number, text?: string) => Concept;
  updateConcept: (
    id: string,
    patch: Partial<Pick<Concept, 'text' | 'style' | 'x' | 'y' | 'w' | 'h'>>,
  ) => void;
  /**
   * 设置/清除概念的父节点（嵌入式节点，Alt 拖入/拖出）。
   * - 拖入：绝对坐标转为相对父节点坐标，尺寸改为嵌入式小号
   * - 拖出：相对坐标转回绝对坐标，尺寸恢复标准
   * - absPos：可选绝对坐标覆盖（拖出时放到指针处）
   * - parentSize：可选父节点实测尺寸（数据层 w/h 随内容自适应后已过期，用 React Flow measured 兜底）
   */
  setConceptParent: (
    id: string,
    parentId: string | null,
    absPos?: { x: number; y: number },
    parentSize?: { w: number; h: number },
  ) => void;
  removeConcepts: (ids: string[]) => void;

  addConnection: (
    fromId: string,
    toId: string,
    opts?: { withLinkingPhrase?: boolean },
  ) => Connection;
  removeConnections: (ids: string[]) => void;
  /**
   * 更新连接线的贝塞尔控制点（Phase 09）。
   * 存储格式：`[sx, sy, tx, ty]`，前两数为源控制点相对「源节点中心」的偏移，
   * 后两数为目标控制点相对「目标节点中心」的偏移——节点移动时曲线自动跟随。
   */
  updateConnectionControlPoints: (id: string, controlPoints: number[]) => void;

  updateLinkingPhraseText: (id: string, text: string) => void;
  updateLinkingPhrasePosition: (id: string, x: number, y: number) => void;
  updateLinkingPhraseStyle: (id: string, patch: Partial<LinkingPhrase['style']>) => void;
  /** 调整连词节点尺寸（NodeResizer 拖拽结束写回，一次 resize = 一步撤销历史） */
  updateLinkingPhraseSize: (id: string, w: number, h: number) => void;
  removeLinkingPhrases: (ids: string[]) => void;

  setSelectedNodeIds: (ids: string[]) => void;
  /** 单选便捷方法（双击新建/双击编辑等单对象场景） */
  setSelectedNodeId: (id: string | null) => void;
  setSelectedEdgeId: (id: string | null) => void;
  setEditingId: (id: string | null) => void;
  setEditingLpId: (id: string | null) => void;
  setEditModalTarget: (target: { type: 'concept' | 'linkingPhrase'; id: string } | null) => void;
  setToolMode: (mode: ToolMode) => void;
  setViewport: (viewport: Viewport) => void;

  /** 进入/退出焦点路径模式（退出时清空路径选择） */
  setPathMode: (mode: boolean) => void;
  /** 设置焦点路径起点（连词/概念均可，终点仍为空时仅高亮起点提示） */
  setPathRoot: (id: string) => void;
  /** 设置焦点路径终点；传入 null 仅取消当前终点选择 */
  setPathTarget: (id: string | null) => void;
  /** 清空起点与终点选择（保持路径模式） */
  clearPathSelection: () => void;
}

/** 清理不再被任何 Connection 引用的孤儿连词 */
function pruneOrphanLps(doc: CmapDocument, usedLpIds: Set<string>): CmapDocument {
  return {
    ...doc,
    linkingPhrases: doc.linkingPhrases.filter((lp) => usedLpIds.has(lp.id)),
  };
}

const now = () => new Date().toISOString();

export const useCmapStore = create<CmapState>()(
  temporal(
    (set, get) => ({
      doc: createEmptyDocument(),
      selectedNodeIds: [],
      selectedEdgeId: null,
      editingId: null,
      editingLpId: null,
      editModalTarget: null,
      toolMode: 'pan',
      viewport: { x: 0, y: 0, zoom: 1 },
      pathMode: false,
      pathRootId: null,
      pathTargetId: null,

      setDoc: (doc) => set({ doc }),

      setDocTitle: (title) => {
        const trimmed = title.trim();
        set((s) => ({
          doc: {
            ...s.doc,
            title: trimmed || '未命名概念图',
            updatedAt: now(),
          },
        }));
      },

      setConfig: (patch) => {
        set((s) => ({
          doc: {
            ...s.doc,
            config: { ...s.doc.config, ...patch },
            updatedAt: now(),
          },
        }));
      },

      addConcept: (x, y, text = '???') => {
        const c: Concept = {
          id: genId('concept'),
          type: 'concept',
          text,
          x,
          y,
          w: 160,
          h: 60,
          style: { ...DEFAULT_CONCEPT_STYLE },
          parentId: null,
        };
        set((s) => ({
          doc: { ...s.doc, concepts: [...s.doc.concepts, c], updatedAt: now() },
        }));
        return c;
      },

      updateConcept: (id, patch) => {
        set((s) => ({
          doc: {
            ...s.doc,
            concepts: s.doc.concepts.map((c) => (c.id === id ? { ...c, ...patch } : c)),
            updatedAt: now(),
          },
        }));
      },

      setConceptParent: (id, parentId, absPos, parentSize) => {
        set((s) => {
          const c = s.doc.concepts.find((x) => x.id === id);
          if (!c || c.parentId === parentId) return {};
          const p = parentId ? s.doc.concepts.find((x) => x.id === parentId) : undefined;
          if (parentId && !p) return {};
          if (parentId && p!.id === id) return {};
          // 当前绝对坐标（沿父链上溯；absPos 显式给出时优先，如拖出放到指针处）
          const abs = absPos ?? absolutePosition(s.doc, id);
          if (parentId) {
            // 拖入：绝对坐标 → 相对父节点坐标，夹在父节点边界内（子节点用嵌入式尺寸）
            const pw = parentSize?.w ?? p!.w;
            const ph = parentSize?.h ?? p!.h;
            const rx = Math.max(0, Math.min(abs.x - p!.x, pw - EMBEDDED_CONCEPT_W));
            const ry = Math.max(0, Math.min(abs.y - p!.y, ph - EMBEDDED_CONCEPT_H));
            return {
              doc: {
                ...s.doc,
                concepts: s.doc.concepts.map((x) =>
                  x.id === id
                    ? { ...x, parentId, x: rx, y: ry, w: EMBEDDED_CONCEPT_W, h: EMBEDDED_CONCEPT_H }
                    : x,
                ),
                updatedAt: now(),
              },
            };
          }
          // 拖出：相对坐标 → 绝对坐标，尺寸恢复标准
          return {
            doc: {
              ...s.doc,
              concepts: s.doc.concepts.map((x) =>
                x.id === id ? { ...x, parentId: null, x: abs.x, y: abs.y, w: 160, h: 60 } : x,
              ),
              updatedAt: now(),
            },
          };
        });
      },

      removeConcepts: (ids) => {
        const idSet = new Set(ids);
        set((s) => {
          // 被删概念的直系子节点 → 提升为顶层（parentId 清空 + 相对坐标转绝对坐标）
          // 更深层后代仍挂在被提升的子节点下，无需递归处理
          const promoted = s.doc.concepts
            .filter((c) => c.parentId !== null && idSet.has(c.parentId))
            .map((c) => {
              const p = s.doc.concepts.find((x) => x.id === c.parentId);
              return {
                ...c,
                parentId: null,
                x: (p?.x ?? 0) + c.x,
                y: (p?.y ?? 0) + c.y,
                w: 160,
                h: 60,
              };
            });
          const promotedById = new Map(promoted.map((c) => [c.id, c]));

          // 与这些概念直接相连的边（含经连词中转的两段）
          const direct = s.doc.connections.filter(
            (c) => idSet.has(c.fromId) || idSet.has(c.toId),
          );
          // 这些边涉及的连词 → 其另一段边也一并删除（连词随概念删除而级联清除）
          const viaIds = new Set(
            direct.filter((c) => c.viaId !== null).map((c) => c.viaId as string),
          );
          const remaining = s.doc.connections.filter(
            (c) =>
              !idSet.has(c.fromId) &&
              !idSet.has(c.toId) &&
              !(c.viaId !== null && viaIds.has(c.viaId)),
          );
          const usedLpIds = new Set(
            remaining.filter((c) => c.viaId !== null).map((c) => c.viaId as string),
          );
          return {
            doc: pruneOrphanLps(
              {
                ...s.doc,
                // 提升的子节点即使同批删除也保留（只删父，不删其子孙）
                concepts: s.doc.concepts
                  .map((c) => promotedById.get(c.id) ?? c)
                  .filter((c) => !idSet.has(c.id) || promotedById.has(c.id)),
                connections: remaining,
                updatedAt: now(),
              },
              usedLpIds,
            ),
            selectedNodeIds: s.selectedNodeIds.filter((id) => !idSet.has(id)),
            editingId: s.editingId && idSet.has(s.editingId) ? null : s.editingId,
            editingLpId: s.editingLpId && idSet.has(s.editingLpId) ? null : s.editingLpId,
            pathRootId: s.pathRootId && idSet.has(s.pathRootId) ? null : s.pathRootId,
            pathTargetId: s.pathTargetId && idSet.has(s.pathTargetId) ? null : s.pathTargetId,
          };
        });
      },

      addConnection: (fromId, toId, opts = {}) => {
        const withLinkingPhrase =
          opts.withLinkingPhrase !== false &&
          // 两端都必须是概念节点，否则（连词参与连线）按直连处理
          get().doc.concepts.some((c) => c.id === fromId) &&
          get().doc.concepts.some((c) => c.id === toId);

        if (withLinkingPhrase) {
          const { doc } = get();
          const a = getAnchor(doc, fromId);
          const b = getAnchor(doc, toId);
          // 连词节点落在两端概念中点（Lynkage 默认行为）
          const lp: LinkingPhrase = {
            id: genId('lp'),
            type: 'linkingPhrase',
            text: '???',
            x: (a.cx + b.cx) / 2 - 40,
            y: (a.cy + b.cy) / 2 - 15,
            w: 80,
            h: 30,
            style: { ...DEFAULT_LP_STYLE },
          };
          const conn1: Connection = {
            id: genId('conn'),
            type: 'connection',
            fromId,
            toId: lp.id,
            viaId: lp.id,
            controlPoints: [],
          };
          const conn2: Connection = {
            id: genId('conn'),
            type: 'connection',
            fromId: lp.id,
            toId,
            viaId: lp.id,
            controlPoints: [],
          };
          set((s) => ({
            doc: {
              ...s.doc,
              linkingPhrases: [...s.doc.linkingPhrases, lp],
              connections: [...s.doc.connections, conn1, conn2],
              updatedAt: now(),
            },
          }));
          return conn1;
        }

        const conn: Connection = {
          id: genId('conn'),
          type: 'connection',
          fromId,
          toId,
          viaId: null,
          controlPoints: [],
        };
        set((s) => ({
          doc: { ...s.doc, connections: [...s.doc.connections, conn], updatedAt: now() },
        }));
        return conn;
      },

      removeConnections: (ids) => {
        const idSet = new Set(ids);
        set((s) => {
          const target = s.doc.connections.filter((c) => idSet.has(c.id));
          // 命题由两段组成：删除其中一段时整条命题（含连词）一并删除
          const viaIds = new Set(
            target.filter((c) => c.viaId !== null).map((c) => c.viaId as string),
          );
          const remaining = s.doc.connections.filter(
            (c) => !idSet.has(c.id) && !(c.viaId !== null && viaIds.has(c.viaId)),
          );
          const usedLpIds = new Set(
            remaining.filter((c) => c.viaId !== null).map((c) => c.viaId as string),
          );
          return {
            doc: pruneOrphanLps(
              { ...s.doc, connections: remaining, updatedAt: now() },
              usedLpIds,
            ),
            selectedEdgeId:
              s.selectedEdgeId && idSet.has(s.selectedEdgeId) ? null : s.selectedEdgeId,
            selectedNodeIds: s.selectedNodeIds.filter((id) => !viaIds.has(id)),
            editingLpId: s.editingLpId && viaIds.has(s.editingLpId) ? null : s.editingLpId,
          };
        });
      },

      updateConnectionControlPoints: (id, controlPoints) => {
        set((s) => ({
          doc: {
            ...s.doc,
            connections: s.doc.connections.map((c) =>
              c.id === id ? { ...c, controlPoints } : c,
            ),
            updatedAt: now(),
          },
        }));
      },

      updateLinkingPhraseText: (id, text) => {
        set((s) => ({
          doc: {
            ...s.doc,
            linkingPhrases: s.doc.linkingPhrases.map((lp) =>
              lp.id === id ? { ...lp, text } : lp,
            ),
            updatedAt: now(),
          },
        }));
      },

      updateLinkingPhrasePosition: (id, x, y) => {
        set((s) => ({
          doc: {
            ...s.doc,
            linkingPhrases: s.doc.linkingPhrases.map((lp) =>
              lp.id === id ? { ...lp, x, y } : lp,
            ),
            updatedAt: now(),
          },
        }));
      },

      updateLinkingPhraseStyle: (id, patch) => {
        set((s) => ({
          doc: {
            ...s.doc,
            linkingPhrases: s.doc.linkingPhrases.map((lp) =>
              lp.id === id ? { ...lp, style: { ...lp.style, ...patch } } : lp,
            ),
            updatedAt: now(),
          },
        }));
      },

      updateLinkingPhraseSize: (id, w, h) => {
        set((s) => ({
          doc: {
            ...s.doc,
            linkingPhrases: s.doc.linkingPhrases.map((lp) =>
              lp.id === id ? { ...lp, w, h } : lp,
            ),
            updatedAt: now(),
          },
        }));
      },

      removeLinkingPhrases: (ids) => {
        const idSet = new Set(ids);
        set((s) => {
          const remaining = s.doc.connections.filter(
            (c) =>
              !idSet.has(c.fromId) &&
              !idSet.has(c.toId) &&
              !(c.viaId !== null && idSet.has(c.viaId)),
          );
          const usedLpIds = new Set(
            remaining.filter((c) => c.viaId !== null).map((c) => c.viaId as string),
          );
          return {
            doc: pruneOrphanLps(
              {
                ...s.doc,
                connections: remaining,
                linkingPhrases: s.doc.linkingPhrases.filter((lp) => !idSet.has(lp.id)),
                updatedAt: now(),
              },
              usedLpIds,
            ),
            selectedNodeIds: s.selectedNodeIds.filter((id) => !idSet.has(id)),
            editingId: s.editingId && idSet.has(s.editingId) ? null : s.editingId,
            editingLpId: s.editingLpId && idSet.has(s.editingLpId) ? null : s.editingLpId,
            pathRootId: s.pathRootId && idSet.has(s.pathRootId) ? null : s.pathRootId,
            pathTargetId: s.pathTargetId && idSet.has(s.pathTargetId) ? null : s.pathTargetId,
          };
        });
      },

      setSelectedNodeIds: (ids) =>
        set({ selectedNodeIds: ids, selectedEdgeId: ids.length ? null : get().selectedEdgeId }),
      setSelectedNodeId: (id) =>
        set({ selectedNodeIds: id ? [id] : [], selectedEdgeId: id ? null : get().selectedEdgeId }),
      setSelectedEdgeId: (id) =>
        set({ selectedEdgeId: id, selectedNodeIds: id ? [] : get().selectedNodeIds }),
      setEditingId: (id) => set({ editingId: id, editingLpId: id ? null : get().editingLpId }),
      setEditingLpId: (id) => set({ editingLpId: id, editingId: id ? null : get().editingId }),
      setEditModalTarget: (editModalTarget) => set({ editModalTarget }),
      setToolMode: (toolMode) => set({ toolMode }),
      setViewport: (viewport) => set({ viewport }),

      // 焦点路径为纯视图态：partialize 只快照 doc，因此这些 set 天然不进撤销历史
      setPathMode: (mode) =>
        set((s) => ({
          pathMode: mode,
          pathRootId: mode ? s.pathRootId : null,
          pathTargetId: mode ? s.pathTargetId : null,
        })),
      setPathRoot: (id) => set({ pathRootId: id, pathTargetId: null }),
      setPathTarget: (id) => set({ pathTargetId: id }),
      clearPathSelection: () => set({ pathRootId: null, pathTargetId: null }),
    }),
    {
      // 只对 doc 做撤销快照；视图/选择态变更不产生历史
      partialize: (s) => ({ doc: s.doc }),
      equality: (past, curr) => past.doc === curr.doc,
      limit: 100,
    },
  ),
);
