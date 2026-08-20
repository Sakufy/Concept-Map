/**
 * 节点样式面板：仅当有选中节点时显示。
 * - 概念节点：点击色块切换 fill/borderColor，A-/A+ 调节字号（12~32，步进 2）
 * - 连词节点：同一套操作，作用于连词 style（字号 10~26，步进 1）
 */
import { useCmapStore } from '../store/cmapStore';

/** 预设色板（Lynkage 风格柔和色块） */
export const NODE_COLORS: { name: string; fill: string; border: string }[] = [
  { name: '蓝', fill: '#e3f2fd', border: '#1976d2' },
  { name: '绿', fill: '#e8f5e9', border: '#388e3c' },
  { name: '橙', fill: '#fff3e0', border: '#f57c00' },
  { name: '粉', fill: '#fce4ec', border: '#c2185b' },
  { name: '紫', fill: '#ede7f6', border: '#5e35b1' },
  { name: '青', fill: '#e0f7fa', border: '#00838f' },
];

const FONT_RANGE: Record<'concept' | 'linkingPhrase', { min: number; max: number; step: number }> = {
  concept: { min: 12, max: 32, step: 2 },
  linkingPhrase: { min: 10, max: 26, step: 1 },
};

export function NodeStylePanel() {
  const selectedNodeIds = useCmapStore((s) => s.selectedNodeIds);
  const doc = useCmapStore((s) => s.doc);
  const updateConcept = useCmapStore((s) => s.updateConcept);
  const updateLinkingPhraseStyle = useCmapStore((s) => s.updateLinkingPhraseStyle);

  // 样式面板只服务单选节点（多选时隐藏，避免语义混乱）
  if (selectedNodeIds.length !== 1) return null;
  const selectedNodeId = selectedNodeIds[0];
  const concept = doc.concepts.find((c) => c.id === selectedNodeId);
  const lp = doc.linkingPhrases.find((x) => x.id === selectedNodeId);
  if (!concept && !lp) return null;

  const kind: 'concept' | 'linkingPhrase' = concept ? 'concept' : 'linkingPhrase';
  const style = concept ? concept.style : (lp!.style);
  const range = FONT_RANGE[kind];

  const applyColor = (fill: string, border: string) => {
    if (concept) {
      updateConcept(concept.id, { style: { ...concept.style, fill, borderColor: border } });
    } else if (lp) {
      updateLinkingPhraseStyle(lp.id, { fill, borderColor: border });
    }
  };

  const adjustFontSize = (delta: number) => {
    const next = Math.min(range.max, Math.max(range.min, style.fontSize + delta));
    if (next === style.fontSize) return;
    if (concept) {
      updateConcept(concept.id, { style: { ...concept.style, fontSize: next } });
    } else if (lp) {
      updateLinkingPhraseStyle(lp.id, { fontSize: next });
    }
  };

  return (
    <div className="cm-style-panel" role="group" aria-label="节点样式">
      <span className="cm-style-panel__group-label">颜色</span>
      {NODE_COLORS.map((c) => (
        <button
          key={c.fill}
          type="button"
          className={`cm-style-panel__swatch${style.fill === c.fill ? ' is-active' : ''}`}
          style={{ background: c.fill, borderColor: c.border }}
          title={c.name}
          aria-label={c.name}
          aria-pressed={style.fill === c.fill}
          onClick={() => applyColor(c.fill, c.border)}
        />
      ))}
      <span className="cm-style-panel__divider" aria-hidden />
      <span className="cm-style-panel__group-label">字号</span>
      <button
        type="button"
        className="cm-style-panel__btn"
        title="减小字号"
        aria-label="减小字号"
        disabled={style.fontSize <= range.min}
        onClick={() => adjustFontSize(-range.step)}
      >
        A−
      </button>
      <span className="cm-style-panel__size">{style.fontSize}px</span>
      <button
        type="button"
        className="cm-style-panel__btn"
        title="增大字号"
        aria-label="增大字号"
        disabled={style.fontSize >= range.max}
        onClick={() => adjustFontSize(range.step)}
      >
        A+
      </button>
    </div>
  );
}
