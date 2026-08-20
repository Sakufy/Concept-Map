/**
 * 本地持久化：IndexedDB 自动保存 + JSON 导入导出 + 本地多图管理
 *
 * 采用成熟方案：idb-keyval 官方 API（get/set/del）—— 最小封装，不做自研。
 * 多图存储（v2）：
 *   - `cmap-local-maps-v1`    元信息列表（LocalMapMeta[]，供列表页展示）
 *   - `cmap-local-folders-v1` 文件夹列表（LocalFolderMeta[]，供「我的地图」分组）
 *   - `cmap-local-map-{id}`   每张图的完整 CmapDocument
 *   - `cmap-local-last-id`    上次打开的本地图 id（启动时恢复）
 * 旧版单文档（cmap-doc-v1）在启动时自动迁移为第一张本地地图。
 */
import { get, set, del } from 'idb-keyval';
import { CMAP_SCHEMA_VERSION, createEmptyDocument, type CmapDocument } from './types/cmap';

/** 旧版单文档 key（v1，启动时迁移后删除） */
export const DOC_KEY = 'cmap-doc-v1';
/** 本地地图元信息列表 key */
export const LOCAL_MAPS_KEY = 'cmap-local-maps-v1';
/** 本地文件夹列表 key */
export const LOCAL_FOLDERS_KEY = 'cmap-local-folders-v1';
/** 上次打开的本地图 id key */
export const LAST_LOCAL_MAP_KEY = 'cmap-local-last-id';

/** 本地文件夹元信息（单层分组，地图可属于 0..1 个文件夹） */
export interface LocalFolderMeta {
  id: string;
  name: string;
  createdAt: string;
}

/** 本地地图元信息（列表页展示用，不存整图） */
export interface LocalMapMeta {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  /** 所属文件夹 id（null = 根目录，旧数据无此字段视为 null） */
  folderId: string | null;
}

const localMapDocKey = (id: string) => `cmap-local-map-${id}`;

/** 从 IndexedDB 加载文档（无数据/损坏/不可用时返回 null） */
export async function loadDocument(): Promise<CmapDocument | null> {
  try {
    const doc = await get<CmapDocument>(DOC_KEY);
    if (!doc || typeof doc !== 'object') return null;
    if (doc.schemaVersion !== CMAP_SCHEMA_VERSION) return null; // 旧版 schema 暂不迁移，直接忽略
    return doc;
  } catch {
    return null;
  }
}

/** 保存文档到 IndexedDB（失败静默，避免阻塞交互）——保留兼容旧调用 */
export async function saveDocument(doc: CmapDocument): Promise<boolean> {
  try {
    await set(DOC_KEY, doc);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// 本地多图管理（照搬云端「我的地图」模式，存储层走 IndexedDB）
// ---------------------------------------------------------------------------

async function readLocalMapsMeta(): Promise<LocalMapMeta[]> {
  try {
    const meta = await get<LocalMapMeta[]>(LOCAL_MAPS_KEY);
    return Array.isArray(meta) ? meta : [];
  } catch {
    return [];
  }
}

async function writeLocalMapsMeta(meta: LocalMapMeta[]): Promise<void> {
  await set(LOCAL_MAPS_KEY, meta);
}

// ---------------------------------------------------------------------------
// 本地文件夹管理（「我的地图」分组，单层结构）
// ---------------------------------------------------------------------------

async function readLocalFolders(): Promise<LocalFolderMeta[]> {
  try {
    const folders = await get<LocalFolderMeta[]>(LOCAL_FOLDERS_KEY);
    return Array.isArray(folders) ? folders : [];
  } catch {
    return [];
  }
}

/** 列出全部本地文件夹（按创建时间倒序） */
export async function listLocalFolders(): Promise<LocalFolderMeta[]> {
  const folders = await readLocalFolders();
  return folders.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** 新建本地文件夹（去重：同名文件夹返回已存在的） */
export async function createLocalFolder(name: string): Promise<LocalFolderMeta> {
  const trimmed = name.trim();
  const all = await readLocalFolders();
  const existing = all.find((f) => f.name === trimmed);
  if (existing) return existing;
  const folder: LocalFolderMeta = {
    id: `folder-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: trimmed || '新建文件夹',
    createdAt: new Date().toISOString(),
  };
  await writeLocalFolders([folder, ...all]);
  return folder;
}

async function writeLocalFolders(folders: LocalFolderMeta[]): Promise<void> {
  await set(LOCAL_FOLDERS_KEY, folders);
}

/** 删除本地文件夹（文件夹内地图移回根目录，不删除地图） */
export async function deleteLocalFolder(id: string): Promise<void> {
  const folders = await readLocalFolders();
  await writeLocalFolders(folders.filter((f) => f.id !== id));
  const maps = await readLocalMapsMeta();
  const moved = maps.map((m) => (m.folderId === id ? { ...m, folderId: null } : m));
  await writeLocalMapsMeta(moved);
}

/** 把某张本地地图移动到文件夹（null = 根目录） */
export async function setLocalMapFolder(mapId: string, folderId: string | null): Promise<void> {
  const maps = await readLocalMapsMeta();
  await writeLocalMapsMeta(maps.map((m) => (m.id === mapId ? { ...m, folderId } : m)));
}

/** 列出全部本地地图元信息，最近更新在前（旧数据无 folderId 视为根目录） */
export async function listLocalMaps(): Promise<LocalMapMeta[]> {
  const meta = await readLocalMapsMeta();
  return meta
    .map((m) => ({ ...m, folderId: m.folderId ?? null }))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

/** 新建本地空地图 → 写文档 + 元信息 + 设为最近打开，返回新文档 */
export async function createLocalMap(title = '未命名概念图'): Promise<CmapDocument> {
  const doc = createEmptyDocument(title);
  const meta: LocalMapMeta = {
    id: doc.id,
    title: doc.title,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    folderId: null,
  };
  const all = await readLocalMapsMeta();
  await writeLocalMapsMeta([meta, ...all]);
  await set(localMapDocKey(doc.id), doc);
  await set(LAST_LOCAL_MAP_KEY, doc.id);
  return doc;
}

/** 加载指定本地地图整图数据（无/损坏/版本不兼容返回 null） */
export async function loadLocalMap(id: string): Promise<CmapDocument | null> {
  try {
    const doc = await get<CmapDocument>(localMapDocKey(id));
    if (!doc || typeof doc !== 'object') return null;
    if (doc.schemaVersion !== CMAP_SCHEMA_VERSION) return null;
    return doc;
  } catch {
    return null;
  }
}

/** 保存本地地图（写文档 + 更新元信息的 title/updatedAt；失败静默） */
export async function saveLocalMap(doc: CmapDocument): Promise<boolean> {
  try {
    const all = await readLocalMapsMeta();
    const existing = all.find((m) => m.id === doc.id);
    const meta: LocalMapMeta = {
      id: doc.id,
      title: doc.title,
      createdAt: existing?.createdAt ?? doc.createdAt,
      updatedAt: doc.updatedAt,
      folderId: existing?.folderId ?? null,
    };
    await writeLocalMapsMeta([meta, ...all.filter((m) => m.id !== doc.id)]);
    await set(localMapDocKey(doc.id), doc);
    return true;
  } catch {
    return false;
  }
}

/** 删除本地地图（删文档 + 移出元信息；若为最近打开记录则一并清除） */
export async function deleteLocalMap(id: string): Promise<void> {
  const all = await readLocalMapsMeta();
  await writeLocalMapsMeta(all.filter((m) => m.id !== id));
  try {
    await del(localMapDocKey(id));
  } catch {
    // 文档不存在等情况忽略
  }
  try {
    const last = await get<string | null>(LAST_LOCAL_MAP_KEY);
    if (last === id) await set(LAST_LOCAL_MAP_KEY, null);
  } catch {
    // 忽略
  }
}

/** 读取上次打开的本地图 id */
export async function getLastLocalMapId(): Promise<string | null> {
  try {
    const id = await get<string | null>(LAST_LOCAL_MAP_KEY);
    return id || null;
  } catch {
    return null;
  }
}

/** 记录最近打开的本地图 id（传 null 表示无） */
export async function setLastLocalMapId(id: string | null): Promise<void> {
  await set(LAST_LOCAL_MAP_KEY, id);
}

/**
 * 迁移旧版单文档（cmap-doc-v1）为第一张本地地图：
 * - 无旧文档 → 返回 null
 * - 旧文档已迁移过（同 id 已在列表）→ 清掉旧 key，返回 null
 * - 迁移成功 → 设为最近打开并返回该文档（供启动直接打开）
 * 全程安全兜底：任何一步失败都不会把应用卡在启动流程。
 */
export async function migrateLegacyDocument(): Promise<CmapDocument | null> {
  const legacy = await loadDocument();
  if (!legacy) return null;
  try {
    const all = await readLocalMapsMeta();
    if (all.some((m) => m.id === legacy.id)) {
      await del(DOC_KEY);
      return null;
    }
    const meta: LocalMapMeta = {
      id: legacy.id,
      title: legacy.title,
      createdAt: legacy.createdAt,
      updatedAt: legacy.updatedAt,
      folderId: null,
    };
    await writeLocalMapsMeta([meta, ...all]);
    await set(localMapDocKey(legacy.id), legacy);
    await set(LAST_LOCAL_MAP_KEY, legacy.id);
    await del(DOC_KEY);
    return legacy;
  } catch {
    return null;
  }
}

/** 导出文档为 JSON 文件（浏览器下载） */
export function exportDocument(doc: CmapDocument): void {
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${doc.title || '概念图'}.cmap.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** 解析导入的 JSON，校验结构合法性；非法返回 null */
export function parseImportedDocument(text: string): CmapDocument | null {
  try {
    const doc = JSON.parse(text) as CmapDocument;
    if (!doc || typeof doc !== 'object') return null;
    if (doc.schemaVersion !== CMAP_SCHEMA_VERSION) return null;
    if (!Array.isArray(doc.concepts) || !Array.isArray(doc.connections)) return null;
    if (!Array.isArray(doc.linkingPhrases)) return null;
    return doc;
  } catch {
    return null;
  }
}
