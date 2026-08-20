# AGENTS.md — 项目级 AI 开发规范

> 本文件是给 AI 编程助手看的项目说明（AGENTS 规范，Anthropic/OpenAI 官方推荐格式）。
> AI 每次在本项目工作前必须阅读并遵守。人类说明见 README.md。

## 项目概述

概念地图软件（对标 Lynkage）：Web/PWA 应用，电脑 + 手机双端可用。
核心功能：无限自由画布、概念节点、带连词（标签）的连接线、嵌入式子节点、云同步、分享。

## 技术栈（严格遵循，不要擅自引入新框架）

- 前端：React 18 + TypeScript + Vite
- 画布：@xyflow/react (React Flow)
- 状态管理：Zustand
- 本地存储：IndexedDB（idb-keyval）
- 云端：Supabase（Phase 3 引入）
- 测试：Vitest + @testing-library/react

## 目录结构

```
src/            # 代码
docs/           # 管理文档（ROADMAP / TASKS / CHANGELOG / ADR）
.codebuddy/     # 工作记忆与工具配置（不要删除）
```

## 工作纪律（必须遵守）

1. **成熟方案优先（最高优先级，用户明确要求）**：任何功能动手前，先找「照搬来源」，按优先级：
   - ① 本仓库已有分析：`docs/Lynkage实现分析.md`、`概念地图软件开发方案.md`、`iterations/v1-launch/.plan/plan.md` 关键决策；
   - ② 依赖的官方文档 / 示例：reactflow.dev（@xyflow/react examples）、idb-keyval README、Zustand 文档、Supabase 官方 quickstart；
   - ③ 官方 / 社区成熟模式（GitHub 示例、知名博客、npm 生态标准用法）。
   有现成方案就直接照搬复用，**禁止自研试错、禁止从零造轮子、禁止"先自己实现再改"**。只有确认三档都找不到现成方案时才自定义，并记录原因。遇到坑先搜官方 issue / 文档，不自己闷头调试。
2. **速度优先（用户明确要求）**：按最小可行路径推进——单测只覆盖 store 核心逻辑 + 关键渲染断言，不堆冗余用例；浏览器实测每个 Phase 只做一次关键路径冒烟，不逐 section 全量回归；文档一次写到位、避免反复改；一个 Phase 自测通过立即推进下一个，不阻塞等待验收。
3. **先读后写**：动手前先读 `iterations/v1-launch/.plan/plan.md` 确认当前任务、`docs/` 确认已有分析结论，不得推翻已有决策。
4. **任务驱动**：只做当前任务（phase）范围内的事，不做范围外改动；新想法写进 plan.md Open Questions，不直接实施。
5. **规格对照**：实现前先明确该任务的验收标准，完成后逐条自检。
6. **测试兜底**：改动必须跑通 `npx vitest run` 才能宣布完成。
7. **质量门禁（DoD）**：build 通过、测试通过、已更新 CHANGELOG、关键交互经一次冒烟验证。
8. **提交规范**：Conventional Commits —— `feat:` `fix:` `refactor:` `docs:` `test:` `chore:`。
9. **变更记录**：每次有实质产出，必须在 `docs/CHANGELOG.md` 追加记录，并在 `.codebuddy/memory/` 写入工作记忆。

## 常用命令

```bash
npm install          # 安装依赖
npm run dev          # 启动开发服务器
npm run build        # 类型检查 + 构建
npx vitest run       # 运行全部测试
npm run lint         # 代码检查
```

## 明确的禁止事项

- 不擅自引入 AGENTS.md 未列出的依赖（先写 ADR 再决定）
- 不重构用户未要求的代码
- 不删除 `.codebuddy/` 目录
- 不在未跑通测试的情况下提交"完成"
