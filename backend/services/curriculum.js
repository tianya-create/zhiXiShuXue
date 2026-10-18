/**
 * 教材目录服务
 *
 * knowledgePoints 集合里既有教材目录节点（curriculum=true），也有早期题库遗留的
 * kp-xxx 章节节点。本模块只暴露教材目录，供知识点树、选题、掌握度与学情统计使用。
 */

const db = require('../database/memory-db');
const tree = require('../../shared/knowledge-tree.json');

const CATEGORIES = tree.categories;

/** 以只读代理暴露节点列表，任何时刻取到的都是库里的最新数据 */
const nodes = new Proxy([], {
  get(_target, key) {
    const current = db
      .find('knowledgePoints')
      .filter((node) => node.curriculum && !node.isCategory && !node.isRoot);
    const value = current[key];
    return typeof value === 'function' ? value.bind(current) : value;
  }
});

function curriculumTree() {
  const children = (parentId) =>
    nodes
      .filter((node) => node.parentId === parentId)
      .map((node) => ({ ...node, children: children(node.id) }));
  return CATEGORIES.map((category) => ({
    id: category.id,
    name: category.name,
    isCategory: true,
    level: 1,
    children: children(category.id)
  }));
}

function gradeOf(value) {
  const text = String(value || '');
  if (/九|初三|grade.?9|^9$/.test(text)) return 9;
  if (/八|初二|grade.?8|^8$/.test(text)) return 8;
  if (/七|初一|grade.?7|^7$/.test(text)) return 7;
  return null;
}

function classOf(studentId) {
  const student =
    db.findById('students', studentId) || db.findOne('students', { userId: studentId });
  return student && student.classId ? db.findById('classes', student.classId) : null;
}

/**
 * 学生可练习的知识点范围。
 * 教师显式配置了「已学范围」就严格按配置；还没配置时按班级年级兜底，
 * 否则新建班级会一道题都推不出来。
 */
function eligibleNodes(studentId) {
  const cls = classOf(studentId);
  const taught = new Set((cls && cls.taughtKnowledgePointIds) || []);
  // 教师还没配置「已学范围」时不设限，避免新班级一道题都推不出来
  if (!taught.size) return nodes.slice();
  return nodes.filter((node) => taught.has(node.id));
}

/** 未配置已学范围时一律视为可练；配置后严格按范围判断 */
function isEligible(studentId, knowledgePointId) {
  const cls = classOf(studentId);
  const taught = new Set((cls && cls.taughtKnowledgePointIds) || []);
  if (!taught.size) return true;
  return taught.has(knowledgePointId);
}

function enrichQuestion(question) {
  const id = question.knowledgePointId || (question.knowledgePoints || [])[0];
  const node = nodes.find((item) => item.id === id);
  return {
    ...question,
    knowledgePointId: id,
    knowledgePoints: (question.knowledgePoints || []).length
      ? question.knowledgePoints
      : id
        ? [id]
        : [],
    knowledgeNodeName: (node && node.name) || question.knowledgeNodeName || '',
    grade: (node && node.grade) || question.grade || null,
    chapter: (node && node.chapter) || question.chapter || '',
    textbookVersion: question.textbookVersion || '通用（教师确认）',
    difficultyLevel:
      Number(question.difficultyLevel) ||
      { easy: 1, medium: 3, hard: 5 }[question.difficulty] ||
      3
  };
}

function saveNode(input, id) {
  const existing = id ? nodes.find((node) => node.id === id) : null;
  if (id && !existing) throw new Error('知识点不存在，模块名称请通过教材配置维护');
  const parentId = input.parentId || (existing && existing.parentId) || CATEGORIES[0].id;
  const category = CATEGORIES.find((item) => item.id === parentId);
  const parent = nodes.find((node) => node.id === parentId);
  if (!category && !parent) throw new Error('父知识点不存在');
  const name = String(input.name || (existing && existing.name) || '').trim();
  if (!name || name.length > 80) throw new Error('请填写有效名称');
  const prerequisites =
    input.prerequisites || input.prerequisiteIds || (existing && existing.prerequisites) || [];
  if (
    !Array.isArray(prerequisites) ||
    prerequisites.some((key) => key === id || !nodes.some((node) => node.id === key))
  )
    throw new Error('前置知识点无效');
  const reaches = (start, target, visited = new Set()) => {
    if (start === target) return true;
    if (visited.has(start)) return false;
    visited.add(start);
    const node = nodes.find((item) => item.id === start);
    return ((node && node.prerequisites) || []).some((key) => reaches(key, target, visited));
  };
  if (id && prerequisites.some((key) => reaches(key, id))) throw new Error('前置关系不能形成循环');
  const grade = Number(input.grade || (existing && existing.grade) || (parent && parent.grade) || 7);
  if (![7, 8, 9].includes(grade)) throw new Error('年级应为七、八或九年级');
  const value = {
    ...existing,
    name,
    description: String(input.description || ''),
    grade,
    chapter: String(input.chapter || name),
    parentId,
    categoryId: (category && category.id) || (parent && parent.categoryId),
    categoryName: (category && category.name) || (parent && parent.categoryName),
    domain:
      (existing && existing.domain) ||
      (parent && parent.domain) ||
      (category && category.name.includes('几何')
        ? '几何'
        : category && category.name.includes('统计')
          ? '概率统计'
          : '代数'),
    curriculum: true,
    level: 2,
    prerequisites,
    dependencies: []
  };
  return db.transaction(() => {
    const saved = existing
      ? db.updateById('knowledgePoints', id, value)
      : db.create('knowledgePoints', value);
    for (const node of nodes)
      db.updateById('knowledgePoints', node.id, {
        dependencies: nodes
          .filter((item) => (item.prerequisites || []).includes(node.id))
          .map((item) => item.id)
      });
    return saved;
  });
}

function deleteNode(id) {
  if (!nodes.some((node) => node.id === id)) throw new Error('知识点不存在');
  if (
    nodes.some((node) => node.parentId === id || (node.prerequisites || []).includes(id)) ||
    db
      .find('questions')
      .some((question) => question.knowledgePointId === id || (question.knowledgePoints || []).includes(id))
  )
    throw new Error('知识点仍有子节点、前置引用或题目，不能删除');
  db.deleteById('knowledgePoints', id);
}

module.exports = {
  nodes,
  curriculumTree,
  saveNode,
  deleteNode,
  gradeOf,
  classOf,
  eligibleNodes,
  isEligible,
  enrichQuestion
};
