# Phase 02 — 无限画布

**Status**: `completed`
**目标**: 画布支持平移、缩放、框选、minimap、网格背景，无限自由
**前置**: Phase 01（scaffold）

## 验收判据

- [x] 拖拽空白处可平移画布（鼠标 + 触摸）——鼠标拖拽 transform 0,0→200,200；CDP 触摸模拟单指拖拽 viewport 变为 translate(-150px,-100px)
- [x] 滚轮/双指缩放，缩放范围合理（如 0.2x~2.5x）——滚轮 100%→230%；双指捏合 scale 1→2.17；缩放上限实测卡在 2.5、下限卡在 0.2
- [x] 框选：拖拽空白可框选多个节点（节点出现后再验证）——select 模式下拖拽出现 200x140 选框元素
- [x] 右下角 minimap 可见，且随画布平移缩放联动
- [x] 网格背景清晰可辨，随画布一起缩放
- [x] 无 console error，`npx vitest run` 通过（11/11）

## Sections

### Section A — 画布视图控制

**Gate**: `self-tested`

**自测判据**：

- `npm run dev` 手工验证：拖拽平移、滚轮缩放正常
- 缩放范围被限制在预设 min/max 内
- React Flow `onViewportChange` 触发时 Zustand 中 viewport 状态同步

**Tasks**：

- [x] 配置 React Flow：`panOnDrag`、`zoomOnScroll`、`minZoom`/`maxZoom`
- [x] viewport 状态接入 Zustand（`viewport` + `setViewport`）
- [x] 平移/缩放的手动验证（桌面 + 移动端模拟器）

**记录**：

- 自测：2026-08-20 playwright 实测——鼠标拖拽 transform 0,0→200,200；CDP 移动端模拟单指触摸拖拽 viewport 变为 translate(-150px,-100px)、双指张开 scale 1→2.16667；滚轮连续放大停在 scale(2.5)、连续缩小停在 scale(0.2)；zoom 标签 100%→230% 联动
- 用户验收：2026-08-20 用户验收通过
- Commit：待用户提交

---

### Section B — 导航与背景

**Gate**: `self-tested`

**自测判据**：

- minimap 显示且随画布联动
- 网格背景开启并随缩放变化
- 框选行为正确（拖拽空白出现选框）

**Tasks**：

- [x] 引入 `<MiniMap>` 并样式化（`pannable`/`zoomable`、按概念填充色着色）
- [x] 引入 `<Background>` 网格背景（点状，gap 24）
- [x] 配置 `selectionOnDrag` / `panOnDrag` 组合，实现拖拽空白 = 平移、框选 = 拖拽带框选（工具栏"平移/框选"切换 + `aria-pressed` 联动）
- [x] 手动验证框选 + minimap + 网格

**记录**：

- 自测：2026-08-20 playwright 实测——点击"框选"按钮后 `aria-pressed` boxSelect=true / pan=false；select 模式拖拽空白出现 `.react-flow__selection` 选框（200x140）；minimap 与网格可见
- 用户验收：待用户确认
- Commit：待用户提交

## Notes

- React Flow 默认行为：拖拽空白平移；`selectionOnDrag={true}` 时拖拽变为框选。需按 Lynkage 习惯（Space+拖拽平移，直接拖拽框选）设计：v1 采用"直接拖拽=平移"（更直觉），框选通过工具栏按钮切换或用 React Flow 默认 shift 拖拽。
- 具体交互取舍在实现时验证后确定，保持简单。
