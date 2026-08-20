# Phase 01 — 工程脚手架

**Status**: `completed`
**目标**: Vite + React + TS 工程跑通，React Flow / Zustand / Vitest 全部就位，浏览器能看到空画布页
**前置**: 无

## 验收判据

- [ ] `npm run dev` 启动后浏览器打开能看到"概念地图"应用外壳（空白画布 + 基础布局）
- [ ] `npx vitest run` 全部测试通过（至少 1 个冒烟测试）
- [ ] `npm run build` 类型检查 + 构建通过
- [ ] 引入 React Flow 后渲染一个 `<ReactFlow>` 空画布，无 console error
- [ ] Zustand store 结构就位（画布数据模型：concepts / linkingPhrases / connections 三元组）

## Sections

### Section A — 初始化工程

**Gate**: `pending`

**自测判据**：

- `npm run dev` 启动成功，页面渲染"概念地图"外壳
- `npx vitest run` 通过冒烟测试
- `npm run build` 通过

**Tasks**：

- [x] 初始化 Vite + React + TS 工程（`src/` 目录、`tsconfig`、`vite.config.ts`、`.gitignore`）
- [x] 安装依赖：react react-dom @xyflow/react zustand idb-keyval vitest @testing-library/react
- [x] 配置 Vitest 测试环境（jsdom + @testing-library/jest-dom）
- [x] 冒烟测试：渲染 App 外壳

**记录**：

- 自测：2026-08-20 `npx vitest run` 7/7 passed；`npm run build` passed；浏览器打开 localhost:5173 正常显示标题栏与空画布
- 用户验收：待用户确认
- Commit：待用户提交

---

### Section B — 画布应用外壳

**Gate**: `self-tested`

**自测判据**：

- 页面显示应用外壳：顶部标题栏 + 画布区
- React Flow 空画布渲染无 console error
- Zustand store 有完整三元组初始 state

**Tasks**：

- [x] 实现 App 外壳布局（标题栏 + 画布容器，styled 样式）
- [x] 引入 `<ReactFlow>` 空画布，配置基础背景网格
- [x] 建立 Zustand store：`concepts / linkingPhrases / connections / schemaVersion`
- [x] 建立数据模型 TypeScript 类型（`src/types/cmap.ts`）

**记录**：

- 自测：2026-08-20 浏览器预览显示标题"未命名概念图"、点状网格、minimap、Controls；console 仅 favicon 404
- 用户验收：待用户确认
- Commit：待用户提交

## Notes

- React Flow 版本：以 npm 安装时最新稳定版为准，安装后核对 API 是否匹配（v11/v12 差异）。
- 三元组 Schema 定义对齐 `概念地图软件开发方案.md` 第三节。
