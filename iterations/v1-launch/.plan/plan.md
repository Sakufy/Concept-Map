# v1-launch：在浏览器中复现 Lynkage 核心绘制体验

> 文件位置：`iterations/v1-launch/.plan/plan.md`
> 配套 skill：first-flight-phases
> 本 plan 文档是**稳定航图**，状态跟踪在各 phase 文档（同目录的 `phases/NN-*.md`）里。
>
> **定位说明（2026-08-20）**：目录名 `v1-launch` 是历史遗留，本文档实为**全项目阶段航图**——v1（01~06）、v2（07~09）、v3（10~13）及体验优化专项全部在此维护，是任务追踪的**单一来源**（不另建 docs/TASKS.md）。新增阶段直接在下方航图表加一行，并新建对应 `phases/NN-<slug>.md`。
> 文档体系总览与更新规则见 [`docs/README.md`](../../../docs/README.md)。

## 背景

对标 Lynkage 做一款概念地图工具（Web/PWA，电脑 + 手机双端）。已通过逆向分析摸清 Lynkage 的实现方法（见 `docs/Lynkage实现分析.md`）并产出完整开发方案（`概念地图软件开发方案.md`）与 v1 PRD（`iterations/v1-launch/PRD.md`）。

v1-launch 的目标：**在浏览器里复现 Lynkage 最核心的绘制体验** —— 无限画布上摆放概念节点、用带连词标签的连线表达"概念—连词—概念"三元关系、本地持久化不丢数据、手机可用。云同步、嵌入式节点、资源挂载等留到 v2+。

## 范围

**做：**

- Vite + React + TS 工程脚手架，引入 React Flow + Zustand + idb-keyval + Vitest
- 无限画布：平移、缩放、框选、minimap、网格背景
- 概念节点：双击画布新建（默认"???"立即编辑）、拖拽、选中、删除、双击编辑文本、基础样式（颜色）
- 连线与连词：节点 Handle 拖出连线、连词标签点击编辑、连线删除、`Ctrl+Shift` 直连
- 本地持久化：IndexedDB 自动保存、刷新恢复、JSON 导出/导入
- 撤销/重做
- 移动端触摸手势验证（单指平移、双指缩放、点选编辑）
- 数据按三元组 Schema 设计（concept / linkingPhrase / connection），为 v2 连词升级独立节点预留

**不做：**

- 云端账号 / 同步 / 协作（v2）
- 嵌入式子节点（v2）
- 资源挂载（附件 / 图片 / 链接）
- 分享链接
- 自动布局
- 富文本编辑器（Slate/MathJax）——v1 用纯文本 contentEditable

## 阶段总览

| #  | 阶段 slug          | 一句话目标                                     | 状态         |
|----|--------------------|------------------------------------------------|--------------|
| 01 | scaffold           | 工程脚手架 + 测试环境 + 空画布页跑通           | completed    |
| 02 | canvas             | 无限画布：平移/缩放/框选/minimap/网格          | completed    |
| 03 | concepts           | 概念节点：新建/拖拽/编辑/删除/样式             | completed    |
| 04 | connections        | 连线与连词：拖线/独立连词节点/删除/直连        | completed    |
| 05 | persistence        | 本地持久化：IndexedDB/恢复/JSON导入导出        | completed    |
| 06 | mobile-polish      | 撤销重做 + 移动端适配 + PWA + 整体验收         | completed    |

> 状态值：`not started` / `in progress` / `completed` / `blocked` / `skipped`
>
> 详细任务、evidence、blocker 在各 phase 文档（`phases/NN-<slug>.md`）里，**不在本表里展开**。

## 关键决策

- **2026-08-20**：技术栈锁定 React 18 + Vite + TS + Zustand + @xyflow/react + idb-keyval + Supabase（Phase 3 才引入，v1 不做云端）。理由：逆向分析确认 React Flow 是 Lynkage"SVG 连线层 + HTML 节点层"混合渲染模式的现成实现，开发速度最快。
- **2026-08-20**：数据模型采用"概念/连词/连接"三元组 Schema（`schemaVersion=2` + `viaId` 可空 + `controlPoints`）。**用户拍板 v1 即做连词独立节点**（对齐 Lynkage 最终形态）：一条命题 = 概念→连词 + 连词→概念 两条 Connection + 一个 LinkingPhrase 节点；直连（Ctrl+Shift）= 单条 Connection（viaId=null）。
- **2026-08-20**：连词为独立节点（Lynkage 同款）：拖线自动在两端概念中点生成胶囊连词节点，可拖动 / 双击编辑 / 可再被连线（四边 source handle，Loose 模式）；删除一段边级联删除整条命题与连词节点。
- **2026-08-20**：撤销/重做采用 zundo middleware（zustand 生态标准 undo/redo 方案，照搬官方用法）——`partialize` 只快照 doc，`equality` 跳过纯视图变更，limit 100 步；组件经 `zustand/traditional` 的 `useStoreWithEqualityFn` 订阅 temporal store。
- **2026-08-20**：持久化采用 idb-keyval 官方 `get/set` + subscribe 防抖 500ms 自动保存 + Blob JSON 导入导出（成熟方案，无自研）。
- **2026-08-20**：PWA 基础支持（manifest + network-first SW + 移动端 meta），SW 仅生产注册避免开发期缓存干扰。

## v2 阶段航图（云同步完成，继续嵌入式/贝塞尔）

| #  | 阶段 slug            | 一句话目标                                     | 状态         |
|----|--------------------|------------------------------------------------|--------------|
| 07 | cloud-sync         | Supabase 云同步：登录/我的地图/自动同步/恢复   | completed    |
| 08 | embedded-nodes     | 嵌入式子节点：Alt 拖入/拖出 + 删除父节点提升   | completed    |
| 09 | bezier-control     | 连线贝塞尔控制点：选中拖动手柄调整曲线         | completed    |

> v2 决策：嵌入式节点用 React Flow 原生 `parentNode` + `extent: 'parent'`（数据层存相对父节点坐标，`parentId` 字段已预留）；贝塞尔控制点存相对两端偏移（节点移动曲线跟随）。

## v3 阶段航图（本地多图/体验增强）

| #  | 阶段 slug      | 一句话目标                                     | 状态         |
|----|----------------|------------------------------------------------|--------------|
| 10 | local-maps     | 本地多图管理：新建/切换/删除 + 启动恢复        | completed    |
| 11 | modal-edit     | 右键弹窗编辑：纯文本 + Markdown 预览           | completed    |
| 12 | png-export     | PNG 导出：画布截图下载                         | completed    |
| 13 | versions       | 历史版本：时间线快照 + 误删恢复                | completed    |

> v3 决策（2026-08-20）：
> - 右键弹窗编辑：节点右键打开编辑弹窗（textarea 纯文本 + Markdown 预览 tab）；Markdown 渲染用 `react-markdown`（npm 生态标准方案，避免自研 parser）；LaTeX/表格后置。**已落地**：`NodeEditModal` 右键弹窗（`editModalTarget` 驱动），Ctrl+Enter 保存 / Esc 取消 / 空文本回退 "???"。
> - PNG 导出：用 `html-to-image` 的 `toPng`（React Flow 官方 ExportImage 示例同款成熟方案），截取 `.react-flow__viewport` 全画布边界。**已落地**：`exportImage.ts` 按 `getNodesBounds` + `viewport.zoom` 计算尺寸，空画布报错提示。
> - 历史版本：IndexedDB 存版本快照数组（`cmap-versions-v1`，上限 20），手动「保存版本」按钮 + 编辑防抖自动快照（距上次 ≥2 分钟），版本面板恢复/删除。**已落地**：`versions.ts` + `VersionsPanel`（恢复后清空撤销历史防误回退）。

## 体验优化专项（撤销历史健壮性 / 交互一致性）

> 范围：不做新功能，只修「使用体验与核心逻辑」问题。无独立 phase 号，作为 v3 收尾专项推进（2026-08-20）。

| 优化点                                    | 一句话目标                                                     | 状态         |
|-------------------------------------------|----------------------------------------------------------------|--------------|
| drag-undo-merge                          | 拖拽节点/连词合并为一步撤销历史（zundo pause/resume + 写回拖前快照） | completed    |
| lp-escape-cancel                         | 连词编辑补 Escape 取消，对齐概念节点                             | completed    |
| lp-autofocus-on-create                   | 新建连词即进入编辑态，对齐「新建概念即编辑」                     | completed    |
| resize-node                              | 节点/连词可拖四角手柄自由调整尺寸（NodeResizer）                 | completed    |
| connection-polish                        | 连接简洁化：吸附半径/箭头/线宽/handle 热区收紧                   | completed    |
| drag-smooth                              | 拖拽顺畅：节点容器/光标/编辑态溢出/子节点宽度优化                | completed    |

> 专项决策（2026-08-20）：
> - 拖拽历史合并方案：zundo 记录「set 前状态」，因此 dragStop 时需 `pause` 中把 doc 写回「拖前」引用 → `resume` → 写回「拖后」引用，pastStates 才只追加一条「拖前」快照（一次拖拽 = 一步 Ctrl+Z）。若只 pause/resume 而不写回，拖拽将完全不记录历史（undo 会误撤掉拖拽前的操作）。
> - 连词 Escape 取消：`setEditingLpId(null)` 丢弃输入；重渲染后文本恢复原值，blur 误触发 commit 时读到的值与原值相等，不会误提交（与 ConceptNode 同款机制）。
> - 验证：`npx vitest run` 92/92；`npm run build` 通过；新增 store 层拖拽合并用例 2 条 + 连词组件用例 6 条。
>
> 专项二决策（2026-08-20，用户反馈「自由调整尺寸 / 连接不顺滑显臃肿 / 拖拽不方便」）：
> - 调整尺寸用 React Flow 官方 `NodeResizer`（v12.11.3 附加组件）——`isVisible={selected}` 四角手柄，`onResizeEnd` 写回 `updateConcept(id,{w,h})` / `updateLinkingPhraseSize(id,w,h)`（新增 action）；尺寸持久化链 `toFlowNodes` 输出 width/height → NodeResizer 改 DOM → onResizeEnd 写回 store → 自动保存。React Flow 尺寸优先级 `measured ?? node.width ?? initialWidth`。
> - 连接简洁化：`connectionRadius` 40→24、箭头 14×14、连线 stroke 1.5px、handle 热区 16→10px。
> - 验证：`npx vitest run` 94/94；build 通过；Playwright 冒烟 `smoke-resize.js` 全通过（ok:true，含 resize 写回/撤销一步/Ctrl+Z/Redo/选中态拖线/样式 computed 断言/LP resize/刷新持久化）。

## 连线清晰度专项（连线视觉降噪 / 自动布局 / 焦点路径）

> 范围：A 档视觉降噪（连线分层、方向强化、连词弱化、智能贝塞尔）+ B 档（dagre 自动布局、从初始节点到目标节点的焦点路径高亮 + 顺序编号）。无独立 phase 号，作为 v3 收尾专项（2026-08-20）。C 档「连词合并为边标签」**用户明确否决**（破坏三元组根基，不做）。

| 任务项                   | 一句话目标                                                       | 状态 |
|--------------------------|------------------------------------------------------------------|------|
| edge-style-layering      | 连线样式分层：普通边弱化 / 相关边高亮 / hover 反馈                | completed (2026-08-20) |
| edge-direction           | 方向感强化：hover 虚线流动动画 + 箭头随状态变色                   | completed (2026-08-20) |
| lp-deemphasis            | 连词节点未选中/未悬停时视觉弱化，减少碎片感                       | completed (2026-08-20) |
| smart-bezier             | 智能贝塞尔：同向多边自动 lane 展开 + 反向连接控制点外绕           | completed (2026-08-20) |
| auto-layout              | dagre 分层布局一键整理（顶层概念分层，连词回中点，可撤销）        | completed (2026-08-20) |
| focus-path               | 焦点路径：选起点→选目标→高亮最短路径 + 边上顺序编号，其余淡化    | completed (2026-08-20) |

> 专项决策（2026-08-20）：
> - 自动布局用 dagre（React Flow 官方 Layouting 示例同款，已安装 `dagre` + `@types/dagre`）。只布局顶层概念节点，嵌入式子节点相对父坐标跟随；连词重新居中到两端概念中点。
> - 焦点路径：BFS 沿 connection 有向边找最短路径（含连词节点）；路径边按顺序编号渲染序号徽标；非路径元素整体淡化。`pathMode/pathRootId/pathTargetId` 为纯视图态，不进撤销历史（partialize 只快照 doc）。
> - 智能贝塞尔：按 `fromId->toId` 分组给同向多边分配 lane，控制点沿垂直方向偏移展开；目标在源左侧（反向）时控制点向外侧偏移避免横穿。

> 专项验证（2026-08-20）：
> - 新增 `src/path.ts`（BFS 最短路径）+ 5 测试、`src/geometry.test.ts`（lane 分配/控制点符号）+ 7 测试、`src/layout.test.ts`（dagre 重排/连词回中/子节点跟随/孤立节点）+ 4 测试、`src/store/cmapStore.test.ts` 焦点路径视图态 5 测试、`ConnectionEdge.test.tsx` 路径徽标 2 测试。
> - 修复 layout 关键 bug：`lpPairs` 存储时 `?? ''` 把 null 占位强转空串，导致命题第二段无法回填另一端、dagre 概念边缺失——改为保留 null 占位。
> - 修复路径模式 UI 点击失效：React Flow `panOnDrag` + 节点可拖拽时点击被当作拖拽起始吞掉 `onNodeClick` → 路径模式临时禁用 `nodesDraggable`/`panOnDrag`/`selectionOnDrag`。
> - dev 冒烟设施：`window.__cmapStore` 暴露 store（DEV 条件），冒烟脚本可直接构造数据避免连续 dblclick 坐标被节点覆盖。
> - 全量 `npx vitest run` 117/117 通过；`npm run build` 通过。
> - Playwright 冒烟（`smoke-clarity.js`）`ok:true`：dagre 重排 + 布局一步撤销/重做 + 路径模式 UI 实际点击 A→C（root/target 正确、4 路径边、徽标 1-4、淡化正确）+ 点空白清除全部通过。

- [x] React Flow 版本选择：v12（已采用，12.3.5+）
- [x] 移动端双击新建与双指缩放手势冲突的处理方案——已用 double-tap 检测（300ms/30px）
- [ ] 嵌入式子节点是否支持多级嵌套（v2 先支持一层，拖出/提升时递归处理绝对坐标）

## 关联

- 长期文档（项目根）：[开发方案](../../../概念地图软件开发方案.md) / [AGENTS.md](../../../AGENTS.md) / [Lynkage实现分析](../../../docs/Lynkage实现分析.md)
- 当前迭代 PRD：[PRD.md](../PRD.md)
