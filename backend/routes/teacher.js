const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database/memory-db');
const { recordQuestionResults } = require('../services/math-bank');

function normalizeUploadedFileName(fileName) {
  if (!fileName) return '';

  if (!/[\x80-\xFF]/.test(fileName)) {
    return fileName;
  }

  try {
    return Buffer.from(fileName, 'latin1').toString('utf8');
  } catch (error) {
    return fileName;
  }
}

function getTeacherByUserId(userId) {
  return db.findById('teachers', userId) || db.findOne('teachers', { userId });
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function getOptionLabel(index) {
  return String.fromCharCode(65 + index);
}

function normalizeChoiceDisplay(question, rawAnswer) {
  const answerText = String(rawAnswer || '').trim();
  const normalizedAnswer = normalizeText(answerText);
  const options = Array.isArray(question.options) ? question.options : [];

  if (!normalizedAnswer) {
    return {
      raw: answerText,
      label: '',
      content: '',
      display: '-'
    };
  }

  const byLabelIndex = options.findIndex((option, index) => {
    return normalizeText(getOptionLabel(index)) === normalizedAnswer;
  });

  if (byLabelIndex >= 0) {
    const label = getOptionLabel(byLabelIndex);
    const content = options[byLabelIndex];
    return {
      raw: answerText,
      label,
      content,
      display: `${label}（${content}）`
    };
  }

  const byContentIndex = options.findIndex((option) => {
    return normalizeText(option) === normalizedAnswer;
  });

  if (byContentIndex >= 0) {
    const label = getOptionLabel(byContentIndex);
    const content = options[byContentIndex];
    return {
      raw: answerText,
      label,
      content,
      display: `${label}（${content}）`
    };
  }

  return {
    raw: answerText,
    label: answerText.toUpperCase(),
    content: answerText,
    display: answerText
  };
}

function buildAnswerDetail(answer) {
  const paper = db.findById('papers', answer.paperId);
  const assignment = db.findById('assignments', answer.assignmentId);
  const student =
    db.findById('students', answer.studentId) ||
    db.findOne('students', { userId: answer.studentId });

  const baseQuestionResults = (answer.questionResults || []).map((item) => {
    const question = db.findById('questions', item.questionId) || {};
    const manualScore =
      answer.scores && answer.scores[item.questionId] !== undefined
        ? answer.scores[item.questionId]
        : item.score;

    const isChoice = question.type === 'choice';
    const standardAnswerInfo = isChoice
      ? normalizeChoiceDisplay(question, question.answer)
      : null;
    const studentAnswerInfo = isChoice
      ? normalizeChoiceDisplay(question, item.answer)
      : null;
    const requiresManualReview = Array.isArray(answer.images) && answer.images.length > 0;

    return {
      questionId: item.questionId,
      questionType: question.type,
      content: question.content,
      options: question.options || [],

      standardAnswer: isChoice ? standardAnswerInfo.display : question.answer,
      studentAnswer: isChoice ? studentAnswerInfo.display : item.answer,

      standardAnswerRaw: question.answer,
      studentAnswerRaw: item.answer,

      standardAnswerLabel: isChoice ? standardAnswerInfo.label : '',
      standardAnswerContent: isChoice ? standardAnswerInfo.content : '',

      studentAnswerLabel: isChoice ? studentAnswerInfo.label : '',
      studentAnswerContent: isChoice ? studentAnswerInfo.content : '',

      correct: requiresManualReview ? false : item.correct,
      score: manualScore || 0,
      fullScore: question.score || 0,
      knowledgePoints: question.knowledgePoints || [],
      comment:
        answer.comments && answer.comments[item.questionId]
          ? answer.comments[item.questionId]
          : '',
      correction:
        answer.corrections && answer.corrections[item.questionId]
          ? answer.corrections[item.questionId]
          : ''
    };
  });

  const questionResults = baseQuestionResults.length > 0
    ? baseQuestionResults
    : Array.isArray(answer.images) && answer.images.length > 0
      ? [{
          questionId: '__image_review__',
          questionType: 'imageUpload',
          content: '学生上传图片作答，请教师根据图片内容进行整体批改。',
          options: [],
          standardAnswer: '见学生上传图片',
          studentAnswer: `${answer.images.length} 张作答图片`,
          standardAnswerRaw: '',
          studentAnswerRaw: '',
          standardAnswerLabel: '',
          standardAnswerContent: '',
          studentAnswerLabel: '',
          studentAnswerContent: '',
          correct: false,
          score:
            answer.scores && answer.scores.__image_review__ !== undefined
              ? Number(answer.scores.__image_review__) || 0
              : Number(answer.totalScore) || 0,
          fullScore:
            paper && Array.isArray(paper.questions) && paper.questions.length > 0
              ? paper.questions.reduce((sum, questionId) => {
                  const question = db.findById('questions', questionId);
                  return sum + (question && question.score ? question.score : 0);
                }, 0)
              : 100,
          knowledgePoints: [],
          comment:
            answer.comments && answer.comments.__image_review__
              ? answer.comments.__image_review__
              : '',
          correction:
            answer.corrections && answer.corrections.__image_review__
              ? answer.corrections.__image_review__
              : ''
        }]
      : [];

  return {
    answer: {
      ...answer,
      questionResults,
      totalScore: answer.totalScore || 0
    },
    assignment,
    paper,
    student,
    questionResults
  };
}

function buildAccuracyFromQuestionResults(questionResults) {
  if (!questionResults || questionResults.length === 0) {
    return 0;
  }

  const correctCount = questionResults.filter((item) => item.correct).length;
  return Math.round((correctCount / questionResults.length) * 100);
}

function applyDemoStudentAnalyticsProfile(student, analytics) { return analytics; }

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.env.UPLOAD_DIR || path.join(__dirname, '../uploads'), 'papers');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = { 'application/pdf': '.pdf', 'image/png': '.png', 'image/jpeg': '.jpg' }[file.mimetype];
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({
  fileFilter: (_req, file, cb) => { const allowed = ['application/pdf', 'image/png', 'image/jpeg'].includes(file.mimetype); cb(allowed ? null : new Error('只允许 PDF、PNG 和 JPEG 试卷'), allowed); },
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB

});

// ========== 班级管理 ==========

// 获取教师的班级列表
router.get('/classes', (req, res) => {
  try {
    const teacherId = req.headers['x-user-id'];
    const teacher = db.findById('teachers', teacherId);

    if (!teacher) {
      // 如果不是教师表中的记录，尝试从用户表查找
      const user = db.findById('users', teacherId);
      if (user && user.role === 'teacher') {
        // 创建教师记录
        db.create('teachers', {
          id: teacherId,
          userId: teacherId,
          name: user.name,
          subject: '数学',
          classes: []
        });
        return res.json({ success: true, data: [] });
      }
      return res.status(404).json({ success: false, message: '教师不存在' });
    }

    const classes = db.find('classes').filter(c => teacher.classes.includes(c.id));

    // 为每个班级添加学生数量
    const classesWithStudentCount = classes.map(cls => ({
      ...cls,
      studentCount: cls.students ? cls.students.length : 0
    }));

    res.json({ success: true, data: classesWithStudentCount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 创建班级
router.post('/classes', (req, res) => {
  try {
    const teacherId = req.headers['x-user-id'];
    const { name, grade } = req.body;

    if (!name || !grade) {
      return res.status(400).json({ success: false, message: '班级名称和年级不能为空' });
    }

    const newClass = db.create('classes', {
      name,
      grade,
      teacherId,
      students: []
    });

    // 更新教师的班级列表
    const teacher = db.findById('teachers', teacherId);
    if (teacher) {
      db.updateById('teachers', teacherId, {
        classes: [...teacher.classes, newClass.id]
      });
    }

    db.addLog(teacherId, 'CREATE_CLASS', { classId: newClass.id, name });

    res.json({ success: true, data: newClass, message: '班级创建成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 更新班级
router.put('/classes/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, grade } = req.body;

    const updated = db.updateById('classes', id, { name, grade });

    if (!updated) {
      return res.status(404).json({ success: false, message: '班级不存在' });
    }

    recordQuestionResults(answer.studentId, nextQuestionResults, {
      answeredAt: updated.gradedAt || new Date().toISOString(),
      source: 'teacher-grade',
      skipTypes: ['shortAnswer', 'imageUpload']
    });

    res.json({ success: true, data: updated, message: '班级更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 删除班级
router.delete('/classes/:id', (req, res) => {
  try {
    const { id } = req.params;
    if (db.find('students', { classId: id }).length || db.find('assignments', { classId: id }).length) return res.status(400).json({ success: false, message: '班级仍有学生或作业，请先处理关联记录' });
    const deleted = db.deleteById('classes', id);

    if (!deleted) {
      return res.status(404).json({ success: false, message: '班级不存在' });
    }

    res.json({ success: true, message: '班级删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== 学生管理 ==========

// 获取班级学生列表
router.get('/classes/:classId/students', (req, res) => {
  try {
    const { classId } = req.params;
    const cls = db.findById('classes', classId);

    if (!cls) {
      return res.status(404).json({ success: false, message: '班级不存在' });
    }

    const students = db.find('students').filter(s => cls.students.includes(s.id));

    res.json({ success: true, data: students });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 添加学生
router.post('/students', (req, res) => {
  try {
    const { name, studentNo, classId, gender, email, phone } = req.body;

    if (!name || !classId) {
      return res.status(400).json({ success: false, message: '学生姓名和班级不能为空' });
    }

    // 创建用户账号
    const bcrypt = require('bcryptjs');
    const defaultPassword = bcrypt.hashSync('123456', 10);

    const user = db.create('users', {
      username: studentNo || `student_${Date.now()}`,
      password: defaultPassword,
      role: 'student',
      name,
      email: email || '',
      phone: phone || ''
    });

    // 创建学生记录
    const student = db.create('students', {
      userId: user.id,
      name,
      studentNo: studentNo || `S${Date.now()}`,
      classId,
      gender: gender || 'male'
    });

    // 更新班级学生列表
    const cls = db.findById('classes', classId);
    if (cls) {
      db.updateById('classes', classId, {
        students: [...cls.students, student.id]
      });
    }

    res.json({ success: true, data: student, message: '学生添加成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 更新学生信息
router.put('/students/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, studentNo, gender, email, phone } = req.body;

    const student = db.findById('students', id);
    if (!student) {
      return res.status(404).json({ success: false, message: '学生不存在' });
    }

    const updated = db.updateById('students', id, { name, studentNo, gender });

    // 同步更新用户信息
    db.updateById('users', student.userId, { name, email, phone });

    res.json({ success: true, data: updated, message: '学生信息更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 删除学生
router.delete('/students/:id', (req, res) => {
  try {
    const { id } = req.params;
    const student = db.findById('students', id);

    if (!student) {
      return res.status(404).json({ success: false, message: '学生不存在' });
    }

    if (db.find('answers', { studentId: id }).length || db.find('learningRecords', { studentId: id }).length || db.find('drafts', { studentId: id }).length) return res.status(400).json({ success: false, message: '学生已有学习记录，请管理员办理账号与数据删除' });
    // 从班级中移除
    const cls = db.findById('classes', student.classId);
    if (cls) {
      db.updateById('classes', student.classId, {
        students: cls.students.filter(s => s !== id)
      });
    }

    // 删除学生和用户记录
    db.deleteById('students', id);
    db.deleteById('users', student.userId);

    res.json({ success: true, message: '学生删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== 试卷管理 ==========

// 上传试卷
router.post('/papers/upload', upload.single('file'), (req, res) => {
  try {
    if (req.file) {
      const data = fs.readFileSync(req.file.path);
      const valid = req.file.mimetype === 'application/pdf' ? data.subarray(0, 5).toString() === '%PDF-' : req.file.mimetype === 'image/png' ? data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : data[0] === 255 && data[1] === 216 && data[2] === 255;
      if (!valid) { fs.unlinkSync(req.file.path); return res.status(400).json({ success: false, message: '试卷文件内容与格式不符' }); }
    }
    const teacherId = req.headers['x-user-id'];
    const { title, classId } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, message: '请上传文件' });
    }

    const originalName = normalizeUploadedFileName(req.file.originalname);

    const paper = db.create('papers', {
      title: title || originalName,
      teacherId,
      classId,
      filePath: `/uploads/papers/${req.file.filename}`,
      fileName: originalName,
      fileSize: req.file.size,
      fileType: path.extname(req.file.filename),
      status: 'pending', // pending, published
      questions: []
    });

    db.addLog(teacherId, 'UPLOAD_PAPER', { paperId: paper.id, title: paper.title });

    res.json({
      success: true,
      data: paper,
      message: '试卷上传成功'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取试卷列表
router.get('/papers', (req, res) => {
  try {
    const teacherId = req.headers['x-user-id'];
    const { classId, status, page = 1, pageSize = 10 } = req.query;

    let query = { teacherId };
    if (classId) query.classId = classId;
    if (status) query.status = status;

    const currentPage = Math.max(1, parseInt(page) || 1);
    const currentPageSize = Math.max(1, parseInt(pageSize) || 10);
    const papers = db.find('papers', query)
      .filter(item => !item.archivedAt)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const decorate = paper => {
      const assignments = db.find('assignments').filter(item => item.paperId === paper.id);
      const assignmentIds = new Set(assignments.map(item => item.id));
      const answerCount = db.find('answers').filter(item => assignmentIds.has(item.assignmentId)).length;
      return {
        ...paper,
        questionCount: Array.isArray(paper.questions) ? paper.questions.length : 0,
        assignmentCount: assignments.length,
        answerCount,
        removalMode: assignments.length
          ? ((paper.source === 'question-bank' || paper.fileType === 'manual' || !paper.filePath) ? 'archive' : 'blocked')
          : 'delete'
      };
    };
    const start = (currentPage - 1) * currentPageSize;
    const result = {
      data: papers.slice(start, start + currentPageSize).map(decorate),
      total: papers.length,
      page: currentPage,
      pageSize: currentPageSize,
      totalPages: Math.ceil(papers.length / currentPageSize)
    };

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取试卷详情
router.get('/papers/:id', (req, res) => {
  try {
    const { id } = req.params;
    const paper = db.findById('papers', id);

    if (!paper) {
      return res.status(404).json({ success: false, message: '试卷不存在' });
    }

    const assignments = db.find('assignments').filter(item => item.paperId === paper.id);
    const assignmentIds = new Set(assignments.map(item => item.id));
    const questionDetails = (paper.questions || [])
      .map(questionId => db.findById('questions', questionId))
      .filter(Boolean);
    res.json({
      success: true,
      data: {
        ...paper,
        questionDetails,
        usage: {
          assignmentCount: assignments.length,
          answerCount: db.find('answers').filter(item => assignmentIds.has(item.assignmentId)).length
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 删除试卷
router.delete('/papers/:id', (req, res) => {
  try {
    const { id } = req.params;
    const paper = db.findById('papers', id);

    if (!paper) {
      return res.status(404).json({ success: false, message: '试卷不存在' });
    }

    const assignments = db.find('assignments').filter(item => item.paperId === paper.id);
    if (assignments.length) {
      const canArchive = paper.source === 'question-bank' || paper.fileType === 'manual' || !paper.filePath;
      if (!canArchive) {
        return res.status(400).json({
          success: false,
          message: `该试卷已用于 ${assignments.length} 份作业，需保留原文件供历史答卷复核；请先删除相关作业后再删除试卷`
        });
      }
      const archived = db.updateById('papers', id, {
        archivedAt: new Date().toISOString(),
        archivedBy: req.user.id,
        status: 'archived'
      });
      db.addLog(req.user.id, 'ARCHIVE_PAPER', { paperId: paper.id, title: paper.title, assignmentCount: assignments.length });
      return res.json({
        success: true,
        data: archived,
        message: '题集已从试卷列表移除，历史作业和答卷仍会保留'
      });
    }
    // 删除文件
    if (paper.filePath) {
      const filePath = require('../services/upload-path').resolveUpload(paper.filePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    db.deleteById('papers', id);

    db.addLog(req.user.id, 'DELETE_PAPER', { paperId: paper.id, title: paper.title });

    res.json({ success: true, message: '试卷删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== 题目管理 ==========

// 获取题库题目列表
router.get('/questions', (req, res) => {
  try {
    const { type, difficulty } = req.query;

    let questions = db.find('questions');

    if (type) {
      questions = questions.filter(q => q.type === type);
    }
    if (difficulty) {
      questions = questions.filter(q => q.difficulty === difficulty);
    }

    res.json({ success: true, data: questions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
// 添加题目
router.post('/questions', (req, res) => {
  try {
    const { paperId, type, content, options, answer, knowledgePoints, difficulty, score } = req.body;

    if (!paperId || !type || !content) {
      return res.status(400).json({ success: false, message: '参数不完整' });
    }

    const question = db.create('questions', {
      paperId,
      type, // choice, fill, shortAnswer
      content,
      options: options || [],
      answer,
      knowledgePoints: knowledgePoints || [],
      difficulty: difficulty || 'medium', // easy, medium, hard
      score: score || 1
    });

    // 更新试卷题目列表
    const paper = db.findById('papers', paperId);
    if (paper) {
      db.updateById('papers', paperId, {
        questions: [...paper.questions, question.id]
      });
    }

    res.json({ success: true, data: question, message: '题目添加成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 更新题目
router.put('/questions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { content, options, answer, knowledgePoints, difficulty, score } = req.body;

    const updated = db.updateById('questions', id, {
      content, options, answer, knowledgePoints, difficulty, score
    });

    if (!updated) {
      return res.status(404).json({ success: false, message: '题目不存在' });
    }

    res.json({ success: true, data: updated, message: '题目更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 删除题目
router.delete('/questions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const question = db.findById('questions', id);

    if (!question) {
      return res.status(404).json({ success: false, message: '题目不存在' });
    }

    // 从试卷中移除
    const paper = db.findById('papers', question.paperId);
    if (paper) {
      db.updateById('papers', question.paperId, {
        questions: paper.questions.filter(q => q !== id)
      });
    }

    db.deleteById('questions', id);

    res.json({ success: true, message: '题目删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== 作业/任务管理 ==========

// 发布作业
router.post('/assignments', (req, res) => {
  try {
    const teacherId = req.headers['x-user-id'];
    const { title, paperId, classId, studentIds, deadline, type, level, levels, questionIds } = req.body;

    if (!title || !classId) {
      return res.status(400).json({ success: false, message: '作业名称和班级不能为空' });
    }

    const normalizedQuestionIds = Array.isArray(questionIds)
      ? [...new Set(questionIds.filter(Boolean))]
      : [];

    const normalizedLevels = Array.isArray(levels)
      ? [...new Set(levels.filter(Boolean))]
      : (level ? [level] : ['strong']);

    if (!paperId && normalizedQuestionIds.length === 0) {
      return res.status(400).json({ success: false, message: '请选择试卷或至少选择一道题目' });
    }

    if (normalizedLevels.length === 0) {
      return res.status(400).json({ success: false, message: '请至少选择一个作业层次' });
    }

    let effectivePaperId = paperId;

    if (!effectivePaperId) {
      const selectedQuestions = normalizedQuestionIds
        .map(questionId => db.findById('questions', questionId))
        .filter(question => question);

      if (selectedQuestions.length !== normalizedQuestionIds.length) {
        return res.status(400).json({ success: false, message: '所选题目不存在或已失效' });
      }

      if (selectedQuestions.some(question => question.reviewStatus !== 'approved')) return res.status(400).json({ success: false, message: '请先审核所有作业题目' });
      const generatedPaper = db.create('papers', {
        title: `${title}-题目集`,
        teacherId,
        classId,
        filePath: '',
        fileName: '',
        fileSize: 0,
        fileType: 'manual',
        status: 'published',
        questions: normalizedQuestionIds,
        source: 'question-bank'
      });

      effectivePaperId = generatedPaper.id;
    } else {
      // 更新现有试卷的状态为已发布
      db.updateById('papers', effectivePaperId, { status: 'published' });
    }

    const snapshotIds = db.findById('papers', effectivePaperId)?.questions || [];
    const questionSnapshots = snapshotIds.map(id => db.findById('questions', id)).filter(Boolean).map(item => ({ ...item }));
    if (questionSnapshots.length !== snapshotIds.length || questionSnapshots.some(item => item.reviewStatus !== 'approved')) return res.status(400).json({ success: false, message: '试卷题目须存在且已审核' });
    const assignment = db.create('assignments', {
      questionIds: snapshotIds,
      questionSnapshots,
      title,
      paperId: effectivePaperId,
      classId,
      teacherId,
      studentIds: studentIds || [],
      deadline,
      type: type || 'homework',
      level: normalizedLevels[0],
      levels: normalizedLevels,
      status: 'published',
      createdAt: new Date().toISOString()
    });

    db.addLog(teacherId, 'CREATE_ASSIGNMENT', {
      assignmentId: assignment.id,
      title,
      paperId: effectivePaperId,
      questionCount: normalizedQuestionIds.length,
      levels: normalizedLevels
    });

    res.json({ success: true, data: assignment, message: '作业发布成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
// 获取题库题目列表
router.get('/questions', (req, res) => {
  try {
    const { type, difficulty } = req.query;

    let questions = db.find('questions');

    if (type) {
      questions = questions.filter(q => q.type === type);
    }
    if (difficulty) {
      questions = questions.filter(q => q.difficulty === difficulty);
    }

    res.json({ success: true, data: questions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取作业列表
router.get('/assignments', (req, res) => {
  try {
    const teacherId = req.headers['x-user-id'];
    const teacher = getTeacherByUserId(teacherId);
    if (!teacher) {
      return res.status(404).json({ success: false, message: '教师不存在' });
    }

    const { classId, status } = req.query;

    let assignments = db.find('assignments', { teacherId: teacher.id });

    if (classId) {
      assignments = assignments.filter(a => a.classId === classId);
    }
    if (status) {
      assignments = assignments.filter(a => a.status === status);
    }

    const result = assignments.map(assignment => {
      const paper = db.findById('papers', assignment.paperId);
      const classInfo = db.findById('classes', assignment.classId);
      const answerCount = db.find('answers').filter(a => a.assignmentId === assignment.id).length;

      return {
        ...assignment,
        paperTitle: paper ? paper.title : '',
        className: classInfo ? classInfo.name : '',
        answerCount,
        submittedCount: answerCount
      };
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取作业详情
router.get('/assignments/:id', (req, res) => {
  try {
    const teacherId = req.headers['x-user-id'];
    const teacher = getTeacherByUserId(teacherId);
    const { id } = req.params;

    if (!teacher) {
      return res.status(404).json({ success: false, message: '教师不存在' });
    }

    const assignment = db.findById('assignments', id);
    if (!assignment || assignment.teacherId !== teacher.id) {
      return res.status(404).json({ success: false, message: '作业不存在' });
    }

    const paper = db.findById('papers', assignment.paperId);
    const classInfo = db.findById('classes', assignment.classId);
    const answerDetails = db.find('answers')
      .filter(a => a.assignmentId === assignment.id)
      .map(a => {
        const detail = buildAnswerDetail(a);
        return {
          ...detail.answer,
          studentName: detail.student ? detail.student.name : '未知学生'
        };
      });

    res.json({
      success: true,
      data: {
        ...assignment,
        paper,
        classInfo,
        answers: answerDetails
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 删除作业
router.delete('/assignments/:id', (req, res) => {
  try {
    const teacherId = req.headers['x-user-id'];
    const teacher = getTeacherByUserId(teacherId);
    const { id } = req.params;

    if (!teacher) {
      return res.status(404).json({ success: false, message: '教师不存在' });
    }

    const assignment = db.findById('assignments', id);
    if (!assignment || assignment.teacherId !== teacher.id) {
      return res.status(404).json({ success: false, message: '作业不存在' });
    }

    db.delete('answers', { assignmentId: id });
    db.deleteById('assignments', id);

    res.json({ success: true, message: '作业删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== 批改管理 ==========

// 获取答题记录
router.get('/answers', (req, res) => {
  try {
    const { assignmentId, classId, studentId } = req.query;

    let answers = db.find('answers');

    if (assignmentId) {
      answers = answers.filter(a => a.assignmentId === assignmentId);
    }
    if (classId) {
      answers = answers.filter(a => a.classId === classId);
    }
    if (studentId) {
      answers = answers.filter(a => a.studentId === studentId);
    }

    const result = answers.map(answer => {
      const assignment = db.findById('assignments', answer.assignmentId);
      const student = db.findById('students', answer.studentId) || db.findOne('students', { userId: answer.studentId });
      return {
        ...answer,
        assignmentTitle: assignment ? assignment.title : '未知作业',
        studentName: student ? student.name : '未知学生'
      };
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取答题详情
router.get('/answers/:id', (req, res) => {
  try {
    const { id } = req.params;
    const answer = db.findById('answers', id);

    if (!answer) {
      return res.status(404).json({ success: false, message: '答题记录不存在' });
    }

    res.json({ success: true, data: buildAnswerDetail(answer) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 批改答题
router.post('/answers/:id/grade', (req, res) => {
  try {
    const { id } = req.params;
    const { scores, comments, corrections } = req.body;
    const teacherId = req.headers['x-user-id'];

    const answer = db.findById('answers', id);
    if (!answer) {
      return res.status(404).json({ success: false, message: '答题记录不存在' });
    }

    const currentQuestionResults = Array.isArray(answer.questionResults) ? answer.questionResults : [];
    const hasImageOnlySubmission = currentQuestionResults.length === 0 && Array.isArray(answer.images) && answer.images.length > 0;

    const nextQuestionResults = hasImageOnlySubmission
      ? [{
          questionId: '__image_review__',
          answer: `${answer.images.length} 张作答图片`,
          score: Math.max(0, Number(scores && scores.__image_review__) || 0),
          correct: (Number(scores && scores.__image_review__) || 0) > 0,
          comment: comments && comments.__image_review__ ? comments.__image_review__ : '',
          correction: corrections && corrections.__image_review__ ? corrections.__image_review__ : ''
        }]
      : currentQuestionResults.map(item => {
          const manualScore = scores && scores[item.questionId] !== undefined ? Number(scores[item.questionId]) : item.score;
          const question = db.findById('questions', item.questionId);
          const fullScore = question && question.score ? question.score : 0;
          const isObjective = question && (question.type === 'choice' || question.type === 'fill');

          return {
            ...item,
            score: Math.max(0, Math.min(fullScore, manualScore || 0)),
            correct: isObjective ? item.correct : (manualScore || 0) >= fullScore * 0.6,
            comment: comments && comments[item.questionId] ? comments[item.questionId] : '',
            correction: corrections && corrections[item.questionId] ? corrections[item.questionId] : ''
          };
        });

    const totalScore = nextQuestionResults.reduce((sum, item) => sum + (item.score || 0), 0);

    const updated = db.updateById('answers', id, {
      scores: scores || {},
      comments: comments || {},
      corrections: corrections || {},
      questionResults: nextQuestionResults,
      totalScore,
      gradedBy: teacherId,
      gradedAt: new Date().toISOString(),
      status: 'graded'
    });

    recordQuestionResults(answer.studentId, nextQuestionResults, {
      answeredAt: updated.gradedAt || new Date().toISOString(),
      source: 'teacher-grade',
      skipTypes: ['shortAnswer', 'imageUpload']
    });

    res.json({ success: true, data: updated, message: '批改成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 批改结果导出：生成真正的 .xlsx（原实现是 CSV，且前端 window.open 不带 token 会 401）
router.get('/answers/export/excel', (req, res) => {
  try {
    const XLSX = require('xlsx');
    const studentOf = (id) =>
      db.findById('students', id) || db.findOne('students', { userId: id });

    // 满分：同一份作业/试卷只算一次
    const fullScoreCache = new Map();
    const fullScoreOf = (answer) => {
      const key = answer.assignmentId || answer.paperId || answer.id;
      if (fullScoreCache.has(key)) return fullScoreCache.get(key);
      let total = 0;
      const assignment = answer.assignmentId ? db.findById('assignments', answer.assignmentId) : null;
      const questions =
        assignment?.questionSnapshots ||
        (assignment?.questionIds || db.findById('papers', assignment?.paperId || answer.paperId)?.questions || [])
          .map((id) => db.findById('questions', id))
          .filter(Boolean);
      for (const question of questions) total += Number(question.score) || 0;
      if (!total) total = (answer.questionResults || []).reduce((sum, item) => sum + (Number(item.fullScore) || 0), 0);
      fullScoreCache.set(key, total);
      return total;
    };

    let answerList = db.find('answers');
    if (req.query.classId) {
      answerList = answerList.filter((answer) => {
        const student = studentOf(answer.studentId);
        return answer.classId === req.query.classId || (student && student.classId === req.query.classId);
      });
    }
    if (req.query.assignmentId) {
      answerList = answerList.filter((answer) => answer.assignmentId === req.query.assignmentId);
    }

    const statusText = (status) =>
      ({ graded: '已批改', submitted: '待批改', reviewed: '已复核' }[status] || status || '');
    const typeText = (type) =>
      ({ homework: '作业', practice: '练习', exam: '测验' }[type] || type || '作业');

    const rows = answerList
      .map((answer) => {
        const student = studentOf(answer.studentId);
        const cls = student?.classId ? db.findById('classes', student.classId) : null;
        const assignment = answer.assignmentId ? db.findById('assignments', answer.assignmentId) : null;
        const fullScore = fullScoreOf(answer);
        const score = Number(answer.totalScore) || 0;
        return {
          学生姓名: student?.name || '未知学生',
          学号: student?.studentNo || '',
          班级: cls?.name || '',
          作业练习名称: assignment?.title || answer.title || '练习记录',
          记录类型: typeText(answer.recordType),
          状态: statusText(answer.status),
          得分: score,
          满分: fullScore,
          得分率: fullScore ? Math.min(100, Math.round((score / fullScore) * 100)) + '%' : '',
          客观题正确率: buildAccuracyFromQuestionResults(answer.questionResults || []) + '%',
          提交时间: answer.submittedAt ? new Date(answer.submittedAt).toLocaleString('zh-CN', { hour12: false }) : '',
          批改时间: answer.gradedAt ? new Date(answer.gradedAt).toLocaleString('zh-CN', { hour12: false }) : '',
          教师评语: answer.comments || ''
        };
      })
      .sort((a, b) => {
        const byName = String(a.学生姓名).localeCompare(String(b.学生姓名), 'zh-CN');
        if (byName !== 0) return byName;
        return String(a.提交时间).localeCompare(String(b.提交时间));
      });

    if (!rows.length) rows.push({ 学生姓名: '暂无批改记录' });

    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet['!cols'] = [
      { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 24 }, { wch: 10 },
      { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 12 },
      { wch: 20 }, { wch: 20 }, { wch: 28 }
    ];
    sheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: 12 } }) };
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, '批改结果');
    const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });

    const stamp = new Date().toISOString().slice(0, 10);
    const fileName = `批改结果_${stamp}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="grading-results-${stamp}.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}`
    );
    res.setHeader('Cache-Control', 'no-store');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ success: false, message: '导出失败：' + error.message });
  }
});

// 已出最终分数的提交：自动批改完成或老师已批改。status 为 submitted 表示还在等老师批改。
function isGradedAnswer(answer) {
  return answer && answer.status !== 'submitted';
}

router.get('/analytics/class/:classId', (req, res) => {
  try {
    const { classId } = req.params;
    const cls = db.findById('classes', classId);

    if (!cls) {
      return res.status(404).json({ success: false, message: '班级不存在' });
    }

    // 获取班级所有答题记录
    const answers = db.find('answers').filter(a => a.classId === classId);
    // 待老师批改（status 为 submitted）的提交还没有最终分数，不计入成绩和掌握度统计
    const gradedAnswers = answers.filter(isGradedAnswer);

    // 计算统计数据
    let totalScore = 0;
    let totalCount = 0;
    const knowledgePointStats = {};
    const scoreByStudent = {};

    gradedAnswers.forEach(answer => {
      if (answer.totalScore !== undefined) {
        totalScore += answer.totalScore;
        totalCount++;

        // 按学生汇总：同一个学生多次提交只算一行，取平均分
        if (!scoreByStudent[answer.studentId]) {
          scoreByStudent[answer.studentId] = { total: 0, count: 0 };
        }
        scoreByStudent[answer.studentId].total += answer.totalScore;
        scoreByStudent[answer.studentId].count++;

        // 统计知识点
        if (answer.knowledgePointScores) {
          Object.entries(answer.knowledgePointScores).forEach(([kp, score]) => {
            if (!knowledgePointStats[kp]) {
              knowledgePointStats[kp] = { total: 0, count: 0 };
            }
            knowledgePointStats[kp].total += score;
            knowledgePointStats[kp].count++;
          });
        }
      }
    });

    const avgScore = totalCount > 0 ? (totalScore / totalCount).toFixed(2) : 0;

    // 每个学生一行：平均分与层次（90 分及以上为优秀，60 分以下为薄弱）
    const studentScores = Object.entries(scoreByStudent)
      .map(([studentId, stats]) => {
        const student = db.findById('students', studentId);
        if (!student) return null;
        const score = Math.round((stats.total / stats.count) * 10) / 10;
        const level = score >= 90 ? 'strong' : score < 60 ? 'weak' : 'normal';
        return { studentId, studentName: student.name, score, level, submissionCount: stats.count };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);
    const studentLevels = studentScores.map(item => ({
      studentId: item.studentId,
      studentName: item.studentName,
      level: item.level,
      score: item.score
    }));

    // 计算知识点掌握度
    const knowledgePointMastery = {};
    Object.entries(knowledgePointStats).forEach(([kp, stats]) => {
      knowledgePointMastery[kp] = (stats.total / stats.count).toFixed(2);
    });

    // 知识点掌握度列表（附名称，按掌握度从低到高）
    const knowledgePointMasteryList = Object.entries(knowledgePointMastery)
      .map(([kpId, value]) => {
        const kp = db.findById('knowledgePoints', kpId);
        return { id: kpId, name: (kp && kp.name) || kpId, mastery: Number(value) };
      })
      .sort((a, b) => a.mastery - b.mastery);

    // 按题型统计错题次数（来自真实答题记录）
    const QUESTION_TYPE_LABELS = { choice: '选择题', fill: '填空题', judge: '判断题', subjective: '解答题', calculation: '计算题', proof: '证明题' };
    const errorTypeCounter = {};
    gradedAnswers.forEach(answer => {
      (answer.questionResults || []).forEach(result => {
        if (result.correct) return;
        const question = db.findById('questions', result.questionId);
        const type = (question && question.type) || 'other';
        errorTypeCounter[type] = (errorTypeCounter[type] || 0) + 1;
      });
    });
    const errorTypeStats = Object.entries(errorTypeCounter)
      .map(([type, count]) => ({ type, label: QUESTION_TYPE_LABELS[type] || '其他', count }))
      .sort((a, b) => b.count - a.count);

    // 统计各层次学生数量
    const levelDistribution = {
      weak: studentLevels.filter(s => s.level === 'weak').length,
      normal: studentLevels.filter(s => s.level === 'normal').length,
      strong: studentLevels.filter(s => s.level === 'strong').length
    };

    res.json({
      success: true,
      data: {
        avgScore,
        studentCount: cls.students.length,
        completedCount: answers.length,
        pendingReviewCount: answers.length - gradedAnswers.length,
        studentScores,
        knowledgePointMastery,
        knowledgePointMasteryList,
        errorTypeStats,
        levelDistribution,
        studentLevels
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 学生个人学情
router.get('/analytics/student/:studentId', (req, res) => {
  try {
    const { studentId } = req.params;
    const student = db.findById('students', studentId);

    if (!student) {
      return res.status(404).json({ success: false, message: '学生不存在' });
    }

    // 获取学生所有已批改的答题记录（待批改的提交还没有最终分数，不计入趋势和错题）
    const answers = db.find('answers').filter(a => a.studentId === studentId && isGradedAnswer(a));

    // 计算成绩趋势
    const scoreTrend = answers
      .filter(a => a.totalScore !== undefined)
      .map(a => ({
        date: a.submittedAt,
        score: a.totalScore,
        assignmentTitle: db.findById('assignments', a.assignmentId)?.title || '未知作业'
      }));

    // 知识点掌握情况
    const knowledgePointStats = {};
    answers.forEach(answer => {
      if (answer.knowledgePointScores) {
        Object.entries(answer.knowledgePointScores).forEach(([kp, score]) => {
          if (!knowledgePointStats[kp]) {
            knowledgePointStats[kp] = { total: 0, count: 0 };
          }
          knowledgePointStats[kp].total += score;
          knowledgePointStats[kp].count++;
        });
      }
    });

    const knowledgePointMastery = {};
    Object.entries(knowledgePointStats).forEach(([kp, stats]) => {
      knowledgePointMastery[kp] = {
        avgScore: (stats.total / stats.count).toFixed(2),
        count: stats.count
      };
    });

    // 错题列表
    const wrongQuestions = [];
    answers.forEach(answer => {
      if (answer.questionResults) {
        answer.questionResults.forEach(qr => {
          if (!qr.correct) {
            const question = db.findById('questions', qr.questionId);
            if (question) {
              wrongQuestions.push({
                questionId: qr.questionId,
                content: question.content,
                correctAnswer: question.answer,
                studentAnswer: qr.answer,
                paperId: answer.paperId,
                knowledgePoints: question.knowledgePoints
              });
            }
          }
        });
      }
    });

    const analyticsData = applyDemoStudentAnalyticsProfile(student, {
      student,
      scoreTrend,
      knowledgePointMastery,
      wrongQuestions
    });

    res.json({
      success: true,
      data: analyticsData
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
