/**
 * 几何纯函数：绝对坐标与锚点计算（cmapStore 与 layout 共用，避免循环依赖）
 */
import type { CmapDocument } from './types/cmap';

/** 递归求概念绝对坐标（嵌入式节点沿父链上溯，支持多层嵌套） */
export function absolutePosition(
  doc: CmapDocument,
  id: string,
): { x: number; y: number } {
  const c = doc.concepts.find((x) => x.id === id);
  if (!c) return { x: 0, y: 0 };
  if (c.parentId) {
    const p = doc.concepts.find((x) => x.id === c.parentId);
    if (p) {
      const pa = absolutePosition(doc, p.id);
      return { x: pa.x + c.x, y: pa.y + c.y };
    }
  }
  return { x: c.x, y: c.y };
}

/** 取某端点（概念或连词）的中心点与尺寸（嵌入式节点返回绝对坐标） */
export function getAnchor(
  doc: CmapDocument,
  id: string,
): { cx: number; cy: number; w: number; h: number } {
  const c = doc.concepts.find((x) => x.id === id);
  if (c) {
    const abs = absolutePosition(doc, c.id);
    return { cx: abs.x + c.w / 2, cy: abs.y + c.h / 2, w: c.w, h: c.h };
  }
  const lp = doc.linkingPhrases.find((x) => x.id === id);
  if (lp) return { cx: lp.x + lp.w / 2, cy: lp.y + lp.h / 2, w: lp.w, h: lp.h };
  return { cx: 0, cy: 0, w: 160, h: 60 };
}

/* ---- 连接线最短吸附（动态端点：起止点始终在节点外侧，连线总长最短） ---- */

/** 轴对齐矩形（绝对坐标，左上角 + 尺寸） */
export type RectLike = { x: number; y: number; w: number; h: number };

/** 从点 p 沿单位方向 (dx,dy) 的射线与矩形边界的第一交点（slab 法，t≥0） */
function rayRectIntersect(
  r: RectLike,
  p: { x: number; y: number },
  dx: number,
  dy: number,
): { x: number; y: number } | null {
  let tMin = 0;
  let tMax = Infinity;
  if (Math.abs(dx) < 1e-9) {
    if (p.x < r.x - 1e-9 || p.x > r.x + r.w + 1e-9) return null;
  } else {
    const t1 = (r.x - p.x) / dx;
    const t2 = (r.x + r.w - p.x) / dx;
    tMin = Math.max(tMin, Math.min(t1, t2));
    tMax = Math.min(tMax, Math.max(t1, t2));
  }
  if (Math.abs(dy) < 1e-9) {
    if (p.y < r.y - 1e-9 || p.y > r.y + r.h + 1e-9) return null;
  } else {
    const t1 = (r.y - p.y) / dy;
    const t2 = (r.y + r.h - p.y) / dy;
    tMin = Math.max(tMin, Math.min(t1, t2));
    tMax = Math.min(tMax, Math.max(t1, t2));
  }
  if (tMin > tMax || !isFinite(tMax)) return null;
  // 从外部进入取 tMin；起点在矩形内部时取 tMax（出射边），保证端点在边界上而非中心
  const t = tMin > 0 ? tMin : tMax;
  if (!isFinite(t)) return null;
  return { x: p.x + t * dx, y: p.y + t * dy };
}

/**
 * 两矩形之间「最短连线」的吸附端点（连接线动态吸附专项）。
 * - 以两矩形中心连线为方向，分别求该射线与两矩形边界的第一交点；
 * - 结果端点必然落在节点外侧边界上，且连线总长约等于最短（两矩形相离时趋近最优，视觉自然）；
 * - 中心重合（节点重叠）等退化场景兜底返回两中心点。
 */
export function findClosestEdgePoints(
  a: RectLike,
  b: RectLike,
): { sx: number; sy: number; tx: number; ty: number } {
  const ca = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
  const cb = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const dx = cb.x - ca.x;
  const dy = cb.y - ca.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) {
    // 中心重合：无方向可判，退回中心点（重叠态无「外侧」可言）
    return { sx: ca.x, sy: ca.y, tx: cb.x, ty: cb.y };
  }
  const ux = dx / len;
  const uy = dy / len;
  const s = rayRectIntersect(a, ca, ux, uy);
  const t = rayRectIntersect(b, cb, -ux, -uy);
  return {
    sx: s?.x ?? ca.x,
    sy: s?.y ?? ca.y,
    tx: t?.x ?? cb.x,
    ty: t?.y ?? cb.y,
  };
}

/* ---- 智能贝塞尔（连线清晰度专项：同向多边 lane 展开 + 反向连接外绕） ---- */

/** lane 间距（同向多边在垂直方向的展开步长） */
export const LANE_SPACING = 24;
/** 反向连接（目标在源左侧）额外外绕量，避免曲线横穿中间的节点/其他连线 */
export const REVERSE_OUTER = 42;

export type ControlPoint = { x: number; y: number };

/**
 * 计算无持久化控制点时的智能贝塞尔控制点。
 * - 同向多边（laneCount > 1）按 laneIndex 沿「源→目标连线」的垂直方向展开，避免重叠；
 * - 目标在源左侧（反向连接）时控制点整体向外侧推离中心线，避免横穿中间区域。
 * 控制点位于连线 30% / 70% 处（与拖拽落库后的默认建议值同构）。
 */
export function smartControlPoints(
  a: { cx: number; cy: number },
  b: { cx: number; cy: number },
  laneIndex = 0,
  laneCount = 1,
): { srcCtl: ControlPoint; tgtCtl: ControlPoint } {
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  const len = Math.hypot(dx, dy) || 1;
  // 垂直单位向量（顺时针 90°，右手定则）
  const nx = -dy / len;
  const ny = dx / len;
  // 组内居中展开：lane 0 居中偏移为 -(n-1)/2 * spacing
  const laneOffset = (laneIndex - (laneCount - 1) / 2) * LANE_SPACING;
  const bump = laneOffset + (dx < 0 ? REVERSE_OUTER : 0);
  return {
    srcCtl: { x: a.cx + dx * 0.3 + nx * bump, y: a.cy + dy * 0.3 + ny * bump },
    tgtCtl: { x: b.cx - dx * 0.3 + nx * bump, y: b.cy - dy * 0.3 + ny * bump },
  };
}

/** 语义边分组结果：connection id -> lane 信息 */
export type EdgeLane = { laneIndex: number; laneCount: number };

/**
 * 给连接线分配智能贝塞尔 lane（连线清晰度专项）。
 * 分组按「语义端点对有向对」：
 * - 命题（A—连词—B）：两段 connection 合并为一条语义边，key = A->B；
 * - 直连：单条 connection，key = fromId->toId。
 * 同一对概念之间的多条语义边按出现顺序分配 laneIndex，供 smartControlPoints 展开。
 */
export function assignLanes(doc: CmapDocument): Map<string, EdgeLane> {
  const isLp = (id: string) => doc.linkingPhrases.some((lp) => lp.id === id);

  // 命题合并：viaId -> 两段 connection id
  const viaGroups = new Map<string, string[]>();
  doc.connections.forEach((conn) => {
    if (!conn.viaId) return;
    const arr = viaGroups.get(conn.viaId) ?? [];
    arr.push(conn.id);
    viaGroups.set(conn.viaId, arr);
  });

  // key（A->B） -> 语义边数组，每个语义边是 connection id 数组
  const semEdges = new Map<string, string[][]>();
  viaGroups.forEach((connIds, viaId) => {
    const pair = doc.connections.filter((c) => c.viaId === viaId);
    const ends = pair.flatMap((c) => [c.fromId, c.toId]).filter((id) => !isLp(id));
    if (ends.length !== 2) return;
    const key = `${ends[0]}->${ends[1]}`;
    const list = semEdges.get(key) ?? [];
    list.push(connIds);
    semEdges.set(key, list);
  });
  // 直连按出现顺序并入（同一 key 时排在命题之后）
  doc.connections.forEach((conn) => {
    if (conn.viaId !== null) return;
    const key = `${conn.fromId}->${conn.toId}`;
    const list = semEdges.get(key) ?? [];
    list.push([conn.id]);
    semEdges.set(key, list);
  });

  const laneById = new Map<string, EdgeLane>();
  semEdges.forEach((list) => {
    list.forEach((edgeIds, laneIndex) => {
      edgeIds.forEach((id) => laneById.set(id, { laneIndex, laneCount: list.length }));
    });
  });
  return laneById;
}
