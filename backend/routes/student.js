const express = require('express');
const router = express.Router();
const db = require('../database/memory-db');

function getStudentByUserId(userId) {
  return db.findById('students', userId) || db.findOne('students', { userId });
}

function getLatestAnswerByAssignmentAndStudent(assignmentId, studentId) {
  return db.find('answers')
    .filter(answer => answer.assignmentId === assignmentId && answer.studentId === studentId)
    .sort((a, b) => new Date(b.submittedAt || b.createdAt) - new Date(a.submittedAt || a.createdAt))[0] || null;
}

// ========== 个人信息管理 ==========

// 获取个人信息
router.get('/profile', (req, res) => {
  try {
    const studentId = req.headers['x-user-id'];
    const student = getStudentByUserId(studentId);
    
    if (!student) {
      // 尝试从用户表查找
      const user = db.findById('users', studentId);
      if (user && user.role === 'student') {
        // 创建学生记录
        const newStudent = db.create('students', {
          id: studentId,
          userId: studentId,
          name: user.name,
          studentNo: `S${Date.now()}`,
          classId: null,
          gender: 'male'
        });
        return res.json({ success: true, data: newStudent });
      }
      return res.status(404).json({ success: false, message: '学生不存在' });
    }
    
    // 获取班级信息
    let classInfo = null;
    if (student.classId) {
      classInfo = db.findById('classes', student.classId);
    }
    
    res.json({
      success: true,
      data: {
        ...student,
        class: classInfo
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 更新个人信息
router.put('/profile', (req, res) => {
  try {
    const studentId = req.headers['x-user-id'];
    const { name, gender, email, phone } = req.body;
    
    const student = getStudentByUserId(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: '学生不存在' });
    }
    
    const updated = db.updateById('students', student.id, { name, gender });
    
    // 同步更新用户信息
    db.updateById('users', student.userId || studentId, { name, email, phone });
    
    res.json({ success: true, data: updated, message: '信息更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 绑定班级
router.post('/bind-class', (req, res) => {
  try {
    const studentId = req.headers['x-user-id'];
    const { classId } = req.body;
    
    const cls = db.findById('classes', classId);
    if (!cls) {
      return res.status(404).json({ success: false, message: '班级不存在' });
    }
    
    // 更新学生的班级
    const student = getStudentByUserId(studentId);
    if (student) {
      db.updateById('students', student.id, { classId });
    }
    
    // 更新班级的学生列表
    if (student && !cls.students.includes(student.id)) {
      db.updateById('classes', classId, {
        students: [...cls.students, student.id]
      });
    }
    
    res.json({ success: true, message: '班级绑定成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== 作业/试卷管理 ==========

// 获取待答题列表
router.get('/assignments', (req, res) => {
  try {
    const studentId = req.headers['x-user-id'];
    const { status } = req.query;
    
    const student = getStudentByUserId(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: '学生不存在' });
    }
    
    // 获取班级的所有作业
    let assignments = [];
    if (student.classId) {
      assignments = db.find('assignments', { classId: student.classId });
    }
    
    // 过滤出学生相关的作业
    const studentAssignments = assignments.map(assignment => {
      const paper = db.findById('papers', assignment.paperId);
      const latestAnswer = getLatestAnswerByAssignmentAndStudent(assignment.id, student.id);
      
      return {
        ...assignment,
        paperTitle: paper?.title,
        questionCount: paper?.questions?.length || 0,
        submitted: !!latestAnswer,
        latestAnswerId: latestAnswer?.id,
        score: latestAnswer?.totalScore,
        answerStatus: latestAnswer?.status || null
      };
    });
    
    // 根据状态过滤
    let filtered = studentAssignments;
    if (status === 'pending') {
      filtered = studentAssignments.filter(a => !a.submitted);
    } else if (status === 'completed') {
      filtered = studentAssignments.filter(a => a.submitted);
    }
    
    res.json({ success: true, data: filtered });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取试卷题目
router.get('/assignments/:id/questions', (req, res) => {
  try {
    const { id } = req.params;
    const assignment = db.findById('assignments', id);
    
    if (!assignment) {
      return res.status(404).json({ success: false, message: '作业不存在' });
    }
    
    const paper = db.findById('papers', assignment.paperId);
    if (!paper) {
      return res.status(404).json({ success: false, message: '试卷不存在' });
    }
    
    // 获取所有题目
    const questions = paper.questions.map(qId => db.findById('questions', qId)).filter(q => q);
    
    // 隐藏答案
    const questionsForStudent = questions.map(q => ({
      id: q.id,
      type: q.type,
      content: q.content,
      options: q.options,
      score: q.score,
      difficulty: q.difficulty
    }));
    
    res.json({
      success: true,
      data: {
        assignment,
        paper,
        questions: questionsForStudent
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 提交答案
router.post('/assignments/:id/submit', (req, res) => {
  try {
    const studentId = req.headers['x-user-id'];
    const { id } = req.params;
    const { answers: questionAnswers } = req.body;
    const student = getStudentByUserId(studentId);
    
    if (!student) {
      return res.status(404).json({ success: false, message: '学生不存在' });
    }
    
    const assignment = db.findById('assignments', id);
    if (!assignment) {
      return res.status(404).json({ success: false, message: '作业不存在' });
    }
    
    const paper = db.findById('papers', assignment.paperId);
    if (!paper) {
      return res.status(404).json({ success: false, message: '试卷不存在' });
    }
    
    // 计算分数
    let totalScore = 0;
    const questionResults = [];
    const knowledgePointScores = {};
    
    paper.questions.forEach(qId => {
      const question = db.findById('questions', qId);
      if (!question) return;
      
      const studentAnswer = questionAnswers[qId] || '';
      let score = 0;
      let correct = false;
      
      // 客观题自动批改
      if (question.type === 'choice') {
        correct = studentAnswer === question.answer;
        score = correct ? question.score : 0;
      } else if (question.type === 'fill') {
        correct = studentAnswer.trim() === question.answer.trim();
        score = correct ? question.score : 0;
      } else {
        // 主观题暂时不自动批改
        score = 0;
      }
      
      totalScore += score;
      questionResults.push({
        questionId: qId,
        answer: studentAnswer,
        correct,
        score
      });
      
      // 统计知识点得分
      if (question.knowledgePoints) {
        question.knowledgePoints.forEach(kp => {
          if (!knowledgePointScores[kp]) {
            knowledgePointScores[kp] = 0;
          }
          knowledgePointScores[kp] += score;
        });
      }
    });
    
    // 保存答题记录
    const answerRecord = db.create('answers', {
      assignmentId: id,
      paperId: assignment.paperId,
      classId: assignment.classId,
      studentId: student.id,
      answers: questionAnswers,
      questionResults,
      totalScore,
      knowledgePointScores,
      submittedAt: new Date().toISOString(),
      status: 'submitted' // submitted, graded
    });
    
    res.json({
      success: true,
      data: {
        answerId: answerRecord.id,
        totalScore,
        questionResults
      },
      message: '提交成功'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
// 获取最近一次答题记录
router.get('/assignments/:id/latest-answer', (req, res) => {
  try {
    const studentId = req.headers['x-user-id'];
    const { id } = req.params;
    const student = getStudentByUserId(studentId);

    if (!student) {
      return res.status(404).json({ success: false, message: '学生不存在' });
    }

    const assignment = db.findById('assignments', id);
    if (!assignment) {
      return res.status(404).json({ success: false, message: '作业不存在' });
    }

    const latestAnswer = getLatestAnswerByAssignmentAndStudent(id, student.id);
    if (!latestAnswer) {
      return res.status(404).json({ success: false, message: '暂无答题记录' });
    }

    res.json({
      success: true,
      data: { answerId: latestAnswer.id }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
// 查看答题结果
router.get('/answers/:id', (req, res) => {
  try {
    const studentId = req.headers['x-user-id'];
    const student = getStudentByUserId(studentId);
    const { id } = req.params;
    const answer = db.findById('answers', id);
    
    if (!answer) {
      return res.status(404).json({ success: false, message: '答题记录不存在' });
    }

    if (student && answer.studentId !== student.id) {
      return res.status(403).json({ success: false, message: '无权查看该答题记录' });
    }
    
    const paper = db.findById('papers', answer.paperId);
    const assignment = db.findById('assignments', answer.assignmentId);
    
    const questions = answer.questionResults.map(qr => {
      const question = db.findById('questions', qr.questionId);
      const manualScore = answer.scores && answer.scores[qr.questionId] !== undefined
        ? answer.scores[qr.questionId]
        : qr.score;

      return {
        ...qr,
        score: manualScore,
        fullScore: question?.score || 0,
        content: question?.content,
        options: question?.options,
        correctAnswer: question?.answer,
        type: question?.type,
        knowledgePoints: question?.knowledgePoints
      };
    });
    
    res.json({
      success: true,
      data: {
        answer: {
          ...answer,
          totalScore: answer.totalScore || 0
        },
        paper,
        assignment,
        questions
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== 学情自查 ==========

// 个人知识图谱
router.get('/knowledge-graph', (req, res) => {
  try {
    const studentId = req.headers['x-user-id'];
    const student = getStudentByUserId(studentId);
    const realStudentId = student ? student.id : studentId;
    
    // 获取所有知识点
    const knowledgePoints = db.find('knowledgePoints');
    
    // 获取学生的答题记录
    const answers = db.find('answers').filter(a => a.studentId === realStudentId);
    
    // 计算每个知识点的掌握度
    const knowledgePointStats = {};
    answers.forEach(answer => {
      if (answer.knowledgePointScores) {
        Object.entries(answer.knowledgePointScores).forEach(([kpId, score]) => {
          if (!knowledgePointStats[kpId]) {
            knowledgePointStats[kpId] = { total: 0, count: 0 };
          }
          knowledgePointStats[kpId].total += score;
          knowledgePointStats[kpId].count++;
        });
      }
    });
    
    // 构建知识图谱数据
    const graphData = knowledgePoints.map(kp => {
      const stats = knowledgePointStats[kp.id] || { total: 0, count: 0 };
      const masteryRate = stats.count > 0 ? (stats.total / (stats.count * 10)) * 100 : 0; // 假设满分10分
      
      return {
        ...kp,
        masteryRate: Math.min(100, masteryRate).toFixed(0),
        tested: stats.count > 0
      };
    });
    
    res.json({ success: true, data: graphData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 薄弱知识点清单
router.get('/weak-points', (req, res) => {
  try {
    const studentId = req.headers['x-user-id'];
    const student = getStudentByUserId(studentId);
    const realStudentId = student ? student.id : studentId;
    
    // 获取学生的答题记录
    const answers = db.find('answers').filter(a => a.studentId === realStudentId);
    
    // 统计错误题目
    const wrongKnowledgePoints = {};
    answers.forEach(answer => {
      if (answer.questionResults) {
        answer.questionResults.forEach(qr => {
          if (!qr.correct) {
            const question = db.findById('questions', qr.questionId);
            if (question && question.knowledgePoints) {
              question.knowledgePoints.forEach(kpId => {
                if (!wrongKnowledgePoints[kpId]) {
                  wrongKnowledgePoints[kpId] = { wrong: 0, total: 0 };
                }
                wrongKnowledgePoints[kpId].wrong++;
                wrongKnowledgePoints[kpId].total++;
              });
            }
          }
        });
      }
    });
    
    // 获取知识点详情并排序
    const weakPoints = Object.entries(wrongKnowledgePoints)
      .map(([kpId, stats]) => {
        const kp = db.findById('knowledgePoints', kpId);
        return {
          ...kp,
          wrongCount: stats.wrong,
          totalCount: stats.total,
          masteryRate: ((stats.total - stats.wrong) / stats.total * 100).toFixed(0)
        };
      })
      .sort((a, b) => b.wrongCount - a.wrongCount);
    
    res.json({ success: true, data: weakPoints });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 学习轨迹
router.get('/learning-track', (req, res) => {
  try {
    const studentId = req.headers['x-user-id'];
    const student = getStudentByUserId(studentId);
    const realStudentId = student ? student.id : studentId;
    
    const answers = db.find('answers')
      .filter(a => a.studentId === realStudentId && a.totalScore !== undefined)
      .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
    
    const track = answers.map(answer => {
      const assignment = db.findById('assignments', answer.assignmentId);
      const paper = db.findById('papers', answer.paperId);
      
      return {
        date: answer.submittedAt,
        assignmentTitle: assignment?.title || '未知作业',
        paperTitle: paper?.title || '未知试卷',
        score: answer.totalScore,
        status: answer.status
      };
    });
    
    res.json({ success: true, data: track });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== 薄弱补练 ==========

// 获取补练习题
router.get('/practice/:knowledgePointId', (req, res) => {
  try {
    const { knowledgePointId } = req.params;
    const { questionId } = req.query;

    if (questionId) {
      const question = db.findById('questions', questionId);
      if (!question) {
        return res.status(404).json({ success: false, message: '题目不存在' });
      }
      return res.json({ success: true, data: [question] });
    }
    
    const questions = db.find('questions')
      .filter(q => q.knowledgePoints && q.knowledgePoints.includes(knowledgePointId))
      .slice(0, 10);
    
    res.json({ success: true, data: questions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 错题本
router.get('/wrong-questions', (req, res) => {
  try {
    const studentId = req.headers['x-user-id'];
    const student = getStudentByUserId(studentId);
    const realStudentId = student ? student.id : studentId;
    
    const answers = db.find('answers').filter(a => a.studentId === realStudentId);
    
    const wrongQuestions = [];
    answers.forEach(answer => {
      if (answer.questionResults) {
        answer.questionResults.forEach(qr => {
          if (!qr.correct) {
            const question = db.findById('questions', qr.questionId);
            if (question) {
              wrongQuestions.push({
                ...question,
                studentAnswer: qr.answer,
                answerRecordId: answer.id,
                submittedAt: answer.submittedAt,
                marked: false // 是否标记已掌握
              });
            }
          }
        });
      }
    });
    
    res.json({ success: true, data: wrongQuestions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
