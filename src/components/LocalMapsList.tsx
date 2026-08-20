/**
 * 「本地地图」列表视图（uiMode='local'）：
 * 新建 / 打开 / 删除本地地图（IndexedDB）。打开后切入编辑器并记录最近打开 id 供启动恢复。
 * 交互与数据流照搬云端「我的地图」（MapsList），存储层改为本地持久化。
 */
import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useCmapStore } from '../store/cmapStore';
import { createEmptyDocument } from '../types/cmap';
import {
  createLocalMap,
  deleteLocalMap,
  listLocalMaps,
  loadLocalMap,
  setLastLocalMapId,
  type LocalMapMeta,
} from '../persistence';

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-CN', { hour12: false });
  } catch {
    return iso;
  }
}

export function LocalMapsList() {
  const [maps, setMaps] = useState<LocalMapMeta[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setMaps(await listLocalMaps());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载本地地图失败');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** 打开某张本地地图 → 载入编辑区 + 记录最近打开 id + 断开云端关联 */
  const handleOpen = async (meta: LocalMapMeta) => {
    setBusy(true);
    setError(null);
    try {
      const doc = await loadLocalMap(meta.id);
      if (!doc) {
        setError('地图数据缺失或版本不兼容');
        return;
      }
      useCmapStore.getState().setDoc(doc);
      useCmapStore.temporal.getState().clear(); // 打开新地图不产生撤销历史
      await setLastLocalMapId(meta.id);
      // 本地图与云端图互斥：打开本地图即断开当前云端地图关联
      useAuthStore.getState().setCloudMapId(null);
      useAuthStore.getState().setCloudUpdatedAt(null);
      useAuthStore.getState().setUiMode('editor');
    } catch (err) {
      setError(err instanceof Error ? err.message : '打开地图失败');
    } finally {
      setBusy(false);
    }
  };

  /** 新建空地图 → 立即打开（createLocalMap 已记录最近打开 id） */
  const handleCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      const doc = await createLocalMap();
      useCmapStore.getState().setDoc(doc);
      useCmapStore.temporal.getState().clear();
      useAuthStore.getState().setCloudMapId(null);
      useAuthStore.getState().setCloudUpdatedAt(null);
      useAuthStore.getState().setUiMode('editor');
    } catch (err) {
      setError(err instanceof Error ? err.message : '新建地图失败');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (meta: LocalMapMeta) => {
    if (!window.confirm(`删除本地地图「${meta.title}」？此操作不可恢复。`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteLocalMap(meta.id);
      // 删除的是当前编辑中的地图 → 内存文档失效，切换到剩余第一张或全新空图，
      // 避免「返回编辑器」后自动保存把已删地图重新写回。
      if (useCmapStore.getState().doc.id === meta.id) {
        await setLastLocalMapId(null);
        const remaining = await listLocalMaps();
        if (remaining.length > 0) {
          const next = await loadLocalMap(remaining[0].id);
          if (next) {
            useCmapStore.getState().setDoc(next);
            useCmapStore.temporal.getState().clear();
            await setLastLocalMapId(remaining[0].id);
          }
        } else {
          const fresh = createEmptyDocument();
          useCmapStore.getState().setDoc(fresh);
          useCmapStore.temporal.getState().clear();
        }
      }
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
        <h2>本地地图</h2>
        <button
          type="button"
          className="cm-maps__btn cm-maps__btn--primary"
          onClick={handleCreate}
          disabled={busy}
          data-testid="local-maps-new"
        >
          新建地图
        </button>
        <button
          type="button"
          className="cm-maps__btn"
          onClick={() => useAuthStore.getState().setUiMode('editor')}
          data-testid="local-maps-back"
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
        {maps.map((m) => (
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
        {!busy && maps.length === 0 && (
          <li className="cm-maps__empty">暂无本地地图，点击「新建地图」开始</li>
        )}
      </ul>
    </main>
  );
}
