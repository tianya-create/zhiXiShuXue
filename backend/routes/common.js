const express = require('express');
const compression = require('compression');
const router = express.Router();
const db = require('../database/memory-db');
const {
  ensureKnowledgeGraph,
  ensureGeneratedQuestions,
  getQuestionBank,
  getWrongStats,
  recommendQuestions,
  KNOWLEDGE_GRAPH,
  DIFFICULTY_LABELS,
  TYPE_LABELS
} = require('../services/math-bank');
const {
  getKnowledgeGraph,
  getWrongQuestionsByKnowledge,
  getRecommendQuestionsByKnowledge
} = require('../services/knowledge-graph');

ensureKnowledgeGraph();

router.use(compression());

router.get('/knowledge-graph', (req, res) => {
  try {
    const data = getKnowledgeGraph(req.query || {});
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/wrong-q/:knowledgeId', (req, res) => {
  try {
    res.json({ success: true, data: getWrongQuestionsByKnowledge(req.params.knowledgeId) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/recommend-q/:knowledgeId', (req, res) => {
  try {
    res.json({ success: true, data: getRecommendQuestionsByKnowledge(req.params.knowledgeId) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/knowledge-points', (req, res) => {
  try {
    const knowledgePoints = db.find('knowledgePoints').filter(
      (kp) => kp.curriculum || kp.isRoot || kp.isCategory
    );
    const tree = [];
    const map = {};
    knowledgePoints.forEach(kp => { map[kp.id] = { ...kp, children: [] }; });
    knowledgePoints.forEach(kp => {
      if (kp.parentId && map[kp.parentId]) map[kp.parentId].children.push(map[kp.id]);
      else if (!kp.parentId) tree.push(map[kp.id]);
    });
    res.json({ success: true, data: tree });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/knowledge-points/flat', (req, res) => {
  try {
    res.json({
      success: true,
      data: db.find('knowledgePoints').filter((kp) => kp.curriculum || kp.isRoot || kp.isCategory)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/classes', (req, res) => {
  try {
    const classes = db.find('classes').map(cls => {
      const teacher = db.findById('teachers', cls.teacherId);
      return { ...cls, teacherName: teacher?.name || '未指定', studentCount: cls.students ? cls.students.length : 0 };
    });
    res.json({ success: true, data: classes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/teachers', (req, res) => {
  try {
    res.json({ success: true, data: db.find('teachers') });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/upload', (req, res) => {
  try {
    res.json({ success: true, message: '文件上传功能需要配置 multer 中间件', data: null });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/system-info', (req, res) => {
  try {
    res.json({ success: true, data: { name: '智析数学', version: '1.0.0', description: 'K12 数学在线教育平台（教师端/学生端/后台管理端）' } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/question-bank/generate', (req, res) => {
  try {
    const { perKnowledgePoint = 6 } = req.body || {};
    const amount = Math.max(3, Math.min(30, Number(perKnowledgePoint) || 6));
    const created = ensureGeneratedQuestions(amount);
    res.json({ success: true, message: `已完成结构化题库生成，本次新增 ${created.length} 道题。`, data: { createdCount: created.length, perKnowledgePoint: amount, totalQuestions: db.find('questions').length, knowledgePointCount: KNOWLEDGE_GRAPH.length } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/question-bank', (req, res) => {
  try {
    const { knowledgePointId, difficulty, type, source } = req.query;
    res.json({ success: true, data: getQuestionBank({ knowledgePointId, difficulty, type, source }) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/question-bank/schema', (req, res) => {
  try {
    res.json({ success: true, data: { tables: { questions: { id: 'string', content: 'string', type: `enum(${Object.keys(TYPE_LABELS).join(',')})`, difficulty: `enum(${Object.keys(DIFFICULTY_LABELS).join(',')})`, knowledgePoints: 'string[]', source: 'example | generated', score: 'number' } } } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/recommendations/:studentId', (req, res) => {
  try {
    const { studentId } = req.params;
    const limit = Math.max(5, Math.min(10, Number(req.query.limit) || 6));
    res.json({ success: true, data: recommendQuestions(studentId, limit) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/wrong-stats/:studentId', (req, res) => {
  try {
    res.json({ success: true, data: getWrongStats(req.params.studentId) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
