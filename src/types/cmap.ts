/**
 * 概念地图数据模型（三元组结构，对齐 Lynkage）
 *
 * 设计来源：docs/Lynkage实现分析.md —— Lynkage 把概念图建模为
 *   CONCEPT（概念）— CONNECTION（连接）— LINKING_PHRASE（连词）— CONNECTION（连接）— CONCEPT（概念）
 *
 * v1 连词即独立节点（可拖动 / 有样式 / 可再被连线），一条命题 =
 *   2 条 Connection（概念→连词、连词→概念）+ 1 个 LinkingPhrase 节点。
 * 直连（Ctrl+Shift 拖线）= 1 条 Connection（viaId=null）。
 */

export const CMAP_SCHEMA_VERSION = 2;

/** 概念节点 */
export interface Concept {
  id: string;
  type: 'concept';
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** 节点样式 */
  style: {
    fill: string;
    borderColor: string;
    fontSize: number;
  };
  /** 父节点 id（嵌入式节点，v2），v1 恒为 null */
  parentId: string | null;
}

/** 连词（Linking Phrase）—— 独立节点，位于两条 Connection 之间 */
export interface LinkingPhrase {
  id: string;
  type: 'linkingPhrase';
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  style: {
    fill: string;
    borderColor: string;
    fontSize: number;
  };
}

/** 连接（三元组中的边） */
export interface Connection {
  id: string;
  type: 'connection';
  fromId: string;
  toId: string;
  /**
   * 所属命题连词 id：
   * - 带连词的命题：两条边都指向同一个 lp.id；
   * - 直连（Ctrl+Shift）：null。
   */
  viaId: string | null;
  /** 贝塞尔曲线控制点（v1 空数组，直线） */
  controlPoints: number[];
}

/** 地图主题/背景等配置（v1 预留） */
export interface CmapConfig {
  theme: string;
  background: { type: 'grid'; color: string };
}

/** 整图数据（本地 IndexedDB 与未来云端共用同一结构） */
export interface CmapDocument {
  schemaVersion: number;
  id: string;
  title: string;
  config: CmapConfig;
  concepts: Concept[];
  linkingPhrases: LinkingPhrase[];
  connections: Connection[];
  /** 演示帧（v2），数据层预留 */
  frames: unknown[];
  createdAt: string;
  updatedAt: string;
}

/** 新建一个空文档 */
export function createEmptyDocument(title = '未命名概念图'): CmapDocument {
  const now = new Date().toISOString();
  return {
    schemaVersion: CMAP_SCHEMA_VERSION,
    id: `map-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    config: { theme: 'default', background: { type: 'grid', color: '#ffffff' } },
    concepts: [],
    linkingPhrases: [],
    connections: [],
    frames: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** 生成短 id */
export function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
