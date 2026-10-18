const db = require('../database/memory-db');
const sharedKnowledgeTree = require('../../shared/knowledge-tree.json');

const STATUS_COLORS = {
  '未掌握': '#E74C3C',
  '待巩固': '#F39C12',
  '已掌握': '#27AE60'
};

const CURATED_NODE_IDS = sharedKnowledgeTree.categories.flatMap(category => category.nodes.map(node => node.id));
const CURATED_NODE_SET = new Set(CURATED_NODE_IDS);
const DEMO_GRAPH = sharedKnowledgeTree.categories.flatMap(category => category.nodes.map(node => ({
  ...node,
  id: node.id,
  name: node.name,
  categoryId: category.id,
  categoryName: category.name,
  difficulty: node.difficulty,
  studyMinutes: node.studyMinutes,
  prerequisites: Array.isArray(node.prerequisites) ? node.prerequisites : [],
  dependencies: Array.isArray(node.dependencies) ? node.dependencies : [],
  domain: node.domain,
  // 知识树本身不带初值状态，缺省按「待巩固」处理，避免颜色映射为 undefined
  masterStatus: node.masterStatus || '待巩固'
})));

/**
 * 知识树升级后（例如 18 → 30 个知识点）需要重建图谱节点，
 * 否则旧库里的持久化数据会一直是上一版的节点集合。
 * 掌握状态不存放在这里（由 student_knowledge_mastery 实时计算），因此重建是安全的。
 */
function ensureKnowledgeGraphDemoData() {
  if (!db.data.knowledgeGraphNodes) db.data.knowledgeGraphNodes = [];
  if (!db.data.knowledgeGraphWrong) db.data.knowledgeGraphWrong = [];
  if (!db.data.knowledgeGraphRecommend) db.data.knowledgeGraphRecommend = [];
  const expectedIds = new Set(DEMO_GRAPH.map(item => item.id));
  const current = db.data.knowledgeGraphNodes;
  const sameShape = current.length === DEMO_GRAPH.length && current.every(item => expectedIds.has(item.id));
  if (!sameShape) {
    db.data.knowledgeGraphNodes = DEMO_GRAPH.map(item => ({
      ...item,
      color: STATUS_COLORS[item.masterStatus] || STATUS_COLORS['待巩固']
    }));
    try {
      db.flushAll();
    } catch (e) {
      // 落盘失败不影响内存中的图谱数据
    }
  }
}

function getKnowledgeGraph(params = {}) {
  ensureKnowledgeGraphDemoData();
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.max(1, Math.min(500, Number(params.pageSize) || 100));
  const subject = String(params.subject || params.domain || '数学');
  const domain = String(params.domain || '').trim();
  const rows = db.data.knowledgeGraphNodes.filter(item => !domain || item.domain === domain);
  const start = (page - 1) * pageSize;
  return {
    subject,
    page,
    pageSize,
    total: rows.length,
    data: rows.slice(start, start + pageSize)
  };
}

function getWrongQuestionsByKnowledge(knowledgeId) {
  ensureKnowledgeGraphDemoData();
  return db.data.knowledgeGraphWrong
    .filter(item => item.knowledgeId === knowledgeId)
    .sort((a, b) => new Date(b.updateTime) - new Date(a.updateTime))
    .slice(0, 20);
}

function getRecommendQuestionsByKnowledge(knowledgeId) {
  ensureKnowledgeGraphDemoData();
  return db.data.knowledgeGraphRecommend
    .filter(item => item.knowledgeId === knowledgeId)
    .sort((a, b) => (a.difficulty || 0) - (b.difficulty || 0))
    .slice(0, 5);
}

module.exports = {
  STATUS_COLORS,
  DEMO_GRAPH,
  CURATED_NODE_IDS,
  CURATED_NODE_SET,
  KNOWLEDGE_TREE_SHARED_CONFIG: sharedKnowledgeTree,
  ensureKnowledgeGraphDemoData,
  getKnowledgeGraph,
  getWrongQuestionsByKnowledge,
  getRecommendQuestionsByKnowledge
};
