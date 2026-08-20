import '@testing-library/jest-dom/vitest';

// jsdom 缺少 ResizeObserver，React Flow 依赖它
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? (ResizeObserverMock as unknown as typeof ResizeObserver);

// jsdom 缺少 DOMRectReadOnly / DOMMatrixReadOnly（React Flow 测量用）
if (typeof globalThis.DOMMatrixReadOnly === 'undefined') {
  class DOMMatrixReadOnlyMock {
    m22 = 1;
    m11 = 1;
    m12 = 0;
    m21 = 0;
    a = 1;
    b = 0;
    c = 0;
    d = 1;
    e = 0;
    f = 0;
    constructor(init?: string) {
      if (init) {
        const parts = init.split(',').map(Number);
        if (parts.length >= 6) {
          this.a = parts[0];
          this.b = parts[1];
          this.c = parts[2];
          this.d = parts[3];
          this.e = parts[4];
          this.f = parts[5];
          this.m11 = parts[0];
          this.m12 = parts[1];
          this.m21 = parts[2];
          this.m22 = parts[3];
        }
      }
    }
  }
  (globalThis as Record<string, unknown>).DOMMatrixReadOnly = DOMMatrixReadOnlyMock;
}
