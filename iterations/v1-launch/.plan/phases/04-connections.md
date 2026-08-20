# Phase 04 — 连线与连词

**Status**: `not started`
**目标**: 节点间拖线连接、连词标签编辑、连线删除、`Ctrl+Shift` 直连
**前置**: Phase 03（concepts）

## 验收判据

- [ ] 从节点 Handle 拖出连线到另一节点，生成带连词标签的连线（`概念 —连词→ 概念`）
- [ ] 拖线生成时自动补全连词占位（如"???"），可点击连词标签编辑文本
- [ ] 单击选中连线后 Delete 可删除
- [ ] `Ctrl/Cmd + Shift` 拖线时生成直连（无连词）
- [ ] 连词标签跟随连线中点位置，随节点移动联动
- [ ] `npx vitest run` 通过，无 console error

## Sections

### Section A — 拖线连接

**Gate**: `self-tested`

**自测判据**：

- [x] 节点右缘 Handle 拖出 → 目标节点出现连线
- [x] store 中生成 `connection`（fromId/toId/viaId）
- [x] 连线渲染为带箭头的曲线

**Tasks**：

- [x] 自定义节点加 `<Handle>`（右侧输出，实现 onConnect）(`src/components/ConceptNode.tsx`)
- [x] `onConnect` 回调：创建 connection + 自动创建 linkingPhrase（占位"???"）(`src/components/ConceptCanvas.tsx` + `src/store/cmapStore.ts:addConnection`)
- [x] 自定义 edge 组件：带箭头、标签占位（虚线可调简化为实线曲线，v1 无需虚线）(`src/components/ConnectionEdge.tsx`)
- [x] 测试：connect 后 store 中三元组结构正确（`src/store/cmapStore.test.ts` 已有 + `ConnectionEdge.test.tsx` 新增）

**记录**：

- 自测：vitest 31/31 通过；playwright 实测——从"光合作用"source handle 拖到"呼吸作用"target handle → edgeCount=1、连词标签"???"、贝塞尔曲线 path（含 C）、箭头 marker `url(#1__color=#94a3b8&type=arrowclosed)`；拖动节点后标签位置从 [575,330] → [582,369] 跟随联动。build 通过（dist 339.36 kB）。
- 用户验收：
- Commit：

---

### Section C — 修复「无法创建连词与连线」（按 Lynkage 方案扩大拖线热区）

**Status**: `fixed` / 等待用户重新验收

**根因**：此前 `ConceptNode` 仅在左右放置 10px 圆点 Handle，命中面极小；用户从节点任意位置拖出连线的预期（Lynkage 的 `cmp-entity-drag-line-area` 覆盖整节点）无法满足。

**修复方案**（对齐 Lynkage 整节点可拖线）：

1. **四边 source Handle**：`ConceptNode` 改为在 top / bottom / left / right 各放一个 `type="source"` 的 Handle，并给 id（`top` / `bottom` / `left` / `right`）。
2. **开启 `ConnectionMode.Loose`**：`ConceptCanvas` 设置 `connectionMode={ConnectionMode.Loose}`、`connectionRadius={40}`，并加蓝色虚线拖线视觉反馈。Loose 模式下任意 Handle 都可作为拖线起点/终点，避免 Strict 模式下「拖到目标 source handle 吸附无效」的问题。
3. **四边全 source 避免方向反转**：React Flow 源码 `isValidHandle` 中 target 起点会反转 source/target。全 source 保证方向恒为「起点节点 → 终点节点」。
4. **CSS 扩大热区**：`.cm-node__handle` 默认透明、覆盖四边 16px 厚边带（默认 `opacity: 0` 但可交互）；节点 hover / 选中时淡入边带中央的小圆点提示；节点中心区域保留给移动/编辑。
5. **覆盖 React Flow 默认 transform**：官方 `.react-flow__handle-{pos}` 带 `translate(-50%,0)` 等位移，必须显式 `transform: none`，否则热区会错位。

**Tasks**：

- [x] `src/components/ConceptNode.tsx`：四边 source Handle，id=top/bottom/left/right。
- [x] `src/components/ConceptCanvas.tsx`：Loose 连接模式、connectionRadius=40、拖线样式。
- [x] `src/App.css`：透明边带热区 + hover/selected 视觉圆点 + transform 归零。
- [x] `src/components/ConceptNode.test.tsx`：新增测试断言 4 个 Handle 与 source 类型。
- [x] 单测与 build：`npx vitest run` 34/34；`npm run build` 通过（341.10 kB）。
- [x] playwright 实测验证：
  - 从节点右缘/左缘拖出 → 成功创建连线；
  - 自动补全 "???" 连词标签；
  - 点击连词标签输入 "causes" 回车 → 标签更新；
  - 选中连线 Delete → edgeCount=0；
  - Ctrl+Shift 拖线 → edgeCount=1、label 为空（直连）；
  - 节点中心拖动 → 位置更新且不新增连线；
  - 双击节点 → 进入编辑态并提交文本。

**记录**：

- 自测：vitest 34/34 通过；build 通过（341.10 kB）；playwright 实测上述 7 项交互全部通过。
- 用户验收：
- Commit：

---

### Section B — 连词编辑与连线管理

**Gate**: `self-tested`

**自测判据**：

- [x] 点击连词标签 → 进入编辑态 → 输入后失焦保存
- [x] 选中连线 Delete 删除（同时清理关联 linkingPhrase 若不再被引用）
- [x] Ctrl+Shift 拖线生成无连词的直连

**Tasks**：

- [x] 连词标签编辑（自定义 edge label，点击进入 contentEditable）(`src/components/ConnectionEdge.tsx`)
- [x] 连线删除（`onEdgesChange` 处理 select + remove）(`src/components/ConceptCanvas.tsx`)
- [x] 删除连线时孤儿连词清理逻辑（`src/store/cmapStore.ts:removeConnections` 已有）
- [x] `Ctrl/Cmd+Shift` 修饰键检测 → 直连模式（`onConnectStart` 记录 → `onConnect` 读 `directConnectRef`）(`src/components/ConceptCanvas.tsx`)

**记录**：

- 自测：vitest 33/33 通过（+store 互斥 + editingLpId 测试）；build 通过（340.76 kB）；playwright 实测——连词编辑：点击 "???" label → waitForFunction activeElement 含 `cm-edge-label--editing` → 输入"导致"回车 → labelText="导致" 退出编辑；连线选中+删除：点 interaction path 起点附近 → `react-flow__edge` classList 含 `selected` → Delete → edgeCount=0；Ctrl+Shift 直连：keyboard.down(Control+Shift) + 拖线 → edgeCount=1、labelText=""（空，无连词）。
- 用户验收：
- Commit：

## Notes

- 自定义 edge label 需在节点移动时保持贴线（React Flow edge 的 `label` 属性 + 自定义 label 组件）。
- 连词编辑与连线选中的事件冲突（点击 label 不应选中连线）需处理 `event.stopPropagation()`。
- 三元组结构：`connection.fromId → linkingPhrase.id → connection.toId`，直连时 `viaId=null`。
