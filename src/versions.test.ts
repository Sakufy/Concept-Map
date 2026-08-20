import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyDocument, type CmapDocument } from './types/cmap';

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
  AUTO_SNAPSHOT_INTERVAL_MS,
  MAX_VERSIONS_PER_MAP,
  deleteVersion,
  listVersions,
  loadVersion,
  saveVersion,
  shouldAutoSnapshot,
} from './versions';

function makeDoc(overrides: Partial<CmapDocument> = {}): CmapDocument {
  return { ...createEmptyDocument('测试图'), ...overrides };
}

describe('历史版本存储', () => {
  beforeEach(() => {
    memoryStore.clear();
  });

  it('saveVersion 保存快照并可在列表按时间倒序读取', async () => {
    const doc = makeDoc({ id: 'map-1', title: '物理' });
    doc.concepts.push({ id: 'c1', type: 'concept', text: '力', x: 0, y: 0, w: 160, h: 60, style: {} as never, parentId: null });
    expect(await saveVersion(doc)).toBe(true);

    const versions = await listVersions('map-1');
    expect(versions).toHaveLength(1);
    expect(versions[0].title).toBe('物理');
    expect(versions[0].conceptCount).toBe(1);

    // 另一张地图的版本隔离
    expect(await listVersions('map-2')).toHaveLength(0);
  });

  it('内容与最新版本相同时 saveVersion 幂等跳过', async () => {
    const doc = makeDoc({ id: 'map-1' });
    await saveVersion(doc);
    expect(await saveVersion({ ...doc })).toBe(false);
    expect(await listVersions('map-1')).toHaveLength(1);
  });

  it('每图版本数达到上限时淘汰最旧', async () => {
    const doc = makeDoc({ id: 'map-1' });
    for (let i = 0; i < MAX_VERSIONS_PER_MAP + 3; i++) {
      // 每次内容不同，避免幂等跳过
      doc.title = `版本${i}`;
      await saveVersion({ ...doc });
    }
    const versions = await listVersions('map-1');
    expect(versions).toHaveLength(MAX_VERSIONS_PER_MAP);
    // 最旧的 3 个被淘汰，保留最新的 20 个
    expect(versions.some((v) => v.title === '版本0')).toBe(false);
    expect(versions[0].title).toBe(`版本${MAX_VERSIONS_PER_MAP + 2}`);
  });

  it('loadVersion 读取快照 / deleteVersion 删除', async () => {
    const doc = makeDoc({ id: 'map-1', title: '待恢复' });
    doc.linkingPhrases.push({ id: 'lp1', type: 'linkingPhrase', text: '导致', x: 0, y: 0, w: 80, h: 30, style: {} as never });
    await saveVersion(doc);
    const [meta] = await listVersions('map-1');
    const snap = await loadVersion(meta.id);
    expect(snap?.linkingPhrases).toHaveLength(1);

    await deleteVersion(meta.id);
    expect(await listVersions('map-1')).toHaveLength(0);
    expect(await loadVersion(meta.id)).toBeNull();
  });

  it('shouldAutoSnapshot：无版本时 true，距上次 ≥ 间隔 true，否则 false', async () => {
    expect(await shouldAutoSnapshot('map-1')).toBe(true);

    const doc = makeDoc({ id: 'map-1' });
    await saveVersion(doc);
    expect(await shouldAutoSnapshot('map-1')).toBe(false);

    // 模拟时间流逝：直接改存储里的 createdAt
    const all = (memoryStore.get('cmap-versions-v1') as { createdAt: string }[]).map((v) => ({
      ...v,
      createdAt: new Date(Date.now() - AUTO_SNAPSHOT_INTERVAL_MS - 1000).toISOString(),
    }));
    memoryStore.set('cmap-versions-v1', all);
    expect(await shouldAutoSnapshot('map-1')).toBe(true);
  });
});
