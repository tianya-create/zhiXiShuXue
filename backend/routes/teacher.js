const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database/memory-db');

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

function buildAnswerDetail(answer) {
  const paper = db.findById('papers', answer.paperId);
  const assignment = db.findById('assignments', answer.assignmentId);
  const student = db.findById('students', answer.studentId) || db.findOne('students', { userId: answer.studentId });

  const questionResults = (answer.questionResults || []).map(item => {
    const question = db.findById('questions', item.questionId) || {};
    const manualScore = answer.scores && answer.scores[item.questionId] !== undefined
      ? answer.scores[item.questionId]
      : item.score;

    return {
      questionId: item.questionId,
      questionType: question.type,
      content: question.content,
      options: question.options || [],
      standardAnswer: question.answer,
      studentAnswer: item.answer,
      correct: item.correct,
      score: manualScore || 0,
      fullScore: question.score || 0,
      knowledgePoints: question.knowledgePoints || []
    };
  });

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

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/papers');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const originalName = normalizeUploadedFileName(file.originalname);
    cb(null, uniqueSuffix + path.extname(originalName));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpg|jpeg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件格式'));
    }
  }
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
    
    res.json({ success: true, data: updated, message: '班级更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 删除班级
router.delete('/classes/:id', (req, res) => {
  try {
    const { id } = req.params;
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
      fileType: path.extname(originalName),
      status: 'pending', // pending, processing, completed
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
    
    const result = db.paginate('papers', query, parseInt(page), parseInt(pageSize));
    
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
    
    res.json({ success: true, data: paper });
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
    
    // 删除文件
    if (paper.filePath) {
      const relativePath = paper.filePath.replace(/^\//, '');
      const filePath = path.join(__dirname, '..', relativePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    db.deleteById('papers', id);
    
    res.json({ success: true, message: '试卷删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== 题目管理 ==========

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
    const { title, paperId, classId, studentIds, deadline, type, level } = req.body;
    
    if (!title || !paperId || !classId) {
      return res.status(400).json({ success: false, message: '参数不完整' });
    }
    
    const assignment = db.create('assignments', {
      title,
      paperId,
      classId,
      teacherId,
      studentIds: studentIds || [],
      deadline,
      type: type || 'homework', // homework, exam
      level: level || 'normal', // weak, normal, strong (分层作业)
      status: 'published',
      createdAt: new Date().toISOString()
    });
    
    db.addLog(teacherId, 'CREATE_ASSIGNMENT', { assignmentId: assignment.id, title });
    
    res.json({ success: true, data: assignment, message: '作业发布成功' });
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
        answerCount
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

    res.json({
      success: true,
      data: {
        ...assignment,
        paper,
        classInfo,
        answers: db.find('answers').filter(a => a.assignmentId === assignment.id)
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
    const { scores, comments } = req.body;
    const teacherId = req.headers['x-user-id'];
    
    const answer = db.findById('answers', id);
    if (!answer) {
      return res.status(404).json({ success: false, message: '答题记录不存在' });
    }
    
    const updated = db.updateById('answers', id, {
      scores,
      comments,
      totalScore: Object.values(scores).reduce((sum, s) => sum + s, 0),
      gradedBy: teacherId,
      gradedAt: new Date().toISOString(),
      status: 'graded'
    });
    
    res.json({ success: true, data: updated, message: '批改成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== 学情分析 ==========

// 班级学情统计
router.get('/analytics/class/:classId', (req, res) => {
  try {
    const { classId } = req.params;
    const cls = db.findById('classes', classId);
    
    if (!cls) {
      return res.status(404).json({ success: false, message: '班级不存在' });
    }
    
    // 获取班级所有答题记录
    const answers = db.find('answers').filter(a => a.classId === classId);
    
    // 计算统计数据
    let totalScore = 0;
    let totalCount = 0;
    const knowledgePointStats = {};
    const studentScores = [];
    
    answers.forEach(answer => {
      if (answer.totalScore !== undefined) {
        totalScore += answer.totalScore;
        totalCount++;
        
        const student = db.findById('students', answer.studentId);
        if (student) {
          studentScores.push({
            studentId: answer.studentId,
            studentName: student.name,
            score: answer.totalScore
          });
        }
        
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
    
    // 计算知识点掌握度
    const knowledgePointMastery = {};
    Object.entries(knowledgePointStats).forEach(([kp, stats]) => {
      knowledgePointMastery[kp] = (stats.total / stats.count).toFixed(2);
    });
    
    res.json({
      success: true,
      data: {
        avgScore,
        studentCount: cls.students.length,
        completedCount: totalCount,
        studentScores,
        knowledgePointMastery
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
    
    // 获取学生所有答题记录
    const answers = db.find('answers').filter(a => a.studentId === studentId);
    
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
    
    res.json({
      success: true,
      data: {
        student,
        scoreTrend,
        knowledgePointMastery,
        wrongQuestions
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
