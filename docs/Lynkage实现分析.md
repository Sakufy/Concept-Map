# Lynkage 实现方法逆向分析

> 分析方式：直接抓取 www.lynkage.cn 生产环境的 JS bundle（main chunk / libs chunk）、HTML、网络请求、公开分享地图的 DOM 结构，结合官方帮助中心文档反推其实现方法。Lynkage 为闭源 SaaS，无公开 GitHub 仓库，本文所有结论均来自实际观测。
>
> 分析日期：2026-08-20

---

## 一、结论摘要

| 维度 | Lynkage 的实际实现 |
|------|-------------------|
| 前端框架 | React SPA（CRA 构建，`static/js/*.chunk.js`） |
| 状态管理 | Redux + Immutable.js（数据全部不可变 Record） |
| 画布渲染 | **D3 驱动纯 SVG**（连线）+ **HTML DOM 覆盖层**（节点），混合渲染 |
| 节点文本编辑 | Slate 富文本编辑器（contenteditable，支持 Markdown / LaTeX / 表格） |
| UI 组件库 | Blueprint.js（Palantir）+ styled-components |
| 数学公式 | MathJax（tex-svg） |
| 画布平移缩放 | d3-zoom / d3-drag |
| 本地缓存 | IndexedDB（idb 库）+ localStorage（仅存 LANG） |
| 后端 | **Neo4j 图数据库**（`/cmap-neo4j/api`）+ 关系型数据库（`/cmap-rdbms/api/v1`）+ 主 API（`/api/v2/`） |
| 文件存储 | 自建 CDN（vdo.lynkage.cn） |
| 监控/分析 | 自建 Sentry + PostHog；Crisp 在线客服 |
| PWA | manifest.json（可安装、离线可用） |

---

## 二、核心数据模型（最重要发现）

Lynkage 概念图的数据模型不是简单的 `nodes + edges`，而是**三种实体节点**：

```
CONCEPT（概念节点）
  ├─ text                文本（富文本）
  ├─ style               样式（默认样式来自 defaultConceptStyle）
  ├─ attachments         附件列表
  ├─ links               链接列表
  └─ x / y / 尺寸        位置

LINKING_PHRASE（连词节点）
  └─ 字段同概念节点（文本/样式/附件/链接）

CONNECTION（连接节点）
  ├─ id
  ├─ fromId / toId       三元组两端
  └─ controlPoints       贝塞尔曲线控制点列表
```

### 关键架构决策：连词是"节点"，不是"边的标签"

```
  概念A ──[CONNECTION]── 连词"导致" ──[CONNECTION]── 概念B
```

- 拖拽概念 A 的拓展箭头 → 自动生成"**概念A - 连词 - 概念B**"命题（Proposition）
- 拖拽时**自动补全连词**（默认占位文本），用户再编辑连词文本
- `Ctrl/Cmd + Shift` 拖拽可生成直连（跳过连词）
- 连接线本身也是节点（CONNECTION），因此支持曲线控制点、独立样式

**为什么这样设计**：符合概念图理论（Ausubel / Novak）的"概念—关系—概念"三元组模型，且：
1. 连词可独立编辑富文本、挂附件、有样式
2. 连词可再被其它连接线引用（连词与连词也能相连）
3. 嵌入式节点中"包含"关系也是通过这种三元结构表达
4. 数据存入图数据库（Neo4j）时是天然的三元关系结构

### 地图容器模型（cmapModel）

```
cmapModel
  ├─ mapModels[]         一个文档可含多个地图（多图管理）
  ├─ currentMapIndex     当前地图索引
  ├─ resMeta             资源元数据（图片/附件引用）
  └─ formatVersion       数据格式版本（做迁移/兼容）

deserializeConfig
  ├─ theme               主题
  └─ ignoreBackgroundWheel  背景滚轮配置

Frames[]                 帧（演示模式：按帧逐页演示概念图）
```

---

## 三、渲染架构（混合渲染）

Lynkage 的画布**同时使用 SVG 和 HTML DOM**，分工明确：

```
┌─────────────────────────────────────────────┐
│  外层 div（styled-components）              │
│  ├─ SVG 层（D3 驱动，1280x720 视口）        │
│  │   ├─ defs/marker#arrow         箭头      │
│  │   ├─ g#for-embedded-entities   嵌入层    │
│  │   ├─ g.cmp-node[data-id]       节点组    │
│  │   │   └─ defs > mask            遮蔽     │
│  │   ├─ path.cmp-conn-line        连接线    │
│  │   │   └─ 主细线(1px) + 粗线(9px hit)    │
│  │   ├─ path 透明对角线            点击层    │
│  │   └─ ...                                │
│  └─ HTML 覆盖层（React DOM）               │
│      ├─ nodes-layer__NodesLayerDiv          │
│      │   └─ EntitysLayerDiv（无限画布尺寸） │
│      │       ├─ div.cmp-node.cmp-entity     │
│      │       │   ├─ cmp-entity-drag-line-area（连线拖拽热区）│
│      │       │   └─ cmp-concept-content（Slate 文本）        │
│      │       └─ ...                          │
└─────────────────────────────────────────────┘
```

### 各层的实现要点

**1. SVG 连接线层（D3）**
- 连接线是贝塞尔曲线 `<path>`（`M...L...`，样式面板可选"贝塞尔 4 控制点曲线"）
- **双 path 技巧**：1px 细线用于显示 + 9px 宽透明粗线（`pointer-events="stroke"`）用于鼠标命中，解决"细线难选中"问题
- **mask 遮蔽**：每条连接线配一个 mask，把连接线穿过的节点区域挖空，线"从节点背后穿过"而不遮挡节点文本
- 箭头用 SVG `<marker id="arrow">` 三角形
- 一条 `M -10000 -10000 L 10000 10000` 的透明对角 path 铺满画布用于捕获空白处点击/拖拽

**2. HTML 节点覆盖层（React）**
- 节点主体是**绝对定位的 HTML div**（`cmp-node cmp-entity has-label`），不是 SVG 图形
- 节点尺寸 73x58 / 158x58 等，由内容自动撑开
- `cmp-entity-drag-line-area` 是覆盖整个节点的透明层，负责"从节点拖出连线"
- 节点文本由 **Slate 编辑器**（`editor-block text-block`，contenteditable）渲染，支持多行、Markdown、LaTeX（MathJax 实时渲染）
- 节点背景样式（圆角矩形、边框、颜色）由 CSS 完成

**3. 平移缩放的实现**
- `d3-zoom`（`scaleExtent`、`wheelDelta` 均来自 d3-zoom API）
- 节点 div 的 transform 与 SVG 的 transform 同步更新

**4. 嵌入式节点**
- SVG 中有独立的 `g#for-embedded-entities` 层
- HTML 层子节点以绝对定位方式挂在父节点容器内部，`Alt + 拖拽` 可把子节点拖入/拖出父节点

---

## 四、交互与编辑实现（来自官方帮助中心 + DOM 验证）

| 交互 | 实现 |
|------|------|
| 创建概念 | **双击画布**创建，默认文本"???"，立即进入编辑 |
| 创建命题 | 单击/拖拽节点上的**拓展箭头**，生成"概念-连词-概念" |
| 多种联系 | 拖拽概念/连词的拓展箭头到目标，**自动补全连词** |
| 直连 | `Ctrl/Cmd + Shift` 拖拽，跳过连词 |
| 曲线 | 选中连线 → 样式面板 → "贝塞尔 4 控制点曲线" → 拖拽控点 |
| 长文本编辑 | 右键 → **弹窗编辑**（弹窗内 Slate：Markdown / LaTeX / 表格） |
| 附件 | 右键 → 关联附件（云端已有 / 本地上传） |
| 嵌入式节点 | 右键 → 添加嵌入子节点；`Alt + 拖拽` 出入父节点 |
| 粘贴 | `Ctrl/Cmd + V` 粘贴文本 / 图片 / 概念 / 连词 |
| 移动画布 | `Space + 左键拖拽`；右下角**导航视窗**（minimap） |
| 数据操作层 | `CmapModelModifier`：addConcept / moveConnection / focusNode / setFrames / pushAttachment 等，所有修改走 Redux reducer |

### 高级功能（帮助中心目录确认存在）
- 设置概念图背景 / 主题 / 元素样式
- **概念图演示**（Frames 帧演示）
- **概念图统计**（节点/连词/命题数量统计）
- **历史版本**（版本回溯）
- **协作制图**
- **发布概念图**（`/share/{id}` 只读分享，支持 iframe 嵌入参数：`showToolbar=false&disableScrollTransform=true&iframe=true&autoFill=true`）

---

## 五、后端与存储架构

```
浏览器 ── axios ──┬─ /api/v2/            → 主 API（账号/地图 CRUD/引导数据）
                 ├─ /cmap-neo4j/api     → Neo4j 图数据库（概念图三元组数据）
                 ├─ /cmap-rdbms/api/v1  → 关系型数据库（用户/元数据/统计）
                 └─ vdo.lynkage.cn      → 文件 CDN（图片/附件）
```

- **用图数据库（Neo4j）存概念图数据**是本产品最有意思的架构决策：概念图的"概念-连词-概念"三元结构天然适合图模型，跨图查询（路径/相似度/子图）可直接用 Cypher
- 关系型数据库负责账号、地图列表等关系型元数据
- 前端 `mapModels[]` 支持一个文档多图，与图数据库多子图对应

---

## 六、对我们项目的启示（对比现有方案）

现有方案（`概念地图软件开发方案.md`）技术栈：React 18 + TS + Vite + Zustand + @xyflow/react + IndexedDB + Supabase。

### 1. 连词建模 —— 建议升级

| | 现有方案 | Lynkage 做法 |
|--|---------|-------------|
| 连词 | edge label（挂在边上） | **独立 LINKING_PHRASE 节点 + CONNECTION 连接节点** |

**启示**：独立连词节点能表达"连词再被连接"、"连词挂附件/公式"等高级语义，且与 Supabase/图数据库结构天然对齐。但开发量更大。建议：
- MVP 用 edge label（React Flow 自定义 edge）快速跑通
- **数据层预留**：JSON Schema 直接采用 `{concept, linkingPhrase, connection}` 三元组结构，MVP 阶段把连词降级渲染为 edge label，后续可无缝升级为独立节点

### 2. 画布引擎对比

| | Lynkage（自研 D3+SVG+DOM） | 本项目（React Flow） |
|--|--------------------------|---------------------|
| 连线命中 | 双 path 技巧 | 内置 handle + edge 交互 |
| 曲线 | 贝塞尔 4 控制点 | 自定义 edge path（支持） |
| mask 遮蔽 | 手写 mask | React Flow 需自定义 |
| 节点文本 | Slate 富文本 | contentEditable 自定义 |
| 移动端 | 支持 | 内置触摸手势 |

**启示**：React Flow 覆盖 Lynkage 90% 画布能力且开发快；Lynkage 的"节点 HTML 覆盖层 + SVG 连线层"思路值得学习——React Flow 本质也是这个模式。自定义节点时**用 HTML div + contentEditable/Slate 渲染文本**，与 Lynkage 体验对齐。

### 3. 可直接借鉴的细节
- 双击空白新建节点（默认占位文本"???"立即编辑）
- 节点上 4 向"拓展箭头"拖出连线、自动补全连词
- `Ctrl+Shift` 直连
- 连线选中后样式面板切换"直线/贝塞尔曲线"+ 拖拽控制点
- 右下角 minimap 导航视窗
- 右键弹窗编辑（长文本/Markdown/LaTeX）
- `formatVersion` 字段做数据迁移
- 分享链接带 iframe 嵌入参数
- Frames 演示模式（可作 P2 亮点功能）

### 4. 后端启示
- 单机 MVP 完全不需要 Neo4j；先用 Supabase `maps.data` JSONB 存三元组结构
- 若未来做"知识图谱查询/自动推荐关联概念"，可考虑升级图数据库（Neo4j / Postgres+Apache AGE），数据模型从第一天就按三元组设计可平滑迁移

---

## 七、Lynkage 功能全景（对标清单补全）

除现有方案已列的 P0/P1 功能外，Lynkage 还有以下值得参考的能力：

1. **元素样式面板**：节点/连线/连词分别可调样式（颜色、边框、曲线类型、字号）
2. **背景设置**：纯色 / 网格 / 图片背景
3. **主题**：全局主题切换
4. **统计面板**：地图节点数、命题数、连词数
5. **历史版本**：时间线回溯
6. **演示模式（Frames）**：帧动画逐页讲解
7. **协作制图**：多人在线编辑
8. **内容粘贴**：支持概念/连词的跨图复制粘贴
9. **PWA 安装**：离线可用

---

## 附录：分析证据来源

- `main.js`（845KB，CRA main chunk）：CmapModelModifier、serializeConcept/LinkingPhrase/Connection、defaultConceptStyle、d3-zoom API、baseURL、`/cmap-neo4j/api`、`/cmap-rdbms/api/v1`、`/api/v2/`、localStorage LANG
- `libs.js`（4MB，vendor chunk）：immutable / redux / axios / moment / slate / d3 / blueprint / mathjax / sentry / posthog / idb / lodash
- 分享地图 `share/m9bbKQHa43Y47gW` 实时 DOM：`g.cmp-node[data-id]`、`path.cmp-conn-line`（1px+9px 双 path）、`marker#arrow`、`mask`、`nodes-layer__*` styled-components、`editor-block text-block`（Slate）、`cmp-entity-drag-line-area`、无 `<text>` 元素（证明节点文本为 DOM 渲染）
- 帮助中心 `help.lynkage.cn/docs/绘制概念图/*`：全部交互细节
