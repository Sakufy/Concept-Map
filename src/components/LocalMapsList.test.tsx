import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAuthStore } from '../store/authStore';
import { useCmapStore } from '../store/cmapStore';
import { createEmptyDocument } from '../types/cmap';
import { LOCAL_FOLDERS_KEY, LOCAL_MAPS_KEY } from '../persistence';
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

/** 预置两张地图；m1 可指定 folderId（默认根目录） */
function seedMaps(folderIdForM1: string | null = null) {
  const meta = [
    { id: 'm1', title: '数学概念图', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-08-01T10:00:00.000Z', folderId: folderIdForM1 },
    { id: 'm2', title: '物理概念图', createdAt: '2026-01-02T00:00:00.000Z', updatedAt: '2026-08-02T10:00:00.000Z', folderId: null },
  ];
  memoryStore.set(LOCAL_MAPS_KEY, meta);
  memoryStore.set('cmap-local-map-m1', { ...createEmptyDocument('数学概念图'), id: 'm1' });
  memoryStore.set('cmap-local-map-m2', { ...createEmptyDocument('物理概念图'), id: 'm2' });
}

function seedFolders() {
  memoryStore.set(LOCAL_FOLDERS_KEY, [{ id: 'f1', name: '数学', createdAt: '2026-01-01T00:00:00.000Z' }]);
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

describe('LocalMapsList 文件夹分组', () => {
  beforeEach(() => {
    memoryStore.clear();
    useAuthStore.setState({ uiMode: 'local', user: null });
    useCmapStore.setState({ doc: createEmptyDocument(), selectedNodeIds: [], selectedEdgeId: null });
    useCmapStore.temporal.getState().clear();
  });

  it('文件夹内的地图以分组展示', async () => {
    seedFolders();
    seedMaps('f1');
    render(<LocalMapsList />);
    expect(await screen.findByText('📁 数学')).toBeInTheDocument();
    expect(screen.getByText('1 张')).toBeInTheDocument();
    expect(screen.getByText('数学概念图')).toBeInTheDocument();
    // 根目录地图仍平铺
    expect(screen.getByText('物理概念图')).toBeInTheDocument();
  });

  it('新建文件夹：输入名称回车后出现在列表', async () => {
    render(<LocalMapsList />);
    await screen.findByText('暂无本地地图，点击「新建地图」开始');
    await userEvent.click(screen.getByTestId('local-folder-new'));
    await userEvent.type(screen.getByTestId('local-folder-input'), '物理');
    await userEvent.keyboard('{Enter}');
    const folders = await screen.findAllByText('📁 物理');
    expect(folders).toHaveLength(1);
    expect(memoryStore.get(LOCAL_FOLDERS_KEY)).toHaveLength(1);
  });

  it('把地图移动到文件夹 → 分组计数更新', async () => {
    seedFolders();
    seedMaps();
    render(<LocalMapsList />);
    await screen.findByText('数学概念图');
    await userEvent.selectOptions(screen.getByTestId('map-folder-m1'), 'f1');
    // 刷新后 m1 进入「数学」文件夹
    expect(await screen.findByText('📁 数学')).toBeInTheDocument();
    expect(await screen.findByText('1 张')).toBeInTheDocument();
  });

  it('删除文件夹 → 地图移回根目录，地图不删除', async () => {
    seedFolders();
    seedMaps('f1');
    render(<LocalMapsList />);
    await screen.findByText('📁 数学');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await userEvent.click(screen.getByTestId('folder-del-f1'));
    await waitFor(() => expect(screen.queryByText('📁 数学')).not.toBeInTheDocument());
    expect(memoryStore.get(LOCAL_FOLDERS_KEY)).toHaveLength(0);
    const maps = memoryStore.get(LOCAL_MAPS_KEY) as { folderId: string | null }[];
    expect(maps.every((m) => m.folderId === null)).toBe(true);
    expect(maps).toHaveLength(2); // 地图本身未被删除
  });
});
