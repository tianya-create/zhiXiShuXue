const db = require('../database/memory-db');
const { ensureKnowledgeGraphDemoData, DEMO_GRAPH } = require('../services/knowledge-graph');

function createWrongRecord(knowledgeId, idx) {
  return {
    wrongId: `${knowledgeId}-wrong-${idx + 1}`,
    knowledgeId,
    questionBody: `【${knowledgeId}】演示错题 ${idx + 1}`,
    studentAnswer: '学生示例答案',
    correctAnswer: '标准答案',
    errorAnalysis: '常见错误：概念混淆或计算细节遗漏。',
    tags: ['演示', '初中数学'],
    updateTime: new Date(Date.now() - idx * 3600 * 1000).toISOString()
  };
}

function createRecommendRecord(knowledgeId, idx) {
  return {
    knowledgeId,
    questionId: `${knowledgeId}-rec-${idx + 1}`,
    title: `补练题 ${idx + 1}`,
    content: `围绕 ${knowledgeId} 的推荐变式题 ${idx + 1}`,
    difficulty: idx + 1
  };
}

function seedDemoData() {
  ensureKnowledgeGraphDemoData();
  db.data.knowledgeGraphNodes = DEMO_GRAPH.map(item => ({ ...item }));
  db.data.knowledgeGraphWrong = [];
  db.data.knowledgeGraphRecommend = [];

  DEMO_GRAPH.forEach(item => {
    const wrongCount = 5 + (item.difficulty % 4);
    for (let i = 0; i < wrongCount; i += 1) {
      db.data.knowledgeGraphWrong.push(createWrongRecord(item.id, i));
    }
    for (let i = 0; i < 5; i += 1) {
      db.data.knowledgeGraphRecommend.push(createRecommendRecord(item.id, i));
    }
  });

  const demoUser = db.findById('users', 'student-demo');
  if (!demoUser) {
    db.data.users.push({
      id: 'student-demo',
      username: 'student-demo',
      password: '$2a$10$VhK8fA7R1QmV6b5lS3nHxuWgOvk6QH6Z8m0lZ0lJ2lNQk0K4x3y4m',
      role: 'student',
      name: '演示学生',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    db.data.students.push({
      id: 'student-demo',
      userId: 'student-demo',
      name: '演示学生',
      studentNo: 'demo-001',
      classId: db.data.classes[0] ? db.data.classes[0].id : null,
      createdAt: new Date().toISOString()
    });
  }

  return {
    nodes: db.data.knowledgeGraphNodes.length,
    wrongRecords: db.data.knowledgeGraphWrong.length,
    recommendRecords: db.data.knowledgeGraphRecommend.length
  };
}

if (require.main === module) {
  const result = seedDemoData();
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { seedDemoData };
