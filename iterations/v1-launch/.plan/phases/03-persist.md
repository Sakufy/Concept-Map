# Phase 03 — 持久化与移动端（persist）

**Status**: `not started`
**Status 候选**: `not started` / `in progress` / `completed` / `blocked` / `skipped`
**目标**: 数据自动保存到 IndexedDB，支持 JSON 导出/导入，移动端手势验证通过
**前置**: phase 02（画布与节点可用）
> ⚠️ 2026-08-20：本文件曾随 `.plan/` 目录意外丢失，已按会话记录重建。

## 验收判据

- 刷新/关闭浏览器后数据不丢失
- 可导出 JSON 文件；可导入 JSON 恢复画布
- 手机浏览器（真机或设备模拟）完成：单指平移、双指缩放、点选编辑、添加节点
- 数据 schema 带 `schemaVersion` 字段（为 v2 迁移预留）

## Tasks

- [ ] idb-keyval 封装 IndexedDB 存储（自动保存，防抖）
- [ ] 导出/导入 JSON（含 schemaVersion）
- [ ] 移动端手势与编辑体验验证（真机/设备模拟）
- [ ] 数据 schema 定义与迁移预留

> **状态符号**：`[ ]` 待办 / `[~]` 进行中 / `[x]` 已完成（附 evidence）/ `[-]` 跳过 / `[!]` 受阻

## Sections

（开始本 phase 时按需拆 Section）

### Section A — 本地持久化
**Gate**: `pending`

### Section B — 导出导入 + 移动端验证
**Gate**: `pending`

## Notes

- Safari 隐私模式 IndexedDB 可能不可用，需降级提示
- 数据模型参考 `概念地图软件开发方案.md`：schemaVersion + focusQuestion + nodes(含parentId) + edges(含连词label)
