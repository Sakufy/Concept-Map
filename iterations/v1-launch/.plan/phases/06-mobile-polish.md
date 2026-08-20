# Phase 06 — 撤销重做 + 移动端适配 + 整体验收

**Status**: `not started`
**目标**: 撤销/重做可用，移动端触摸手势可用，v1 全部功能通过 DoD 验收
**前置**: Phase 05（persistence）

## 验收判据

- [ ] Ctrl+Z 撤销、Ctrl+Shift+Z（或 Ctrl+Y）重做，覆盖节点/连线/连词/位置/样式所有操作
- [ ] 手机浏览器：单指平移、双指缩放、点击选中、双击（或长按）新建节点可用
- [ ] 双击新建与双指缩放无手势冲突
- [ ] 触摸编辑文本弹出软键盘不遮挡输入（或可滚动）
- [ ] v1 功能全清单人工验收通过（对照 PRD 第 4 节 6 个模块 + 撤销重做 + 基础样式）
- [ ] `npx vitest run` + `npm run build` + lint 全部通过
- [ ] CHANGELOG.md 已更新

## Sections

### Section A — 撤销/重做

**Gate**: `pending`

**自测判据**：

- 连续操作后 Ctrl+Z 逐步回退，Ctrl+Shift+Z 逐步重做
- 撤销/重做覆盖：添加/删除节点、拖拽移动、连线创建/删除、连词文本、颜色切换
- 撤销栈与 IndexedDB 保存不冲突

**Tasks**：

- [ ] Zustand 历史栈实现（past / present / future）
- [ ] 命令/快照式撤销（v1 用快照式：每次操作存全量 state，简单可靠）
- [ ] 快捷键绑定 Ctrl+Z / Ctrl+Shift+Z
- [ ] 测试：历史栈 push/undo/redo 逻辑

**记录**：

- 自测：
- 用户验收：
- Commit：

---

### Section B — 移动端适配

**Gate**: `pending`

**自测判据**：

- DevTools 设备模拟 + 真机浏览器验证手势
- 触控节点编辑可用
- 布局在窄屏（375px）不破

**Tasks**：

- [ ] 触摸手势验证：单指平移 / 双指缩放 / 点选
- [ ] 双击新建在触屏的替代方案（如工具栏"＋"按钮）
- [ ] 响应式布局（工具栏/面板在窄屏折叠）
- [ ] 手动验证移动端全流程

**记录**：

- 自测：
- 用户验收：
- Commit：

---

### Section C — v1 整体验收

**Gate**: `pending`

**自测判据**：

- `npx vitest run`、`npm run build`、`npm run lint` 全部通过
- 对照 PRD 第 4 节验收清单逐项人工验证
- 无 console error

**Tasks**：

- [ ] 对照 PRD 验收清单逐项自测
- [ ] 补遗漏测试与样式
- [ ] 更新 docs/CHANGELOG.md
- [ ] 更新 plan.md 阶段总览

**记录**：

- 自测：
- 用户验收：
- Commit：

## Notes

- v1 不做 PWA（manifest/Service Worker）——留到 v2 与云同步一起做，避免范围膨胀。
- 撤销/重做 v1 用快照式（每次操作存全量 state），节点量小时足够，v2 如需协作再换命令式。
