/**
 * 头部操作区：保存状态 + 导出 / 导入 JSON + 云同步（登录 / 我的地图 / 退出）
 * 未配置 Supabase（.env 缺 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY）时云按钮自动隐藏。
 */
import { lazy, Suspense, useRef, useState } from 'react';
import { useCmapStore } from '../store/cmapStore';
import { useAuthStore } from '../store/authStore';
import { isSupabaseConfigured } from '../supabase';
import { signOut } from '../cloudSync';
import { exportDocument, parseImportedDocument } from '../persistence';
import { saveVersion } from '../versions';
import { LoginModal } from './LoginModal';
// 懒加载：版本面板仅在点击「版本历史」时拉取
const VersionsPanel = lazy(() =>
  import('./VersionsPanel').then((m) => ({ default: m.VersionsPanel })),
);

interface Props {
  saveState: 'saving' | 'saved';
  syncMsg?: string;
}

export function HeaderActions({ saveState, syncMsg }: Props) {
  const doc = useCmapStore((s) => s.doc);
  const setDoc = useCmapStore((s) => s.setDoc);
  const user = useAuthStore((s) => s.user);
  const uiMode = useAuthStore((s) => s.uiMode);
  const fileRef = useRef<HTMLInputElement>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showVersions, setShowVersions] = useState(false);

  /** 立即保存一个版本快照（误删保护） */
  const handleSaveVersion = async () => {
    const ok = await saveVersion(useCmapStore.getState().doc);
    if (!ok) alert('当前内容与最近版本相同，无需重复保存');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseImportedDocument(String(reader.result ?? ''));
      if (parsed) {
        setDoc(parsed);
        // 导入后清空撤销历史，避免回退到旧文档
        useCmapStore.temporal.getState().clear();
      } else {
        alert('导入失败：文件格式不正确或版本不兼容');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      // 退出后断开当前云端地图关联，避免向云端推送本地编辑
      useAuthStore.getState().setCloudMapId(null);
      useAuthStore.getState().setCloudUpdatedAt(null);
      useAuthStore.getState().setCloudMaps([]);
    } catch (err) {
      alert(err instanceof Error ? err.message : '退出失败，请重试');
    }
  };

  return (
    <div className="app-header__actions">
      {syncMsg && (
        <span className="app-header__sync-msg" role="status">
          {syncMsg}
        </span>
      )}
      <span className="app-header__save-state" role="status">
        {saveState === 'saving' ? '保存中…' : '已保存'}
      </span>
      {/* 本地地图入口：不依赖云端配置，未登录用户也可多图管理 */}
      {!user && uiMode !== 'local' && (
        <button
          className="app-header__btn"
          title="新建 / 切换 / 删除本地概念图"
          onClick={() => useAuthStore.getState().setUiMode('local')}
          data-testid="local-maps-btn"
        >
          我的地图
        </button>
      )}
      {isSupabaseConfigured && !user && (
        <button
          className="app-header__btn"
          title="登录后可将概念图保存到云端"
          onClick={() => setShowLogin(true)}
          data-testid="login-btn"
        >
          登录
        </button>
      )}
      {isSupabaseConfigured && user && (
        <>
          {uiMode !== 'local' && (
            <button
              className="app-header__btn"
              title="新建 / 切换 / 删除本地概念图"
              onClick={() => useAuthStore.getState().setUiMode('local')}
              data-testid="local-maps-btn"
            >
              本地地图
            </button>
          )}
          {uiMode !== 'maps' && (
            <button
              className="app-header__btn"
              title="查看 / 新建云端概念图"
              onClick={() => useAuthStore.getState().setUiMode('maps')}
              data-testid="maps-btn"
            >
              我的地图
            </button>
          )}
          <span className="app-header__user" title={user.email}>
            {user.email}
          </span>
          <button className="app-header__btn" title="退出登录" onClick={handleSignOut} data-testid="signout-btn">
            退出
          </button>
        </>
      )}
      <button className="app-header__btn" title="导出当前概念图为 JSON 文件" onClick={() => exportDocument(doc)}>
        导出
      </button>
      <button className="app-header__btn" title="从 JSON 文件导入概念图" onClick={() => fileRef.current?.click()}>
        导入
      </button>
      <button className="app-header__btn" title="为当前概念图保存一个历史版本" onClick={handleSaveVersion}>
        保存版本
      </button>
      <button
        className="app-header__btn"
        title="查看 / 恢复历史版本（误删保护）"
        onClick={() => setShowVersions(true)}
        data-testid="versions-btn"
      >
        版本历史
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={handleImport}
        data-testid="import-input"
      />
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onSuccess={() => setShowLogin(false)} />}
      {showVersions && (
        <Suspense fallback={null}>
          <VersionsPanel onClose={() => setShowVersions(false)} />
        </Suspense>
      )}
    </div>
  );
}
