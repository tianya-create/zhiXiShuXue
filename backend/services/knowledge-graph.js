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
  difficulty: node.difficulty,
  studyMinutes: node.studyMinutes,
  prerequisites: Array.isArray(node.prerequisites) ? node.prerequisites : [],
  dependencies: Array.isArray(node.dependencies) ? node.dependencies : [],
  domain: node.domain,
  masterStatus: node.masterStatus
})));

function ensureKnowledgeGraphDemoData() {
  if (!db.data.knowledgeGraphNodes) db.data.knowledgeGraphNodes = [];
  if (!db.data.knowledgeGraphWrong) db.data.knowledgeGraphWrong = [];
  if (!db.data.knowledgeGraphRecommend) db.data.knowledgeGraphRecommend = [];
  if (!db.data.knowledgeGraphNodes.length) {
    db.data.knowledgeGraphNodes = DEMO_GRAPH.map(item => ({ ...item, color: STATUS_COLORS[item.masterStatus] }));
  }
}

function getKnowledgeGraph(params = {}) {
  ensureKnowledgeGraphDemoData();
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.max(1, Math.min(500, Number(params.pageSize) || 100));
  const subject = String(params.subject || params.domain || '数学');
  const domain = String(params.domain || '').trim();
  const rows = require('./curriculum').nodes.filter(item => !domain || item.domain === domain);
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
