# 概念地图软件

对标 [Lynkage](https://www.lynkage.cn) 的概念地图工具：无限自由画布、概念节点、带连词的连接线、嵌入式子节点、云同步与分享。电脑 + 手机双端可用（Web/PWA）。

## 技术栈

React 18 · TypeScript · Vite · @xyflow/react (React Flow) · Zustand · idb-keyval · Supabase（Phase 3+）

## 快速开始

```bash
npm install          # 安装依赖
npm run dev          # 启动开发服务器（默认 http://localhost:5173）
npm run build        # 类型检查 + 构建
npx vitest run       # 运行全部测试
```

## 在线地址（已部署）

| 项 | 值 |
|------|------|
| 线上地址 | https://concept-map-d6gl2vdifa67790a0-1440482625.tcloudbaseapp.com/ |
| 托管平台 | 腾讯云 CloudBase 静态网站托管（体验版环境） |
| 环境 ID | `concept-map-d6gl2vdifa67790a0`（区域 ap-shanghai） |
| 环境配置 | 静态托管 IndexDocument=`index.html`；PWA 资源（`sw.js` / `manifest.webmanifest` / `icon.svg`）已随构建产物上传 |

更新部署：

```bash
npm run build                  # 1. 构建（产出 dist/）
# 2. 将 dist/ 内容上传到 CloudBase 静态托管根目录（CloudBase 控制台「静态网站托管」或 IDE 部署工具）
```

> 注意：浏览器可能缓存旧版本，更新后建议带随机 query 访问（如 `?v=<时间戳>`）验证最新版本。

## 项目文档导航

| 文档 | 用途 |
|------|------|
| [docs/README.md](docs/README.md) | **文档地图**：所有文档的定位与更新规则（先看这个） |
| [AGENTS.md](AGENTS.md) | AI 协作规范（技术栈 / 工作纪律 / 常用命令） |
| [概念地图软件开发方案.md](概念地图软件开发方案.md) | 技术选型与开发路线图 |
| [AI辅助开发管理方案.md](AI辅助开发管理方案.md) | AI 辅助开发的流程方法论 |
| [docs/Lynkage实现分析.md](docs/Lynkage实现分析.md) | Lynkage 竞品逆向分析（技术依据） |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | 变更日志 |
| [iterations/v1-launch/.plan/plan.md](iterations/v1-launch/.plan/plan.md) | 全项目阶段航图与关键决策 |

> 给 AI 助手看的规范见 `AGENTS.md`（每次会话自动加载）。
