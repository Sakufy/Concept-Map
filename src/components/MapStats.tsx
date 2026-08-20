/**
 * 底部信息栏：概念图统计（概念/连词/连接计数）。
 * 统计直接派生自 doc；主题切换已迁移至 Header ⋯ 菜单（清爽化）。
 */
import { useCmapStore } from '../store/cmapStore';

export function MapStats() {
  const doc = useCmapStore((s) => s.doc);

  return (
    <div className="cm-stats">
      <span className="cm-stats__item">
        <span className="cm-stats__num">{doc.concepts.length}</span> 概念
      </span>
      <span className="cm-stats__item">
        <span className="cm-stats__num">{doc.linkingPhrases.length}</span> 连词
      </span>
      <span className="cm-stats__item">
        <span className="cm-stats__num">{doc.connections.length}</span> 连接
      </span>
    </div>
  );
}
