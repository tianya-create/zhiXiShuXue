/**
 * 教材目录同步
 *
 * shared/knowledge-tree.json 是知识点的唯一权威来源，这里把它灌进 memory-db 的
 * knowledgePoints 集合，供管理端知识点树、教师端选题、学情统计共用。
 *
 * 只做「补齐」不做「删除」：
 *   - 树里新增的知识点会自动出现（例如 18 → 30 的扩容）
 *   - 管理员在后台补充的自定义节点、教师改过的名称不会被覆盖
 */

const db = require('../database/memory-db');
const tree = require('../../shared/knowledge-tree.json');

function upsertNode(node) {
  const existing = db.findById('knowledgePoints', node.id);
  if (existing) {
    // 已存在则只补空缺字段，保留后台可能改过的名称/描述
    const patch = {};
    for (const key of ['grade', 'chapter', 'difficulty', 'studyMinutes', 'domain', 'categoryId', 'categoryName']) {
      if (existing[key] === undefined || existing[key] === null || existing[key] === '') {
        patch[key] = node[key];
      }
    }
    if (Object.keys(patch).length) db.updateById('knowledgePoints', node.id, patch);
    return false;
  }
  db.create('knowledgePoints', node);
  return true;
}

function syncCurriculum() {
  let created = 0;

  // 根节点
  if (!db.findById('knowledgePoints', tree.root.id)) {
    db.create('knowledgePoints', {
      id: tree.root.id,
      name: tree.root.name,
      parentId: null,
      level: 0,
      isRoot: true
    });
    created += 1;
  }

  for (const category of tree.categories) {
    if (!db.findById('knowledgePoints', category.id)) {
      db.create('knowledgePoints', {
        id: category.id,
        name: category.name,
        parentId: tree.root.id,
        level: 1,
        isCategory: true
      });
      created += 1;
    }
    for (const node of category.nodes) {
      if (
        upsertNode({
          ...node,
          parentId: category.id,
          level: 2,
          categoryId: category.id,
          categoryName: category.name,
          curriculum: true
        })
      ) {
        created += 1;
      }
    }
  }

  if (created) {
    console.log(`[curriculum] 已同步 ${created} 个知识点节点（当前教材共 ${tree.categories.reduce((sum, c) => sum + c.nodes.length, 0)} 个知识点）`);
  }
  return created;
}

module.exports = { syncCurriculum };
