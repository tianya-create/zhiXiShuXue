/**
 * 知识点等价映射
 *
 * 平台里存在两套知识点编号：
 *   - 教材树（shared/knowledge-tree.json）：alg-1、number-1、geometry-1 …
 *   - 早期题库（practice-seed / manual-curated）：kp-001…kp-012、alg-1…geo-7
 *
 * 教材树扩到 30 个知识点后，有一半新节点在题库里没有同名题目。
 * 这里建立「新节点 → 已有题库节点」的等价关系，让练习与推送能复用现有题目，
 * 避免出现"知识点能看到、点进去没有题"的空壳。
 *
 * 新增知识点时同步在这里补一行即可。
 */

const KNOWLEDGE_EQUIV = {
  // 数与式
  'number-1': ['number-1', 'alg-1', 'kp-001'],
  'number-2': ['number-2', 'alg-1', 'kp-008'],
  'alg-1': ['alg-1', 'kp-001', 'kp-002'],
  'alg-2': ['alg-2', 'kp-002'],
  'algebra-1': ['algebra-1', 'alg-2', 'kp-002'],
  'algebra-2': ['algebra-2', 'alg-2', 'kp-002'],
  'algebra-3': ['algebra-3', 'alg-1', 'kp-002'],
  'algebra-4': ['algebra-4', 'alg-1', 'kp-008'],

  // 方程与不等式
  'alg-3': ['alg-3', 'kp-003'],
  'alg-4': ['alg-4', 'kp-010'],
  'alg-5': ['alg-5', 'kp-008'],
  'equation-1': ['equation-1', 'alg-3', 'kp-011'],
  'equation-2': ['equation-2', 'alg-3', 'kp-003'],

  // 函数
  'coordinate-1': ['coordinate-1', 'alg-6', 'kp-009'],
  'alg-6': ['alg-6', 'kp-009'],
  'alg-7': ['alg-7', 'kp-004'],
  'alg-8': ['alg-8', 'kp-004'],

  // 几何
  'geo-1': ['geo-1', 'kp-006'],
  'geo-2': ['geo-2', 'kp-007'],
  'geo-3': ['geo-3', 'kp-005'],
  'geo-6': ['geo-6', 'kp-005'],
  'geo-7': ['geo-7', 'kp-005'],
  'geometry-1': ['geometry-1', 'geo-3', 'kp-005'],
  'geometry-2': ['geometry-2', 'geo-3', 'kp-005'],

  // 统计与概率
  'stat-1': ['stat-1', 'kp-012'],
  'stat-2': ['stat-2', 'kp-012'],
  'stat-3': ['stat-3', 'kp-012'],
  'stat-4': ['stat-4', 'kp-012'],
  'stat-5': ['stat-5', 'kp-012'],
  'statistics-1': ['statistics-1', 'stat-3', 'kp-012']
}

/** 把一个知识点编号展开成"可用于查题的编号集合"（含自身） */
function expandKnowledgeIds(id) {
  const key = String(id || '').trim()
  if (!key) return []
  const list = KNOWLEDGE_EQUIV[key]
  if (Array.isArray(list) && list.length) {
    return Array.from(new Set([key, ...list]))
  }
  // 反向兼容：传进来的是题库老编号（kp-001），也要能找到挂在教材节点上的题
  const reverse = Object.keys(KNOWLEDGE_EQUIV).filter((nodeId) => KNOWLEDGE_EQUIV[nodeId].includes(key))
  return Array.from(new Set([key, ...reverse]))
}

// 教材目录节点（用于把老题库编号归一）
const CURRICULUM_IDS = new Set(
  require('../../shared/knowledge-tree.json').categories.flatMap((category) =>
    category.nodes.map((node) => node.id)
  )
)

/**
 * 把任意知识点编号归一到教材目录节点。
 * 掌握度、学情统计、知识点图谱都必须落在目录节点上，否则 30 个节点里
 * 会有一半永远没有数据（题还挂在 kp-002 这类老编号上）。
 */
function canonicalKnowledgeId(id) {
  const key = String(id || '').trim()
  if (!key) return ''
  if (CURRICULUM_IDS.has(key)) return key
  for (const [nodeId, list] of Object.entries(KNOWLEDGE_EQUIV)) {
    if (CURRICULUM_IDS.has(nodeId) && Array.isArray(list) && list.includes(key)) return nodeId
  }
  return key
}

module.exports = { KNOWLEDGE_EQUIV, expandKnowledgeIds, canonicalKnowledgeId }
