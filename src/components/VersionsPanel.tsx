/**
 * 「版本历史」面板：列出当前地图的时间线快照（误删保护）。
 * - 恢复：确认后载入快照（替换当前 doc，清空撤销历史，防止 Ctrl+Z 回退到旧图）
 * - 删除：移除单个版本
 */
import { useCallback, useEffect, useState } from 'react';
import { useCmapStore } from '../store/cmapStore';
import {
  deleteVersion,
  listVersions,
  loadVersion,
  saveVersion,
  type VersionMeta,
} from '../versions';

interface Props {
  onClose: () => void;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-CN', { hour12: false });
  } catch {
    return iso;
  }
}

export function VersionsPanel({ onClose }: Props) {
  const doc = useCmapStore((s) => s.doc);
  const [versions, setVersions] = useState<VersionMeta[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setVersions(await listVersions(doc.id));
  }, [doc.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** 立即为当前图保存一个版本 */
  const handleSaveNow = async () => {
    setBusy(true);
    try {
      const ok = await saveVersion(useCmapStore.getState().doc);
      if (!ok) alert('当前内容与最近版本相同，无需重复保存');
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async (v: VersionMeta) => {
    if (!window.confirm(`恢复 ${formatTime(v.createdAt)} 的版本？当前编辑内容将被替换。`)) return;
    setBusy(true);
    try {
      const snap = await loadVersion(v.id);
      if (!snap) {
        alert('版本数据缺失');
        return;
      }
      useCmapStore.getState().setDoc(snap);
      useCmapStore.temporal.getState().clear(); // 恢复后禁止撤销回旧图
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (v: VersionMeta) => {
    if (!window.confirm(`删除 ${formatTime(v.createdAt)} 的版本？`)) return;
    setBusy(true);
    try {
      await deleteVersion(v.id);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cm-modal__backdrop" onClick={onClose}>
      <div
        className="cm-modal cm-versions"
        role="dialog"
        aria-modal="true"
        aria-label="版本历史"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cm-versions__header">
          <h3 className="cm-modal__title">版本历史 · {doc.title}</h3>
          <button
            type="button"
            className="cm-maps__btn cm-maps__btn--primary"
            onClick={handleSaveNow}
            disabled={busy}
            data-testid="versions-save-now"
          >
            保存当前版本
          </button>
        </div>
        <p className="cm-versions__hint">每 2 分钟自动记录一次；「保存当前版本」可随时手动打点。</p>
        <ul className="cm-versions__list">
          {versions.map((v) => (
            <li key={v.id} className="cm-versions__item">
              <div className="cm-versions__info">
                <span className="cm-versions__time">{formatTime(v.createdAt)}</span>
                <span className="cm-versions__stat">
                  {v.conceptCount} 概念 · {v.linkingPhraseCount} 连词 · {v.connectionCount} 连接
                </span>
              </div>
              <div className="cm-versions__actions">
                <button
                  type="button"
                  className="cm-maps__btn"
                  onClick={() => handleRestore(v)}
                  disabled={busy}
                >
                  恢复
                </button>
                <button
                  type="button"
                  className="cm-maps__del"
                  onClick={() => handleDelete(v)}
                  disabled={busy}
                >
                  删除
                </button>
              </div>
            </li>
          ))}
          {!busy && versions.length === 0 && (
            <li className="cm-maps__empty">暂无历史版本，编辑后会自动记录</li>
          )}
        </ul>
        <div className="cm-modal__actions">
          <button type="button" className="cm-modal__ghost" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
