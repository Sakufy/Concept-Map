import { describe, expect, it } from 'vitest';
import { createEmptyDocument, type CmapDocument } from './types/cmap';
import { findFocusPath } from './path';

/** 构造测试文档：A—LP1→B—LP2→C 命题链 + C→A 直连 + 孤立节点 D */
function makeDoc(): CmapDocument {
  const doc = createEmptyDocument('t');
  doc.concepts = [
    { id: 'A', type: 'concept', text: 'A', x: 0, y: 0, w: 160, h: 60, style: { fill: '#e3f2fd', borderColor: '#1976d2', fontSize: 16 }, parentId: null },
    { id: 'B', type: 'concept', text: 'B', x: 400, y: 0, w: 160, h: 60, style: { fill: '#e3f2fd', borderColor: '#1976d2', fontSize: 16 }, parentId: null },
    { id: 'C', type: 'concept', text: 'C', x: 800, y: 0, w: 160, h: 60, style: { fill: '#e3f2fd', borderColor: '#1976d2', fontSize: 16 }, parentId: null },
    { id: 'D', type: 'concept', text: 'D', x: 0, y: 400, w: 160, h: 60, style: { fill: '#e3f2fd', borderColor: '#1976d2', fontSize: 16 }, parentId: null },
  ];
  doc.linkingPhrases = [
    { id: 'LP1', type: 'linkingPhrase', text: '→', x: 120, y: 0, w: 80, h: 30, style: { fill: '#fff', borderColor: '#94a3b8', fontSize: 13 } },
    { id: 'LP2', type: 'linkingPhrase', text: '→', x: 560, y: 0, w: 80, h: 30, style: { fill: '#fff', borderColor: '#94a3b8', fontSize: 13 } },
  ];
  doc.connections = [
    { id: 'c1', type: 'connection', fromId: 'A', toId: 'LP1', viaId: 'LP1', controlPoints: [] },
    { id: 'c2', type: 'connection', fromId: 'LP1', toId: 'B', viaId: 'LP1', controlPoints: [] },
    { id: 'c3', type: 'connection', fromId: 'B', toId: 'LP2', viaId: 'LP2', controlPoints: [] },
    { id: 'c4', type: 'connection', fromId: 'LP2', toId: 'C', viaId: 'LP2', controlPoints: [] },
    { id: 'c5', type: 'connection', fromId: 'C', toId: 'A', viaId: null, controlPoints: [] },
  ];
  return doc;
}

describe('findFocusPath 焦点路径（BFS 沿有向 connection）', () => {
  it('命题链 A→C 的路径含连词节点，边按顺序编号', () => {
    const r = findFocusPath(makeDoc(), 'A', 'C');
    expect(r).not.toBeNull();
    expect(r!.edgeIds).toEqual(['c1', 'c2', 'c3', 'c4']);
    expect([...r!.nodeIds].sort()).toEqual(['A', 'B', 'C', 'LP1', 'LP2']);
  });

  it('相邻命题 A→B 只取前两段边', () => {
    const r = findFocusPath(makeDoc(), 'A', 'B');
    expect(r!.edgeIds).toEqual(['c1', 'c2']);
  });

  it('直连边 C→A 走单向边（BFS 不回溯反向）', () => {
    const r = findFocusPath(makeDoc(), 'C', 'A');
    expect(r!.edgeIds).toEqual(['c5']);
  });

  it('不可达（孤立节点 D）返回 null', () => {
    expect(findFocusPath(makeDoc(), 'A', 'D')).toBeNull();
  });

  it('起点等于终点时为空路径（仅含起点）', () => {
    const r = findFocusPath(makeDoc(), 'A', 'A');
    expect(r!.edgeIds).toEqual([]);
    expect([...r!.nodeIds]).toEqual(['A']);
  });
});
