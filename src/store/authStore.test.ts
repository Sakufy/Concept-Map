import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './authStore';

describe('authStore（云同步 UI 状态）', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      uiMode: 'editor',
      cloudMaps: [],
      cloudMapId: null,
      cloudUpdatedAt: null,
      authReady: false,
    });
  });

  it('登录/退出更新用户与 authReady', () => {
    useAuthStore.getState().setAuthReady(true);
    expect(useAuthStore.getState().authReady).toBe(true);

    useAuthStore.getState().setUser({ id: 'u1', email: 'a@b.com' });
    expect(useAuthStore.getState().user?.email).toBe('a@b.com');

    useAuthStore.getState().setUser(null);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('视图模式在 editor 与 maps 间切换', () => {
    expect(useAuthStore.getState().uiMode).toBe('editor');
    useAuthStore.getState().setUiMode('maps');
    expect(useAuthStore.getState().uiMode).toBe('maps');
    useAuthStore.getState().setUiMode('editor');
    expect(useAuthStore.getState().uiMode).toBe('editor');
  });

  it('云端地图列表 / cloudMapId / 云端版本号可更新', () => {
    useAuthStore.getState().setCloudMaps([{ id: 'm1', title: '图1', updatedAt: '2026-08-20T00:00:00Z' }]);
    expect(useAuthStore.getState().cloudMaps).toHaveLength(1);
    expect(useAuthStore.getState().cloudMaps[0].title).toBe('图1');

    useAuthStore.getState().setCloudMapId('m1');
    expect(useAuthStore.getState().cloudMapId).toBe('m1');

    useAuthStore.getState().setCloudUpdatedAt('2026-08-20T00:00:01Z');
    expect(useAuthStore.getState().cloudUpdatedAt).toBe('2026-08-20T00:00:01Z');

    // 打开本地图 / 退出时清空关联
    useAuthStore.getState().setCloudMapId(null);
    useAuthStore.getState().setCloudUpdatedAt(null);
    expect(useAuthStore.getState().cloudMapId).toBeNull();
    expect(useAuthStore.getState().cloudUpdatedAt).toBeNull();
  });
});
