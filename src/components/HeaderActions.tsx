/**
 * 头部操作区（清爽版）：保存状态 chip + 用户区（登录 / 头像下拉）+ ⋯ 聚合菜单。
 * - 状态 chip：● 已保存 / 保存中…（信息态，浅底胶囊）
 * - 未登录：我的地图（本地列表入口）+ 登录按钮
 * - 已登录：头像按钮展开菜单（本地地图 / 云端地图 / 退出登录）
 * - ⋯ 菜单：导入 / 导出 / 保存版本 / 版本历史（低频 I/O 与版本管理收拢，减少头部密度）
 * 未配置 Supabase（.env 缺 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY）时云功能自动隐藏。
 */
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useCmapStore } from '../store/cmapStore';
import { useAuthStore } from '../store/authStore';
import { isSupabaseConfigured } from '../supabase';
import { signOut } from '../cloudSync';
import { exportDocument, parseImportedDocument } from '../persistence';
import { saveVersion } from '../versions';
import { LoginModal } from './LoginModal';
import {
  IconChevronDown,
  IconDownload,
  IconFolder,
  IconHistory,
  IconLogOut,
  IconMore,
  IconSave,
  IconUpload,
  IconUser,
} from './icons';
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
  const [openMenu, setOpenMenu] = useState<'user' | 'more' | null>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  // 下拉菜单通用开关：点击菜单外任意处 / Esc 关闭
  useEffect(() => {
    if (!openMenu) return;
    const onPointerDown = (e: PointerEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openMenu]);

  /** 立即保存一个版本快照（误删保护） */
  const handleSaveVersion = async () => {
    setOpenMenu(null);
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
    setOpenMenu(null);
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

  const goLocal = () => {
    setOpenMenu(null);
    useAuthStore.getState().setUiMode('local');
  };
  const goMaps = () => {
    setOpenMenu(null);
    useAuthStore.getState().setUiMode('maps');
  };

  const userInitial = user?.email ? user.email[0].toUpperCase() : '?';
  const moreBtn = (
    <button
      className="app-header__icon-btn"
      title="更多操作"
      aria-label="更多操作"
      aria-expanded={openMenu === 'more'}
      onClick={() => setOpenMenu(openMenu === 'more' ? null : 'more')}
      data-testid="more-menu-btn"
    >
      <IconMore />
    </button>
  );

  return (
    <div className="app-header__actions" ref={actionsRef}>
      {syncMsg && (
        <span className="app-header__sync-msg" role="status">
          {syncMsg}
        </span>
      )}
      <span className="app-header__save-state" role="status">
        {saveState === 'saving' ? '保存中…' : '已保存'}
      </span>

      {/* 未登录：我的地图 = 本地地图列表入口（不依赖云端配置） */}
      {!user && uiMode !== 'local' && (
        <button
          className="app-header__btn"
          title="新建 / 切换 / 删除本地概念图"
          onClick={goLocal}
          data-testid="local-maps-btn"
        >
          <IconFolder />我的地图
        </button>
      )}
      {isSupabaseConfigured && !user && (
        <button
          className="app-header__btn"
          title="登录后可将概念图保存到云端"
          onClick={() => setShowLogin(true)}
          data-testid="login-btn"
        >
          <IconUser />登录
        </button>
      )}

      {/* 已登录：头像下拉（本地地图 / 云端地图 / 退出） */}
      {isSupabaseConfigured && user && (
        <div className="app-header__menu-wrap">
          <button
            className="app-header__user-btn"
            title={user.email}
            aria-expanded={openMenu === 'user'}
            onClick={() => setOpenMenu(openMenu === 'user' ? null : 'user')}
            data-testid="user-menu-btn"
          >
            <span className="app-header__avatar">{userInitial}</span>
            <span className="app-header__user-email">{user.email}</span>
            <IconChevronDown />
          </button>
          {openMenu === 'user' && (
            <div className="cm-dropdown cm-dropdown--right" role="menu">
              <button className="cm-dropdown__item" onClick={goLocal} data-testid="local-maps-menu">
                <IconFolder />
                <span>本地地图</span>
              </button>
              <button className="cm-dropdown__item" onClick={goMaps} data-testid="maps-menu">
                <IconFolder />
                <span>云端地图</span>
              </button>
              <div className="cm-dropdown__sep" />
              <button className="cm-dropdown__item" onClick={handleSignOut} data-testid="signout-btn">
                <IconLogOut />
                <span>退出登录</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ⋯ 聚合菜单：导入 / 导出 / 保存版本 / 版本历史 */}
      <div className="app-header__menu-wrap">
        {moreBtn}
        {openMenu === 'more' && (
          <div className="cm-dropdown cm-dropdown--right" role="menu">
            <button
              className="cm-dropdown__item"
              title="从 JSON 文件导入概念图"
              onClick={() => {
                setOpenMenu(null);
                fileRef.current?.click();
              }}
              data-testid="import-menu-btn"
            >
              <IconUpload />
              <span>导入</span>
            </button>
            <button
              className="cm-dropdown__item"
              title="导出当前概念图为 JSON 文件"
              onClick={() => {
                setOpenMenu(null);
                exportDocument(doc);
              }}
              data-testid="export-menu-btn"
            >
              <IconDownload />
              <span>导出</span>
            </button>
            <div className="cm-dropdown__sep" />
            <button className="cm-dropdown__item" onClick={handleSaveVersion} data-testid="save-version-btn">
              <IconSave />
              <span>保存版本</span>
            </button>
            <button
              className="cm-dropdown__item"
              onClick={() => {
                setOpenMenu(null);
                setShowVersions(true);
              }}
              data-testid="versions-btn"
            >
              <IconHistory />
              <span>版本历史</span>
            </button>
          </div>
        )}
      </div>

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
