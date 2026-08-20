/**
 * 云同步相关 UI 状态（不参与撤销历史）：
 * - 当前登录用户
 * - 视图模式：editor（画布）/ maps（云端我的地图列表）/ local（本地地图列表）
 * - 云端地图列表
 * - 当前打开的云端地图 id（用于自动保存）
 */
import { create } from 'zustand';

export interface CloudUser {
  id: string;
  email: string;
}

export interface CloudMapMeta {
  id: string;
  title: string;
  updatedAt: string;
}

interface AuthState {
  user: CloudUser | null;
  uiMode: 'editor' | 'maps' | 'local';
  cloudMaps: CloudMapMeta[];
  cloudMapId: string | null;
  /** 最近一次从云端读取/写入得到的 updated_at（冲突检测用） */
  cloudUpdatedAt: string | null;
  /** 登录态恢复完成（启动时 onAuthStateChange 回调） */
  authReady: boolean;

  setUser: (user: CloudUser | null) => void;
  setUiMode: (mode: 'editor' | 'maps' | 'local') => void;
  setCloudMaps: (maps: CloudMapMeta[]) => void;
  setCloudMapId: (id: string | null) => void;
  setCloudUpdatedAt: (at: string | null) => void;
  setAuthReady: (ready: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  uiMode: 'editor',
  cloudMaps: [],
  cloudMapId: null,
  cloudUpdatedAt: null,
  authReady: false,

  setUser: (user) => set({ user }),
  setUiMode: (uiMode) => set({ uiMode }),
  setCloudMaps: (cloudMaps) => set({ cloudMaps }),
  setCloudMapId: (cloudMapId) => set({ cloudMapId }),
  setCloudUpdatedAt: (cloudUpdatedAt) => set({ cloudUpdatedAt }),
  setAuthReady: (authReady) => set({ authReady }),
}));
