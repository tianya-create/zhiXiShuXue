const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database/memory-db');
const { gradeQuestions, synchronize } = require('../services/learning');
const { isEligible } = require('../services/curriculum');
const { ensureKnowledgeGraph, recordQuestionResults, getWrongStats, getQuestionBank } = require('../services/math-bank');
const { ensureManualQuestionBank, getQuestionBankByNode } = require('../services/manual-question-bank');
const { getPersonalizedPush, ensureDemoWrongHistory, getColorStatus } = require('../services/personalized-push');
const { gradeAnswer } = require('../services/autoGrade');
const { updateMastery, getTrend } = require('../services/masteryEngine');
const { buildMistakeTags, normalizeErrorType } = require('../services/mistakeTagging');
const { askAiTutor, validateQuestion, normalizeTutorMode, getTutorConfigStatus } = require('../services/ai-tutor');
const { DEMO_GRAPH, CURATED_NODE_SET } = require('../services/knowledge-graph');
const { KNOWLEDGE_EQUIV, expandKnowledgeIds, canonicalKnowledgeId } = require('../services/question-map');
const KP_ALIAS_MAP = {
  'kp-001': 'alg-1', 'kp-002': 'alg-2', 'kp-003': 'alg-3', 'kp-004': 'alg-1', 'kp-005': 'alg-5',
  'kp-006': 'geo-1', 'kp-007': 'geo-2', 'kp-008': 'alg-5', 'kp-009': 'alg-6', 'kp-010': 'alg-4',
  'kp-011': 'alg-3', 'kp-012': 'stat-1'
};
const router = express.Router();
ensureKnowledgeGraph();
ensureManualQuestionBank();
const dir = path.join(__dirname, '../uploads/answers'); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
const upload = multer({ storage: multer.diskStorage({ destination(_r, _f, cb) { cb(null, dir) }, filename(_r, f, cb) { cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + (path.extname(f.originalname) || '.png')) } }), limits: { fileSize: 10 * 1024 * 1024 } });
const S = id => db.findById('students', id) || db.findOne('students', { userId: id });
const T = v => String(v || '').trim().toLowerCase();
const L = i => String.fromCharCode(65 + i);
function N(q, a) { const t = String(a || '').trim(), n = T(t), ops = Array.isArray(q.options) ? q.options : []; if (!n) return { normalized: '', label: '', content: '' }; let i = ops.findIndex((_, x) => T(L(x)) === n); if (i < 0) i = ops.findIndex(x => T(x) === n); return i >= 0 ? { normalized: T(L(i)), label: L(i), content: ops[i] } : { normalized: n, label: t.toUpperCase(), content: t } }
function D(q, a) { const i = N(q, a); return !i.normalized ? '-' : (i.label && i.content ? `${i.label}（${i.content}）` : (i.content || i.label || '-')) }
function E(q, a) { a = String(a || '').trim(); if (q.type === 'choice') { const ok = N(q, a).normalized && N(q, a).normalized === N(q, q.answer).normalized; return { answer: a, correct: !!ok, score: ok ? +q.score || 0 : 0, sub: false } } if (q.type === 'fill') { const ok = T(a) === T(q.answer); return { answer: a, correct: ok, score: ok ? +q.score || 0 : 0, sub: false } } const g = gradeAnswer(q, a); return { answer: a, correct: !!g.isCorrect, score: g.isCorrect ? (+q.score || 0) : 0, sub: true } }
function latestAnswer(assignmentId, studentId) { return db.find('answers').filter(x => x.assignmentId === assignmentId && x.studentId === studentId).sort((a, b) => new Date(b.submittedAt || b.createdAt) - new Date(a.submittedAt || a.createdAt))[0] || null }
function P(ids, answers) { let totalScore = 0, hasSubjectiveQuestions = false, questionResults = []; ids.forEach(id => { const q = db.findById('questions', id); if (!q) return; const r = E(q, answers[id]); totalScore += r.score; if (r.sub) hasSubjectiveQuestions = true; questionResults.push({ questionId: id, answer: r.answer, correct: r.correct, score: r.score, correctAnswer: q.type === 'choice' ? D(q, q.answer) : (q.answer || '') }) }); return { totalScore, hasSubjectiveQuestions, questionResults } }
function wrongs(studentId) { const book = (db.getAllMistakesForStudent(studentId) || []).map(m => { const q = db.findById('questions', m.questionId) || {}; const kp = m.kpCode || q.knowledgePointId || (q.knowledgePoints || [])[0] || ''; return { id: m.questionId, questionId: m.questionId, content: m.content || q.content || m.questionBody || '题目内容暂缺', kpCode: kp, knowledgePointId: kp, errorType: m.errorType || '其他', masteryStatus: m.masteryStatus || '待强化', wrongCount: m.wrongCount || 1, lastPracticeTime: m.lastPracticeTime || m.updatedAt || m.createdAt || '', difficulty: m.difficulty || q.difficultyLevel || q.difficulty || 3, type: q.type || 'fill', options: q.options || [], answer: q.answer || '', answerDisplay: q.type === 'choice' ? D(q, q.answer) : (q.answer || ''), knowledgePoints: q.knowledgePoints || [kp], question: q } }); if (book.length) return book; return (getWrongStats(studentId).questionBook || []).map(m => { const q = db.findById('questions', m.questionId) || {}; const kp = (m.knowledgePoints || [])[0] || q.knowledgePointId || ''; return { id: m.questionId, questionId: m.questionId, content: q.content || '题目内容暂缺', kpCode: kp, knowledgePointId: kp, errorType: '其他', masteryStatus: '待强化', wrongCount: m.wrongCount || 1, lastPracticeTime: m.lastWrongAt || m.updatedAt || m.createdAt || '', difficulty: q.difficultyLevel || q.difficulty || 3, type: q.type || 'fill', options: q.options || [], answer: q.answer || '', answerDisplay: q.type === 'choice' ? D(q, q.answer) : (q.answer || ''), knowledgePoints: q.knowledgePoints || [kp], question: q } }) }
function resolveKnowledgeMeta(id) {
  const aliasId = KP_ALIAS_MAP[id] || id;
  const fromDemo = (DEMO_GRAPH || []).find(item => item.id === aliasId)
  if (fromDemo) return { id: aliasId, name: fromDemo.name, domain: fromDemo.domain, description: `${fromDemo.domain} · 建议学习 ${fromDemo.studyMinutes || 30} 分钟` }
  const fromDb = db.findById('knowledgePoints', id) || db.findById('knowledgePoints', aliasId)
  if (fromDb) return { id: fromDb.id, name: fromDb.name, domain: '', description: fromDb.description || '' }
  return { id: aliasId, name: id, domain: '', description: '' }
}

function practiceQs(studentId, kp, precomputedWrongs) { const targetKp = KP_ALIAS_MAP[kp] || kp; const eqIds = expandKnowledgeIds(kp); const a = (precomputedWrongs || wrongs(studentId)).filter(x => eqIds.includes(x.knowledgePointId)).slice(0, 2).map(x => ({ ...x, source: 'wrong-book' })); const b = getQuestionBankByNode({ knowledgePointId: targetKp }).slice(0, 5).map(x => ({ ...x, knowledgePointId: targetKp, knowledgePoints: [targetKp], answerDisplay: x.type === 'choice' ? D(x, x.answer) : (x.answer || '') })); const out = [], seen = new Set(); a.concat(b).forEach(x => { if (x && !seen.has(x.id)) { seen.add(x.id); out.push(x) } }); return out.slice(0, 6) }
function weak(studentId) { const book = wrongs(studentId); const curated = (DEMO_GRAPH || []).filter(node => CURATED_NODE_SET.has(node.id)); const list = curated.map((node, index) => { const s = getColorStatus(studentId, node.id), label = s.mastery < 60 ? '薄弱' : s.mastery < 80 ? '待巩固' : '已掌握'; return { id: node.id, name: node.name, description: `${node.domain} · 建议学习 ${node.studyMinutes || 30} 分钟`, parentId: node.prerequisites && CURATED_NODE_SET.has(node.prerequisites[0]) ? node.prerequisites[0] : '', depth: node.prerequisites && node.prerequisites.length ? 2 : 1, masteryRate: s.mastery, statusLabel: label, wrongCount: book.filter(x => (KNOWLEDGE_EQUIV[node.id] || [node.id]).includes(x.knowledgePointId)).length, questionCount: practiceQs(studentId, node.id, book).length, isLeaf: !(node.dependencies && node.dependencies.some(dep => CURATED_NODE_SET.has(dep))), hasNewRecommendation: s.mastery < 80, improved: s.mastery >= 60, categoryName: node.categoryName || (node.domain === '几何' ? '几何' : node.domain === '概率统计' ? '统计概率' : (node.name.includes('函数') || node.name.includes('坐标')) ? '函数' : (node.name.includes('方程') || node.name.includes('不等式')) ? '方程与不等式' : '数与式'), visibleIndex: index + 1 } }).sort((a, b) => a.masteryRate - b.masteryRate || b.wrongCount - a.wrongCount); const ensureVisible = (matcher, fallbackRate) => { if (list.some(matcher)) return; const candidate = list.find(item => item.isLeaf) || list[0]; if (candidate) { candidate.masteryRate = fallbackRate; candidate.statusLabel = fallbackRate < 60 ? '薄弱' : fallbackRate < 80 ? '待巩固' : '已掌握' } }; ensureVisible(item => item.statusLabel === '薄弱', 45); ensureVisible(item => item.statusLabel === '待巩固', 70); ensureVisible(item => item.statusLabel === '已掌握', 88); return list }
function chat(studentId, kp) { const list = weak(studentId), k = list.find(x => x.id === kp) || null; return { openingMessage: k ? `已为你定位到 ${k.name}，建议先做基础题，再逐步过渡到变式题。` : '已为你生成当前最适合的补练题目。', knowledgePoint: k, relatedKnowledgePoints: list.filter(x => x.id === kp || x.parentId === kp || x.parentId === (k && k.parentId)).slice(0, 8), candidateQuestions: practiceQs(studentId, kp).slice(0, 5) } }
function kpChanges(studentId, questions, results, fallback) { const map = {}; questions.forEach(q => { const kp = canonicalKnowledgeId(q.knowledgePointId || (q.knowledgePoints || [])[0] || fallback || ''); if (!kp) return; const before = getColorStatus(studentId, kp); if (!map[kp]) { const k = db.findById('knowledgePoints', kp) || { name: kp }; map[kp] = { knowledgePointId: kp, knowledgePointName: k.name, masteryBefore: before.mastery, masteryAfter: before.mastery, questionCount: 0, correctCount: 0, wrongCount: 0, statusLabel: before.label, statusType: before.status === 'green' ? 'success' : before.status === 'orange' ? 'warning' : 'danger' } } map[kp].questionCount++; const r = results.find(x => x.questionId === q.id); if (r && r.correct) map[kp].correctCount++; if (r && !r.correct) map[kp].wrongCount++ }); return Object.values(map).map(x => { const a = getColorStatus(studentId, x.knowledgePointId); return { ...x, masteryAfter: a.mastery, statusLabel: a.label, statusType: a.status === 'green' ? 'success' : a.status === 'orange' ? 'warning' : 'danger' } }) }
function trackList(studentId) { const a = db.find('answers').filter(x => x.studentId === studentId).map(x => { const assignment = db.findById('assignments', x.assignmentId) || {}, paper = db.findById('papers', x.paperId) || {}, rs = x.questionResults || [], rate = rs.length ? Math.round(rs.filter(r => r.correct).length / rs.length * 100) : 0; return { id: x.id, recordType: 'homework', assignmentTitle: assignment.title || '作业记录', paperTitle: paper.title || '题库组卷', score: x.totalScore || 0, correctRate: rate, status: x.status || 'graded', date: x.submittedAt || x.createdAt, masteryAfter: rate } }); const b = db.find('learningRecords').filter(x => x.studentId === studentId).map(x => { const rs = x.questionResults || [], rate = rs.length ? Math.round(rs.filter(r => r.correct).length / rs.length * 100) : 0, ma = (x.knowledgePointChanges || []).length ? Math.round((x.knowledgePointChanges || []).reduce((s, i) => s + (+i.masteryAfter || 0), 0) / (x.knowledgePointChanges || []).length) : rate; return { id: x.id, recordType: 'practice', assignmentTitle: x.title || '个性化补练', paperTitle: x.mode === 'wrong-question' ? '错题重做' : '知识点专项', score: x.totalScore || 0, correctRate: rate, status: x.status || 'completed', date: x.createdAt, masteryAfter: ma } }); return a.concat(b).sort((x, y) => new Date(y.date) - new Date(x.date)) }
function trackDetail(studentId, id, type) { if (type === 'homework') { const a = db.findById('answers', id); if (!a || a.studentId !== studentId) return null; const rs = a.questionResults || [], qs = rs.map(r => { const q = db.findById('questions', r.questionId) || {}; return { content: q.content || '题目内容暂缺', userAnswer: r.answer || '', answer: q.type === 'choice' ? D(q, q.answer) : (q.answer || ''), isCorrect: !!r.correct } }), radar = Object.entries(a.knowledgePointScores || {}).map(([kp, v]) => ({ name: (db.findById('knowledgePoints', kp) || { name: kp }).name, value: +v || 0 })).slice(0, 6), rate = rs.length ? Math.round(rs.filter(r => r.correct).length / rs.length * 100) : 0; return { title: '作业记录详情', score: a.totalScore || 0, correctRate: rate, duration: Math.max(5, rs.length * 3), radarData: radar, questions: qs } } const r = db.findById('learningRecords', id); if (!r || r.studentId !== studentId) return null; const rs = r.questionResults || [], qs = rs.map(i => { const q = db.findById('questions', i.questionId) || {}; return { content: q.content || '题目内容暂缺', userAnswer: i.answer || '', answer: q.type === 'choice' ? D(q, q.answer) : (q.answer || ''), isCorrect: !!i.correct } }), radar = (r.knowledgePointChanges || []).map(i => ({ name: i.knowledgePointName, value: +i.masteryAfter || 0 })).slice(0, 6), rate = rs.length ? Math.round(rs.filter(x => x.correct).length / rs.length * 100) : 0; return { title: r.title || '练习记录详情', score: r.totalScore || 0, correctRate: rate, duration: Math.max(5, rs.length * 3), radarData: radar, questions: qs } }
function summarizeTeacherFeedback(questionList, field) { return (questionList || []).map((item, index) => { const value = String(item && item[field] || '').trim(); if (!value) return ''; return `第${index + 1}题：${value}` }).filter(Boolean).join('；') }
router.post('/answers/upload', upload.single('file'), (req, res) => { if (!req.file) return res.status(400).json({ success: false, message: '未接收到上传文件' }); res.json({ success: true, data: { fileName: req.file.filename, originalName: req.file.originalname, filePath: '/uploads/answers/' + req.file.filename, size: req.file.size } }) });
router.get('/assignments', (req, res) => { try { const s = S(req.headers['x-user-id']); if (!s) return res.status(404).json({ success: false, message: '学生不存在' }); const st = String(req.query.status || ''); const data = db.find('assignments').filter(a => { const ok = Array.isArray(a.studentIds) && a.studentIds.length ? a.studentIds.includes(s.id) : a.classId === s.classId; if (!ok) return false; const la = latestAnswer(a.id, s.id); return st === 'pending' ? !la : st === 'completed' ? !!la : true }).map(a => { const la = latestAnswer(a.id, s.id), p = a.paperId ? db.findById('papers', a.paperId) : null, count = p && Array.isArray(p.questions) ? p.questions.length : (a.questionIds || []).length; return { ...a, paperTitle: p ? p.title : '题库组卷', questionCount: count, submitted: !!la, score: la ? la.totalScore : undefined, hasPdfPaper: !!(p && p.filePath), paperFilePath: p ? p.filePath || '' : '' } }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); res.json({ success: true, data }) } catch (e) { res.status(500).json({ success: false, message: e.message }) } });
router.get('/assignments/:id/questions', (req, res) => { try { const s = S(req.headers['x-user-id']); if (!s) return res.status(404).json({ success: false, message: '学生不存在' }); const a = db.findById('assignments', req.params.id); if (!a) return res.status(404).json({ success: false, message: '作业不存在' }); const ok = Array.isArray(a.studentIds) && a.studentIds.length ? a.studentIds.includes(s.id) : a.classId === s.classId; if (!ok) return res.status(403).json({ success: false, message: '无权查看该作业' }); const p = a.paperId ? db.findById('papers', a.paperId) : null, ids = p && Array.isArray(p.questions) ? p.questions : (a.questionIds || []), questions = ids.map(id => db.findById('questions', id)).filter(Boolean); res.json({ success: true, data: { assignment: { ...a, title: a.title || '作业', paperTitle: p ? p.title : '题库组卷', paperId: a.paperId }, paper: p ? { id: p.id, title: p.title, filePath: p.filePath || '', fileName: p.fileName || '', fileSize: p.fileSize || 0, fileType: p.fileType || '', createdAt: p.createdAt || '', source: p.source || '' } : null, questions } }) } catch (e) { res.status(500).json({ success: false, message: e.message }) } });
router.get('/assignments/:id/latest-answer', (req, res) => { try { const s = S(req.headers['x-user-id']); if (!s) return res.status(404).json({ success: false, message: '学生不存在' }); const a = latestAnswer(req.params.id, s.id); res.json({ success: true, data: a ? { answerId: a.id } : null }) } catch (e) { res.status(500).json({ success: false, message: e.message }) } });
router.get('/answers/:id', (req, res) => { try { const s = S(req.headers['x-user-id']); if (!s) return res.status(404).json({ success: false, message: '学生不存在' }); const a = db.findById('answers', req.params.id); if (!a || a.studentId !== s.id) return res.status(404).json({ success: false, message: '答题记录不存在' }); const p = a.paperId ? db.findById('papers', a.paperId) : null; const questions = (a.questionResults || []).map(i => { const q = db.findById('questions', i.questionId) || {}; const teacherComment = (a.comments && a.comments[i.questionId]) || i.comment || ''; const teacherCorrection = (a.corrections && a.corrections[i.questionId]) || i.correction || ''; return { questionId: i.questionId, questionType: q.type || i.questionType || '', content: q.content || '', answer: i.answer || '', correct: !!i.correct, score: i.score || 0, fullScore: q.score || i.fullScore || 0, correctAnswer: q.type === 'choice' ? D(q, q.answer) : (q.answer || ''), teacherComment, teacherCorrection, comment: teacherComment, correction: teacherCorrection } }); const questionLevelComments = summarizeTeacherFeedback(questions, 'teacherComment'); const questionLevelCorrections = summarizeTeacherFeedback(questions, 'teacherCorrection'); res.json({ success: true, data: { ...a, paper: p ? { id: p.id, title: p.title, filePath: p.filePath || '', fileName: p.fileName || '', fileSize: p.fileSize || 0, fileType: p.fileType || '', createdAt: p.createdAt || '' } : null, images: Array.isArray(a.images) ? a.images : [], overallComment: typeof a.comments === 'string' ? a.comments : ((a.comments && a.comments.__image_review__) || questionLevelComments || ''), overallCorrection: typeof a.corrections === 'string' ? a.corrections : ((a.corrections && a.corrections.__image_review__) || questionLevelCorrections || ''), questions } }) } catch (e) { res.status(500).json({ success: false, message: e.message }) } });
router.post('/assignments/:id/submit', (req, res) => {
  try {
    const s = S(req.headers['x-user-id']);
    if (!s) return res.status(404).json({ success: false, message: '学生不存在' });
    const a = db.findById('assignments', req.params.id);
    if (!a) return res.status(404).json({ success: false, message: '作业不存在' });
    const ok = Array.isArray(a.studentIds) && a.studentIds.length ? a.studentIds.includes(s.id) : a.classId === s.classId;
    if (!ok) return res.status(403).json({ success: false, message: '无权提交该作业' });
    const existing = latestAnswer(a.id, s.id);
    if (existing) return res.json({ success: true, message: '这份作业已交卷', data: { answerId: existing.id, totalScore: existing.totalScore, questionResults: existing.questionResults || [], knowledgePointChanges: [] } });
    if (a.deadline && Date.now() > new Date(a.deadline).getTime()) return res.status(400).json({ success: false, message: '作业已截止' });
    const paper = a.paperId ? db.findById('papers', a.paperId) : null;
    const overrides = Array.isArray(a.questionSnapshots) ? a.questionSnapshots.filter(Boolean) : [];
    const ids = overrides.length ? overrides.map(q => q.id) : ((paper && Array.isArray(paper.questions) ? paper.questions : (a.questionIds || [])));
    const answers = req.body.answers || {};
    if (Object.keys(answers).some(id => !ids.includes(id))) return res.status(400).json({ success: false, message: '作答包含不属于该作业的题目' });
    const images = Array.isArray(req.body.images) ? req.body.images.filter(Boolean) : [];
    if (!Object.keys(answers).length && !images.length) return res.status(400).json({ success: false, message: '请先完成作答' });
    const questions = ids.map(id => db.findById('questions', id)).filter(Boolean);
    const before = masteryMap(s.id, questions);
    const results = gradeQuestions(ids, answers, overrides);
    const needsReview = images.length > 0 || results.some(r => r.needsReview);
    const rec = db.transaction(() => {
      const value = db.create('answers', {
        assignmentId: a.id,
        paperId: a.paperId || '',
        classId: a.classId || '',
        studentId: s.id,
        submittedAt: new Date().toISOString(),
        costTime: Math.max(0, Math.min(86400, Number(req.body.costTime) || 0)),
        totalScore: results.reduce((sum, r) => sum + r.score, 0),
        status: needsReview ? 'submitted' : 'graded',
        questionResults: results,
        images,
        comments: '',
        corrections: ''
      });
      // 判分结果统一由 learning.synchronize 落到 student_answer / 错题本 / 掌握度快照，
      // 保证"作业"和"专项练习"两条链路的统计口径完全一致
      synchronize(value);
      const draft = db.findOne('drafts', { studentId: s.id, key: 'assignment-' + a.id });
      if (draft) db.deleteById('drafts', draft.id);
      return value;
    });
    const after = kpChanges(s.id, questions, results, '');
    res.json({
      success: true,
      message: needsReview ? '提交成功，解答题等待老师复核' : '提交成功',
      data: {
        answerId: rec.id,
        totalScore: rec.totalScore,
        status: rec.status,
        questionResults: results,
        knowledgePointChanges: after.map(item => ({ ...item, masteryBefore: before[item.knowledgePointId] ?? item.masteryBefore }))
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});
router.get('/wrong-questions', (req, res) => { try { const s = S(req.headers['x-user-id']); if (!s) return res.status(404).json({ success: false, message: '学生不存在' }); res.json({ success: true, data: wrongs(s.id) }) } catch (e) { res.status(500).json({ success: false, message: e.message }) } });
router.get('/wrong-questions/stats', (req, res) => { try { const s = S(req.headers['x-user-id']); if (!s) return res.status(404).json({ success: false, message: '学生不存在' }); const list = wrongs(s.id), masteredCount = list.filter(x => x.masteryStatus === '已掌握').length; res.json({ success: true, data: { totalCount: list.length, masteredCount, unmasteredCount: list.length - masteredCount, noteCount: 0 } }) } catch (e) { res.status(500).json({ success: false, message: e.message }) } });
router.get('/weak-points', (req, res) => { try { const s = S(req.headers['x-user-id']); if (!s) return res.status(404).json({ success: false, message: '学生不存在' }); res.json({ success: true, data: weak(s.id) }) } catch (e) { res.status(500).json({ success: false, message: e.message }) } });
router.get('/recommendations', (req, res) => { try { const s = S(req.headers['x-user-id']); if (!s) return res.status(404).json({ success: false, message: '学生不存在' }); const nodeId = String(req.query.nodeId || '').trim(); if (nodeId) { const data = practiceQs(s.id, nodeId).slice(0, +req.query.limit || 3).map((item, index) => ({ ...item, displayIndex: index + 1, visibleQuestionNo: `第${index + 1}题` })); return res.json({ success: true, data }) } const pack = getPersonalizedPush(s.id, { limit: +req.query.limit || 3, refresh: String(req.query.refresh || 'false') === 'true' }); res.json({ success: true, data: (pack.questions || []).map((item, index) => ({ ...item, knowledgePointId: Object.keys(KP_ALIAS_MAP).find(key => KP_ALIAS_MAP[key] === item.knowledgePointId) || item.knowledgePointId, knowledgePoints: [Object.keys(KP_ALIAS_MAP).find(key => KP_ALIAS_MAP[key] === item.knowledgePointId) || item.knowledgePointId], displayIndex: index + 1, visibleQuestionNo: `第${index + 1}题` })) }) } catch (e) { res.status(500).json({ success: false, message: e.message }) } });
router.get('/personalized-recommendations', (req, res) => { try { const s = S(req.headers['x-user-id']); if (!s) return res.status(404).json({ success: false, message: '学生不存在' }); const all = String(req.query.all || 'false') === 'true', pack = getPersonalizedPush(s.id, { limit: all ? 12 : 3, refresh: false }); res.json({ success: true, data: { ...pack, questions: (pack.questions || []).map((item, index) => ({ ...item, displayIndex: index + 1, visibleQuestionNo: `第${index + 1}题` })) } }) } catch (e) { res.status(500).json({ success: false, message: e.message }) } });
router.post('/answer/submit', (req, res) => { try { const s = S(req.headers['x-user-id']); if (!s) return res.status(404).json({ success: false, message: '学生不存在' }); const q = db.findById('questions', req.body.questionId); if (!q) return res.status(404).json({ success: false, message: '题目不存在' }); const g = gradeAnswer(q, req.body.userAnswer || ''), kp = q.knowledgePointId || (q.knowledgePoints || [])[0] || '', ok = !!g.isCorrect, et = normalizeErrorType(req.body.errorType, q, req.body.userAnswer || ''); db.create('student_answer', { userId: s.id, questionId: q.id, kpCode: kp, isCorrect: ok, costTime: +req.body.costTime || 0, userAnswer: String(req.body.userAnswer || '').trim(), createdAt: new Date().toISOString() }); const m = updateMastery(s.id, kp), tags = buildMistakeTags(q, et); if (!ok) db.upsertStudentMistake(s.id, { questionId: q.id, content: q.content || '', kpCode: tags.kpCode, difficulty: tags.difficulty, errorType: tags.errorType, masteryStatus: m.status, wrongCount: 1, lastPracticeTime: new Date().toISOString(), isResolved: false }); else db.resolveStudentMistake(s.id, q.id); res.json({ success: true, data: { isCorrect: ok, answer: q.type === 'choice' ? D(q, q.answer) : (q.answer || ''), analysis: q.analysis || q.explanation || g.explanation || '', correctAnswer: g.correctAnswer || q.answer || '', mastery: m.mastery, masteryStatus: m.status } }) } catch (e) { res.status(500).json({ success: false, message: e.message }) } });
router.get('/mastery/trend', (req, res) => { try { const s = S(req.headers['x-user-id']); if (!s) return res.status(404).json({ success: false, message: '学生不存在' }); res.json({ success: true, data: getTrend(s.id, req.query.kpCode, req.query.days || 30) }) } catch (e) { res.status(500).json({ success: false, message: e.message }) } });
router.get('/questions', (req, res) => { try { const s = S(req.headers['x-user-id']); if (!s) return res.status(404).json({ success: false, message: '学生不存在' }); const data = req.query.knowledgePointId ? practiceQs(s.id, req.query.knowledgePointId) : getQuestionBank({}).slice(0, 20); res.json({ success: true, data }) } catch (e) { res.status(500).json({ success: false, message: e.message }) } });
router.get('/practice/:knowledgePointId', (req, res) => { try { const s = S(req.headers['x-user-id']); if (!s) return res.status(404).json({ success: false, message: '学生不存在' }); const kp = req.params.knowledgePointId, { questionId, questionIds } = req.query; let questions = [], mode = 'weak-point', title = '知识点专项补练'; if (req.query.mode === 'wrong-redo' && questionIds) { const ids = String(questionIds).split(',').filter(Boolean); questions = wrongs(s.id).filter(q => ids.includes(q.id)); mode = 'wrong-question'; title = '错题批量重做' } else if (questionId) { const q = wrongs(s.id).find(x => x.id === questionId); if (q) { questions = [q]; mode = 'wrong-question'; title = '错题重做' } } else if (kp && kp !== 'custom') { questions = practiceQs(s.id, kp); const k = db.findById('knowledgePoints', kp); if (k) title = k.name + ' · 个性化补练' } const latest = db.find('learningRecords').filter(r => r.studentId === s.id && r.recordType === 'practice' && r.knowledgePointId === kp).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null; res.json({ success: true, data: { mode, title, knowledgePointId: kp, latestPractice: latest, chatPractice: kp && kp !== 'custom' ? chat(s.id, kp) : null, questions } }) } catch (e) { res.status(500).json({ success: false, message: e.message }) } });
router.post('/practice/:knowledgePointId/submit', (req, res) => {
  try {
    const s = S(req.headers['x-user-id']);
    if (!s) return res.status(404).json({ success: false, message: '学生不存在' });
    const kp = req.params.knowledgePointId;
    const requestId = String(req.body.requestId || '');
    if (requestId) {
      const duplicate = db.findOne('learningRecords', { studentId: s.id, requestId });
      if (duplicate) return res.json({ success: true, data: duplicate });
    }
    const ids = Array.isArray(req.body.questionIds) && req.body.questionIds.length ? [...new Set(req.body.questionIds)] : Object.keys(req.body.answers || {});
    if (!ids.length || ids.length > 20) return res.status(400).json({ success: false, message: '请选择 1 到 20 道题' });
    const questions = ids.map(id => db.findById('questions', id)).filter(Boolean);
    const wrongIds = new Set(wrongs(s.id).map(item => item.questionId));
    const blocked = questions.find(q => {
      const nodeId = q.knowledgePointId || (q.knowledgePoints || [])[0] || '';
      return !wrongIds.has(q.id) && nodeId && !isEligible(s.id, nodeId);
    });
    if (blocked) return res.status(400).json({ success: false, message: '题目不在本班已学范围内' });
    const before = masteryMap(s.id, questions);
    const results = gradeQuestions(ids, req.body.answers || {});
    const needsReview = results.some(r => r.needsReview);
    const rec = db.transaction(() => {
      const value = db.create('learningRecords', {
        studentId: s.id,
        classId: s.classId || '',
        recordType: 'practice',
        mode: req.body.mode || 'weak-point',
        requestId,
        knowledgePointId: kp,
        title: req.body.title || '个性化补练',
        questionIds: ids,
        questionResults: results,
        totalScore: results.reduce((sum, r) => sum + r.score, 0),
        status: needsReview ? 'pending_review' : 'completed',
        submittedAt: new Date().toISOString(),
        costTime: Math.max(0, Math.min(86400, Number(req.body.costTime) || 0))
      });
      synchronize(value);
      return value;
    });
    const changes = kpChanges(s.id, questions, results, kp === 'custom' ? '' : kp).map(item => ({
      ...item,
      masteryBefore: before[item.knowledgePointId] ?? item.masteryBefore
    }));
    const judged = results.filter(r => !r.needsReview);
    const correctCount = judged.filter(r => r.correct).length;
    const accuracy = judged.length ? Math.round((correctCount / judged.length) * 100) : 0;
    const report = judged.length
      ? `本次练习已判定 ${judged.length} 题，答对 ${correctCount} 题，正确率 ${accuracy}%。${needsReview ? '解答题已提交老师复核，复核后掌握度会更新。' : ''}`
      : '本次练习的题目都在等待老师复核，复核后掌握度会更新。';
    const ebbinghaus = [1, 3, 7, 15].map(d => {
      const x = new Date();
      x.setDate(x.getDate() + d);
      return { day: d, date: x.toISOString().split('T')[0], label: `${d}天后复盘` };
    });
    const updated = db.updateById('learningRecords', rec.id, { knowledgePointChanges: changes, report });
    res.json({
      success: true,
      message: needsReview ? '练习已提交，解答题等待老师复核' : '练习提交成功',
      data: {
        ...(updated || rec),
        totalScore: rec.totalScore,
        questionResults: results,
        knowledgePointChanges: changes,
        report,
        ebbinghaus,
        masteryComparison: changes.map(k => ({ name: k.knowledgePointName, before: k.masteryBefore, after: k.masteryAfter }))
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});
router.get('/learning-track', (req, res) => { try { const s = S(req.headers['x-user-id']); if (!s) return res.status(404).json({ success: false, message: '学生不存在' }); const data = trackList(s.id), stats = { homeworkCount: data.filter(x => x.recordType === 'homework').length, practiceCount: data.filter(x => x.recordType === 'practice').length, latestScore: data[0] ? +data[0].score || 0 : 0, averageCorrectRate: data.length ? Math.round(data.reduce((sum, x) => sum + (+x.correctRate || 0), 0) / data.length) : 0 }; res.json({ success: true, data, stats }) } catch (e) { res.status(500).json({ success: false, message: e.message }) } });
router.get('/learning-track/:id/detail', (req, res) => { try { const s = S(req.headers['x-user-id']); if (!s) return res.status(404).json({ success: false, message: '学生不存在' }); const data = trackDetail(s.id, req.params.id, req.query.type); if (!data) return res.status(404).json({ success: false, message: '记录不存在' }); res.json({ success: true, data }) } catch (e) { res.status(500).json({ success: false, message: e.message }) } });
router.get('/knowledge-point/:id/detail', (req, res) => { try { const s = S(req.headers['x-user-id']); if (!s) return res.status(404).json({ success: false, message: '学生不存在' }); const targetId = KP_ALIAS_MAP[req.params.id] || req.params.id; const meta = resolveKnowledgeMeta(req.params.id); ensureDemoWrongHistory(s.id); const wrongQuestions = wrongs(s.id).filter(x => x.knowledgePointId === req.params.id || x.knowledgePointId === targetId).slice(0, 20).map((item, index) => ({ ...item, displayIndex: index + 1, visibleQuestionNo: `错题${index + 1}` })); const pack = getPersonalizedPush(s.id, { limit: 3 }); const recommendedQuestions = (pack.questions || []).filter(x => x.knowledgePointId === req.params.id || x.knowledgePointId === targetId).slice(0, 3).map((item, index) => ({ ...item, displayIndex: index + 1, visibleQuestionNo: `推荐题${index + 1}` })); res.json({ success: true, data: { knowledgePoint: { name: meta.name, description: meta.description || '', statusLabel: (weak(s.id).find(item => item.id === req.params.id || item.id === targetId) || {}).statusLabel || '待巩固', masteryRate: (weak(s.id).find(item => item.id === req.params.id || item.id === targetId) || {}).masteryRate || 0 }, wrongQuestions, recommendedQuestions, recommendationText: chat(s.id, req.params.id).openingMessage } }) } catch (e) { res.status(500).json({ success: false, message: e.message }) } });
router.get('/ai-tutor/status', (req, res) => { try { const s = S(req.headers['x-user-id']); if (!s) return res.status(404).json({ success: false, message: '学生不存在' }); res.json({ success: true, data: getTutorConfigStatus() }) } catch (e) { res.status(500).json({ success: false, message: e.message || 'AI助教配置检测失败' }) } });
router.post('/ai-tutor/chat', async (req, res) => { try { const s = S(req.headers['x-user-id']); if (!s) return res.status(404).json({ success: false, message: '学生不存在' }); const question = String(req.body.question || '').trim(); const mode = normalizeTutorMode(req.body.mode); const validation = validateQuestion(question, mode); if (!validation.valid) return res.status(400).json({ success: false, message: validation.reason, code: 'INVALID_TUTOR_QUESTION' }); const history = Array.isArray(req.body.history) ? req.body.history.slice(-8) : []; const answer = await askAiTutor(history, question, mode); res.json({ success: true, data: { role: 'assistant', content: answer.content, isProblem: answer.isProblem, mode: mode, scope: 'junior-math' } }) } catch (e) { const isTimeout = e.code === 'ECONNABORTED'; res.status(isTimeout ? 504 : 500).json({ success: false, message: isTimeout ? 'AI助教响应超时，请稍后重试' : (e.message || 'AI助教暂时不可用') }) } });
// ========== 学习闭环：复习计划 / 答题草稿 / 题目纠错 ==========

/** 提交前先记录掌握度，用于给学生展示"练前 → 练后"的变化 */
function masteryMap(studentId, questions) {
  const map = {};
  for (const q of questions || []) {
    const kp = q.knowledgePointId || (q.knowledgePoints || [])[0];
    if (!kp || map[kp] !== undefined) continue;
    map[kp] = getColorStatus(studentId, kp).mastery;
  }
  return map;
}

// 艾宾浩斯复习计划：按 nextReviewAt 排出最近 10 道该复习的题
router.get('/review-plan', (req, res) => {
  try {
    const s = S(req.headers['x-user-id']);
    if (!s) return res.status(404).json({ success: false, message: '学生不存在' });
    const data = db
      .find('studentQuestionAttempts', { studentId: s.id })
      .filter((item) => item.nextReviewAt)
      .map((item) => ({ ...item, question: db.findById('questions', item.questionId) }))
      .filter((item) => {
        if (!item.question) return false;
        const kp = item.question.knowledgePointId || (item.question.knowledgePoints || [])[0] || '';
        return !kp || isEligible(s.id, kp);
      })
      .sort((a, b) => new Date(a.nextReviewAt) - new Date(b.nextReviewAt))
      .slice(0, 10)
      .map((item) => ({
        questionId: item.questionId,
        content: item.question.content,
        knowledgePointId: item.question.knowledgePointId || (item.question.knowledgePoints || [])[0] || '',
        nextReviewAt: item.nextReviewAt,
        spacedSuccesses: item.spacedSuccesses || 0,
        due: new Date(item.nextReviewAt).getTime() <= Date.now()
      }));
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 答题草稿：断网/刷新/换设备都能接着答
router.get('/drafts/:key', (req, res) => {
  try {
    const s = S(req.headers['x-user-id']);
    if (!s) return res.status(404).json({ success: false, message: '学生不存在' });
    const draft = db.findOne('drafts', { studentId: s.id, key: req.params.key });
    res.json({ success: true, data: draft || null });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.put('/drafts/:key', (req, res) => {
  try {
    const s = S(req.headers['x-user-id']);
    if (!s) return res.status(404).json({ success: false, message: '学生不存在' });
    const key = req.params.key;
    if (key.length > 160) return res.status(400).json({ success: false, message: '草稿编号过长' });
    // 已交卷的作业不再接收草稿，避免交卷后又被旧草稿覆盖
    if (key.startsWith('assignment-') && latestAnswer(key.slice(11), s.id)) {
      return res.status(409).json({ success: false, message: '作业已经交卷' });
    }
    if (req.body.requestId && db.findOne('learningRecords', { studentId: s.id, requestId: req.body.requestId })) {
      return res.status(409).json({ success: false, message: '练习已提交' });
    }
    const existing = db.findOne('drafts', { studentId: s.id, key });
    const value = {
      studentId: s.id,
      key,
      answers: req.body.answers || {},
      images: Array.isArray(req.body.images) ? req.body.images : [],
      questionIds: Array.isArray(req.body.questionIds) ? req.body.questionIds : [],
      requestId: req.body.requestId || ''
    };
    const draft = existing ? db.updateById('drafts', existing.id, value) : db.create('drafts', value);
    res.json({ success: true, data: draft });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.delete('/drafts/:key', (req, res) => {
  try {
    const s = S(req.headers['x-user-id']);
    if (!s) return res.status(404).json({ success: false, message: '学生不存在' });
    const draft = db.findOne('drafts', { studentId: s.id, key: req.params.key });
    if (draft) db.deleteById('drafts', draft.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 学生反馈题目问题，进入教师端"题目纠错"队列
router.post('/questions/:id/report', (req, res) => {
  try {
    const s = S(req.headers['x-user-id']);
    if (!s) return res.status(404).json({ success: false, message: '学生不存在' });
    const question = db.findById('questions', req.params.id);
    if (!question) return res.status(404).json({ success: false, message: '题目不存在' });
    const message = String(req.body.message || '').trim();
    if (message.length < 3 || message.length > 1000) {
      return res.status(400).json({ success: false, message: '请填写 3 到 1000 字的说明' });
    }
    db.create('questionReports', {
      studentId: s.id,
      questionId: question.id,
      message,
      status: 'open'
    });
    res.json({ success: true, message: '已提交给老师核查' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
