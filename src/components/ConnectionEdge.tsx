/**
 * 连接线（直线 + 箭头）。
 * - 连词已是独立节点，线上不再渲染 label；命题由「概念→连词」「连词→概念」两段组成。
 * - 端点默认用 React Flow 的 Handle 位置；当 data.points 存在时优先使用
 *   「最短吸附」计算出的起止点（两节点边界上距离最短的两点，均在节点外侧）。
 */
import { useReactFlow, BaseEdge, EdgeLabelRenderer, type Edge, type EdgeProps } from '@xyflow/react';

export type ConnectionEdgeData = {
  viaId: string | null;
  /** 焦点路径：是否在最短路径上 */
  isPath: boolean;
  /** 焦点路径：非路径元素整体淡化 */
  isDimmed: boolean;
  /** 焦点路径：边在路径上的顺序编号（1 起），不在路径上为 null */
  pathOrder: number | null;
  /**
   * 最短吸附端点（flow 坐标，见 geometry.findClosestEdgePoints）。
   * 节点未测量完成时为 null → 回退用 React Flow 默认 Handle 位置。
   */
  points?: { sx: number; sy: number; tx: number; ty: number } | null;
};
export type ConnectionEdgeType = Edge<ConnectionEdgeData, 'connection'>;

export function ConnectionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  selected,
  markerEnd,
  data = {} as ConnectionEdgeData,
}: EdgeProps<ConnectionEdgeType>) {
  const { getZoom } = useReactFlow();
  const zoom = getZoom();

  // 直线：P0=源端点 → P1=目标端点（优先用最短吸附点，否则用 Handle 位置）
  const p = data.points;
  const sx = p?.sx ?? sourceX;
  const sy = p?.sy ?? sourceY;
  const tx = p?.tx ?? targetX;
  const ty = p?.ty ?? targetY;
  const edgePath = `M ${sx},${sy} L ${tx},${ty}`;

  // 焦点路径：线段中点，用于放顺序编号徽标
  const showBadge = data.isPath && data.pathOrder != null;
  const mid = showBadge ? { x: (sx + tx) / 2, y: (sy + ty) / 2 } : null;

  const lineClass = [
    'cm-edge__line',
    selected ? 'is-selected' : '',
    data.isPath ? 'is-path' : '',
    data.isDimmed ? 'is-dimmed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        className={lineClass}
      />
      {showBadge && mid && (
        <EdgeLabelRenderer>
          <div
            className="cm-edge__order-badge nopan nodrag"
            data-testid="edge-order-badge"
            style={{
              transform: `translate(-50%,-50%) translate(${mid.x}px, ${mid.y}px) scale(${1 / zoom})`,
            }}
          >
            {data.pathOrder}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
