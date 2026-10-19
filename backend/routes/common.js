const express = require('express');
const compression = require('compression');
const router = express.Router();
const db = require('../database/memory-db');
const { roles } = require('../middleware/access');
const { publicQuestion } = require('../services/question-quality');
const { nodes } = require('../services/curriculum');
const { getPersonalizedPush } = require('../services/personalized-push');
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
    res.json({ success: true, data: db.getAllMistakesForStudent((db.findOne('students', { userId: req.user.id }) || {}).id).filter(item => item.kpCode === req.params.knowledgeId) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/recommend-q/:knowledgeId', (req, res) => {
  try {
    res.json({ success: true, data: require('../services/manual-question-bank').getQuestionBankByNode({ knowledgePointId: req.params.knowledgeId }).slice(0, 5).map(publicQuestion) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/knowledge-points', (req,res) => res.json({success:true,data:require('../services/curriculum').curriculumTree()}));
router.get('/knowledge-points/flat', (req,res) => res.json({success:true,data:require('../services/curriculum').nodes}));

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
    res.json({ success: true, data: { name: '智析数学', version: '1.0.0', description: '初中数学智能学情分析平台 - 学生端、教师端、管理端' } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/question-bank/generate', roles('admin'), (req, res) => {
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
    res.json({ success: true, data: req.user.role === 'student' ? getQuestionBank({ knowledgePointId, difficulty, type, source }).filter(item => item.reviewStatus === 'approved').map(publicQuestion) : getQuestionBank({ knowledgePointId, difficulty, type, source }) });
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
    if (!db.findById('students', studentId)) return res.status(403).json({ success: false, message: '无权访问此学生' });
    const limit = Math.max(5, Math.min(10, Number(req.query.limit) || 6));
    res.json({ success: true, data: getPersonalizedPush(studentId, { limit }).questions.map(publicQuestion) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/wrong-stats/:studentId', (req, res) => {
  try {
    if (!db.findById('students', req.params.studentId)) return res.status(403).json({ success: false, message: '无权访问此学生' });
    res.json({ success: true, data: { questionBook: db.getAllMistakesForStudent(req.params.studentId), knowledgePointStats: nodes.map(node => { const state = require('../services/masteryEngine').calculateMastery(req.params.studentId, node.id); return { knowledgePointId: node.id, knowledgePointName: node.name, masteryRate: state.mastery, statusLabel: state.status, attemptCount: state.attemptCount }; }) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
