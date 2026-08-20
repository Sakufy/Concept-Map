import { describe, expect, it } from 'vitest';
import { createEmptyDocument, type CmapDocument } from './types/cmap';
import {
  assignLanes,
  findClosestEdgePoints,
  LANE_SPACING,
  REVERSE_OUTER,
  smartControlPoints,
} from './geometry';

const CONCEPT_STYLE = { fill: '#e3f2fd', borderColor: '#1976d2', fontSize: 16 };
const LP_STYLE = { fill: '#fff', borderColor: '#94a3b8', fontSize: 13 };

describe('smartControlPoints 智能贝塞尔', () => {
  it('水平正向单边：控制点位于连线 30% / 70% 处（在直线上）', () => {
    const { srcCtl, tgtCtl } = smartControlPoints({ cx: 0, cy: 0 }, { cx: 100, cy: 0 }, 0, 1);
    expect(srcCtl).toEqual({ x: 30, y: 0 });
    expect(tgtCtl).toEqual({ x: 70, y: 0 });
  });

  it('同向多边：控制点沿垂直方向居中展开（laneCount=2 时 ±LANE_SPACING/2）', () => {
    const half = LANE_SPACING / 2;
    const lane0 = smartControlPoints({ cx: 0, cy: 0 }, { cx: 100, cy: 0 }, 0, 2);
    const lane1 = smartControlPoints({ cx: 0, cy: 0 }, { cx: 100, cy: 0 }, 1, 2);
    expect(lane0.srcCtl.y).toBeCloseTo(-half);
    expect(lane1.srcCtl.y).toBeCloseTo(half);
    expect(lane0.srcCtl.x).toBe(30);
    expect(lane1.srcCtl.x).toBe(30);
  });

  it('竖直边（向下）：垂直向量指向左侧，lane 沿水平展开且两 lane 方向相反', () => {
    // dx=0, dy=100 → 垂直向量 (nx,ny)=(-1,0)：lane0(bump=-12) 偏 x=+12，lane1 偏 x=-12
    const lane0 = smartControlPoints({ cx: 0, cy: 0 }, { cx: 0, cy: 100 }, 0, 2);
    const lane1 = smartControlPoints({ cx: 0, cy: 0 }, { cx: 0, cy: 100 }, 1, 2);
    expect(lane0.srcCtl.x).toBeCloseTo(LANE_SPACING / 2);
    expect(lane1.srcCtl.x).toBeCloseTo(-LANE_SPACING / 2);
    expect(lane0.srcCtl.x).not.toBeCloseTo(lane1.srcCtl.x);
  });

  it('反向连接（目标在源左侧）控制点外绕 REVERSE_OUTER，避免横穿', () => {
    // dx=-100, dy=0 → 垂直向量 (0,-1)：反向边统一弯向 y 负方向（外绕）
    const { srcCtl, tgtCtl } = smartControlPoints({ cx: 0, cy: 0 }, { cx: -100, cy: 0 }, 0, 1);
    expect(srcCtl.y).toBeCloseTo(-REVERSE_OUTER);
    expect(tgtCtl.y).toBeCloseTo(-REVERSE_OUTER);
    expect(srcCtl.x).toBeCloseTo(-30);
    expect(tgtCtl.x).toBeCloseTo(-70);
  });
});

describe('assignLanes 语义边分组', () => {
  function makeDoc(): CmapDocument {
    const doc = createEmptyDocument('t');
    doc.concepts = [
      { id: 'A', type: 'concept', text: 'A', x: 0, y: 0, w: 160, h: 60, style: CONCEPT_STYLE, parentId: null },
      { id: 'B', type: 'concept', text: 'B', x: 400, y: 0, w: 160, h: 60, style: CONCEPT_STYLE, parentId: null },
      { id: 'C', type: 'concept', text: 'C', x: 800, y: 0, w: 160, h: 60, style: CONCEPT_STYLE, parentId: null },
    ];
    return doc;
  }

  it('命题两段共享同一 lane（A—LP—B 合并为一条语义边）', () => {
    const doc = makeDoc();
    doc.linkingPhrases = [{ id: 'LP', type: 'linkingPhrase', text: '→', x: 120, y: 0, w: 80, h: 30, style: LP_STYLE }];
    doc.connections = [
      { id: 'c1', type: 'connection', fromId: 'A', toId: 'LP', viaId: 'LP', controlPoints: [] },
      { id: 'c2', type: 'connection', fromId: 'LP', toId: 'B', viaId: 'LP', controlPoints: [] },
    ];
    const lanes = assignLanes(doc);
    expect(lanes.get('c1')).toEqual({ laneIndex: 0, laneCount: 1 });
    expect(lanes.get('c2')).toEqual({ laneIndex: 0, laneCount: 1 });
  });

  it('多条 A→B 连接（命题×2 + 直连）按出现顺序分配 lane 0/1/2', () => {
    const doc = makeDoc();
    doc.linkingPhrases = [
      { id: 'LP1', type: 'linkingPhrase', text: '→', x: 100, y: 0, w: 80, h: 30, style: LP_STYLE },
      { id: 'LP2', type: 'linkingPhrase', text: '→', x: 100, y: 0, w: 80, h: 30, style: LP_STYLE },
    ];
    doc.connections = [
      { id: 'c1', type: 'connection', fromId: 'A', toId: 'LP1', viaId: 'LP1', controlPoints: [] },
      { id: 'c2', type: 'connection', fromId: 'LP1', toId: 'B', viaId: 'LP1', controlPoints: [] },
      { id: 'c3', type: 'connection', fromId: 'A', toId: 'LP2', viaId: 'LP2', controlPoints: [] },
      { id: 'c4', type: 'connection', fromId: 'LP2', toId: 'B', viaId: 'LP2', controlPoints: [] },
      { id: 'c5', type: 'connection', fromId: 'A', toId: 'B', viaId: null, controlPoints: [] },
    ];
    const lanes = assignLanes(doc);
    expect(lanes.get('c1')).toEqual({ laneIndex: 0, laneCount: 3 });
    expect(lanes.get('c2')).toEqual({ laneIndex: 0, laneCount: 3 });
    expect(lanes.get('c3')).toEqual({ laneIndex: 1, laneCount: 3 });
    expect(lanes.get('c4')).toEqual({ laneIndex: 1, laneCount: 3 });
    expect(lanes.get('c5')).toEqual({ laneIndex: 2, laneCount: 3 });
  });

  it('A→B 与 B→A 是不同分组（有向）', () => {
    const doc = makeDoc();
    doc.connections = [
      { id: 'c1', type: 'connection', fromId: 'A', toId: 'B', viaId: null, controlPoints: [] },
      { id: 'c2', type: 'connection', fromId: 'B', toId: 'A', viaId: null, controlPoints: [] },
    ];
    const lanes = assignLanes(doc);
    expect(lanes.get('c1')).toEqual({ laneIndex: 0, laneCount: 1 });
    expect(lanes.get('c2')).toEqual({ laneIndex: 0, laneCount: 1 });
  });
});

describe('findClosestEdgePoints 最短吸附端点', () => {
  it('水平分离：两端点吸附在相对的左右边界中点，连线最短', () => {
    const { sx, sy, tx, ty } = findClosestEdgePoints(
      { x: 0, y: 0, w: 100, h: 60 },
      { x: 300, y: 0, w: 100, h: 60 },
    );
    expect({ sx, sy, tx, ty }).toEqual({ sx: 100, sy: 30, tx: 300, ty: 30 });
  });

  it('垂直分离：两端点吸附在相对的上下边界中点，连线最短', () => {
    const { sx, sy, tx, ty } = findClosestEdgePoints(
      { x: 0, y: 0, w: 100, h: 60 },
      { x: 0, y: 200, w: 100, h: 60 },
    );
    expect({ sx, sy, tx, ty }).toEqual({ sx: 50, sy: 60, tx: 50, ty: 200 });
  });

  it('对角分布：端点落在源右边界/目标左边界（中心连线方向），距离短于中心距', () => {
    const a = { x: 0, y: 0, w: 100, h: 100 };
    const b = { x: 500, y: 300, w: 100, h: 100 };
    const { sx, sy, tx, ty } = findClosestEdgePoints(a, b);
    // 起点在 A 边界上（x=100 或 y 边界），终点在 B 边界上（x=500 或 y 边界）
    const onBoundary = (r: typeof a, x: number, y: number) =>
      x === r.x || x === r.x + r.w || y === r.y || y === r.y + r.h;
    expect(onBoundary(a, sx, sy)).toBe(true);
    expect(onBoundary(b, tx, ty)).toBe(true);
    // 端点在各自矩形外侧（不在矩形内部）
    expect(sx < a.x + a.w + 1e-6 && sx > a.x - 1e-6).toBe(true);
    // 连线长度 < 中心距（吸附缩短了连线）
    const seg = Math.hypot(tx - sx, ty - sy);
    const centers = Math.hypot(500, 300);
    expect(seg).toBeLessThan(centers);
  });

  it('上下对角（目标在源左上方）：端点吸附在相对边界', () => {
    const { sx, sy, tx, ty } = findClosestEdgePoints(
      { x: 300, y: 300, w: 100, h: 100 },
      { x: 0, y: 0, w: 100, h: 100 },
    );
    // 起点在 A 的顶或左边界，终点在 B 的底或右边界
    expect(sy === 300 || sx === 300).toBe(true);
    expect(ty === 100 || tx === 100).toBe(true);
  });

  it('中心重合（节点重叠）：兜底返回两中心点', () => {
    const { sx, sy, tx, ty } = findClosestEdgePoints(
      { x: 0, y: 0, w: 100, h: 100 },
      { x: 0, y: 0, w: 100, h: 100 },
    );
    expect({ sx, sy }).toEqual({ sx: 50, sy: 50 });
    expect({ tx, ty }).toEqual({ tx: 50, ty: 50 });
  });
});
