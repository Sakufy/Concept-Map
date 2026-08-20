# 项目文档地图与维护指南

> 本文件是**全项目唯一的文档索引**。回答两个问题：① 每份文档是干什么的、什么时候更新；② 一次变更/一个迭代完成后该更新哪些文档。
>
> 维护原则：**先看本地图定位文档，再动手更新**；新文档必须在这里登记一行。

## 一、文档体系总览（三层）

```
概念地图项目/
├── README.md                        ← L1·人类入口：项目是什么 + 怎么跑 + 文档导航
├── AGENTS.md                        ← L1·AI 规范：技术栈/纪律/命令（每次会话自动加载）
├── 概念地图软件开发方案.md           ← L1·长期纲领：技术选型 / 路线图 / 数据模型
├── AI辅助开发管理方案.md             ← L1·方法论：AI 协作流程 / 三层文档体系定义
├── docs/
│   ├── README.md                    ← 【本文档】文档索引与维护指南
│   ├── CHANGELOG.md                 ← L3·变更日志：每次有实质产出必追加
│   └── Lynkage实现分析.md           ← L1·竞品逆向：Lynkage 实现方法（技术依据）
├── iterations/
│   └── v1-launch/
│       ├── PRD.md                   ← L2·产品需求：本次迭代做什么、不做什么
│       └── .plan/
│           ├── plan.md              ← L2·全项目航图：阶段状态 + 关键决策（任务追踪唯一来源）
│           └── phases/NN-*.md       ← L2·阶段详情：验收判据 / sections / 自测记录
└── .codebuddy/
    └── memory/                      ← L3·工作记忆：跨会话上下文
        ├── MEMORY.md                ← 长期事实 / 用户偏好 / 踩坑（就地更新）
        └── YYYY-MM-DD.md            ← 每日日志（append-only）
```

## 二、文档清单（谁 · 何时 · 怎么更新）

| 文档 | 定位 | 更新频率 | 更新时机 | 维护者 |
|------|------|---------|---------|--------|
| `README.md` | 人类入口 | 极低 | 项目功能/使用方式有变化 | 人 |
| `AGENTS.md` | AI 工作纪律 | 极低 | 用户改变纪律/技术栈时 | 人 + AI |
| `概念地图软件开发方案.md` | 长期纲领 | 极低 | 技术选型/路线图层面决策时；正文改动**一律加演进标注**，不重写历史 | 人 + AI |
| `AI辅助开发管理方案.md` | 方法论 | 极低 | 协作流程本身调整时 | 人 |
| `docs/CHANGELOG.md` | 变更日志 | **每次实质产出** | 功能完成/修 bug/重构后，在 `## [Unreleased]` 下按日期追加 | AI（必须） |
| `docs/Lynkage实现分析.md` | 技术依据 | 极低 | 新竞品调研时才动 | AI |
| `iterations/v1-launch/PRD.md` | 迭代需求 | 每轮迭代 | 新一轮迭代规划时 | 人 + AI |
| `iterations/v1-launch/.plan/plan.md` | 全项目航图 | **每个阶段/专项结束** | 阶段状态表 +「关键决策」节追加 | AI（必须） |
| `iterations/v1-launch/.plan/phases/NN-*.md` | 阶段详情 | 每个 phase 内 | Gate 状态 / 自测记录 / 用户验收 | AI |
| `.codebuddy/memory/MEMORY.md` | 长期记忆 | 中 | 用户偏好/长期事实/可复用踩坑（就地更新） | AI（必须） |
| `.codebuddy/memory/YYYY-MM-DD.md` | 每日日志 | **每次实质工作** | 收尾时 append 简短记录 | AI（必须） |

## 三、更新工作流（一次变更该动哪些文档）

```
【常规功能 / 修 bug / 重构】
  ① docs/CHANGELOG.md 追加（必须）
  ② .codebuddy/memory/YYYY-MM-DD.md 追加（必须）
  ③ 若产生可复用经验 → MEMORY.md「技术要点」就地更新
  ④ 若属于某 phase/专项 → plan.md 状态表 + 对应 phases 文档同步

【新阶段 / 新迭代】
  ① plan.md 阶段总览加一行（slug / 一句话目标 / 状态）
  ② 新建 phases/NN-<slug>.md（照 01-scaffold.md 模板）
  ③ 需要产品定义时更新 PRD.md
  ④ 一个 phase 自测通过 → 更新该 phase 文档 Gate 状态再推进

【技术选型 / 架构决策】
  ① plan.md「关键决策」节追加（约束 + 为什么选 B 而非 A）
  ② CHANGELOG.md 记录落地
  ③ MEMORY.md「技术要点」补踩坑（如适用）
  ※ 不再另建 docs/ADR/（决策已集中记在 plan.md 关键决策，避免第三处重复）

【竞品调研 / 外部依据】
  ① docs/ 下独立分析文档（如 Lynkage实现分析.md）
  ② 结论回写到开发方案/plan.md 决策
```

## 四、维护规则（防止文档失序）

1. **文档地图是唯一入口**：新增文档必须在本文件「文档清单」登记一行，否则视为不存在。
2. **plan.md 是任务追踪的单一来源**：不建 docs/TASKS.md（避免与 plan.md 双轨）。任务状态只在 plan.md + phases 文档里维护。
3. **决策集中记录**：架构决策一律进 plan.md「关键决策」，不散落在多处。
4. **长期文档只加演进标注，不重写历史**：正文描述的是「决策当时」的事实；后来的变化在文首加一段「演进说明」块，保留时间线。
5. **CHANGELOG 只追加**：`## [Unreleased]` 下按日期分组，不改写已发布条目。
6. **memory 区分两种写入**：临时进展进当日日志；稳定偏好/踩坑进 MEMORY.md。MEMORY.md 定期就地压缩。
7. **旧文档归档**：内容被替代时，在文首加 `> ⚠️ 已归档：……指向……`，不删除（保留可追溯历史）。

## 五、文档间引用关系

```
README.md ──────────────→ docs/README.md（导航）
AGENTS.md ──────────────→ 引用纪律（技术栈/命令）
概念地图软件开发方案.md ←──── 依据 docs/Lynkage实现分析.md
iterations/v1-launch/PRD.md ←── 依据 概念地图软件开发方案.md
iterations/v1-launch/.plan/plan.md ←── 引用 PRD + 开发方案 + AGENTS
.codebuddy/memory/ ←────── 每份文档的变更都会在这里留痕
```
