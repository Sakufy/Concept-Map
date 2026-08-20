/**
 * 历史版本（误删保护）：IndexedDB 保存地图版本快照时间线。
 * - 存储：`cmap-versions-v1` 数组，每项含完整 CmapDocument 快照 + 创建时间
 * - 按地图分组限制（每图最多 MAX_VERSIONS_PER_MAP 个，超出删除最旧）
 * - 手动「保存版本」+ 编辑防抖自动快照（距上次 ≥ 2 分钟才打）
 */
import { get, set } from 'idb-keyval';
import { genId, type CmapDocument } from './types/cmap';

export const VERSIONS_KEY = 'cmap-versions-v1';
/** 每张地图最多保留的版本数（上限保护，避免 IndexedDB 膨胀） */
export const MAX_VERSIONS_PER_MAP = 20;
/** 自动快照最小间隔（与上次快照相比，避免每次保存都打点） */
export const AUTO_SNAPSHOT_INTERVAL_MS = 2 * 60 * 1000;

export interface VersionEntry {
  id: string;
  mapId: string;
  title: string;
  createdAt: string;
  doc: CmapDocument;
}

/** 列表页展示用元信息（不含整图快照） */
export type VersionMeta = Omit<VersionEntry, 'doc'> & {
  conceptCount: number;
  linkingPhraseCount: number;
  connectionCount: number;
};

async function readAll(): Promise<VersionEntry[]> {
  try {
    const all = await get<VersionEntry[]>(VERSIONS_KEY);
    return Array.isArray(all) ? all : [];
  } catch {
    return [];
  }
}

async function writeAll(all: VersionEntry[]): Promise<void> {
  await set(VERSIONS_KEY, all);
}

/** 列出某地图的版本（最近在前） */
export async function listVersions(mapId: string): Promise<VersionMeta[]> {
  const all = await readAll();
  return all
    .filter((v) => v.mapId === mapId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((v) => ({
      id: v.id,
      mapId: v.mapId,
      title: v.title,
      createdAt: v.createdAt,
      conceptCount: v.doc.concepts.length,
      linkingPhraseCount: v.doc.linkingPhrases.length,
      connectionCount: v.doc.connections.length,
    }));
}

/**
 * 保存一个版本快照。若该地图已达上限则删除最旧版本。
 * 内容与最新快照完全一致时跳过（幂等，返回 false）。
 */
export async function saveVersion(doc: CmapDocument): Promise<boolean> {
  const all = await readAll();
  const mapVersions = all.filter((v) => v.mapId === doc.id);
  if (mapVersions.length > 0) {
    const last = mapVersions[mapVersions.length - 1];
    if (last && JSON.stringify(last.doc) === JSON.stringify(doc)) return false;
  }
  const entry: VersionEntry = {
    id: genId('ver'),
    mapId: doc.id,
    title: doc.title,
    createdAt: new Date().toISOString(),
    doc,
  };
  const next = [...all, entry];
  // 按地图分组裁剪，保留最近的 MAX_VERSIONS_PER_MAP 个
  const others = next.filter((v) => v.mapId !== doc.id);
  const kept = [...next.filter((v) => v.mapId === doc.id)]
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
    .slice(-MAX_VERSIONS_PER_MAP);
  await writeAll([...others, ...kept]);
  return true;
}

/** 读取版本整图快照（用于恢复） */
export async function loadVersion(id: string): Promise<CmapDocument | null> {
  const all = await readAll();
  return all.find((v) => v.id === id)?.doc ?? null;
}

/** 删除一个版本 */
export async function deleteVersion(id: string): Promise<void> {
  const all = await readAll();
  await writeAll(all.filter((v) => v.id !== id));
}

/** 该地图是否需要自动快照（距上次快照 ≥ 2 分钟） */
export async function shouldAutoSnapshot(mapId: string): Promise<boolean> {
  const all = await readAll();
  const mapVersions = all.filter((v) => v.mapId === mapId);
  if (mapVersions.length === 0) return true;
  const lastAt = new Date(
    [...mapVersions].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0].createdAt,
  ).getTime();
  return Date.now() - lastAt >= AUTO_SNAPSHOT_INTERVAL_MS;
}
