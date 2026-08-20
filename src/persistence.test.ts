import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyDocument, type CmapDocument } from './types/cmap';

// 内存版 idb-keyval（jsdom 无 indexedDB），模拟官方 get/set/del
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

import {
  DOC_KEY,
  LAST_LOCAL_MAP_KEY,
  LOCAL_MAPS_KEY,
  createLocalMap,
  deleteLocalMap,
  getLastLocalMapId,
  listLocalMaps,
  loadLocalMap,
  migrateLegacyDocument,
  saveLocalMap,
  setLastLocalMapId,
} from './persistence';

/** 直接塞入一张文档（绕过 createLocalMap，用于构造差异化的 updatedAt） */
function seedDoc(overrides: Partial<CmapDocument> = {}): CmapDocument {
  const doc = createEmptyDocument(overrides.title ?? '种子图');
  memoryStore.set(`cmap-local-map-${doc.id}`, doc);
  const meta = {
    id: doc.id,
    title: doc.title,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
  const existing = (memoryStore.get(LOCAL_MAPS_KEY) as unknown[] | undefined) ?? [];
  memoryStore.set(LOCAL_MAPS_KEY, [meta, ...existing]);
  return doc;
}

describe('本地多图持久化', () => {
  beforeEach(() => {
    memoryStore.clear();
  });

  it('createLocalMap 写入元信息、文档并记录最近打开', async () => {
    const meta = await createLocalMap('物理概念图');
    expect(meta.title).toBe('物理概念图');
    expect(memoryStore.get(LOCAL_MAPS_KEY)).toHaveLength(1);
    expect(memoryStore.get(`cmap-local-map-${meta.id}`)).toBeTruthy();
    expect(memoryStore.get(LAST_LOCAL_MAP_KEY)).toBe(meta.id);

    const maps = await listLocalMaps();
    expect(maps).toHaveLength(1);
    expect(maps[0].id).toBe(meta.id);
  });

  it('listLocalMaps 最近更新在前', async () => {
    const a = seedDoc();
    const b = seedDoc();
    // 让 b 更晚更新
    await saveLocalMap({ ...b, updatedAt: '2099-01-01T00:00:00.000Z' });
    const maps = await listLocalMaps();
    expect(maps.map((m) => m.id)).toEqual([b.id, a.id]);
  });

  it('saveLocalMap 更新标题与 updatedAt，且不改变 createdAt', async () => {
    const meta = await createLocalMap('旧标题');
    const doc = (await loadLocalMap(meta.id))!;
    const ok = await saveLocalMap({
      ...doc,
      title: '新标题',
      updatedAt: '2099-01-01T00:00:00.000Z',
    });
    expect(ok).toBe(true);
    const saved = (await loadLocalMap(meta.id))!;
    expect(saved.title).toBe('新标题');
    const maps = await listLocalMaps();
    expect(maps[0].title).toBe('新标题');
    expect(maps[0].createdAt).toBe(meta.createdAt);
  });

  it('loadLocalMap 对缺失/版本不兼容返回 null', async () => {
    expect(await loadLocalMap('no-such-map')).toBeNull();
    memoryStore.set('cmap-local-map-bad', { schemaVersion: 1, concepts: [] });
    expect(await loadLocalMap('bad')).toBeNull();
  });

  it('deleteLocalMap 删除文档、元信息并清除最近打开记录', async () => {
    const a = await createLocalMap('图A');
    const b = await createLocalMap('图B');
    await deleteLocalMap(a.id);
    const maps = await listLocalMaps();
    expect(maps.map((m) => m.id)).toEqual([b.id]);
    expect(memoryStore.get(`cmap-local-map-${a.id}`)).toBeUndefined();
    // lastId 指向最后创建的 b，删除 a 不影响
    expect(memoryStore.get(LAST_LOCAL_MAP_KEY)).toBe(b.id);
    // 删除 lastId 指向的 b → lastId 清空
    await deleteLocalMap(b.id);
    expect(memoryStore.get(LAST_LOCAL_MAP_KEY)).toBeNull();
  });

  it('setLastLocalMapId / getLastLocalMapId 记忆最近打开', async () => {
    await setLastLocalMapId('map-x');
    expect(await getLastLocalMapId()).toBe('map-x');
    await setLastLocalMapId(null);
    expect(await getLastLocalMapId()).toBeNull();
  });

  it('migrateLegacyDocument 将旧单文档迁移为本地地图并清除旧 key', async () => {
    const legacy = createEmptyDocument('我的旧图');
    memoryStore.set(DOC_KEY, legacy);
    const migrated = await migrateLegacyDocument();
    expect(migrated?.id).toBe(legacy.id);
    expect(memoryStore.get(DOC_KEY)).toBeUndefined();
    expect(memoryStore.get(`cmap-local-map-${legacy.id}`)).toBeTruthy();
    expect(memoryStore.get(LAST_LOCAL_MAP_KEY)).toBe(legacy.id);
    // 二次调用：已迁移过 → 返回 null 且不重复导入
    expect(await migrateLegacyDocument()).toBeNull();
    expect((await listLocalMaps()).map((m) => m.id)).toEqual([legacy.id]);
  });

  it('migrateLegacyDocument 无旧文档返回 null', async () => {
    expect(await migrateLegacyDocument()).toBeNull();
  });
});
