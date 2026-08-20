import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Position, ReactFlowProvider, type EdgeProps } from '@xyflow/react';
import { ConnectionEdge, type ConnectionEdgeType } from './ConnectionEdge';

// EdgeLabelRenderer 依赖 React Flow 渲染树中的 portal 容器（jsdom 下不存在），
// mock 为直接渲染 children，便于断言序号徽标内容。
vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  return {
    ...actual,
    EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

function makeProps(overrides: Partial<EdgeProps<ConnectionEdgeType>> = {}): EdgeProps<ConnectionEdgeType> {
  return {
    id: 'conn-1',
    sourceX: 0,
    sourceY: 0,
    targetX: 100,
    targetY: 100,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    zoom: 1,
    data: {
      viaId: 'lp-1',
      isPath: false,
      isDimmed: false,
      pathOrder: null,
    },
    selected: false,
    markerEnd: undefined,
    ...overrides,
  } as EdgeProps<ConnectionEdgeType>;
}

describe('ConnectionEdge 连接线组件', () => {
  it('渲染连线 path（BaseEdge）且为直线', () => {
    render(
      <ReactFlowProvider>
        <ConnectionEdge {...makeProps()} />
      </ReactFlowProvider>,
    );
    const line = document.querySelector('.cm-edge__line');
    expect(line).toBeTruthy();
    // 直线：源 Handle → 目标 Handle 直接相连，无贝塞尔控制点
    expect(line?.getAttribute('d')).toBe('M 0,0 L 100,100');
  });

  it('选中态 line 加 is-selected class', () => {
    render(
      <ReactFlowProvider>
        <ConnectionEdge {...makeProps({ selected: true })} />
      </ReactFlowProvider>,
    );
    expect(document.querySelector('.cm-edge__line')?.classList.contains('is-selected')).toBe(true);
  });

  it('提供最短吸附 points 时优先用它渲染（动态吸附端点）', () => {
    render(
      <ReactFlowProvider>
        <ConnectionEdge
          {...makeProps({
            // Handle 默认位置（0,0）→（100,100），被吸附点覆盖
            data: {
              viaId: 'lp-1',
              isPath: false,
              isDimmed: false,
              pathOrder: null,
              points: { sx: 100, sy: 30, tx: 300, ty: 30 },
            },
          })}
        />
      </ReactFlowProvider>,
    );
    expect(document.querySelector('.cm-edge__line')?.getAttribute('d')).toBe('M 100,30 L 300,30');
  });

  it('points 为 null 时回退用 Handle 默认位置', () => {
    render(
      <ReactFlowProvider>
        <ConnectionEdge
          {...makeProps({
            data: { viaId: 'lp-1', isPath: false, isDimmed: false, pathOrder: null, points: null },
          })}
        />
      </ReactFlowProvider>,
    );
    expect(document.querySelector('.cm-edge__line')?.getAttribute('d')).toBe('M 0,0 L 100,100');
  });

  it('焦点路径：路径边加 is-path class 并渲染顺序编号徽标', () => {
    render(
      <ReactFlowProvider>
        <ConnectionEdge {...makeProps({ data: { viaId: 'lp-1', isPath: true, isDimmed: false, pathOrder: 2 } })} />
      </ReactFlowProvider>,
    );
    const line = document.querySelector('.cm-edge__line');
    expect(line?.classList.contains('is-path')).toBe(true);
    const badge = document.querySelector('[data-testid="edge-order-badge"]');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toBe('2');
  });

  it('焦点路径：淡化边加 is-dimmed class 且不渲染编号徽标', () => {
    render(
      <ReactFlowProvider>
        <ConnectionEdge {...makeProps({ data: { viaId: 'lp-1', isPath: false, isDimmed: true, pathOrder: null } })} />
      </ReactFlowProvider>,
    );
    const line = document.querySelector('.cm-edge__line');
    expect(line?.classList.contains('is-dimmed')).toBe(true);
    expect(line?.classList.contains('is-path')).toBe(false);
    expect(document.querySelector('[data-testid="edge-order-badge"]')).toBeNull();
  });
});
