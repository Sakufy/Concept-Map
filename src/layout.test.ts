import { describe, expect, it } from 'vitest';
import { createEmptyDocument, type CmapDocument } from './types/cmap';
import { applyAutoLayout } from './layout';
import { getAnchor } from './geometry';

const CONCEPT_STYLE = { fill: '#e3f2fd', borderColor: '#1976d2', fontSize: 16 };
const LP_STYLE = { fill: '#fff', borderColor: '#94a3b8', fontSize: 13 };

/** A—LP→B 命题 + 孤立概念 C + A 的嵌入式子节点 D（相对坐标 10,10） */
function makeDoc(): CmapDocument {
  const doc = createEmptyDocument('t');
  doc.concepts = [
    { id: 'A', type: 'concept', text: 'A', x: 0, y: 0, w: 160, h: 60, style: CONCEPT_STYLE, parentId: null },
    { id: 'B', type: 'concept', text: 'B', x: 500, y: 300, w: 160, h: 60, style: CONCEPT_STYLE, parentId: null },
    { id: 'C', type: 'concept', text: 'C', x: 0, y: 600, w: 160, h: 60, style: CONCEPT_STYLE, parentId: null },
    { id: 'D', type: 'concept', text: 'D', x: 10, y: 10, w: 120, h: 48, style: CONCEPT_STYLE, parentId: 'A' },
  ];
  doc.linkingPhrases = [
    { id: 'LP', type: 'linkingPhrase', text: '→', x: 100, y: 100, w: 80, h: 30, style: LP_STYLE },
  ];
  doc.connections = [
    { id: 'c1', type: 'connection', fromId: 'A', toId: 'LP', viaId: 'LP', controlPoints: [] },
    { id: 'c2', type: 'connection', fromId: 'LP', toId: 'B', viaId: 'LP', controlPoints: [] },
  ];
  return doc;
}

describe('applyAutoLayout dagre 分层布局', () => {
  it('顶层概念坐标由 dagre 重排（LR：A 在 B 左侧），全部坐标为有限数值', () => {
    const out = applyAutoLayout(makeDoc());
    out.concepts.forEach((c) => {
      expect(Number.isFinite(c.x)).toBe(true);
      expect(Number.isFinite(c.y)).toBe(true);
    });
    const A = out.concepts.find((c) => c.id === 'A')!;
    const B = out.concepts.find((c) => c.id === 'B')!;
    expect(A.x + A.w).toBeLessThan(B.x); // rankdir LR：源在左、目标在右
  });

  it('连词重新居中到两端概念中心连线中点', () => {
    const out = applyAutoLayout(makeDoc());
    const lp = out.linkingPhrases.find((x) => x.id === 'LP')!;
    const a = getAnchor(out, 'A');
    const b = getAnchor(out, 'B');
    expect(lp.x + lp.w / 2).toBeCloseTo((a.cx + b.cx) / 2);
    expect(lp.y + lp.h / 2).toBeCloseTo((a.cy + b.cy) / 2);
  });

  it('嵌入式子节点保持相对父坐标（不参与分层，父移动自动跟随）', () => {
    const out = applyAutoLayout(makeDoc());
    const D = out.concepts.find((c) => c.id === 'D')!;
    expect(D).toMatchObject({ x: 10, y: 10, parentId: 'A' });
  });

  it('孤立概念保留在结果中且坐标有限', () => {
    const out = applyAutoLayout(makeDoc());
    const C = out.concepts.find((c) => c.id === 'C')!;
    expect(C).toBeTruthy();
    expect(Number.isFinite(C.x)).toBe(true);
  });
});
