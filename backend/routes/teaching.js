/**
 * 教学闭环扩展路由（挂载在 /api/teacher）
 *
 * 只承担"原有 teacher.js 里没有"的新能力：
 *   - 班级已学范围（教材进度）
 *   - 真实学情统计（学生 / 班级）
 *   - 待复核队列（解答题、图片作答）与题目纠错处理
 */

const express = require('express');
const db = require('../database/memory-db');
const { nodes } = require('../services/curriculum');
const { reviewRecord } = require('../services/learning');
const router = express.Router();

const run = (handler) => (req, res) => {
  try {
    handler(req, res);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const actorId = (req) => (req.user && req.user.id) || req.headers['x-user-id'];

function teacherClassIds(teacherId) {
  return db
    .find('classes')
    .filter((cls) => cls.teacherId === teacherId || db.findById('teachers', teacherId)?.id === cls.teacherId)
    .map((cls) => cls.id);
}

function assertClassOwned(req, classId) {
  const cls = db.findById('classes', classId);
  if (!cls) throw new Error('班级不存在');
  if (req.user && req.user.role === 'admin') return cls;
  if (cls.teacherId !== actorId(req)) throw new Error('无权访问该班级');
  return cls;
}

function assertStudentOwned(req, studentId) {
  const student = db.findById('students', studentId);
  if (!student) throw new Error('学生不存在');
  if (req.user && req.user.role === 'admin') return student;
  assertClassOwned(req, student.classId);
  return student;
}

// ===== 已学范围 =====
router.get(
  '/classes/:id/curriculum',
  run((req, res) => {
    const cls = assertClassOwned(req, req.params.id);
    res.json({ success: true, data: { class: cls, nodes } });
  })
);

router.put(
  '/classes/:id/curriculum',
  run((req, res) => {
    const cls = assertClassOwned(req, req.params.id);
    const ids = req.body.taughtKnowledgePointIds;
    if (!Array.isArray(ids) || ids.some((id) => !nodes.some((node) => node.id === id))) {
      throw new Error('已学知识点列表无效');
    }
    const version = String(req.body.textbookVersion || '').trim();
    if (!version || version.length > 80) throw new Error('请填写教材版本');
    const saved = db.updateById('classes', cls.id, {
      taughtKnowledgePointIds: [...new Set(ids)],
      textbookVersion: version
    });
    db.addLog(actorId(req), 'UPDATE_CLASS_CURRICULUM', {
      classId: cls.id,
      count: ids.length,
      textbookVersion: version
    });
    res.json({ success: true, data: saved, message: '已学范围已保存' });
  })
);

// ===== 学情统计 =====
router.get(
  '/analytics/student/:studentId',
  run((req, res) => {
    const student = assertStudentOwned(req, req.params.studentId);
    res.json({
      success: true,
      data: require('../services/analytics').studentAnalytics(student.id)
    });
  })
);

router.get(
  '/analytics/class/:classId',
  run((req, res) => {
    const cls = assertClassOwned(req, req.params.classId);
    res.json({
      success: true,
      data: require('../services/analytics').classAnalytics(cls.id)
    });
  })
);

// ===== 审核中心 =====
router.get(
  '/review-queue',
  run((req, res) => {
    const classIds = new Set(req.user && req.user.role === 'admin' ? db.find('classes').map((c) => c.id) : teacherClassIds(actorId(req)));
    const data = ['answers', 'learningRecords']
      .flatMap((collection) =>
        db
          .find(collection)
          .filter(
            (record) =>
              ['submitted', 'pending_review'].includes(record.status) &&
              (!record.classId || classIds.has(record.classId))
          )
          .map((record) => ({
            ...record,
            collection,
            studentName: db.findById('students', record.studentId)?.name || '',
            title: record.title || db.findById('assignments', record.assignmentId)?.title || '专项练习'
          }))
      )
      .sort((a, b) => new Date(a.submittedAt || a.createdAt) - new Date(b.submittedAt || b.createdAt));
    res.json({ success: true, data });
  })
);

router.post(
  '/review-queue/:id',
  run((req, res) => {
    const collection = req.body.collection === 'learningRecords' ? 'learningRecords' : 'answers';
    const record = db.findById(collection, req.params.id);
    if (!record) throw new Error('答卷不存在');
    assertStudentOwned(req, record.studentId);
    res.json({
      success: true,
      data: reviewRecord(collection, record, req.body, actorId(req)),
      message: '复核结果已保存'
    });
  })
);

// ===== 题目纠错 =====
router.get(
  '/question-reports',
  run((req, res) => {
    const classIds = new Set(req.user && req.user.role === 'admin' ? db.find('classes').map((c) => c.id) : teacherClassIds(actorId(req)));
    const data = db
      .find('questionReports')
      .map((report) => {
        const student = db.findById('students', report.studentId);
        return {
          ...report,
          studentName: (student && student.name) || '',
          question: db.findById('questions', report.questionId),
          classId: (student && student.classId) || ''
        };
      })
      .filter((report) => !report.classId || classIds.has(report.classId))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, data });
  })
);

router.put(
  '/question-reports/:id',
  run((req, res) => {
    const report = db.findById('questionReports', req.params.id);
    if (!report) throw new Error('纠错记录不存在');
    const resolution = String(req.body.resolution || '').trim();
    if (!resolution) throw new Error('请填写处理结果');
    res.json({
      success: true,
      data: db.updateById('questionReports', report.id, {
        status: 'resolved',
        resolution,
        resolvedBy: actorId(req),
        resolvedAt: new Date().toISOString()
      })
    });
  })
);

module.exports = router;
