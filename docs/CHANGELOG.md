# CHANGELOG

本项目变更记录。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Added (2026-08-20)

#### 概念图重命名 + 我的地图文件夹分组 (`completed`)

用户反馈两个能力缺失：①「现在还无法为概念图命名」；②「我的地图不能创建文件夹」。本轮一次性补齐本地与云端。

**概念图重命名**：
- 头部标题改为可点击重命名按钮（`DocTitle.tsx` 新建组件）：点击进入内联 input 编辑态，`requestAnimationFrame` 自动聚焦+全选；Enter / 失焦提交，Escape 取消，空文本回退「未命名概念图」。
- store 新增 `setDocTitle` action（`cmapStore.ts`）：trim + 空回退 + 更新 `doc.title/updatedAt`，参与 zundo 撤销历史 → 自动保存链路（`App.tsx`）自然把新标题写入本地 IndexedDB meta 与云端 `maps.title`，无需单独同步代码。
- App.css：`.app-header__title` 改按钮样式（hover 背景、✎ 渐显、`ellipsis`）；新增 `.app-header__title-input` 编辑态样式（蓝色边框 + 圆角 + focus 光环）。

**本地文件夹（IndexedDB）**：
- `persistence.ts` 新增 `LOCAL_FOLDERS_KEY` 存储 `LocalFolderMeta[]`；`LocalMapMeta` 加 `folderId: string | null` 字段（旧数据归一化为 `null` 即根目录）。
- 单层分组模型：API `listLocalFolders` / `createLocalFolder`（同名去重返回已存在，空名回退「新建文件夹」）/ `deleteLocalFolder`（地图移回根目录，不删图）/ `setLocalMapFolder`。
- 启动迁移：旧版无 `folderId` 字段的元信息在 `listLocalMaps` 内 `?? null` 归一化，对历史数据零侵入。

**云端文件夹（Supabase）**：
- 新增迁移 `add_folders`：`alter table public.maps add column if not exists folder_id text;` + `create table public.folders (id uuid default gen_random_uuid(), user_id uuid, name text, created_at timestamptz default now())` + RLS 四条 policy（按 `auth.uid()` 隔离 select/insert/update/delete）。
- `cloudSync.ts` 增 `listCloudFolders` / `createCloudFolder`（同名去重）/ `deleteCloudFolder`（先 `maps.folder_id=null` 再删 folder 行）/ `setCloudMapFolder`；`createCloudMap` / `listCloudMaps` 增可选 `folderId` 参数，读回 `folder_id` 字段。
- `authStore.ts` 加 `CloudFolderMeta {id, name}` + `cloudFolders` state + `setCloudFolders` action。

**UI（本地/云端列表共用分组模式，照搬彼此）**：
- 抽出 `MapItem` 子组件（打开 / 移动到文件夹 select / 删除）。
- header 加「新建文件夹」按钮 + 内联命名 input（Enter/blur 提交、Escape 取消、自动聚焦）。
- 文件夹组卡片：「📁 名称 + N 张 + 删除」+ 内嵌子项 list；空文件夹显示「文件夹为空」。
- 根目录地图平铺在文件夹组下方。
- `MapsList.tsx`（云端）刷新时并行 `listCloudMaps + listCloudFolders` 写入 `setCloudMaps + setCloudFolders`。
- 删除文件夹是当前打开的本地图 → 断开 `cloudMapId` 避免自动保存对已删图写回（云端同步版）。
- `App.css` 新增 `.cm-maps__group` / `__group-head` / `__group-name` / `__group-count` / `__sublist` / `__group-empty` / `__folder-select` / `__folder-input` 等样式（与 LocalMapsList 类名保持一致）。

**测试 + 构建 + 冒烟**：
- `npx vitest run` **137/137**（+13 持久化文件夹 CRUD 5 + LocalMapsList 分组 4 + cmapStore `setDocTitle` 3 + `DocTitle` 组件 1 + `authStore` 类型修正）。
- `npm run build` 通过（修了 `authStore.test.ts` mock 缺 `folderId` 字段的 TS2741）。
- Playwright 冒烟（`smoke-title-folder.js`，playwright-cli `--filename` + `run-code`）：
  - 重命名：UI 标题变「物理概念图」+ IndexedDB `cmap-local-maps-v1` meta[0].title =「物理概念图」（持久化验证）。
  - 文件夹：新建「📁 物理」→ 地图 select 选「物理」→ 计数「1 张」→ 删除文件夹（confirm 覆盖）→ 地图移回根目录（`cm-maps__item` = 1）。
  - 截图 `smoke-title-folder-final.png` 视觉确认分组 UI（白底卡片 / 📁 名称 / 「1 张」/ select 显示当前文件夹）。

**踩坑**：
- `playwright-cli run-code` 不支持内联文件路径作代码（`smoke` undefined），需用 `--filename <path>` 加载 JS 文件。
- `run-code` 内 `page.on('dialog')` 与工具 modal state 冲突（`does not handle the modal state`），改用 `window.confirm = () => true` 页面内覆盖；遗留 dialog 需 `playwright-cli dialog-accept` 清掉才能继续。
- `page.selectOption(ElementHandle, opts)` 报 `selector: expected string, got object` → 改用 `selectOption("[data-testid=...]", opts)` 字符串选择器。
- button 文字取 `textContent` 含 ✎ span → 断言用 `.app-header__title-text` 子元素。

### Chore (2026-08-20)

#### 部署上线 — 腾讯云 CloudBase 静态托管 (`deployed`)

#### 接入 Git 版本控制并推送 GitHub

- 初始化 git 仓库（`main` 分支），首次提交全部代码（73 文件）→ 清理提交（移除 `.vite/` 缓存与冒烟截图）→ 补充 `.gitignore`（新增 `.vite/`、`.codebuddy/`、冒烟产物 `smoke-*.js/png`、`v2-*.png` 等）。
- 远程仓库：`origin = https://github.com/Sakufy/Concept-Map.git`，`main` 已推送并设置上游跟踪。
- 提交规范启用：Conventional Commits（`feat:`/`fix:`/`chore:`/`docs:` 等）。
- 坑（Windows）：PowerShell 内联中文 commit message 会经 GBK 转码乱码 → **必须用 `git commit -F <msg文件>`**（UTF-8 文件）方式提交，或使用纯 ASCII message。

### Docs (2026-08-20)

#### 文档体系全面整理 — 建立「文档地图」，统一后续更新入口

- **新增 `docs/README.md`（文档地图）**：全项目唯一文档索引——三层文档体系总览、文档清单表（路径/定位/更新频率/更新时机/维护者）、更新工作流（常规变更/新迭代/架构决策/竞品调研各需更新哪些文档）、6 条维护规则、文档引用关系图。约定：新增文档必须在此登记一行；plan.md 为任务追踪**单一来源**（不建 docs/TASKS.md）；架构决策集中记于 plan.md「关键决策」（不另建 docs/ADR/）。
- **新增根目录 `README.md`**：人类入口（AGENTS.md 此前引用但不存在）——项目简介、技术栈、快速开始命令、文档导航表。
- **`AI辅助开发管理方案.md`**：头部补「落地现状」说明（实际采用 plan.md + phases 替代 ROADMAP/TASKS/ADR 三件套）；落地文件结构图更新为实际；启动清单勾选为真实状态。
- **`概念地图软件开发方案.md`**：头部补「演进说明」——「连词渲染降级为 edge label」不再适用（v1 即做连词独立节点，用户拍板），正文保留决策当时内容不重写。
- **`iterations/v1-launch/.plan/plan.md`**：头部补定位说明——目录名 v1-launch 为历史遗留，本文档实为全项目航图（v1~v3 + 体验优化专项）。
- 维护约定固化：长期文档只加演进标注不重写历史；CHANGELOG 只追加；memory 区分当日日志（append）与 MEMORY.md（就地更新）。

#### 体验优化专项三 — 直线连线 / 节点框随文字自适应 (`completed`)

- **连接线改为直线（user-requested）**：`ConnectionEdge` 路径从智能贝塞尔 `M P0 C P1 P2 P3` 改为直线 `M P0 L P1`，直接由源 Handle 连到目标 Handle。同时移除已无意义的「贝塞尔控制点拖动手柄」（`ConnectionControlHandles`、`controlPoints` 字段仍保留在 schema 以兼容历史数据与未变更的 `updateConnectionControlPoints` store 方法）。`toFlowEdges` 简化：去掉 `getAnchor` + `assignLanes` + `smartControlPoints` 计算与 `srcCtl/tgtCtl/srcCx/srcCy/tgtCx/tgtCy/controlPoints` 边数据字段；`getAnchor` 仍供 `layout.ts` 计算连词中点。
- **概念/连词框随文字自适应（user-requested）**：照搬 React Flow 官方「不传 width/height → 自动测量」成熟模式——`toFlowNodes` 不再为概念/连词输出 `width/height`，由 React Flow 的 `ResizeObserver` 实测后驱动 `measured`，节点框 `shrink-wrap` 文字，文本变化自动跟随（不需手动触发测量）。
  - CSS：`.cm-node` 改为 `width:max-content; height:max-content; min-width:56px; min-height:32px; max-width:240px`（长文本在 240px 换行）；`.cm-lp` 同理（`min-width:64 min-height:26 max-width:200`，胶囊焦点态 `:focus-within` 临时 `overflow:visible` 避免编辑期文本被裁）。
  - 移除两节点的 `NodeResizer`（自由调整尺寸与自适应冲突，且用户已要求改自适应）；`updateConcept({w,h})` / `updateLinkingPhraseSize` store action 保留供历史数据与测试（store 尺寸字段变为历史遗留，仅 `layout.ts` 仍用其估算布局间距）。
  - 嵌入式子节点 Alt 拖拽命中测试改用 React Flow 实测尺寸：父节点命中 `getInternalNode(p.id).measured` 替代过期数据层 `p.w/p.h`；`setConceptParent(id, parentId, absPos?, parentSize?)` 新增可选 `parentSize` 参数，clamp 用 `parentSize ?? p.w/p.h` 兜底。
  - 新增 `useEffect`「等全部节点测量完成后调用 `fitView({padding:0.1})`」：解决首屏 fitView 时 0 尺寸节点算错视口的问题（rAF 轮询 `getInternalNode` 直至 `measured.width>0`）。
- 删除/清理：`.cm-node__resize-handle` / `.cm-edge__control` CSS（与已删除的 NodeResizer / 控制点手柄一起清掉）；`ConnectionEdge.test.tsx` 重写为直线断言（`d="M 0,0 L 100,100"`）+ 焦点路径徽标 + 淡化状态，去掉控制点手柄的 describe。
- 坑：dev 冒烟脚本通过 `window.__cmapStore.getState().addConnection` 后必须**重新** `getState()` 拿最新 doc 查 `viaId`，否则拿到旧快照 find 失败（已在脚本里改成 `const st = window.__cmapStore.getState(); st.doc.connections.find(...)`）。
- 验证：`npx vitest run` **114/114**（`ConnectionEdge.test.tsx` 由 7 减为 4，去除控制点相关断言）；`npm run build` 通过；浏览器冒烟：`edgeD = ["M 228,180 L 482,195","M 482,195 L 740,180"]`（直线，无 `C` 控制点）；`getComputedStyle(.cm-node).width` = `56px`（min 生效）/ `240px`（max-width 触发换行），`getComputedStyle(.cm-node).maxWidth = 240px`；连词 `???` 框 136×59，改长文本后 426×100 同步放大——文字驱动框体大小验证通过。

### Added (2026-08-20)

#### 体验优化专项四 — 连接线动态最短吸附（user-requested）

用户要求：「动态调整连接线条的吸附位置，确保出发与终点始终在外面，连接线距离最短的原则」——端点不再固定 React Flow 默认 Handle，而是算两节点矩形边界上距离最短的两点（起止点始终在节点外侧，连线总长最短）。

- **几何核心**（`src/geometry.ts`）：新增 `RectLike` + `rayRectIntersect`（slab 法）+ `findClosestEdgePoints(a, b)` —— 从两矩形中心连线方向发射射线与各自边界求第一交点（起点在矩形内部时取 `tMax` 出射边保证端点在边界上而非中心；中心重合兜底返回两中心点）。slab 法为 CS 经典算法无现成库函数可照搬，自研并记录原因。
- **组件接入**：`ConnectionEdgeData` 新增 `points?: {sx,sy,tx,ty} | null`；`ConnectionEdge` 渲染优先 `data.points`，回退 React Flow Handle 位置；徽标中点改 `(sx+tx)/2,(sy+ty)/2`。`toFlowEdges` 第四参 `rectOf`，两端矩形均可用时调 `findClosestEdgePoints` 写入 `data.points`。`ConceptCanvas.rectOf` 从 React Flow `nodeLookup` 取 `measured` + `internals.positionAbsolute`。
- **关键踩坑（修了上一轮「端点恒为 null」）**：`useStore((s) => s.nodeLookup)` 订阅 React Flow 内部 Map，但 React Flow 的 `nodeLookup` 是**原地 mutate**（`adoptUserNodes` clear+重填同 Map；`updateNodeInternals` `nodeLookup.set(id, newNode)` 用新对象覆盖）——Map 引用永远不变，zustand 默认 `Object.is` 等值比较 → 测量/位置更新后组件**永不重渲染**，`edges useMemo` 看到的永远是空 Map，`data.points` 恒为 null，edge 回退默认 Handle。修复照搬 React Flow 官方 `useNodes` / `useInternalNode` 模式：选择器返回 `Array.from(s.nodeLookup.values())` 新数组 + `zustand/shallow` 逐元素比较——内部节点对象被替换时数组元素变化 → 触发重渲染 → edges 重算。
- 删除/清理：调试期间的全部 TEMP DEBUG 标记（`__cmDebug` effect / `__cmRectCalls` / `__cmEdgeCalc` / `__cmToFlow` / `data-debug-points` EdgeLabelRenderer）。
- 验证：`npx vitest run` **121/121**（新增 `geometry.test.ts` 5 个 `findClosestEdgePoints` 用例——水平/垂直/对角/中心重合兜底 + `ConnectionEdge.test.tsx` 2 个 points 优先/回退用例）；`npm run build` 通过。浏览器冒烟 `smoke-anchor.js`（A=(0,0) 63×47, B=(480,240) 78×47 对角布局）：edge path = `M 63,39.0077 L 480,244.3`（与中心连线与各自边界的理论交点完全一致），`onBoundary:true/true`、`shorter:true`（线段<中心距）、`colinear:9e-13`、`dynamic:true`（非默认 Handle）；截图 `smoke-anchor-final.png` 视觉确认——直线从 AAA 右边缘直接连到 BBBBB 左边缘。

### Added (2026-08-20)

#### 连线清晰度专项 — 视觉降噪 / 自动布局 / 焦点路径 (`completed`)

A 档视觉降噪 + B 档结构清晰（C 档「连词合并为边标签」用户明确否决，保持三元组数据模型）。

- **连线样式分层（edge-style-layering）**：普通边弱化 `#b6c2d1` 1.5px；已选/相关边高亮 `#1976d2` 2.2px；hover 边加深 `#475569` + `stroke-dasharray: 8 6`。
- **方向感强化（edge-direction）**：hover 时虚线流动动画（`cm-dash-flow`，`stroke-dashoffset` keyframes）；箭头颜色随状态变化（普通 `#b6c2d1` / 选中或路径 `#1976d2` / 淡化 `#cbd5e1`）。
- **连词降比重（lp-deemphasis）**：LP 节点默认透明胶囊弱化，选中 / hover / 路径中时恢复实色，减少碎片感。
- **智能贝塞尔（smart-bezier）**：新增 `src/geometry.ts` 纯函数 `assignLanes`（按语义端点对 `fromId->toId` 分组，命题两段合并为一条语义边，同对多边分配 laneIndex/laneCount）+ `smartControlPoints`（控制点在连线 30%/70%，沿逆时针法向量按 `LANE_SPACING=24` 做 lane 展开；反向连接即目标在源左侧时额外 `REVERSE_OUTER=42` 外绕避免横穿）。持久化 `controlPoints` 优先，无则走智能计算。
- **dagre 自动布局（auto-layout）**：`src/layout.ts` 照搬 React Flow 官方 Layouting 示例——只布局顶层概念节点（嵌入式子节点相对父坐标自动跟随），命题（概念→连词→概念）两段合并为一条概念边、连词不参与分层；布局后连词重新居中到两端概念中点；`CanvasToolbar`「整理」按钮通过 `setDoc` 提交为一步撤销操作（Ctrl+Z 可回退）。
- **焦点路径（focus-path）**：新增 `src/path.ts` 纯函数 `findFocusPath`（BFS 沿有向边找起点→目标最短路径，含连词节点）。工具栏「路径」切换进入模式：点起点→点目标→高亮路径（蓝色加粗边 + 按顺序编号的 18px 圆形序号徽标，路径节点蓝色 ring，其余节点/边整体淡化），点空白取消；`pathMode/pathRootId/pathTargetId` 为纯视图态不进撤销历史（zundo partialize 只快照 doc）。删除概念/连词时自动清除相关 path 引用。
- 坑：`EdgeLabelRenderer` 依赖 React Flow DOM portal，jsdom 下渲染为 `null` → 组件测试 mock 为 `<>{children}</>`。layout 关键 bug：`lpPairs` 存储时 `?? ''` 把 null 占位强转空串，导致命题第二段无法回填另一端、dagre 概念边缺失（B 被当孤立节点）——改为保留 null 占位后修复。
- 坑：路径模式下节点 click 被拖拽起始吞掉（React Flow `panOnDrag` + 节点可拖拽时，点击被当作拖拽预处理，`onNodeClick` 不触发）→ 路径模式临时禁用 `nodesDraggable` / `panOnDrag` / `selectionOnDrag` 后修复。
- dev 冒烟设施：dev 模式在 `window.__cmapStore` 暴露 store（`import.meta.env.DEV` 条件），冒烟脚本可直接构造数据 + `setViewport`，避免连续 dblclick 建节点在初始 fitView 放大后坐标被节点/Handle 覆盖。
- 验证：`npx vitest run` **117/117**（新增 `path.test.ts` 5、`geometry.test.ts` 7、`layout.test.ts` 4、`cmapStore.test.ts` 焦点路径视图态 5、`ConnectionEdge.test.tsx` 路径徽标 2）；`npm run build` 通过。
- Playwright 冒烟（`smoke-clarity.js`）全通过（`ok:true`）：构建 A→B→C + B→D（6 边/3 连词/4 概念）→「整理」dagre 重排（A<B<C 左→右、连词回中点）→ Ctrl+Z 一步复原 / Ctrl+Y 重做（布局为一步撤销历史）→ 路径模式 UI 实际点击 A→C（`root/target` 正确设置）→ 4 条路径边 + 徽标编号 1-4 + 3 个路径节点 + 1 淡化节点 + 2 淡化边 → 点空白清除，全部正确。

### Added (2026-08-20)

#### 体验优化专项二 — 自由调整尺寸 / 连接简洁 / 拖拽顺畅 (`completed`)

- **节点/连词自由调整尺寸**：照搬 React Flow 官方 `NodeResizer`（v12.11.3 附加组件，成熟方案无自研）——`ConceptNode` / `LinkingPhraseNode` 内挂 `<NodeResizer isVisible={selected} minWidth minHeight onResizeEnd>`，四角手柄（handleClassName 自定义样式，z-index 6 高于连接热区）。尺寸持久化链：`toFlowNodes` 输出 `width/height`（来自 store `c.w/c.h`）→ NodeResizer 改 DOM 容器尺寸 → `onResizeEnd` 写回 `updateConcept(id, {w,h})` / `updateLinkingPhraseSize(id, w, h)`（新增 action，参与撤销历史）→ 自动保存 → 刷新恢复。React Flow 尺寸优先级 `measured ?? node.width ?? initialWidth` 保证一致性。
- **连接简洁化（去臃肿）**：`connectionRadius` 40→24（收紧误吸附）；`connectionLineStyle` 蓝色虚线更醒目；markerEnd 箭头 `width:14, height:14, color:'#b6c2d1'`（默认 20px 大显臃肿）；连线 stroke `#b6c2d1` 1.5px（选中 2.2px），较原 2px 亚标签色更细轻；handle 热区 16px→10px（避免抢占节点拖拽抓取区）。
- **拖拽顺畅**：节点/连词容器 `width/height:100%` 跟随、`cursor:grab`（active:grabbing）；编辑态 `overflow:visible` 防输入被裁切；嵌入式子节点移除固定 120px 宽改用 100%。
- 验证：`npx vitest run` **94/94**（+`updateConcept` 尺寸+撤销、`updateLinkingPhraseSize`+撤销 2 条）、`npm run build` 通过、0 lint。
- Playwright 冒烟（`smoke-resize.js`）全部通过（`ok:true`）：选中出现 4 个尺寸手柄 → 拖右下角扩大后 store 写回（160×60→184×76）→ Ctrl+Z 回原尺寸 / Redo 恢复（一次 resize = 一步历史）→ 中心拖拽顺畅 → **选中态下拖线连接正常**（edgeCount=2、lp=1，前一轮失败系测试脚本 B 坐标与拖拽后的 A 重叠，非产品 bug）→ 连线 computed style `rgb(182,194,209)/1.5px` → LP resize（80×30→96×38）→ 刷新后尺寸持久化。
- 冒烟新经验（写入工作记忆）：① `fitView` 仅 mount 后执行一次，不会反复跳动；② 诊断拖线失败先 `document.elementFromPoint` 打命中链，区分测试坐标问题与产品 bug；③ LP 节点 DOM class 是 `react-flow__node-linkingPhrase`（不能写 `-lp`）；④ 连线 stroke/stroke-width 是 CSS 属性，需 `getComputedStyle` 断言。

### Fixed (2026-08-20)

#### 优化：交互一致性 + 撤销历史健壮性 (`fixed`)

- **拖拽撤销历史合并（核心逻辑）**：此前拖拽节点/连词时，`onNodesChange` 对每个 position change 都调用 `updateConcept`/`updateLinkingPhrasePosition`，每次 set 都产生一条 zundo 撤销快照——拖一次节点可能吃掉几十步历史，100 步 limit 很快被占满，导致无法撤销较久远的操作。修复：`ConceptCanvas` 增加 `onNodeDragStart`（`useCmapStore.temporal.getState().pause()`）与 `onNodeDragStop`（`pause` 中把 doc 写回「拖前」引用 → `resume` → 写回「拖后」引用）。zundo 记录「set 前状态」，因此一次拖拽只追加一条「拖前」快照 = 一步 Ctrl+Z；Alt 嵌套/提升（`setConceptParent`）也合并进同一快照。
- **连词编辑补 Escape 取消**：`LinkingPhraseNode` 此前只有 Enter 提交、无 Escape 取消（概念节点有），行为不对称。修复：`handleKeyDown` 补 `Escape → setEditingLpId(null)` 丢弃输入；重渲染后文本恢复原值，blur 时不误提交（与概念节点同款机制）。
- **新建连词即编辑（体验一致性）**：`onConnect` 新建连词后自动 `setSelectedNodeId(viaId)` + `setEditingLpId(viaId)`，对齐「新建概念即编辑」；直连模式（Ctrl+Shift）不受影响。
- 验证：新增 2 条 store 层拖拽合并用例（pause 期间多次 position 更新不记录 + dragStop 合并后仅 1 条历史且 undo/redo 位置正确；点击未移动不产生额外历史）+ 6 条连词组件用例（非编辑渲染/进入编辑态/双击编辑/Enter 提交/空文本回退/Escape 取消）；`npx vitest run` 92/92、`npm run build` 通过。

#### 优化：保存触发过宽 + favicon 404 + 首屏分包 + 导出边界 (`fixed`)

- **保存触发过宽（体验 bug）**：`App.tsx` 自动保存的 `useCmapStore.subscribe` 无 selector，任何 store 变更（含 `setViewport` 平移/缩放、选中态）都会触发「保存中…」闪烁 + 重置 500ms 防抖 + 额外 IndexedDB 写入。修复：用 ref 记录上次 `doc` 引用，仅 `doc` 引用变化才走保存流程。Playwright 实测：平移画布全程保持「已保存」，编辑节点保存机制不受影响。
- **favicon 404**：`index.html` 补 `<link rel="icon" type="image/svg+xml" href="/icon.svg">`，消除控制台请求 `/favicon.ico` 的 404 报错。
- **首屏分包（性能）**：主包 729KB → **595KB**（gzip 178KB）。`NodeEditModal`（含 `react-markdown` 120KB）与 `VersionsPanel` 改 `React.lazy` 按需加载；`exportImage.ts` 的 `toPng` 改动态 `import('html-to-image')`，PNG 按钮点击时才拉取。
- **导出边界计算（消除 warning）**：`getNodesBounds` 直接 import 版本对嵌入式子节点（sub flows）边界不准（React Flow 控制台 warning）。`exportCanvasToPng` 增加可选 `bounds` 参数，`CanvasToolbar` 改用 `useReactFlow().getNodesBounds(getNodes())` 传入；未传时 fallback 原逻辑（单测兼容）。
- 坑：`React.lazy` 默认取模块 `default` 导出，本项目组件为命名导出 → lazy 工厂需 `.then((m) => ({ default: m.X }))`，否则报 `Cannot convert object to primitive value`（jsdom 下 11 个用例崩）。
- 验证：`npx vitest run` 84/84、`npm run build` 通过；Playwright 实测平移不闪「保存中…」、右键弹窗/版本面板懒加载正常、PNG 下载正常、console 无 error 无 warning（仅 React DevTools 提示）。

### Added (2026-08-20)

#### 右键弹窗编辑 — 纯文本 + Markdown 预览 (`completed`)

- 新增 `NodeEditModal`：概念节点与连词节点右键（`onContextMenu`）打开编辑弹窗，替代双击内联编辑（适合长文本）；store 新增 `editModalTarget`（`{type, id}`）+ `setEditModalTarget`。
- 弹窗结构：顶部「编辑 / 预览」双 tab——编辑 tab 为 textarea 纯文本，预览 tab 用 `react-markdown` 渲染（npm 生态标准方案，不引入自研 parser）；快捷键 Ctrl+Enter 保存、Esc 取消；空文本保存回退 "???" 占位；保存后关闭弹窗并同步节点文本。
- 入口：`ConceptNode` / `LinkingPhraseNode` 右键节点任意位置打开弹窗；`App.tsx` 挂载 `<NodeEditModal />`。
- 测试增至 76 用例（+5：右键打开弹窗、载入现有文本、预览渲染 strong/列表、Ctrl+Enter 保存关窗、空文本回退）；`npx vitest run` 76/76、`npx tsc --noEmit`、`npm run build` 通过。
- Playwright 冒烟：节点右键 → 弹窗打开且 textarea 载入文本 → 输入 `**加粗**` 切换到预览 tab（strong 元素渲染成功）→ Ctrl+Enter 保存关窗、节点文本已更新，全部通过（Windows 下 CLI 中文显示乱码属编码问题，非业务 bug）。

#### PNG 导出 — 画布截图下载 (`completed`)

- 新增 `src/exportImage.ts`：用 `html-to-image` 的 `toPng`（React Flow 官方 Export Image 示例同款成熟方案），`pixelRatio=2` 截取 `.react-flow__viewport`；按 `getNodesBounds` + `viewport.zoom` 计算画布实际边界尺寸，节点四周留 40px padding；空画布时 alert 提示「画布为空」不产出文件。
- UI：`CanvasToolbar` 新增「PNG」按钮（带下载图标），导出文件名 `{doc.title}.png`（默认「未命名概念图.png」）。
- 测试增至 79 用例（+3：空画布报错、非空时计算导出尺寸、toPng 调用参数）；vitest 79/79、build 通过。
- Playwright 冒烟：创建节点 → 点击 PNG → 浏览器下载 `未命名概念图.png`（19KB 非空），截图内容含画布节点。

#### 历史版本 — 时间线快照 + 误删恢复 (`completed`)

- 新增 `src/versions.ts`：IndexedDB 存版本快照数组（`cmap-versions-v1`，含完整 `CmapDocument` 快照 + 创建时间）；API `saveVersion`（幂等：与最新快照 JSON 一致则跳过）/ `listVersions`（按地图过滤 + 时间倒序 + 概念/连词/连接计数器）/ `loadVersion` / `deleteVersion` / `shouldAutoSnapshot`；每图上限 20，超出删除最旧（防 IndexedDB 膨胀）。
- 双通道打点：① 手动——头部「保存版本」按钮 + 版本面板内「保存当前版本」；② 自动——App 自动保存时若距上次快照 ≥2 分钟（`AUTO_SNAPSHOT_INTERVAL_MS`）自动记录。
- 新增 `VersionsPanel`：头部「版本历史」按钮打开；列表按时间倒序显示快照时间 + 计数统计；「恢复」确认后载入快照并清空撤销历史（防 Ctrl+Z 回退到旧图）；「删除」移除单条版本；空态提示「暂无历史版本，编辑后会自动记录」。
- 测试增至 84 用例（+5：saveVersion 幂等去重、上限裁剪淘汰最旧、listVersions 排序与计数、loadVersion/deleteVersion、shouldAutoSnapshot 间隔判断）；vitest 84/84、build 通过。
- Playwright 冒烟（本轮）：创建节点自动快照（版本面板显示 1 条「1 概念 · 0 连词 · 0 连接」）→ 新增第二个节点后「保存当前版本」（2 条，最新「2 概念」）→ 恢复旧版本（确认后节点数 2→1，内容还原为快照）→ 删除最新版本（2→1 条）→ 内容未变再点保存提示无需重复保存（幂等），全部通过。

### Added (2026-08-20)

#### 本地多图管理 — 多科目/多主题记录（新建/切换/删除 + 启动恢复） (`completed`)

- 数据层 `src/persistence.ts`：IndexedDB 存储升级为多图结构——`cmap-local-maps-v1`（元信息列表 `LocalMapMeta[]`，含 id/title/createdAt/updatedAt，供列表页展示）+ `cmap-local-map-{id}`（每张图完整文档）+ `cmap-local-last-id`（上次打开记忆）。API：`listLocalMaps`（按更新时间倒序）/ `createLocalMap` / `loadLocalMap` / `saveLocalMap`（更新元信息 title/updatedAt）/ `deleteLocalMap` / `get|setLastLocalMapId`；全部 try/catch 安全兜底，IndexedDB 不可用时静默降级不阻塞。
- 迁移：`migrateLegacyDocument()` 启动时将旧版单文档（`cmap-doc-v1`）自动导入为第一张本地地图并删除旧 key（幂等：已迁移过则跳过）。
- UI：新增 `LocalMapsList`「本地地图」视图（照搬云端「我的地图」`MapsList` 交互模式）——新建地图 / 打开 / 删除（confirm 确认）/ 返回编辑器；打开地图时断开云端关联（`cloudMapId=null`），删除当前编辑中的地图时自动切换到剩余第一张或全新空图，避免返回编辑器后自动保存把已删图写回。
- 入口：`HeaderActions` 未登录用户显示「我的地图」（本地版，不依赖云端配置）；已登录用户显示「本地地图」+ 云端「我的地图」双入口。
- 启动流程（`App.tsx`）：迁移旧文档 → 恢复上次打开的本地地图 → 无记录时已有图则进入列表选择 / 全新用户自动新建一张，加载的文档不产生撤销历史。
- 测试增至 71 用例（+8 持久化多图 CRUD/排序/迁移 +4 列表渲染/空态/新建/打开）；`npx vitest run` 71/71、`npx tsc --noEmit`、`npm run build` 通过。
- Playwright 冒烟实测：全新环境自动建图进编辑器 → 「我的地图」进入本地列表 → 新建第二张 → 列表按更新时间排序 → 打开指定图 → 删除第二张（confirm）→ 刷新后自动恢复剩余地图，全部通过。

#### Phase 09 — 连线贝塞尔控制点（选中拖动手柄调整曲线） (`completed`)

- 数据层：`Connection.controlPoints`（v1 已预留的 `number[]`）正式启用，存储格式 `[sx, sy, tx, ty]`——前两数 = 源控制点相对「源节点中心」偏移，后两数 = 目标控制点相对「目标节点中心」偏移，**节点移动时曲线自动跟随**（相对偏移不变）；store 新增 `updateConnectionControlPoints(connId, controlPoints)`。
- 渲染层：`ConnectionEdge` 改为手写三次贝塞尔 path（`M P0 C P1 P2 P3`，P1/P2 = 源/目标控制点绝对坐标）。原因：`@xyflow/react` 的 `getBezierPath` 不支持自定义控制点参数（源码确认），手写 C 命令是自定义边教程标准做法。
- 交互：选中连线时经 `EdgeLabelRenderer` 渲染 2 个控制点拖动手柄（`translate(-50%,-50%) translate(x,y) scale(1/zoom)` 恒定尺寸 + `nopan/nodrag`）；拖拽期间本地 draft 实时预览曲线，pointer up 一次性写回 store（只产生一步撤销历史，可 Ctrl+Z 撤销）。
- 无持久化控制点时显示「中心连线 30% 处」默认建议手柄（跟随节点移动，拖拽后才落数据）。
- 坑与修复：
  - `getBezierPath`（@xyflow/system v12）签名无 `sourceControlX/Y` 参数 → 手写 C 命令。
  - `EdgeProps` 无 `zoom` prop → 用 `useReactFlow().getZoom()`。
  - 手柄在 DOM 中位于 `react-flow__nodes` 之前被节点遮挡 → `.react-flow__edgelabel-renderer { z-index: 10 }` 提升层级。
  - `edgelabel-renderer` 容器 `pointer-events: none` → 手柄自身需 `pointer-events: all`。
- 测试增至 59 用例（+`updateConnectionControlPoints` 写入、撤销/重做、控制点路径 C 命令断言、手柄 pointerdown 回调、zoom 恒定尺寸）；`npx vitest run` 59/59、`npx tsc --noEmit`、`npm run build` 全部通过。
- Playwright 冒烟实测：创建 2 节点 → Ctrl+Shift 直连 → 选中边出现 2 个控制点手柄 → 拖拽源控制点（path 控制点 `(361.6,220.88)→(401.6,196.88)`，源 handle 不动）→ 拖动节点 A 后源控制点按 flow 位移精确跟随（54/54、36/36 像素）→ 刷新后控制点随 IndexedDB 持久化恢复，全部通过。
- 冒烟经验：fitView 在空画布 mount 时会把视图放大到 maxZoom（2.5×），节点重叠覆盖路径中点 → 选中边改用 dispatch `click` 事件到 `.react-flow__edge`（绕开 HTML 节点遮挡）；flow→屏幕坐标换算需加 `.react-flow__pane` 容器偏移（标题栏 48px）。

#### v2 嵌入式子节点 — Alt 拖入/拖出 + 删除父节点提升 (`completed`)

- 数据层：`parentId` 字段（相对父节点坐标）；`setConceptParent(conceptId, parentId|null)` 拖入时绝对坐标转相对坐标、尺寸改嵌入式小号（120×48），拖出时相对转回绝对坐标、尺寸恢复标准（160×60）；不允许自挂；拖入时坐标夹在父节点边界内不越界。
- 渲染层：React Flow 原生 `parentNode` + `extent: 'parent'`（成熟方案，无自研）；`ConceptNode` 嵌入式子节点渲染为缩小 chip（`cm-node--embedded`），父节点含子节点时虚线边框提示（`cm-node--has-children`）。
- 交互：Alt + 拖拽 拖入/拖出/换父（`onNodeDragStop` 判定目标节点）；拖拽移动节点时子节点坐标相对父节点联动。
- 级联：`removeConcepts` 删除父节点时子节点提升为顶层（递归），同批删除父+子时子节点仍被提升保留不误删。
- `addConnection` 连词中点按绝对坐标计算（嵌入式子节点坐标 = 父坐标 + 相对坐标）。
- 测试增至 54 用例（+7 嵌入式：拖入坐标/尺寸、拖出恢复、禁止自挂、边界夹取、删除提升、同批删除、连词绝对坐标）；`npx vitest run` 54/54 通过。
- Playwright 实测：创建 2 节点 → Alt 拖入（embedded=1 / hasChildren=1，子节点吸附父节点内）→ Alt 拖出（标记清零、坐标转回绝对）→ 再次拖入 → 删除父节点（子节点提升保留，embedded=0）全部通过。

- 基础设施：`@supabase/supabase-js` 接入；`src/supabase.ts` 客户端（`.env` 提供 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`，未配置时 `isSupabaseConfigured=false`，云功能自动隐藏、本地功能不受影响）。
- 数据库：`public.maps` 表（id / user_id / title / data jsonb / created_at / updated_at），RLS 按 `auth.uid()` 隔离 + `updated_at` 触发器自动更新（经 Supabase migration 落地）。
- 服务层 `src/cloudSync.ts`：邮箱+密码 登录/注册/退出、`listCloudMaps` / `createCloudMap` / `loadCloudMap` / `deleteCloudMap`、`saveMapToCloud`（最后写入优先 + 版本比对返回 `conflict` + 返回最新 `updatedAt`）。
- UI：`LoginModal`（登录/注册弹窗）；`HeaderActions` 条件渲染登录 / 用户邮箱 / 我的地图 / 退出；`MapsList`「我的地图」视图（新建 / 打开 / 删除，打开即载入编辑区并记录 `cloudMapId`）；`authStore` 独立管理登录/列表状态（不参与撤销历史）。
- 自动保存联动：本地防抖 500ms 保存同时，若已打开云端地图则推送 `saveMapToCloud` 并更新本地版本号，冲突/失败时头部闪现提示。
- 注册体验：项目开启邮箱确认时 signup 不建立会话，提示「注册成功，请查收邮件完成邮箱确认后再登录」而非静默关闭弹窗。
- 环境：`.env.example` 模板 + `.gitignore` 忽略 `.env`；已配置真实 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`（可发布密钥）。
- 测试增至 47 用例（+authStore 登录态/视图切换/云端关联状态）；`npx vitest run` 47/47 通过；`npx tsc --noEmit` 通过。
- Playwright 全链路 E2E 验证通过（真实 Supabase）：登录/注册（邮箱确认提示）→ 新建云端地图（RLS 隔离落库）→ 编辑自动同步（concepts 0→1→2）→ 刷新登录态恢复 → 云端列表显示与从云端打开 → 删除（确认框 + 数据库行删除）→ 退出登录；未配置云端时登录按钮隐藏、本地功能无回归。

#### Phase 04~06 — 连词独立节点 / 持久化 / 撤销重做 + 移动端 (`completed`)

连词升级独立节点（用户拍板，对齐 Lynkage 最终形态）：
- 数据模型 `schemaVersion=2`：`LinkingPhrase` 成为带位置/样式的独立节点；一条命题 =「概念→连词」+「连词→概念」两条 Connection（同 `viaId`），直连（Ctrl+Shift）= 单条 Connection（`viaId=null`）。
- 渲染层：新增 `LinkingPhraseNode`（胶囊节点，四边 source handle，双击编辑、可拖动、可再被连线）；`ConnectionEdge` 简化为纯贝塞尔线（连词不再作为线上标签）。
- Store 级联：删除概念→级联清命题与连词；删除连词→级联删两段边；删除一段边→整条命题+连词一并删除；连词参与连线时按直连处理（不套娃）。
- 移动端双击建节点：触摸不派发 `dblclick`，按通用 double-tap 模式（300ms / 30px）手动检测。

持久化（成熟方案照搬）：
- `src/persistence.ts`：idb-keyval 官方 `get/set` + `schemaVersion` 校验；App 启动加载 + subscribe 防抖 500ms 自动保存。
- JSON 导入/导出：`HeaderActions`（导出下载 `.cmap.json` / 文件导入 + 校验 + 清空撤销历史）。

撤销/重做（成熟方案照搬）：
- 引入 `zundo`（zustand 生态标准 undo/redo middleware），`partialize` 只快照 doc、`equality` 跳过纯视图变更、limit 100 步。
- 工具栏撤销/重做按钮（`zustand/traditional` 的 `useStoreWithEqualityFn` 订阅）+ 全局快捷键 Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y（编辑态自动跳过）。

PWA / 移动端：
- `public/manifest.webmanifest` + `public/sw.js`（network-first 静态缓存）+ 移动端 meta + `public/icon.svg`；SW 仅生产注册。
- 测试增至 39 用例（新增连词节点模型、级联删除、undo/redo、导入导出结构等）。

验证（2026-08-20）：
- `npx vitest run` 39/39 通过；`npm run build` 通过；0 lint 错误。
- Playwright 实测：拖线生成连词节点（1 连词 + 2 边，方向 概念→连词→概念）、双击连词编辑提交、撤销/重做（含快捷键）、刷新后 IndexedDB 数据恢复、导出 `未命名概念图.cmap.json`、导入还原（空画布→4 概念+1 连词+2 边）、移动端触屏双击建节点与触屏拖线均正常。

#### 修复 — 框选只能选中一个节点 (`fixed`)

- 根因：`onNodesChange` 处理 `select` 变化时调用单选 `setSelectedNodeId`，框选派发的多个 select change 被逐个覆盖，最终只剩最后一个节点选中。
- 修复：选中态升级为多选集合 `selectedNodeIds: string[]`（store 新增 `setSelectedNodeIds`，保留 `setSelectedNodeId` 作为双击新建/编辑等单对象场景的便捷方法）；`onNodesChange` 将 select 变化累积到集合后一次性同步，天然支持框选与 Ctrl+单击多选；`toFlowNodes` 按集合输出 `selected` 字段；级联删除按集合过滤清理。
- 细节：移除 `handleNodeClick`（改为依赖 React Flow 原生 `selectNodesOnClick` 派发的 select change，避免与 Ctrl+多选冲突）；`NodeStylePanel` 仅单选节点时显示（多选时隐藏）；节点与边选择互斥逻辑同步到多选。
- 测试增至 44 用例（新增 `setSelectedNodeIds` 多选/互斥/级联清理用例）。
- 验证（2026-08-20）：`npx vitest run` 44/44 通过；`npx tsc --noEmit` 通过。
- Playwright 实测：框选 4 节点全部选中（4/4）、缩小框选保留框内 1 节点、多选时样式面板隐藏 / 单选恢复显示、框选后 Delete 批量删除 4 节点、Ctrl+单击累积多选（2 节点）全部正常。

#### v1 打磨增强 — 样式面板 / 统计栏 / 主题切换 (`completed`)

- 样式面板升级：`NodeColorPicker` → `NodeStylePanel`，概念与连词节点统一支持 6 色配色 + 字号调节（A-/A+，概念 12~32 步进 2、连词 10~26 步进 1，边界自动禁用）。
- 底部统计栏 `MapStats`：概念 / 连词 / 连接实时计数（直接派生自 doc，随编辑更新）。
- 主题切换：深色 / 浅色画布（`Background` 点色联动 + `.cm-canvas.is-dark`），写入 `doc.config.theme` 随文档持久化；store 新增 `setConfig` action。
- 测试增至 43 用例（新增统计栏计数、主题切换、概念/连词字号与配色调节）。
- 验证（2026-08-20）：`npx vitest run` 43/43 通过；`npx tsc --noEmit` 通过；`npx vite build` 通过。
- Playwright 冒烟：统计栏 2/1/3 实时更新、概念节点字号 16→18px 与绿色配色、连词节点字号 13→14px 与橙色配色、深色主题切换、Ctrl+Shift 直连拖线（1 边 0 连词）、普通拖线生成连词（1 连词 + 2 边）全部正常。

### Added (2026-08-20)

#### Phase 01 — 工程脚手架 (`completed`)

- 初始化 Vite + React 18 + TypeScript 工程（`package.json` / `vite.config.ts` / `tsconfig.json` / `index.html` / `.gitignore`）。
- 引入依赖：`@xyflow/react@12`、`zustand`、`idb-keyval`、`vitest@3`、`@testing-library/react`。
- 建立三元组数据模型 `src/types/cmap.ts`（`Concept` / `LinkingPhrase` / `Connection` / `CmapDocument` / `CMAP_SCHEMA_VERSION=1` / `createEmptyDocument()` / `genId()`）。
- 建立 Zustand store `src/store/cmapStore.ts`（`addConcept` / `addConnection` / `updateLinkingPhraseText` / `removeConcepts` / `removeConnections`）。
- 建立应用外壳 `src/App.tsx`（`<ReactFlowProvider>` 包裹）+ `src/components/ConceptCanvas.tsx` 空画布。
- 测试：`src/App.test.tsx` + `src/store/cmapStore.test.ts`（7 用例）。

#### Phase 02 — 无限画布 (`completed`)

- 画布工具模式 `toolMode`（`pan` / `select`）+ `setToolMode`，工具栏按钮切换（`CanvasToolbar.tsx`）。
- React Flow 画布配置：`panOnDrag` / `selectionOnDrag` 互斥切换、`minZoom=0.2` / `maxZoom=2.5`、`zoomOnDoubleClick=false`、`deleteKeyCode=null`。
- viewport 状态接入 Zustand（`onMove` → `setViewport`），工具栏实时显示缩放百分比。
- `<MiniMap>`（pannable/zoomable，按概念填充色着色）+ `<Background>` 点状网格。
- 测试增至 11 用例（工具模式切换、setViewport、工具栏渲染）。
- 验证：`npx vitest run` 11/11 通过；`npm run build` 通过；playwright 实测鼠标/触摸平移、滚轮/双指缩放（上限 2.5 / 下限 0.2）、框选、模式切换均正常，console 无 error。

#### Phase 03 — 概念节点 (`completed`)

- 自定义概念节点 `ConceptNode`（圆角矩形 + contentEditable 纯文本）：编辑态由 `store.editingId` 驱动，Enter 提交 / Shift+Enter 换行 / Escape 取消 / 失焦提交，空文本保持 "???" 占位。
- 画布交互：双击空白新建（默认"???"并立即聚焦编辑）、双击节点编辑、单击选中、拖拽移动（position 同步 store）、Delete/Backspace 删除（`removeConcepts` 级联清理连接与孤立连词）。
- 节点样式：6 色预设色板 `NodeColorPicker`（蓝/绿/橙/粉/紫/青），仅选中节点时显示，切换同步 `fill`/`borderColor`。
- **选中态修复**：`onNodesChange` 处理 `type:'select'` 同步 `selectedNodeId`，`toFlowNodes` 输出 `selected` 字段，React Flow 的 `.selected` class 与自定义节点高亮（`.cm-node.is-selected`）生效。
- 测试增至 25 用例（store 编辑态/级联删除、ConceptNode 渲染与键盘交互、App 双击建节点/色板换色）。
- 验证：`npx vitest run` 25/25 通过；`npm run build` 通过（dist 338.22 kB）；playwright 实测新建→输入→换行→提交、选中高亮、拖拽持久化、Delete/Backspace、换色、Escape 取消全部正常。
- 验收修复：双击已有节点不再新建（此前 `onDoubleClick` 经 React Flow `...rest` 透传到 wrapper div，双击节点冒泡后误新建）。`handleDoubleClick` 增加 `event.target.closest('.react-flow__node')` 判断；新增回归测试，vitest 26/26，playwright 实测双击节点进入编辑态、可全选替换文本。

#### Phase 04 — 连线与连词 (`in progress`)

- 自定义连线组件 `ConnectionEdge`（贝塞尔曲线 + 箭头 + 连词标签）：标签渲染在连线中点（`EdgeLabelRenderer` portal），随节点移动联动；选中态高亮。
- 概念节点 `ConceptNode` 增加左右 Handle（type=target/source，Position.Left/Right），支持节点间拖线连接。
- 拖线连接：`onConnect` 自动创建 `connection` + `linkingPhrase`（默认占位 "???"），数据层保持三元组结构。
- **连词编辑**（Section B）：点击连线标签进入 contentEditable 编辑态（`editingLpId` 驱动），Enter/blur 提交 → `updateLinkingPhraseText`、Escape 取消；点击 label 阻止冒泡避免选中连线。
- **连线选中+删除**（Section B）：`onEdgesChange` 处理 `type:'select'` 同步 `selectedEdgeId`，`toFlowEdges` 输出 `selected` 字段使 React Flow `.selected` 生效；选中后 Delete 触发 `removeConnections` 级联清理孤立连词。
- **Ctrl/Cmd+Shift 直连**（Section B）：`onConnectStart` 记录修饰键 → `directConnectRef` → `onConnect` 读 ref 决定 `withLinkingPhrase: false`，生成无连词的直连。
- 互斥设计：选中节点时清 `selectedEdgeId`，反之亦然（`setSelectedNodeId` / `setSelectedEdgeId` 互斥）。
- 测试增至 33 用例（+store selectedEdgeId/editingLpId 互斥、+ConnectionEdge 渲染与标签组件纯展示）。
- 验证：`npx vitest run` 33/33 通过；`npm run build` 通过（dist 340.76 kB）；playwright 实测拖线创建连接（含贝塞尔路径+箭头+连词"???"占位）、节点移动标签联动、连词点击编辑（"???"→"导致"）、连线选中+Delete 删除、Ctrl+Shift 直连（空连词标签）。

**修复：整节点可拖线（按 Lynkage 方案）**

- **问题**：用户反馈「无法创建连词与连线」。根因为此前仅 10px 圆点 Handle 可拖出连线，命中面过小。
- **方案**：
  - `ConceptNode` 改为四边 `source` Handle（top/bottom/left/right），id 标注方向。
  - `ConceptCanvas` 开启 `ConnectionMode.Loose` + `connectionRadius={40}`，拖线时显示蓝色虚线。
  - 四边全 `source` 避免 Loose 模式下 target 起点导致的方向反转（React Flow 源码 `isValidHandle` 会反转 target 起点的 source/target）。
  - `App.css` 将 Handle 热区扩大为四边 16px 透明边带；节点 hover / 选中时显示边带中央小圆点提示；中心区域保留给移动/编辑。
  - 显式覆盖 React Flow 官方 `.react-flow__handle-{pos}` 的 `transform` 为 `none`，避免热区错位。
- **验证**：vitest 34/34 通过；build 通过（dist 341.10 kB）；playwright 实测从节点右缘/左缘拖线均成功创建连线、自动补全 "???" 连词、连词编辑、Delete 删除、Ctrl+Shift 直连、节点中心拖动、双击节点编辑全部通过。

## [0.1.0] - 2026-08-20

### Added

- 项目立项：`概念地图软件开发方案.md`（含数据模型设计、交互设计、4 Phase 路线图）。
- 逆向分析：`docs/Lynkage实现分析.md`（Lynkage 技术栈 / 三元组数据模型 / 混合渲染架构 / Neo4j 后端 / 交互细节）。
- 迭代规划：`iterations/v1-launch/PRD.md` + `.plan/plan.md` + 6 个 phase 文档。
