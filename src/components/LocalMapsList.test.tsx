import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAuthStore } from '../store/authStore';
import { useCmapStore } from '../store/cmapStore';
import { createEmptyDocument } from '../types/cmap';
import { LOCAL_MAPS_KEY } from '../persistence';
import { LocalMapsList } from './LocalMapsList';

const { memoryStore } = vi.hoisted(() => ({
  memoryStore: new Map<string, unknown>(),
}));
vi.mock('idb-keyval', () => ({
  get: async (key: string) => memoryStore.get(key),
  set: async (key: string, value: unknown) => {
    memoryStore.set(key, value);
  },
  del: async (key: string) => {
    memoryStore.delete(key);
  },
}));

function seedMaps() {
  const meta = [
    { id: 'm1', title: '数学概念图', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-08-01T10:00:00.000Z' },
    { id: 'm2', title: '物理概念图', createdAt: '2026-01-02T00:00:00.000Z', updatedAt: '2026-08-02T10:00:00.000Z' },
  ];
  memoryStore.set(LOCAL_MAPS_KEY, meta);
  memoryStore.set('cmap-local-map-m1', { ...createEmptyDocument('数学概念图'), id: 'm1' });
  memoryStore.set('cmap-local-map-m2', { ...createEmptyDocument('物理概念图'), id: 'm2' });
}

describe('LocalMapsList 本地地图列表', () => {
  beforeEach(() => {
    memoryStore.clear();
    useAuthStore.setState({ uiMode: 'local', user: null });
    useCmapStore.setState({ doc: createEmptyDocument(), selectedNodeIds: [], selectedEdgeId: null });
    useCmapStore.temporal.getState().clear();
  });

  it('渲染本地地图标题列表', async () => {
    seedMaps();
    render(<LocalMapsList />);
    expect(await screen.findByText('数学概念图')).toBeInTheDocument();
    expect(screen.getByText('物理概念图')).toBeInTheDocument();
    expect(screen.getByText('本地地图')).toBeInTheDocument();
  });

  it('空列表显示引导文案', async () => {
    render(<LocalMapsList />);
    expect(await screen.findByText('暂无本地地图，点击「新建地图」开始')).toBeInTheDocument();
  });

  it('点击「新建地图」创建并进入编辑器', async () => {
    render(<LocalMapsList />);
    await screen.findByText('暂无本地地图，点击「新建地图」开始');
    await userEvent.click(screen.getByTestId('local-maps-new'));
    // 新建后 handleOpen 切到编辑器
    expect(useAuthStore.getState().uiMode).toBe('editor');
    expect(useCmapStore.getState().doc.title).toBe('未命名概念图');
  });

  it('点击某张地图 → 载入并进入编辑器', async () => {
    seedMaps();
    render(<LocalMapsList />);
    await userEvent.click(await screen.findByText('数学概念图'));
    expect(useAuthStore.getState().uiMode).toBe('editor');
    expect(useCmapStore.getState().doc.id).toBe('m1');
    expect(useCmapStore.getState().doc.title).toBe('数学概念图');
  });
});
