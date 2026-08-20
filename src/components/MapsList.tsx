/**
 * 「我的地图」云端列表视图（uiMode='maps'）：
 * 新建 / 打开 / 删除云端地图。打开后切入编辑器并记录 cloudMapId 供自动保存联动。
 */
import { useCallback, useEffect, useState } from 'react';
import { useAuthStore, type CloudMapMeta } from '../store/authStore';
import { useCmapStore } from '../store/cmapStore';
import { createCloudMap, deleteCloudMap, listCloudMaps, loadCloudMap } from '../cloudSync';

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-CN', { hour12: false });
  } catch {
    return iso;
  }
}

export function MapsList() {
  const cloudMaps = useAuthStore((s) => s.cloudMaps);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const maps = await listCloudMaps();
      useAuthStore.getState().setCloudMaps(maps);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载云端地图失败');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** 打开某张云端地图 → 载入编辑区并记录 cloudMapId */
  const handleOpen = async (meta: CloudMapMeta) => {
    setBusy(true);
    setError(null);
    try {
      const doc = await loadCloudMap(meta.id);
      useCmapStore.getState().setDoc(doc);
      useCmapStore.temporal.getState().clear(); // 打开新地图不产生撤销历史
      useAuthStore.getState().setCloudMapId(meta.id);
      useAuthStore.getState().setCloudUpdatedAt(meta.updatedAt);
      useAuthStore.getState().setUiMode('editor');
    } catch (err) {
      setError(err instanceof Error ? err.message : '打开地图失败');
    } finally {
      setBusy(false);
    }
  };

  /** 新建空地图 → 立即打开 */
  const handleCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      const meta = await createCloudMap('未命名概念图');
      await handleOpen(meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : '新建地图失败');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (meta: CloudMapMeta) => {
    if (!window.confirm(`删除云端地图「${meta.title}」？此操作不可恢复。`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteCloudMap(meta.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除地图失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="app-main cm-maps">
      <div className="cm-maps__header">
        <h2>我的地图</h2>
        <button
          type="button"
          className="cm-maps__btn cm-maps__btn--primary"
          onClick={handleCreate}
          disabled={busy}
          data-testid="maps-new"
        >
          新建地图
        </button>
        <button
          type="button"
          className="cm-maps__btn"
          onClick={() => useAuthStore.getState().setUiMode('editor')}
          data-testid="maps-back"
        >
          返回编辑器
        </button>
      </div>
      {error && (
        <p className="cm-maps__error" role="alert">
          {error}
        </p>
      )}
      <ul className="cm-maps__list">
        {cloudMaps.map((m) => (
          <li key={m.id} className="cm-maps__item">
            <button type="button" className="cm-maps__open" onClick={() => handleOpen(m)}>
              <span className="cm-maps__title">{m.title}</span>
              <span className="cm-maps__time">更新于 {formatTime(m.updatedAt)}</span>
            </button>
            <button
              type="button"
              className="cm-maps__del"
              title="删除此地图"
              onClick={() => handleDelete(m)}
              disabled={busy}
            >
              删除
            </button>
          </li>
        ))}
        {!busy && cloudMaps.length === 0 && (
          <li className="cm-maps__empty">暂无云端地图，点击「新建地图」开始</li>
        )}
      </ul>
    </main>
  );
}
