# Phase 03 — 概念节点

**Status**: `completed`
**目标**: 双击画布新建概念节点（默认"???"立即编辑）、拖拽移动、双击编辑、删除、基础样式
**前置**: Phase 02（canvas）

## 验收判据

- [x] 双击画布空白处新建节点，默认文本"???"并自动进入编辑态，光标聚焦
- [x] 输入文本后回车/点击空白确认，节点显示该文本
- [x] 拖拽节点可自由移动（position 持久到 store）
- [x] 单击选中（高亮边框），Delete/Backspace 删除选中节点
- [x] 节点有基础样式区分（如不同颜色可选），圆角矩形外观
- [x] 节点文本支持换行显示
- [x] `npx vitest run` 通过，无 console error（仅 favicon 404，已知）

## Sections

### Section A — 节点创建与编辑

**Gate**: `user-approved`

**自测判据**：

- [x] 双击空白 → 节点出现且立即进入编辑态（光标在文本里）
- [x] 输入后失焦/回车 → 文本保存到 store
- [x] 空文本节点自动删除或保持"???"占位（实现为保持"???"占位）

**Tasks**：

- [x] 自定义节点组件 `ConceptNode`（圆角矩形 + contentEditable 文本）
- [x] 画布 `onDoubleClick` 事件：在双击坐标创建节点（`screenToFlowPosition` 换算）
- [x] 编辑态管理：新建即 `editing=true`，失焦提交；Enter 提交 / Shift+Enter 换行 / Escape 取消
- [x] 测试：`store.addConcept()` / 节点文本更新逻辑

**记录**：

- 自测：vitest 25/25 通过；playwright 实测——双击新建 → "???"编辑态自动聚焦 → 输入"光合作用"回车提交退出编辑；Shift+Enter 换行（innerText "光合\n作用"）；空文本回车保持"???"；Escape 取消丢弃输入保持"???"。build 通过（dist 338.22 kB）。
- 用户验收：2026-08-20 验收发现问题——"初始创建概念块结点时才能更改文本，后续无论双击任何位置都只能新建概念块"（双击已有节点无法编辑）。
- 修复：2026-08-20 `handleDoubleClick` 增加 `event.target.closest('.react-flow__node')` 判断，命中则跳过（编辑交给 `onNodeDoubleClick`）。新增回归测试（双击节点不新建、进入该节点编辑态），vitest 26/26、build 通过、playwright 实测——双击空白新建正常；双击已有节点 nodeCount 保持 1、进入编辑态且聚焦；全选替换文本为"呼吸作用"提交生效。
- 用户验收：2026-08-20 通过（"通过"）。
- Commit：

---

### Section B — 节点选择、拖拽与删除

**Gate**: `user-approved`

**自测判据**：

- [x] 拖拽节点移动，store 中 position 更新
- [x] 单击选中高亮；Delete 删除选中节点
- [x] 选中状态样式（边框/阴影）明显

**Tasks**：

- [x] 节点选中态样式（`selected` class）
- [x] 拖拽同步 position 到 store（`onNodesChange` 处理）
- [x] 键盘 Delete/Backspace 删除选中节点
- [x] 节点颜色切换（工具栏预设色板点击切换）

**记录**：

- 自测：playwright 实测——单击节点 wrapper 出现 `selected`、`.cm-node` 出现 `is-selected`；色板点绿 → 背景 `#e8f5e9` + 边框 `#388e3c`，色板 `aria-pressed` 同步；拖拽后 `style.transform` 更新（position 持久化）；Delete/Backspace 均删除选中节点且色板隐藏（选中态清理）。
- 用户验收：2026-08-20 通过（"通过"）。
- Commit：

## Notes

- **选中态受控修复**（本阶段关键决策）：React Flow 节点选中是受控状态，需在 `onNodesChange` 处理 `type:'select'` 的 change（同步 `store.selectedNodeId`），且 `toFlowNodes` 输出节点需带 `selected` 字段，`.react-flow__node.selected` 与自定义节点 `selected` prop 才会生效。单击/拖拽/框选均会触发 select change。
- **contentEditable 编辑态**：编辑时加 `nodrag` class 防拖拽冲突；focus 需 rAF 重试（React Flow 节点测量完成前 `visibility:hidden`，hidden 元素 `focus()` 无效）。
- **空文本**：提交时 `trim()` 为空则保持 "???" 占位（不自动删除，避免误删用户节点）。
- **pane 双击与节点双击冲突**（验收修复）：React Flow v12 **没有** pane 级 `onDoubleClick` prop，传给 `<ReactFlow>` 的 `onDoubleClick` 会被 `...rest` 透传绑定到 wrapper div（原生 dblclick）。双击节点时 `onNodeDoubleClick` 先触发编辑，随后 dblclick 冒泡到 wrapper div 再次触发 `handleDoubleClick` → 新建节点，表现为"双击任何位置都新建"。修复：`handleDoubleClick` 检查 `event.target.closest('.react-flow__node')`，命中则 return。双击空白 → `handleDoubleClick` 新建；双击节点 → `onNodeDoubleClick` 编辑。
- **自动测试注意**：playwright 双击后需等待编辑器真正聚焦（`document.activeElement` 含 `cm-node__text`）再输入，否则首字符可能丢失（纯自动化时序问题，真人操作无感）。
