import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { ConceptCanvas } from './components/ConceptCanvas';
import { HeaderActions } from './components/HeaderActions';
import { DocTitle } from './components/DocTitle';
import { MapsList } from './components/MapsList';
import { LocalMapsList } from './components/LocalMapsList';
// 懒加载：弹窗含 react-markdown（重依赖），仅打开时才拉取，减小首屏包体
const NodeEditModal = lazy(() =>
  import('./components/NodeEditModal').then((m) => ({ default: m.NodeEditModal })),
);
import { useCmapStore } from './store/cmapStore';
import { useAuthStore } from './store/authStore';
import { supabase } from './supabase';
import { saveMapToCloud } from './cloudSync';
import {
  createLocalMap,
  getLastLocalMapId,
  listLocalMaps,
  loadLocalMap,
  migrateLegacyDocument,
  saveLocalMap,
} from './persistence';
import { saveVersion, shouldAutoSnapshot } from './versions';
import './App.css';

export function App() {
  const title = useCmapStore((s) => s.doc.title);
  // 主题驱动根节点 class（Header 深色适配依赖 .app.is-dark）
  const isDark = useCmapStore((s) => s.doc.config.theme === 'dark');
  const uiMode = useAuthStore((s) => s.uiMode);
  const [saveState, setSaveState] = useState<'saving' | 'saved'>('saved');
  const [syncMsg, setSyncMsg] = useState('');
  const loadedRef = useRef(false);
  const syncTimerRef = useRef<number | undefined>(undefined);

  // 启动加载：迁移旧单文档 → 恢复上次打开的本地地图 → 无记录则进列表选择 / 全新用户建一张
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // 1) v1 单文档自动迁移为本地地图（仅首次，成功后清除旧 key）
      let doc = await migrateLegacyDocument();
      if (cancelled) return;
      // 2) 恢复上次打开的本地地图
      if (!doc) {
        const lastId = await getLastLocalMapId();
        if (lastId) doc = await loadLocalMap(lastId);
      }
      // 3) 无上次记录：已有本地地图 → 进入列表让用户选择；全新用户 → 直接新建一张
      if (!doc) {
        const maps = await listLocalMaps();
        if (cancelled) return;
        if (maps.length > 0) {
          useAuthStore.getState().setUiMode('local');
        } else {
          try {
            doc = await createLocalMap();
          } catch {
            // IndexedDB 不可用：保持默认空文档继续渲染
          }
        }
      }
      if (cancelled) return;
      if (doc) {
        useCmapStore.getState().setDoc(doc);
        useCmapStore.temporal.getState().clear(); // 加载不产生历史
      }
      loadedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 登录态初始化：恢复会话（Supabase 官方 onAuthStateChange 用法）
  useEffect(() => {
    if (!supabase) {
      useAuthStore.getState().setAuthReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      useAuthStore.getState().setUser(u ? { id: u.id, email: u.email ?? '' } : null);
      useAuthStore.getState().setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user;
      useAuthStore.getState().setUser(u ? { id: u.id, email: u.email ?? '' } : null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  /** 临时提示云同步状态，3 秒后消失 */
  const flashSyncMsg = (msg: string) => {
    setSyncMsg(msg);
    window.clearTimeout(syncTimerRef.current);
    syncTimerRef.current = window.setTimeout(() => setSyncMsg(''), 3000);
  };

  // 文档变化 → 防抖 500ms 自动保存（成熟方案：subscribe + debounce）
  // 用 ref 记录上次 doc 引用过滤纯视图变更（viewport/选中），避免平移/缩放画布触发「保存中…」
  // 已打开云端地图（cloudMapId）时，本地保存同时推送云端
  useEffect(() => {
    let timer: number | undefined;
    let lastDoc = useCmapStore.getState().doc;
    const unsub = useCmapStore.subscribe((state) => {
      if (state.doc === lastDoc) return;
      lastDoc = state.doc;
      if (!loadedRef.current) return;
      setSaveState('saving');
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        const doc = useCmapStore.getState().doc;
        void (async () => {
          await saveLocalMap(doc);
          // 历史版本自动快照：距上次 ≥ 2 分钟且内容有变化时打点（误删保护）
          try {
            if (await shouldAutoSnapshot(doc.id)) {
              await saveVersion(doc);
            }
          } catch {
            // 快照失败不阻塞自动保存
          }
          const { user, cloudMapId, cloudUpdatedAt } = useAuthStore.getState();
          if (user && cloudMapId) {
            try {
              const res = await saveMapToCloud(cloudMapId, doc, cloudUpdatedAt ?? undefined);
              useAuthStore.getState().setCloudUpdatedAt(res.updatedAt);
              if (res.conflict) flashSyncMsg('云端存在更新版本，已覆盖保存');
            } catch {
              flashSyncMsg('云端保存失败');
            }
          }
          setSaveState('saved');
        })();
      }, 500);
    });
    return () => {
      clearTimeout(timer);
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 全局快捷键：Ctrl+Z 撤销 / Ctrl+Shift+Z 与 Ctrl+Y 重做
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // 输入框/编辑态中不拦截（避免吃掉文本编辑的原生撤销）
      const target = e.target as HTMLElement | null;
      if (target && 'closest' in target && target.closest('input, textarea, [contenteditable="true"]')) return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          useCmapStore.temporal.getState().redo();
        } else {
          useCmapStore.temporal.getState().undo();
        }
      } else if (key === 'y') {
        e.preventDefault();
        useCmapStore.temporal.getState().redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className={`app${isDark ? ' is-dark' : ''}`}>
      <header className="app-header">
        <DocTitle title={title} />
        <div className="app-header__hint">双击空白处新建概念 · 节点拖线连线</div>
        <HeaderActions saveState={saveState} syncMsg={syncMsg} />
      </header>
      <main className="app-main">
        {uiMode === 'maps' ? (
          <MapsList />
        ) : uiMode === 'local' ? (
          <LocalMapsList />
        ) : (
          <ReactFlowProvider>
            <ConceptCanvas />
          </ReactFlowProvider>
        )}
      </main>
      <Suspense fallback={null}>
        <NodeEditModal />
      </Suspense>
    </div>
  );
}