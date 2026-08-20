# Phase 05 — 本地持久化

**Status**: `not started`
**目标**: IndexedDB 自动保存、刷新恢复、JSON 导出/导入
**前置**: Phase 04（connections）

## 验收判据

- [ ] 编辑后自动保存到 IndexedDB（防抖，无需手动点击保存）
- [ ] 刷新浏览器后完整恢复画布（节点/连线/连词/样式/位置）
- [ ] 导出 JSON 文件（完整三元组 Schema 序列化，含 schemaVersion）
- [ ] 导入 JSON 文件恢复画布
- [ ] 导入非法/旧版本数据时有错误提示，不崩溃
- [ ] `npx vitest run` 通过，无 console error

## Sections

### Section A — IndexedDB 自动保存与恢复

**Gate**: `pending`

**自测判据**：

- 编辑后数秒内 IndexedDB 中数据更新（devtools Application 面板可见）
- 刷新后画布完整恢复
- 首启无数据时显示空白画布，不报错

**Tasks**：

- [ ] 用 idb-keyval 实现保存/读取（key: `currentMap`）
- [ ] store 订阅 + 防抖保存（300~500ms）
- [ ] 启动时异步加载恢复
- [ ] 测试：序列化/反序列化 round-trip

**记录**：

- 自测：
- 用户验收：
- Commit：

---

### Section B — JSON 导出/导入

**Gate**: `pending`

**自测判据**：

- 导出文件为合法 JSON，包含 schemaVersion + 三元组
- 导入后画布还原且可继续编辑
- 导入 schemaVersion 不匹配时给出提示

**Tasks**：

- [ ] 工具栏加"导出 JSON"按钮（生成 Blob 下载）
- [ ] 工具栏加"导入 JSON"按钮（文件选择 + 解析 + 校验）
- [ ] schemaVersion 校验与兼容提示
- [ ] 测试：导入导出 round-trip 测试

**记录**：

- 自测：
- 用户验收：
- Commit：

## Notes

- IndexedDB 自动保存与导出 JSON 是两套独立机制：前者为本地恢复，后者为用户可控备份。
- 序列化函数与 `docs/Lynkage实现分析.md` 的 `formatVersion` 思路对齐（本项目用 `schemaVersion`）。
