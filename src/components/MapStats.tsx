/**
 * 底部信息栏：概念图统计（概念/连词/连接计数）+ 主题切换（浅色/深色）。
 * 统计直接派生自 doc，主题切换写入 doc.config（随文档持久化）。
 */
import { useCmapStore } from '../store/cmapStore';

export function MapStats() {
  const doc = useCmapStore((s) => s.doc);
  const setConfig = useCmapStore((s) => s.setConfig);
  const isDark = doc.config.theme === 'dark';

  const toggleTheme = () => {
    setConfig({ theme: isDark ? 'default' : 'dark' });
  };

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
      <button
        type="button"
        className="cm-stats__btn"
        title={isDark ? '切换到浅色主题' : '切换到深色主题'}
        aria-label="切换主题"
        aria-pressed={isDark}
        onClick={toggleTheme}
      >
        {isDark ? '☀' : '🌙'}
        <span className="cm-stats__btn-label">{isDark ? '浅色' : '深色'}</span>
      </button>
    </div>
  );
}
