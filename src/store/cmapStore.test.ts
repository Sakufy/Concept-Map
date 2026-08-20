import { useCmapStore } from './cmapStore';
import { createEmptyDocument } from '../types/cmap';

describe('cmapStore 三元组数据模型', () => {
  beforeEach(() => {
    useCmapStore.setState({
      doc: createEmptyDocument(),
      selectedNodeIds: [],
      selectedEdgeId: null,
      editingId: null,
      editingLpId: null,
      viewport: { x: 0, y: 0, zoom: 1 },
    });
    useCmapStore.temporal.getState().clear();
  });

  it('addConcept 创建概念节点，默认文本 ???', () => {
    const c = useCmapStore.getState().addConcept(10, 20);
    expect(c.type).toBe('concept');
    expect(c.text).toBe('???');
    const doc = useCmapStore.getState().doc;
    expect(doc.concepts).toHaveLength(1);
    expect(doc.concepts[0]).toMatchObject({ x: 10, y: 20 });
  });

  it('addConnection 自动补全连词（连词为独立节点，命题=两段边）', () => {
    const { addConcept, addConnection } = useCmapStore.getState();
    const a = addConcept(0, 0, 'A');
    const b = addConcept(0, 100, 'B');
    const conn1 = addConnection(a.id, b.id);

    const doc = useCmapStore.getState().doc;
    // 连词节点被创建
    expect(doc.linkingPhrases).toHaveLength(1);
    expect(doc.connections).toHaveLength(2);
    const lp = doc.linkingPhrases[0];
    expect(lp.text).toBe('???');
    // conn1: 概念→连词；conn2: 连词→概念；两段边 viaId 指向同一连词
    const conn2 = doc.connections.find((c) => c.id !== conn1.id)!;
    expect(conn1).toMatchObject({ fromId: a.id, toId: lp.id, viaId: lp.id });
    expect(conn2).toMatchObject({ fromId: lp.id, toId: b.id, viaId: lp.id });
    // 连词节点位于两端概念中心连线中点（概念 w=160,h=60 → 中心 80,30 / 80,130）
    expect(lp.x).toBeCloseTo(80 - 40);
    expect(lp.y).toBeCloseTo(80 - 15);
  });

  it('addConnection 直连模式 viaId 为 null', () => {
    const { addConcept, addConnection } = useCmapStore.getState();
    const a = addConcept(0, 0, 'A');
    const b = addConcept(0, 100, 'B');
    const conn = addConnection(a.id, b.id, { withLinkingPhrase: false });
    expect(conn.viaId).toBeNull();
    expect(useCmapStore.getState().doc.connections).toHaveLength(1);
    expect(useCmapStore.getState().doc.linkingPhrases).toHaveLength(0);
  });

  it('连词参与连线时按直连处理（不套娃生成新连词）', () => {
    const { addConcept, addConnection } = useCmapStore.getState();
    const a = addConcept(0, 0, 'A');
    const b = addConcept(0, 100, 'B');
    const conn1 = addConnection(a.id, b.id);
    const lpId = conn1.viaId!;
    const c = addConcept(200, 0, 'C');
    // 从连词拖线到 C → 直连
    const direct = addConnection(lpId, c.id);
    expect(direct.viaId).toBeNull();
    const doc = useCmapStore.getState().doc;
    expect(doc.linkingPhrases).toHaveLength(1); // 未新增连词
    expect(doc.connections).toHaveLength(3);
  });

  it('updateLinkingPhraseText 更新连词文本', () => {
    const { addConcept, addConnection, updateLinkingPhraseText } = useCmapStore.getState();
    const a = addConcept(0, 0, 'A');
    const b = addConcept(0, 100, 'B');
    const conn1 = addConnection(a.id, b.id);
    updateLinkingPhraseText(conn1.viaId!, '导致');
    const lp = useCmapStore.getState().doc.linkingPhrases[0];
    expect(lp.text).toBe('导致');
  });

  it('updateLinkingPhrasePosition 同步连词位置', () => {
    const { addConcept, addConnection, updateLinkingPhrasePosition } = useCmapStore.getState();
    const a = addConcept(0, 0, 'A');
    const b = addConcept(0, 100, 'B');
    const conn1 = addConnection(a.id, b.id);
    updateLinkingPhrasePosition(conn1.viaId!, 500, 600);
    const lp = useCmapStore.getState().doc.linkingPhrases[0];
    expect(lp).toMatchObject({ x: 500, y: 600 });
  });

  it('removeConcepts 级联清理连接与连词节点', () => {
    const { addConcept, addConnection, removeConcepts } = useCmapStore.getState();
    const a = addConcept(0, 0, 'A');
    const b = addConcept(0, 100, 'B');
    addConnection(a.id, b.id);

    removeConcepts([a.id]);
    const doc = useCmapStore.getState().doc;
    expect(doc.concepts).toHaveLength(1);
    expect(doc.connections).toHaveLength(0);
    expect(doc.linkingPhrases).toHaveLength(0);
  });

  it('removeLinkingPhrases 级联删除整条命题（两段边）', () => {
    const { addConcept, addConnection, removeLinkingPhrases } = useCmapStore.getState();
    const a = addConcept(0, 0, 'A');
    const b = addConcept(0, 100, 'B');
    const conn1 = addConnection(a.id, b.id);
    const lpId = conn1.viaId!;

    removeLinkingPhrases([lpId]);
    const doc = useCmapStore.getState().doc;
    expect(doc.connections).toHaveLength(0);
    expect(doc.linkingPhrases).toHaveLength(0);
    expect(doc.concepts).toHaveLength(2);
  });

  it('removeConnections 删除命题的一段边时整条命题被删除', () => {
    const { addConcept, addConnection, removeConnections } = useCmapStore.getState();
    const a = addConcept(0, 0, 'A');
    const b = addConcept(0, 100, 'B');
    const conn1 = addConnection(a.id, b.id);
    const doc0 = useCmapStore.getState().doc;
    const conn2 = doc0.connections.find((c) => c.id !== conn1.id)!;

    // 删除其中一段 → 另一段 + 连词一并清理
    removeConnections([conn1.id]);
    const doc = useCmapStore.getState().doc;
    expect(doc.connections).toHaveLength(0);
    expect(doc.linkingPhrases).toHaveLength(0);
    expect(doc.connections.find((c) => c.id === conn2.id)).toBeUndefined();
  });

  it('删除直连边只删该边，不误伤其他命题', () => {
    const { addConcept, addConnection, removeConnections } = useCmapStore.getState();
    const a = addConcept(0, 0, 'A');
    const b = addConcept(0, 100, 'B');
    const c = addConcept(0, 200, 'C');
    addConnection(a.id, b.id); // 命题 lp1
    const direct = addConnection(b.id, c.id, { withLinkingPhrase: false }); // 直连

    removeConnections([direct.id]);
    const doc = useCmapStore.getState().doc;
    expect(doc.connections).toHaveLength(2);
    expect(doc.linkingPhrases).toHaveLength(1);
  });

  it('toolMode 切换', () => {
    expect(useCmapStore.getState().toolMode).toBe('pan');
    useCmapStore.getState().setToolMode('select');
    expect(useCmapStore.getState().toolMode).toBe('select');
  });

  it('setViewport 同步画布视口', () => {
    useCmapStore.getState().setViewport({ x: 100, y: 50, zoom: 1.5 });
    expect(useCmapStore.getState().viewport).toEqual({ x: 100, y: 50, zoom: 1.5 });
  });

  it('setEditingId 进入/退出节点文本编辑态（互斥连词编辑态）', () => {
    const { addConcept, addConnection, setEditingId, setEditingLpId } = useCmapStore.getState();
    const a = addConcept(0, 0, 'A');
    const b = addConcept(0, 100, 'B');
    const conn1 = addConnection(a.id, b.id);
    const lpId = conn1.viaId!;
    expect(useCmapStore.getState().editingId).toBeNull();
    setEditingId(a.id);
    expect(useCmapStore.getState().editingId).toBe(a.id);
    // 进入连词编辑态时清空概念编辑态
    setEditingLpId(lpId);
    expect(useCmapStore.getState().editingLpId).toBe(lpId);
    expect(useCmapStore.getState().editingId).toBeNull();
    setEditingLpId(null);
    expect(useCmapStore.getState().editingLpId).toBeNull();
  });

  it('removeConcepts 清理被删节点的选中/编辑状态', () => {
    const { addConcept, removeConcepts, setSelectedNodeId, setEditingId } = useCmapStore.getState();
    const a = addConcept(0, 0, 'A');
    setSelectedNodeId(a.id);
    setEditingId(a.id);
    removeConcepts([a.id]);
    const s = useCmapStore.getState();
    expect(s.selectedNodeIds).toEqual([]);
    expect(s.editingId).toBeNull();
  });

  it('updateConcept 修改节点文本与样式', () => {
    const { addConcept, updateConcept } = useCmapStore.getState();
    const c = addConcept(0, 0, 'A');
    updateConcept(c.id, { text: 'B', style: { ...c.style, fill: '#e8f5e9' } });
    const updated = useCmapStore.getState().doc.concepts[0];
    expect(updated.text).toBe('B');
    expect(updated.style.fill).toBe('#e8f5e9');
  });

  it('setSelectedEdgeId 与 setSelectedNodeId 互斥', () => {
    const { addConcept, addConnection, setSelectedEdgeId, setSelectedNodeId } = useCmapStore.getState();
    const a = addConcept(0, 0, 'A');
    const b = addConcept(100, 0, 'B');
    const conn1 = addConnection(a.id, b.id);

    setSelectedEdgeId(conn1.id);
    expect(useCmapStore.getState().selectedEdgeId).toBe(conn1.id);
    expect(useCmapStore.getState().selectedNodeIds).toEqual([]);

    setSelectedNodeId(a.id);
    expect(useCmapStore.getState().selectedNodeIds).toEqual([a.id]);
    expect(useCmapStore.getState().selectedEdgeId).toBeNull();
  });

  it('setSelectedNodeIds 支持多选、与边互斥、删除级联清理', () => {
    const { addConcept, addConnection, setSelectedNodeIds, setSelectedEdgeId } = useCmapStore.getState();
    const a = addConcept(0, 0, 'A');
    const b = addConcept(0, 100, 'B');
    const c = addConcept(200, 0, 'C');
    const conn1 = addConnection(a.id, b.id);

    // 多选两个节点
    setSelectedNodeIds([a.id, b.id]);
    expect(useCmapStore.getState().selectedNodeIds).toEqual([a.id, b.id]);

    // 选中边时清空节点多选
    setSelectedEdgeId(conn1.id);
    expect(useCmapStore.getState().selectedNodeIds).toEqual([]);
    expect(useCmapStore.getState().selectedEdgeId).toBe(conn1.id);

    // 再选多个节点时清空边的选中
    setSelectedNodeIds([b.id, c.id]);
    expect(useCmapStore.getState().selectedEdgeId).toBeNull();

    // 删除多选中的节点 → 级联清理选中数组
    useCmapStore.getState().removeConcepts([b.id]);
    expect(useCmapStore.getState().selectedNodeIds).toEqual([c.id]);
  });

  it('撤销/重做：addConcept 后 undo/redo', () => {
    const { addConcept } = useCmapStore.getState();
    const c = addConcept(10, 20, 'A');
    expect(useCmapStore.getState().doc.concepts).toHaveLength(1);

    useCmapStore.temporal.getState().undo();
    expect(useCmapStore.getState().doc.concepts).toHaveLength(0);
    // undo 后节点 id 不可再用（快照回退）
    expect(useCmapStore.getState().doc.concepts.find((x) => x.id === c.id)).toBeUndefined();

    useCmapStore.temporal.getState().redo();
    expect(useCmapStore.getState().doc.concepts).toHaveLength(1);
    expect(useCmapStore.getState().doc.concepts[0].text).toBe('A');
  });

  it('撤销/重做：addConnection 整条命题一起回退', () => {
    const { addConcept, addConnection } = useCmapStore.getState();
    const a = addConcept(0, 0, 'A');
    const b = addConcept(0, 100, 'B');
    addConnection(a.id, b.id);
    expect(useCmapStore.getState().doc.connections).toHaveLength(2);

    useCmapStore.temporal.getState().undo();
    const doc = useCmapStore.getState().doc;
    expect(doc.connections).toHaveLength(0);
    expect(doc.linkingPhrases).toHaveLength(0);
  });

  it('纯视图操作（setViewport）不产生撤销历史', () => {
    const { addConcept, setViewport } = useCmapStore.getState();
    addConcept(0, 0, 'A');
    setViewport({ x: 99, y: 99, zoom: 0.5 });
    expect(useCmapStore.temporal.getState().pastStates.length).toBe(1);
  });
});

describe('嵌入式节点（parentId，Alt 拖入/拖出）', () => {
  beforeEach(() => {
    useCmapStore.setState({
      doc: createEmptyDocument(),
      selectedNodeIds: [],
      selectedEdgeId: null,
      editingId: null,
      editingLpId: null,
      viewport: { x: 0, y: 0, zoom: 1 },
    });
    useCmapStore.temporal.getState().clear();
  });

  it('setConceptParent 拖入：parentId 置位 + 坐标转相对父节点 + 尺寸改嵌入式', () => {
    const { addConcept, setConceptParent } = useCmapStore.getState();
    const parent = addConcept(200, 100, '父');
    const child = addConcept(210, 110, '子');
    setConceptParent(child.id, parent.id);
    const c = useCmapStore.getState().doc.concepts.find((x) => x.id === child.id)!;
    expect(c.parentId).toBe(parent.id);
    expect(c.x).toBe(10); // 210 - 200（相对父节点）
    expect(c.y).toBe(10); // 110 - 100
    expect(c.w).toBe(120); // 嵌入式小号
    expect(c.h).toBe(48);
  });

  it('setConceptParent 拖出：相对坐标转回绝对坐标 + 尺寸恢复标准', () => {
    const { addConcept, setConceptParent } = useCmapStore.getState();
    const parent = addConcept(200, 100, '父');
    const child = addConcept(210, 110, '子');
    setConceptParent(child.id, parent.id);
    setConceptParent(child.id, null);
    const c = useCmapStore.getState().doc.concepts.find((x) => x.id === child.id)!;
    expect(c.parentId).toBeNull();
    expect(c.x).toBe(210);
    expect(c.y).toBe(110);
    expect(c.w).toBe(160);
    expect(c.h).toBe(60);
  });

  it('setConceptParent 不允许把自己挂到自己', () => {
    const { addConcept, setConceptParent } = useCmapStore.getState();
    const a = addConcept(0, 0, 'A');
    setConceptParent(a.id, a.id);
    expect(useCmapStore.getState().doc.concepts[0].parentId).toBeNull();
  });

  it('拖入时子节点坐标夹在父节点边界内（不越界）', () => {
    const { addConcept, setConceptParent } = useCmapStore.getState();
    const parent = addConcept(200, 100, '父');
    const child = addConcept(500, 300, '子'); // 远在父节点外
    setConceptParent(child.id, parent.id);
    const c = useCmapStore.getState().doc.concepts.find((x) => x.id === child.id)!;
    expect(c.x).toBe(160 - 120); // 40
    expect(c.y).toBe(60 - 48); // 12
  });

  it('removeConcepts 删除父节点时子节点提升为顶层，孙节点保持嵌套', () => {
    const { addConcept, setConceptParent, removeConcepts } = useCmapStore.getState();
    const parent = addConcept(200, 100, '父');
    const child = addConcept(210, 110, '子');
    const grand = addConcept(220, 120, '孙');
    setConceptParent(child.id, parent.id);
    setConceptParent(grand.id, child.id);
    removeConcepts([parent.id]);
    const doc = useCmapStore.getState().doc;
    expect(doc.concepts).toHaveLength(2);
    const c1 = doc.concepts.find((x) => x.id === child.id)!;
    const c2 = doc.concepts.find((x) => x.id === grand.id)!;
    expect(c1.parentId).toBeNull();
    expect(c1.x).toBe(210);
    expect(c1.y).toBe(110);
    expect(c1.w).toBe(160);
    expect(c2.parentId).toBe(child.id);
  });

  it('同批删除父+子时子节点仍被提升保留（不误删）', () => {
    const { addConcept, setConceptParent, removeConcepts } = useCmapStore.getState();
    const parent = addConcept(200, 100, '父');
    const child = addConcept(210, 110, '子');
    setConceptParent(child.id, parent.id);
    removeConcepts([parent.id, child.id]);
    const doc = useCmapStore.getState().doc;
    expect(doc.concepts).toHaveLength(1);
    expect(doc.concepts[0].id).toBe(child.id);
    expect(doc.concepts[0].parentId).toBeNull();
  });

  it('addConnection 连词中点按绝对坐标计算（嵌入式节点）', () => {
    const { addConcept, setConceptParent, addConnection } = useCmapStore.getState();
    const parent = addConcept(200, 100, '父');
    const child = addConcept(220, 110, '子');
    setConceptParent(child.id, parent.id);
    // 子节点绝对位置 = (200+20, 100+10)=(220,110)，中心=(220+60, 110+24)=(280,134)
    const other = addConcept(400, 200, '其他');
    addConnection(child.id, other.id);
    const lp = useCmapStore.getState().doc.linkingPhrases[0];
    // other 中心 (480, 230)；两中心中点 (380, 182)；连词锚在 (中点-40, 中点-15)
    expect(lp.x).toBeCloseTo(380 - 40);
    expect(lp.y).toBeCloseTo(182 - 15);
  });

  it('updateConnectionControlPoints 写入边控制点偏移（节点移动曲线跟随的存储格式）', () => {
    const { addConcept, addConnection, updateConnectionControlPoints } = useCmapStore.getState();
    const a = addConcept(0, 0, 'A');
    const b = addConcept(0, 100, 'B');
    const conn = addConnection(a.id, b.id, { withLinkingPhrase: false });
    const cp = [30, -40, -30, -40];
    updateConnectionControlPoints(conn.id, cp);
    const c = useCmapStore.getState().doc.connections.find((x) => x.id === conn.id)!;
    expect(c.controlPoints).toEqual(cp);
  });

  it('updateConnectionControlPoints 支持撤销/重做（zundo 快照 doc）', () => {
    const { addConcept, addConnection, updateConnectionControlPoints } = useCmapStore.getState();
    const a = addConcept(0, 0, 'A');
    const b = addConcept(0, 100, 'B');
    const conn = addConnection(a.id, b.id, { withLinkingPhrase: false });
    updateConnectionControlPoints(conn.id, [10, 10, -10, -10]);
    updateConnectionControlPoints(conn.id, [20, 20, -20, -20]);
    useCmapStore.temporal.getState().undo();
    const c = useCmapStore.getState().doc.connections.find((x) => x.id === conn.id)!;
    expect(c.controlPoints).toEqual([10, 10, -10, -10]);
    useCmapStore.temporal.getState().redo();
    expect(useCmapStore.getState().doc.connections[0].controlPoints).toEqual([20, 20, -20, -20]);
  });
});

describe('撤销历史合并（一次拖拽 = 一步历史）', () => {
  beforeEach(() => {
    useCmapStore.setState({
      doc: createEmptyDocument(),
      selectedNodeIds: [],
      selectedEdgeId: null,
      editingId: null,
      editingLpId: null,
      viewport: { x: 0, y: 0, zoom: 1 },
    });
    useCmapStore.temporal.getState().clear();
  });

  it('pause 期间多次位置更新不记录；dragStop 合并后只追加一条「拖前」快照', () => {
    const { addConcept, addConnection, updateConcept, updateLinkingPhrasePosition } =
      useCmapStore.getState();
    const a = addConcept(0, 0, 'A');
    const b = addConcept(0, 100, 'B');
    const conn = addConnection(a.id, b.id);
    const lpId = conn.viaId!;
    useCmapStore.temporal.getState().clear();
    const docBefore = useCmapStore.getState().doc;

    // 模拟拖拽：dragStart pause → 多次 position 同步
    useCmapStore.temporal.getState().pause();
    updateConcept(a.id, { x: 10, y: 0 });
    updateConcept(a.id, { x: 20, y: 0 });
    updateConcept(a.id, { x: 30, y: 0 });
    updateLinkingPhrasePosition(lpId, 40, 50);
    expect(useCmapStore.temporal.getState().pastStates).toHaveLength(0);
    const docFinal = useCmapStore.getState().doc;

    // dragStop：pause 中写回拖前 → resume → 写回最终位置
    useCmapStore.getState().setDoc(docBefore);
    useCmapStore.temporal.getState().resume();
    useCmapStore.getState().setDoc(docFinal);

    // 一次拖拽只产生一步历史，undo 一次回到拖前
    expect(useCmapStore.temporal.getState().pastStates).toHaveLength(1);
    useCmapStore.temporal.getState().undo();
    const doc = useCmapStore.getState().doc;
    expect(doc.concepts.find((x) => x.id === a.id)).toMatchObject({ x: 0, y: 0 });
    expect(doc.linkingPhrases.find((x) => x.id === lpId)).toMatchObject({ x: 40, y: 65 });
    // redo 恢复拖后位置
    useCmapStore.temporal.getState().redo();
    const doc2 = useCmapStore.getState().doc;
    expect(doc2.concepts.find((x) => x.id === a.id)).toMatchObject({ x: 30, y: 0 });
    expect(doc2.linkingPhrases.find((x) => x.id === lpId)).toMatchObject({ x: 40, y: 50 });
  });

  it('点击未移动（docBefore === docFinal）不产生额外历史', () => {
    const { addConcept } = useCmapStore.getState();
    addConcept(0, 0, 'A');
    useCmapStore.temporal.getState().clear();
    const docBefore = useCmapStore.getState().doc;

    useCmapStore.temporal.getState().pause();
    const docFinal = useCmapStore.getState().doc; // 无位置变化，引用未变
    useCmapStore.getState().setDoc(docBefore);
    useCmapStore.temporal.getState().resume();
    useCmapStore.getState().setDoc(docFinal);

    expect(useCmapStore.temporal.getState().pastStates).toHaveLength(0);
  });
});

describe('节点自由调整大小（NodeResizer 写回 store）', () => {
  beforeEach(() => {
    useCmapStore.setState({
      doc: createEmptyDocument(),
      selectedNodeIds: [],
      selectedEdgeId: null,
      editingId: null,
      editingLpId: null,
      viewport: { x: 0, y: 0, zoom: 1 },
    });
    useCmapStore.temporal.getState().clear();
  });

  it('updateConcept 支持调整概念尺寸，一次 resize = 一步撤销历史', () => {
    const { addConcept, updateConcept } = useCmapStore.getState();
    const c = addConcept(0, 0, 'A');
    updateConcept(c.id, { w: 240, h: 120 });
    expect(useCmapStore.getState().doc.concepts[0]).toMatchObject({ w: 240, h: 120 });
    useCmapStore.temporal.getState().undo();
    expect(useCmapStore.getState().doc.concepts[0]).toMatchObject({ w: 160, h: 60 });
  });

  it('updateLinkingPhraseSize 调整连词尺寸并支持撤销', () => {
    const { addConcept, addConnection, updateLinkingPhraseSize } = useCmapStore.getState();
    const a = addConcept(0, 0, 'A');
    const b = addConcept(0, 100, 'B');
    const conn = addConnection(a.id, b.id);
    const lpId = conn.viaId!;
    updateLinkingPhraseSize(lpId, 200, 40);
    expect(useCmapStore.getState().doc.linkingPhrases[0]).toMatchObject({ w: 200, h: 40 });
    useCmapStore.temporal.getState().undo();
    expect(useCmapStore.getState().doc.linkingPhrases[0]).toMatchObject({ w: 80, h: 30 });
  });
});

describe('焦点路径视图态（pathMode / pathRootId / pathTargetId，不进撤销历史）', () => {
  beforeEach(() => {
    useCmapStore.setState({
      doc: createEmptyDocument(),
      selectedNodeIds: [],
      selectedEdgeId: null,
      editingId: null,
      editingLpId: null,
      viewport: { x: 0, y: 0, zoom: 1 },
      pathMode: false,
      pathRootId: null,
      pathTargetId: null,
    });
    useCmapStore.temporal.getState().clear();
  });

  it('setPathMode 进入/退出路径模式；退出时清空路径选择', () => {
    const s = useCmapStore.getState();
    s.setPathRoot('c-1');
    s.setPathTarget('c-2');
    s.setPathMode(true);
    let st = useCmapStore.getState();
    expect(st.pathMode).toBe(true);
    expect(st.pathRootId).toBe('c-1');
    expect(st.pathTargetId).toBe('c-2');

    st.setPathMode(false);
    st = useCmapStore.getState();
    expect(st.pathMode).toBe(false);
    expect(st.pathRootId).toBeNull();
    expect(st.pathTargetId).toBeNull();
  });

  it('path 选择为纯视图态：不产生撤销历史', () => {
    useCmapStore.getState().addConcept(0, 0, 'A');
    const historyAfterAdd = useCmapStore.temporal.getState().pastStates.length;
    expect(historyAfterAdd).toBeGreaterThan(0);

    const s = useCmapStore.getState();
    s.setPathMode(true);
    s.setPathRoot('whatever');
    s.setPathTarget('whatever-2');
    s.setPathMode(false);
    // doc 引用未变 → zundo equality 判定相等，不追加历史
    expect(useCmapStore.temporal.getState().pastStates.length).toBe(historyAfterAdd);
  });

  it('setPathRoot 换起点时重置终点；clearPathSelection 清空起终点但保持模式', () => {
    const s = useCmapStore.getState();
    s.setPathMode(true);
    s.setPathRoot('a');
    s.setPathTarget('b');
    expect(useCmapStore.getState().pathTargetId).toBe('b');

    s.setPathRoot('c'); // 换起点 → 终点清空
    expect(useCmapStore.getState().pathTargetId).toBeNull();
    expect(useCmapStore.getState().pathRootId).toBe('c');

    s.setPathTarget('d');
    s.clearPathSelection();
    const st = useCmapStore.getState();
    expect(st.pathRootId).toBeNull();
    expect(st.pathTargetId).toBeNull();
    expect(st.pathMode).toBe(true);
  });

  it('删除概念时清空指向被删概念的路径选择', () => {
    const { addConcept, addConnection, removeConcepts } = useCmapStore.getState();
    const a = addConcept(0, 0, 'A');
    const b = addConcept(0, 200, 'B');
    const conn = addConnection(a.id, b.id);
    void conn;
    const s = useCmapStore.getState();
    s.setPathRoot(a.id);
    s.setPathTarget(b.id);

    removeConcepts([a.id]);
    const st = useCmapStore.getState();
    expect(st.pathRootId).toBeNull();
    expect(st.pathTargetId).toBe(b.id); // B 未被删除，仍保留
  });

  it('删除连词时清空指向该连词的路径选择', () => {
    const { addConcept, addConnection, removeLinkingPhrases } = useCmapStore.getState();
    const a = addConcept(0, 0, 'A');
    const b = addConcept(0, 200, 'B');
    const conn = addConnection(a.id, b.id);
    const lpId = conn.viaId!;
    const s = useCmapStore.getState();
    s.setPathRoot(a.id);
    s.setPathTarget(lpId);

    removeLinkingPhrases([lpId]);
    const st = useCmapStore.getState();
    expect(st.pathRootId).toBe(a.id);
    expect(st.pathTargetId).toBeNull();
  });
});
