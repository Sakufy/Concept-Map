/**
 * 焦点路径：BFS 沿 connection 有向边找最短路径（含连词节点）。
 * 方向恒为「fromId → toId」（数据层定义）；命题 A—连词—B 由 A→连词、连词→B 两段组成，
 * 因此最短路径天然会穿过连词节点，让"初始概念 → 目标概念"的顺序可被逐边编号。
 */
import type { CmapDocument } from './types/cmap';

export interface FocusPathResult {
  /** 路径边 id，按「起点 → 终点」顺序排列（编号 = 下标 + 1） */
  edgeIds: string[];
  /** 路径经过的节点 id 集合（含起点与终点） */
  nodeIds: Set<string>;
}

/** BFS 找从 rootId 到 targetId 的最短有向路径；不可达返回 null */
export function findFocusPath(
  doc: CmapDocument,
  rootId: string,
  targetId: string,
): FocusPathResult | null {
  if (rootId === targetId) return { edgeIds: [], nodeIds: new Set([rootId]) };

  // 邻接表：nodeId -> { to, connId }（有向边）
  const adj = new Map<string, { to: string; connId: string }[]>();
  doc.connections.forEach((conn) => {
    const list = adj.get(conn.fromId) ?? [];
    list.push({ to: conn.toId, connId: conn.id });
    adj.set(conn.fromId, list);
  });

  const visited = new Set<string>([rootId]);
  const prev = new Map<string, { node: string; connId: string }>();
  const queue: string[] = [rootId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur === targetId) break;
    for (const next of adj.get(cur) ?? []) {
      if (visited.has(next.to)) continue;
      visited.add(next.to);
      prev.set(next.to, { node: cur, connId: next.connId });
      queue.push(next.to);
    }
  }
  if (!prev.has(targetId)) return null;

  // 回溯还原路径
  const edgeIds: string[] = [];
  const nodeIds = new Set<string>([rootId]);
  let cur = targetId;
  while (cur !== rootId) {
    const p = prev.get(cur);
    if (!p) break;
    edgeIds.unshift(p.connId);
    nodeIds.add(cur);
    cur = p.node;
  }
  return { edgeIds, nodeIds };
}
