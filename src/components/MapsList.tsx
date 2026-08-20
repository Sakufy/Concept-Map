/**
 * 「我的地图」云端列表视图（uiMode='maps'）：
 * 新建 / 打开 / 删除云端地图 + 文件夹分组管理（单层结构）。
 * 打开后切入编辑器并记录 cloudMapId 供自动保存联动。
 * 文件夹交互与本地版 LocalMapsList 保持一致。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore, type CloudFolderMeta, type CloudMapMeta } from '../store/authStore';
import { useCmapStore } from '../store/cmapStore';
import {
  createCloudFolder,
  createCloudMap,
  deleteCloudFolder,
  deleteCloudMap,
  listCloudFolders,
  listCloudMaps,
  loadCloudMap,
  setCloudMapFolder,
} from '../cloudSync';

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-CN', { hour12: false });
  } catch {
    return iso;
  }
}

/** 单条地图项（云端版）：打开 / 移动到文件夹 / 删除 */
function MapItem({
  m,
  folders,
  busy,
  onOpen,
  onMove,
  onDelete,
}: {
  m: CloudMapMeta;
  folders: CloudFolderMeta[];
  busy: boolean;
  onOpen: (m: CloudMapMeta) => void;
  onMove: (m: CloudMapMeta, folderId: string | null) => void;
  onDelete: (m: CloudMapMeta) => void;
}) {
  return (
    <li className="cm-maps__item">
      <button type="button" className="cm-maps__open" onClick={() => onOpen(m)}>
        <span className="cm-maps__title">{m.title}</span>
        <span className="cm-maps__time">更新于 {formatTime(m.updatedAt)}</span>
      </button>
      <select
        className="cm-maps__folder-select"
        title="移动到文件夹"
        value={m.folderId ?? ''}
        onChange={(e) => onMove(m, e.target.value || null)}
        disabled={busy}
        data-testid={`map-folder-${m.id}`}
      >
        <option value="">根目录</option>
        {folders.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="cm-maps__del"
        title="删除此地图"
        onClick={() => onDelete(m)}
        disabled={busy}
      >
        删除
      </button>
    </li>
  );
}

export function MapsList() {
  const cloudMaps = useAuthStore((s) => s.cloudMaps);
  const cloudFolders = useAuthStore((s) => s.cloudFolders);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const [maps, folders] = await Promise.all([listCloudMaps(), listCloudFolders()]);
      useAuthStore.getState().setCloudMaps(maps);
      useAuthStore.getState().setCloudFolders(folders);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载云端地图失败');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (creatingFolder) folderInputRef.current?.focus();
  }, [creatingFolder]);

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
      // 删除的是当前编辑中的地图 → 断开云端关联，避免自动保存对已删图写回
      if (useAuthStore.getState().cloudMapId === meta.id) {
        useAuthStore.getState().setCloudMapId(null);
        useAuthStore.getState().setCloudUpdatedAt(null);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除地图失败');
    } finally {
      setBusy(false);
    }
  };

  /** 新建文件夹（内联输入，Enter/blur 提交，Escape 取消） */
  const handleCreateFolder = async (name: string) => {
    setCreatingFolder(false);
    if (!name.trim()) return;
    try {
      await createCloudFolder(name);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '新建文件夹失败');
    }
  };

  const handleDeleteFolder = async (folder: CloudFolderMeta) => {
    if (!window.confirm(`删除文件夹「${folder.name}」？文件夹内的地图会移到根目录，不会删除地图。`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteCloudFolder(folder.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除文件夹失败');
    } finally {
      setBusy(false);
    }
  };

  const handleMove = async (meta: CloudMapMeta, folderId: string | null) => {
    setBusy(true);
    setError(null);
    try {
      await setCloudMapFolder(meta.id, folderId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '移动地图失败');
    } finally {
      setBusy(false);
    }
  };

  const rootMaps = cloudMaps.filter((m) => !m.folderId);
  const mapsByFolder = (folderId: string) => cloudMaps.filter((m) => m.folderId === folderId);

  return (
    <main className="app-main cm-maps">
      <div className="cm-maps__header">
        <h2>我的地图</h2>
        <button
          type="button"
          className="cm-maps__btn"
          onClick={() => setCreatingFolder(true)}
          disabled={busy}
          data-testid="maps-folder-new"
        >
          新建文件夹
        </button>
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
      {creatingFolder && (
        <input
          ref={folderInputRef}
          className="cm-maps__folder-input"
          placeholder="文件夹名称，回车创建"
          onBlur={(e) => handleCreateFolder(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreateFolder(e.currentTarget.value);
            else if (e.key === 'Escape') setCreatingFolder(false);
          }}
          data-testid="maps-folder-input"
        />
      )}
      {error && (
        <p className="cm-maps__error" role="alert">
          {error}
        </p>
      )}
      <ul className="cm-maps__list">
        {cloudFolders.map((folder) => {
          const inFolder = mapsByFolder(folder.id);
          return (
            <li key={folder.id} className="cm-maps__group">
              <div className="cm-maps__group-head">
                <span className="cm-maps__group-name">📁 {folder.name}</span>
                <span className="cm-maps__group-count">{inFolder.length} 张</span>
                <button
                  type="button"
                  className="cm-maps__del"
                  title="删除文件夹（地图移到根目录）"
                  onClick={() => handleDeleteFolder(folder)}
                  disabled={busy}
                  data-testid={`folder-del-${folder.id}`}
                >
                  删除
                </button>
              </div>
              {inFolder.length > 0 ? (
                <ul className="cm-maps__sublist">
                  {inFolder.map((m) => (
                    <MapItem
                      key={m.id}
                      m={m}
                      folders={cloudFolders}
                      busy={busy}
                      onOpen={handleOpen}
                      onMove={handleMove}
                      onDelete={handleDelete}
                    />
                  ))}
                </ul>
              ) : (
                <p className="cm-maps__group-empty">文件夹为空</p>
              )}
            </li>
          );
        })}
        {rootMaps.map((m) => (
          <MapItem
            key={m.id}
            m={m}
            folders={cloudFolders}
            busy={busy}
            onOpen={handleOpen}
            onMove={handleMove}
            onDelete={handleDelete}
          />
        ))}
        {!busy && cloudMaps.length === 0 && cloudFolders.length === 0 && (
          <li className="cm-maps__empty">暂无云端地图，点击「新建地图」开始</li>
        )}
      </ul>
    </main>
  );
}
