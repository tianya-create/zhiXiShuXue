const db = require("../database/memory-db");
const tree = require("../../shared/knowledge-tree.json");
if (!db.data.settings.curriculumCatalogInitialized) {
  for (const category of tree.categories)
    for (const node of category.nodes) {
      if (!db.findById("knowledgePoints", node.id))
        db.create("knowledgePoints", {
          ...node,
          curriculum: true,
          categoryId: category.id,
          categoryName: category.name,
          parentId: category.id,
          level: 2,
        });
    }
  db.data.settings.curriculumCatalogInitialized = true;
}
// nodes 原先每次属性访问都重新 db.find('knowledgePoints').filter(...)，
// enrichQuestion 又对每道题调用 nodes.find —— 2000+ 道题 × 全表过滤直接拖慢所有学生端页面。
// 这里按数据版本缓存目录节点列表，只有数据变化时才重建。
let nodesCache = { version: -1, list: [] };
const nodes = new Proxy([], {
  get(_target, key) {
    if (nodesCache.version !== db.version) {
      nodesCache = {
        version: db.version,
        list: db.find("knowledgePoints").filter((node) => node.curriculum),
      };
    }
    const current = nodesCache.list;
    const value = current[key];
    return typeof value === "function" ? value.bind(current) : value;
  },
});
function curriculumTree() {
  function children(parentId) {
    return nodes
      .filter((node) => node.parentId === parentId)
      .map((node) => ({ ...node, children: children(node.id) }));
  }
  return tree.categories.map((category) => ({
    id: category.id,
    name: category.name,
    isCategory: true,
    level: 1,
    children: children(category.id),
  }));
}
function saveNode(input, id) {
  const existing = id ? nodes.find((node) => node.id === id) : null;
  if (id && !existing)
    throw new Error("知识点不存在，模块名称请通过教材配置维护");
  const parentId =
    input.parentId || existing?.parentId || tree.categories[0].id;
  const category = tree.categories.find((item) => item.id === parentId);
  const parent = nodes.find((node) => node.id === parentId);
  if (!category && !parent) throw new Error("父知识点不存在");
  const name = String(input.name || existing?.name || "").trim();
  if (!name || name.length > 80) throw new Error("请填写有效名称");
  const prerequisites =
    input.prerequisites ||
    input.prerequisiteIds ||
    existing?.prerequisites ||
    [];
  if (
    !Array.isArray(prerequisites) ||
    prerequisites.some(
      (key) => key === id || !nodes.some((node) => node.id === key),
    )
  )
    throw new Error("前置知识点无效");
  const reaches = (start, target, visited = new Set()) => {
    if (start === target) return true;
    if (visited.has(start)) return false;
    visited.add(start);
    return (nodes.find((node) => node.id === start)?.prerequisites || []).some(
      (key) => reaches(key, target, visited),
    );
  };
  if (id && prerequisites.some((key) => reaches(key, id)))
    throw new Error("前置关系不能形成循环");
  let ancestor = parent;
  const visited = new Set();
  while (ancestor) {
    if (ancestor.id === id || visited.has(ancestor.id))
      throw new Error("知识点层级不能形成循环");
    visited.add(ancestor.id);
    ancestor = nodes.find((node) => node.id === ancestor.parentId);
  }
  const grade = Number(input.grade || existing?.grade || parent?.grade || 7);
  if (![7, 8, 9].includes(grade)) throw new Error("年级应为七、八或九年级");
  const value = {
    ...existing,
    name,
    description: String(input.description || ""),
    grade,
    chapter: String(input.chapter || name),
    parentId,
    categoryId: category?.id || parent.categoryId,
    categoryName: category?.name || parent.categoryName,
    domain:
      existing?.domain ||
      parent?.domain ||
      (category?.name.includes("几何")
        ? "几何"
        : category?.name.includes("统计")
          ? "概率统计"
          : "代数"),
    curriculum: true,
    level: parent ? (parent.level || 2) + 1 : 2,
    prerequisites,
    dependencies: [],
  };
  return db.transaction(() => {
    const saved = existing
      ? db.updateById("knowledgePoints", id, value)
      : db.create("knowledgePoints", value);
    for (const node of nodes)
      db.updateById("knowledgePoints", node.id, {
        dependencies: nodes
          .filter((item) => item.prerequisites?.includes(node.id))
          .map((item) => item.id),
      });
    return saved;
  });
}
function deleteNode(id) {
  if (!nodes.some((node) => node.id === id)) throw new Error("知识点不存在");
  if (db.find("student_answer").some((item) => item.kpCode === id))
    throw new Error("知识点已有答题历史，请保留以供追溯");
  if (
    nodes.some(
      (node) => node.parentId === id || node.prerequisites?.includes(id),
    ) ||
    db
      .find("questions")
      .some(
        (question) =>
          question.knowledgePointId === id ||
          question.knowledgePoints?.includes(id),
      )
  )
    throw new Error("知识点仍有子节点、前置引用或题目，不能删除");
  db.deleteById("knowledgePoints", id);
}
function gradeOf(value) {
  const text = String(value || "");
  if (/九|初三|grade.?9|^9$/.test(text)) return 9;
  if (/八|初二|grade.?8|^8$/.test(text)) return 8;
  if (/七|初一|grade.?7|^7$/.test(text)) return 7;
  return null;
}
function classOf(studentId) {
  const student =
    db.findById("students", studentId) ||
    db.findOne("students", { userId: studentId });
  return student ? db.findById("classes", student.classId) : null;
}
function eligibleNodes(studentId) {
  const cls = classOf(studentId);
  if (!cls) return [];
  const taught = new Set(cls.taughtKnowledgePointIds || []);
  // 教师尚未配置教材进度时不限制范围，否则新建班级会出现「无题可练」
  if (!taught.size) return nodes;
  return nodes.filter((node) => taught.has(node.id));
}
function enrichQuestion(question) {
  const id = question.knowledgePointId || question.knowledgePoints?.[0];
  const node = nodes.find((item) => item.id === id);
  return {
    ...question,
    knowledgePointId: id,
    knowledgePoints: question.knowledgePoints?.length
      ? question.knowledgePoints
      : id
        ? [id]
        : [],
    knowledgeNodeName: node?.name || question.knowledgeNodeName || "",
    grade: node?.grade || question.grade || null,
    chapter: node?.chapter || question.chapter || "",
    textbookVersion: question.textbookVersion || "通用（教师确认）",
    difficultyLevel:
      Number(question.difficultyLevel) ||
      { easy: 1, medium: 3, hard: 5 }[question.difficulty] ||
      3,
  };
}
module.exports = {
  nodes,
  curriculumTree,
  saveNode,
  deleteNode,
  gradeOf,
  classOf,
  eligibleNodes,
  enrichQuestion,
};
