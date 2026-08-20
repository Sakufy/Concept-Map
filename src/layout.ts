/**
 * dagre 分层自动布局（React Flow 官方 Layouting 示例同款方案）。
 *
 * 规则：
 * - 只布局顶层概念节点（parentId === null）；嵌入式子节点保持相对父坐标（父移动自动跟随）。
 * - 概念间的边：命题（概念→连词→概念）合并为一条概念边，直连保留；连词不参与分层。
 * - 布局后连词重新居中到两端概念中点。
 */
import dagre from 'dagre';
import type { CmapDocument } from './types/cmap';
import { getAnchor } from './geometry';

export function applyAutoLayout(doc: CmapDocument): CmapDocument {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  // LR：从左到右分层，命题链沿阅读顺序排列
  g.setGraph({ rankdir: 'LR', nodesep: 70, ranksep: 110, marginx: 40, marginy: 40 });

  const topConcepts = doc.concepts.filter((c) => c.parentId === null);
  topConcepts.forEach((c) => g.setNode(c.id, { width: c.w, height: c.h }));

  // 命题两段合并为一条概念边（A -连词-> B）
  const lpPairs = new Map<string, [string | null, string | null]>();
  doc.connections.forEach((conn) => {
    if (conn.viaId === null) return;
    const pair = lpPairs.get(conn.viaId) ?? [null, null] as [string | null, string | null];
    // 概念端（非连词端）
    const fromIsLp = doc.linkingPhrases.some((lp) => lp.id === conn.fromId);
    const toIsLp = doc.linkingPhrases.some((lp) => lp.id === conn.toId);
    if (!fromIsLp && pair[0] === null) pair[0] = conn.fromId;
    if (!toIsLp && pair[1] === null) pair[1] = conn.toId;
    // 注意：保留 null 占位，不能转空串，否则后续连接无法回填另一端
    lpPairs.set(conn.viaId, [pair[0], pair[1]]);
  });
  // 命题边
  lpPairs.forEach(([a, b]) => {
    if (a && b && a !== b) g.setEdge(a, b);
  });
  // 直连边（无连词）
  doc.connections.forEach((conn) => {
    if (conn.viaId === null && conn.fromId !== conn.toId) g.setEdge(conn.fromId, conn.toId);
  });

  dagre.layout(g);

  // 写回顶层概念坐标（dagre 返回节点中心，需转左上角）
  const newConcepts = doc.concepts.map((c) => {
    if (c.parentId !== null) return c;
    const pos = g.node(c.id);
    if (!pos) return c;
    return { ...c, x: pos.x - c.w / 2, y: pos.y - c.h / 2 };
  });
  const tempDoc: CmapDocument = { ...doc, concepts: newConcepts };

  // 连词重新居中到两端概念中点
  const newLps = doc.linkingPhrases.map((lp) => {
    const pair = lpPairs.get(lp.id);
    if (!pair || !pair[0] || !pair[1]) return lp;
    const a = getAnchor(tempDoc, pair[0]);
    const b = getAnchor(tempDoc, pair[1]);
    return { ...lp, x: (a.cx + b.cx) / 2 - lp.w / 2, y: (a.cy + b.cy) / 2 - lp.h / 2 };
  });

  return { ...tempDoc, linkingPhrases: newLps, updatedAt: new Date().toISOString() };
}
