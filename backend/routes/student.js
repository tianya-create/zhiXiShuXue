const express = require('express');
const axios = require('axios');
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

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function getOptionLabel(index) {
  return String.fromCharCode(65 + index);
}

function evaluateQuestion(question, studentAnswer) {
  const answerText = String(studentAnswer || '').trim();
  let score = 0;
  let correct = false;
  let hasSubjective = false;

  if (question.type === 'choice') {
    const normalizedStudentAnswer = normalizeText(answerText);
    const normalizedStandardAnswer = normalizeText(question.answer);
    const optionIndex = (question.options || []).findIndex(option => normalizeText(option) === normalizedStudentAnswer);
    const optionLabel = optionIndex >= 0 ? normalizeText(getOptionLabel(optionIndex)) : '';

    correct = normalizedStudentAnswer === normalizedStandardAnswer || (!!optionLabel && optionLabel === normalizedStandardAnswer);
    score = correct ? (question.score || 0) : 0;
  } else if (question.type === 'fill') {
    correct = normalizeText(answerText) === normalizeText(question.answer);
    score = correct ? (question.score || 0) : 0;
  } else {
    hasSubjective = true;
  }

  return {
    answer: studentAnswer || '',
    correct,
    score,
    hasSubjective
  };
}

function calculateAnswerPayload(questionIds, questionAnswers) {
  let totalScore = 0;
  let hasSubjectiveQuestions = false;
  const questionResults = [];
  const knowledgePointScores = {};

  questionIds.forEach(qId => {
    const question = db.findById('questions', qId);
    if (!question) return;

    const evaluation = evaluateQuestion(question, questionAnswers[qId]);

    totalScore += evaluation.score;
    if (evaluation.hasSubjective) {
      hasSubjectiveQuestions = true;
    }

    questionResults.push({
      questionId: qId,
      answer: evaluation.answer,
      correct: evaluation.correct,
      score: evaluation.score
    });

    if (question.knowledgePoints) {
      question.knowledgePoints.forEach(kp => {
        if (!knowledgePointScores[kp]) {
          knowledgePointScores[kp] = 0;
        }
        knowledgePointScores[kp] += evaluation.score;
      });
    }
  });

  return {
    totalScore,
    questionResults,
    knowledgePointScores,
    hasSubjectiveQuestions
  };
}

function getWrongQuestionEntries(studentId) {
  const answers = db.find('answers').filter(a => a.studentId === studentId);
  const wrongQuestionMap = new Map();

  answers.forEach(answer => {
    (answer.questionResults || []).forEach(qr => {
      if (qr.correct) {
        return;
      }

      const question = db.findById('questions', qr.questionId);
      if (!question) {
        return;
      }

      const existing = wrongQuestionMap.get(qr.questionId);
      const wrongHistory = existing && existing.wrongHistory ? existing.wrongHistory.slice() : [];
      wrongHistory.push({
        answerRecordId: answer.id,
        submittedAt: answer.submittedAt,
        studentAnswer: qr.answer,
        sourceType: answer.recordType || 'homework'
      });

      const latestSubmittedAt = answer.submittedAt || answer.createdAt;
      if (!existing || new Date(latestSubmittedAt) >= new Date(existing.submittedAt || existing.createdAt || 0)) {
        wrongQuestionMap.set(qr.questionId, {
          ...question,
          studentAnswer: qr.answer,
          answerRecordId: answer.id,
          submittedAt: latestSubmittedAt,
          latestSourceType: answer.recordType || 'homework',
          wrongHistory,
          wrongCount: wrongHistory.length,
          latestPracticeStatus: answer.practiceStatus || null,
          mastered: false
        });
      } else {
        existing.wrongHistory = wrongHistory;
        existing.wrongCount = wrongHistory.length;
      }
    });
  });

  const masteredRecords = db.find('masteredWrongQuestions').filter(item => item.studentId === studentId);
  masteredRecords.forEach(item => {
    const target = wrongQuestionMap.get(item.questionId);
    if (target) {
      target.mastered = true;
      target.masteredAt = item.masteredAt;
    }
  });

  return Array.from(wrongQuestionMap.values()).sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
}

function buildLearningRecord(record) {
  const knowledgePoint = record.knowledgePointId ? db.findById('knowledgePoints', record.knowledgePointId) : null;
  const assignment = record.assignmentId ? db.findById('assignments', record.assignmentId) : null;
  const paper = record.paperId ? db.findById('papers', record.paperId) : null;

  return {
    ...record,
    knowledgePointName: knowledgePoint ? knowledgePoint.name : '',
    assignmentTitle: assignment ? assignment.title : '',
    paperTitle: paper ? paper.title : ''
  };
}

function getMasteryLabel(rate) {
  if (rate >= 80) return '已掌握';
  if (rate >= 60) return '学习中';
  return '薄弱';
}

function getKnowledgePointExamples(knowledgePointId) {
  return db.find('questions')
    .filter(question => Array.isArray(question.knowledgePoints) && question.knowledgePoints.includes(knowledgePointId))
    .slice(0, 3)
    .map(question => ({
      id: question.id,
      type: question.type,
      content: question.content,
      difficulty: question.difficulty,
      answer: question.answer,
      options: question.options || [],
      knowledgePoints: question.knowledgePoints || []
    }));
}

function buildChatPracticeData(studentId, knowledgePointId) {
  const knowledgePoint = db.findById('knowledgePoints', knowledgePointId);
  const wrongQuestions = getWrongQuestionEntries(studentId)
    .filter(item => (item.knowledgePoints || []).includes(knowledgePointId));
  const answerRecords = db.find('answers').filter(answer => answer.studentId === studentId);
  const practicedQuestionIds = new Set();
  const correctQuestionIds = new Set();

  answerRecords.forEach(answer => {
    (answer.questionResults || []).forEach(result => {
      practicedQuestionIds.add(result.questionId);
      if (result.correct) {
        correctQuestionIds.add(result.questionId);
      }
    });
  });

  const wrongQuestionIdSet = new Set(wrongQuestions.map(item => item.id));
  const difficultyOrder = { easy: 1, medium: 2, hard: 3 };

  const candidateQuestions = db.find('questions')
    .filter(question => Array.isArray(question.knowledgePoints) && question.knowledgePoints.includes(knowledgePointId))
    .map(question => ({
      id: question.id,
      type: question.type,
      difficulty: question.difficulty,
      content: question.content,
      answer: question.answer,
      options: question.options || [],
      knowledgePoints: question.knowledgePoints || [],
      priority: wrongQuestionIdSet.has(question.id) ? 0 : (practicedQuestionIds.has(question.id) ? 2 : 1),
      practiced: practicedQuestionIds.has(question.id),
      correct: correctQuestionIds.has(question.id),
      difficultyRank: difficultyOrder[question.difficulty] || 99
    }))
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (a.difficultyRank !== b.difficultyRank) return a.difficultyRank - b.difficultyRank;
      if (a.practiced !== b.practiced) return a.practiced ? 1 : -1;
      if (a.correct !== b.correct) return a.correct ? 1 : -1;
      return String(a.id).localeCompare(String(b.id));
    })
    .slice(0, 10)
    .map(question => ({
      id: question.id,
      type: question.type,
      difficulty: question.difficulty,
      content: question.content,
      answer: question.answer,
      options: question.options || [],
      knowledgePoints: question.knowledgePoints || []
    }));

  const openingMessage = knowledgePoint
    ? '开始“' + knowledgePoint.name + '”补练。系统会优先推荐你做错过的同知识点题目，其次推荐未做过的题目，并按由易到难排列。'
    : '开始知识点补练。系统会优先推荐相关错题与未做过题目。';

  const relatedKnowledgePointIds = new Set([knowledgePointId]);
  wrongQuestions.forEach(item => {
    (item.knowledgePoints || []).forEach(kpId => relatedKnowledgePointIds.add(kpId));
  });
  candidateQuestions.forEach(question => {
    (question.knowledgePoints || []).forEach(kpId => relatedKnowledgePointIds.add(kpId));
  });

  const relatedKnowledgePoints = Array.from(relatedKnowledgePointIds)
    .map(kpId => {
      const item = db.findById('knowledgePoints', kpId);
      if (!item) return null;
      return {
        id: item.id,
        name: item.name,
        description: item.description || ''
      };
    })
    .filter(Boolean);

  return {
    mode: 'chat-practice',
    openingMessage,
    knowledgePoint: knowledgePoint ? {
      id: knowledgePoint.id,
      name: knowledgePoint.name,
      description: knowledgePoint.description || ''
    } : null,
    relatedKnowledgePoints,
    wrongQuestions: wrongQuestions.map(item => ({
      id: item.id,
      content: item.content,
      studentAnswer: item.studentAnswer,
      answer: item.answer,
      wrongCount: item.wrongCount,
      knowledgePoints: item.knowledgePoints || []
    })),
    candidateQuestions
  };
}

function buildPracticeKnowledgePointChanges(questions, questionResults, knowledgePointId) {
  const map = {};

  questions.forEach(question => {
    (question.knowledgePoints || []).forEach(kpId => {
      if (!map[kpId]) {
        const kp = db.findById('knowledgePoints', kpId);
        map[kpId] = {
          knowledgePointId: kpId,
          knowledgePointName: kp ? kp.name : kpId,
          questionCount: 0,
          correctCount: 0,
          wrongCount: 0,
          isInitialWeakPoint: kpId === knowledgePointId
        };
      }
      map[kpId].questionCount += 1;
    });
  });

  questionResults.forEach(result => {
    const question = questions.find(item => item.id === result.questionId);
    if (!question) return;

    (question.knowledgePoints || []).forEach(kpId => {
      if (!map[kpId]) return;
      if (result.correct) {
        map[kpId].correctCount += 1;
      } else {
        map[kpId].wrongCount += 1;
      }
    });
  });

  return Object.values(map).map(item => {
    const masteryAfter = item.questionCount > 0
      ? Math.round((item.correctCount / item.questionCount) * 100)
      : 0;

    return {
      ...item,
      masteryAfter,
      statusLabel: item.correctCount === item.questionCount
        ? '???'
        : (item.correctCount > 0 ? '????' : '??????'),
      statusType: item.correctCount === item.questionCount
        ? 'success'
        : (item.correctCount > 0 ? 'warning' : 'danger')
    };
  }).sort((a, b) => Number(b.isInitialWeakPoint) - Number(a.isInitialWeakPoint) || a.masteryAfter - b.masteryAfter);
}

function buildKnowledgeGraphData(studentId) {
  const knowledgePoints = db.find('knowledgePoints');
  const answers = db.find('answers').filter(a => a.studentId === studentId);
  const practiceRecords = db.find('learningRecords').filter(record => record.studentId === studentId && record.recordType === 'practice');

  const statsMap = {};

  knowledgePoints.forEach(kp => {
    statsMap[kp.id] = {
      total: 0,
      count: 0,
      wrongCount: 0,
      practiceCount: 0,
      correctCount: 0
    };
  });

  answers.forEach(answer => {
    (answer.questionResults || []).forEach(result => {
      const question = db.findById('questions', result.questionId);
      if (!question || !question.knowledgePoints) {
        return;
      }

      question.knowledgePoints.forEach(kpId => {
        if (!statsMap[kpId]) {
          statsMap[kpId] = { total: 0, count: 0, wrongCount: 0, practiceCount: 0, correctCount: 0 };
        }
        statsMap[kpId].count += 1;
        statsMap[kpId].total += result.correct ? 100 : 0;
        if (!result.correct) {
          statsMap[kpId].wrongCount += 1;
        }
      });
    });
  });

  practiceRecords.forEach(record => {
    if (!record.knowledgePointId) {
      return;
    }
    if (!statsMap[record.knowledgePointId]) {
      statsMap[record.knowledgePointId] = { total: 0, count: 0, wrongCount: 0, practiceCount: 0, correctCount: 0 };
    }
    statsMap[record.knowledgePointId].practiceCount += record.questionCount || 0;
    statsMap[record.knowledgePointId].correctCount += record.correctCount || 0;
  });

    const graphData = knowledgePoints.map(kp => {
    const stats = statsMap[kp.id] || { total: 0, count: 0, wrongCount: 0, practiceCount: 0, correctCount: 0 };
    const totalQuestions = stats.count + stats.practiceCount;
    const totalCorrect = (stats.total / 100) + stats.correctCount;
    const masteryRate = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

    return {
      ...kp,
      masteryRate,
      masteryLabel: getMasteryLabel(masteryRate),
      wrongCount: stats.wrongCount,
      practiceCount: stats.practiceCount,
      tested: totalQuestions > 0,
      clickable: stats.wrongCount > 0,
      examples: getKnowledgePointExamples(kp.id)
    };
  });

  return {
    tree: graphData.map(kp => ({
      ...kp,
      children: graphData.filter(item => item.parentId === kp.id)
    })),
    flat: graphData
  };
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

    // 计算学生层次
    let studentLevel = 'normal';
    const answers = db.find('answers').filter(a => a.studentId === student.id);
    if (answers.length > 0) {
      // 取最近一次的成绩
      const latestAnswer = answers.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))[0];
      if (latestAnswer.totalScore >= 90) {
        studentLevel = 'strong';
      } else if (latestAnswer.totalScore < 60) {
        studentLevel = 'weak';
      }
    }

    // 获取班级的所有作业
    let assignments = [];
    if (student.classId) {
      assignments = db.find('assignments', { classId: student.classId });
    }

    // 过滤出学生相关的作业（支持多层次）
    const studentAssignments = assignments.map(assignment => {
      const paper = db.findById('papers', assignment.paperId);
      const latestAnswer = getLatestAnswerByAssignmentAndStudent(assignment.id, student.id);
      const assignmentLevels = Array.isArray(assignment.levels)
        ? assignment.levels
        : (assignment.level ? [assignment.level] : []);

      return {
        ...assignment,
        paperTitle: paper?.title,
        questionCount: paper?.questions?.length || 0,
        submitted: !!latestAnswer,
        latestAnswerId: latestAnswer?.id,
        score: latestAnswer?.totalScore,
        answerStatus: latestAnswer?.status || null,
        levels: assignmentLevels
      };
    }).filter(assignment => {
      if (!assignment.levels || assignment.levels.length === 0) {
        return true;
      }
      return assignment.levels.includes(studentLevel);
    });

    // 根据状态过滤
    let filtered = studentAssignments;
    if (status === 'pending') {
      filtered = studentAssignments.filter(a => !a.submitted);
    } else if (status === 'completed') {
      filtered = studentAssignments.filter(a => a.submitted);
    }

    res.json({ success: true, data: filtered, studentLevel });
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

function createLearningRecord(record) {
  return db.create('learningRecords', {
    ...record,
    completedAt: record.completedAt || new Date().toISOString()
  });
}

function markWrongQuestionAsActive(studentId, questionId) {
  const masteredRecord = db.findOne('masteredWrongQuestions', { studentId, questionId });
  if (masteredRecord) {
    db.deleteById('masteredWrongQuestions', masteredRecord.id);
  }
}

function syncWrongQuestionStatusFromPractice(studentId, questionResults, practiceRecord, mode) {
  questionResults.forEach(result => {
    if (result.correct) {
      return;
    }

    if (mode === 'wrong-question') {
      markWrongQuestionAsActive(studentId, result.questionId);
    }
  });

  if (mode === 'wrong-question' && practiceRecord.allCorrect) {
    practiceRecord.questionIds.forEach(questionId => {
      markWrongQuestionAsActive(studentId, questionId);
    });
  }
}

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

    const payload = calculateAnswerPayload(paper.questions, questionAnswers || {});
    const status = payload.hasSubjectiveQuestions ? 'submitted' : 'graded';

    const answerRecord = db.create('answers', {
      assignmentId: id,
      paperId: assignment.paperId,
      classId: assignment.classId,
      studentId: student.id,
      answers: questionAnswers || {},
      questionResults: payload.questionResults,
      totalScore: payload.totalScore,
      knowledgePointScores: payload.knowledgePointScores,
      submittedAt: new Date().toISOString(),
      status,
      recordType: 'homework'
    });

    createLearningRecord({
      studentId: student.id,
      source: 'assignment',
      recordType: 'homework',
      assignmentId: id,
      paperId: assignment.paperId,
      score: payload.totalScore,
      status,
      completedAt: answerRecord.submittedAt,
      answerId: answerRecord.id,
      questionCount: payload.questionResults.length,
      correctCount: payload.questionResults.filter(item => item.correct).length
    });

    res.json({
      success: true,
      data: {
        answerId: answerRecord.id,
        totalScore: payload.totalScore,
        questionResults: payload.questionResults,
        status
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

    const graphData = buildKnowledgeGraphData(realStudentId);

    res.json({ success: true, data: graphData.tree });
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

    const learningRecords = db.find('learningRecords').filter(record => record.studentId === realStudentId);
    const masteredWrongQuestions = db.find('masteredWrongQuestions').filter(item => item.studentId === realStudentId);

    const knowledgePointStats = {};

    learningRecords.forEach(record => {
      const kpId = record.knowledgePointId;
      if (!kpId) {
        return;
      }

      if (!knowledgePointStats[kpId]) {
        knowledgePointStats[kpId] = {
          wrongCount: 0,
          practiceCount: 0,
          correctCount: 0,
          lastPracticeAt: null,
          lastHomeworkAt: null,
          latestRecordType: null,
          recommendationClearedAt: null
        };
      }

      const stat = knowledgePointStats[kpId];
      if (record.recordType === 'practice') {
        stat.practiceCount += record.questionCount || 0;
        stat.correctCount += record.correctCount || 0;
        stat.lastPracticeAt = record.completedAt;
        stat.latestRecordType = 'practice';
      }

      if (record.recordType === 'homework') {
        stat.lastHomeworkAt = record.completedAt || null;
        stat.recommendationClearedAt = record.recommendationClearedAt || null;
        stat.latestRecordType = stat.latestRecordType || 'homework';
      }
    });

    const answers = db.find('answers').filter(a => a.studentId === realStudentId);
    answers.forEach(answer => {
      (answer.questionResults || []).forEach(qr => {
        if (qr.correct) {
          return;
        }

        const question = db.findById('questions', qr.questionId);
        if (!question || !question.knowledgePoints) {
          return;
        }

        question.knowledgePoints.forEach(kpId => {
          if (!knowledgePointStats[kpId]) {
            knowledgePointStats[kpId] = {
              wrongCount: 0,
              practiceCount: 0,
              correctCount: 0,
              lastPracticeAt: null,
              lastHomeworkAt: null,
              latestRecordType: null
            };
          }
          knowledgePointStats[kpId].wrongCount += 1;
        });
      });
    });

    const masteredQuestionIds = masteredWrongQuestions.map(item => item.questionId);
    if (masteredQuestionIds.length > 0) {
      masteredQuestionIds.forEach(questionId => {
        const question = db.findById('questions', questionId);
        if (!question || !question.knowledgePoints) {
          return;
        }
        question.knowledgePoints.forEach(kpId => {
          if (!knowledgePointStats[kpId]) {
            knowledgePointStats[kpId] = {
              wrongCount: 0,
              practiceCount: 0,
              correctCount: 0,
              lastPracticeAt: null,
              lastHomeworkAt: null,
              latestRecordType: null
            };
          }
        });
      });
    }

    const weakPoints = Object.entries(knowledgePointStats)
      .map(([kpId, stats]) => {
        const kp = db.findById('knowledgePoints', kpId);
        if (!kp) {
          return null;
        }

        const total = stats.wrongCount + stats.practiceCount;
        const masteredByPractice = stats.practiceCount > 0 ? (stats.correctCount / stats.practiceCount) * 100 : 0;
        const masteryRate = total > 0
          ? Math.round((stats.correctCount / total) * 100)
          : Math.round(masteredByPractice);

        const hasFreshHomeworkTrigger = !!stats.lastHomeworkAt && (!stats.lastPracticeAt || new Date(stats.lastHomeworkAt) > new Date(stats.lastPracticeAt));
        const hasBeenCleared = !!stats.recommendationClearedAt && !!stats.lastHomeworkAt && new Date(stats.recommendationClearedAt) >= new Date(stats.lastHomeworkAt);

        return {
          ...kp,
          wrongCount: stats.wrongCount,
          practiceCount: stats.practiceCount,
          correctCount: stats.correctCount,
          masteryRate: String(Math.max(0, Math.min(100, masteryRate))),
          improved: stats.practiceCount > 0 && stats.correctCount > 0,
          latestRecordType: stats.latestRecordType,
          lastPracticeAt: stats.lastPracticeAt,
          lastHomeworkAt: stats.lastHomeworkAt || null,
          recommendationClearedAt: stats.recommendationClearedAt || null,
          hasNewRecommendation: hasFreshHomeworkTrigger && !hasBeenCleared && stats.wrongCount > 0
        };
      })
      .filter(item => item && (item.wrongCount > 0 || item.practiceCount > 0))
      .sort((a, b) => Number(a.masteryRate) - Number(b.masteryRate) || b.wrongCount - a.wrongCount);

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
      .map(answer => {
        const assignment = db.findById('assignments', answer.assignmentId);
        const paper = db.findById('papers', answer.paperId);

        return {
          id: answer.id,
          date: answer.submittedAt,
          assignmentTitle: assignment?.title || '未知作业',
          paperTitle: paper?.title || '未知试卷',
          score: answer.totalScore,
          status: answer.status,
          recordType: answer.recordType || 'homework',
          source: 'assignment'
        };
      });

    const graphData = buildKnowledgeGraphData(realStudentId);
    const graphMap = {};
    graphData.flat.forEach(item => {
      graphMap[item.id] = item;
    });

    const practiceRecords = db.find('learningRecords')
      .filter(record => record.studentId === realStudentId)
      .map(record => ({
        id: record.id,
        date: record.completedAt,
        assignmentTitle: record.title || (record.recordType === 'practice' ? '薄弱补练' : '学习记录'),
        paperTitle: record.knowledgePointName || '',
        score: record.score,
        status: record.status,
        recordType: record.recordType,
        source: record.source,
        questionCount: record.questionCount,
        correctCount: record.correctCount,
        allCorrect: record.allCorrect,
        correctRate: record.questionCount ? Math.round((record.correctCount || 0) / record.questionCount * 100) : null,
        masteryAfter: record.knowledgePointId && graphMap[record.knowledgePointId]
          ? graphMap[record.knowledgePointId].masteryRate
          : null
      }));

    const track = answers.concat(practiceRecords)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({ success: true, data: track });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 学习记录
router.get('/learning-records', (req, res) => {
  try {
    const studentId = req.headers['x-user-id'];
    const student = getStudentByUserId(studentId);
    const realStudentId = student ? student.id : studentId;

    const records = db.find('learningRecords')
      .filter(record => record.studentId === realStudentId)
      .map(buildLearningRecord)
      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

    res.json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== 薄弱补练 ==========

// AI 薄弱补练推荐（预留外部 API 接入）
router.get('/practice-ai-recommendation/:knowledgePointId', async (req, res) => {
  try {
    const studentId = req.headers['x-user-id'];
    const student = getStudentByUserId(studentId);
    const realStudentId = student ? student.id : studentId;
    const { knowledgePointId } = req.params;

    const recommendation = await getAiPracticeRecommendations(realStudentId, knowledgePointId);

    res.json({ success: true, data: recommendation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取补练习题
router.get('/practice/:knowledgePointId', async (req, res) => {
  try {
    const studentId = req.headers['x-user-id'];
    const student = getStudentByUserId(studentId);
    const realStudentId = student ? student.id : studentId;
    const { knowledgePointId } = req.params;
    const { questionId } = req.query;

    if (questionId) {
      const question = db.findById('questions', questionId);
      if (!question) {
        return res.status(404).json({ success: false, message: '题目不存在' });
      }
      return res.json({
        success: true,
        data: {
          mode: 'wrong-question',
          title: '错题重做',
          knowledgePointId: knowledgePointId === 'custom' ? '' : knowledgePointId,
          chatPractice: {
            openingMessage: '我们先重做这道错题，我会记录你的作答并在提交后自动判分。',
            knowledgePoint: null,
            wrongQuestions: [{ id: question.id, content: question.content }]
          },
          questions: [question]
        }
      });
    }

    const questions = db.find('questions')
      .filter(q => q.knowledgePoints && q.knowledgePoints.includes(knowledgePointId))
      .slice(0, 10);

    const chatPractice = buildChatPracticeData(realStudentId, knowledgePointId);
    const practiceQuestions = chatPractice.candidateQuestions && chatPractice.candidateQuestions.length
      ? chatPractice.candidateQuestions
      : questions;

    const knowledgePoint = db.findById('knowledgePoints', knowledgePointId);
    const latestPractice = db.find('learningRecords')
      .filter(record => record.studentId === realStudentId && record.recordType === 'practice' && record.knowledgePointId === knowledgePointId)
      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0] || null;

    res.json({
      success: true,
      data: {
        mode: 'weak-point',
        title: knowledgePoint ? knowledgePoint.name + ' 专项补练' : '薄弱补练',
        knowledgePointId,
        latestPractice,
        chatPractice,
        questions: practiceQuestions
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 提交补练
router.post('/practice/:knowledgePointId/submit', (req, res) => {
  try {
    const studentId = req.headers['x-user-id'];
    const student = getStudentByUserId(studentId);
    const realStudentId = student ? student.id : studentId;
    const { knowledgePointId } = req.params;
    const { answers: questionAnswers, questionIds, mode, title } = req.body;

    if (!student) {
      return res.status(404).json({ success: false, message: '学生不存在' });
    }

    const targetQuestionIds = Array.isArray(questionIds) && questionIds.length > 0
      ? questionIds
      : Object.keys(questionAnswers || {});

    if (targetQuestionIds.length === 0) {
      return res.status(400).json({ success: false, message: '缺少练习题目' });
    }

    const payload = calculateAnswerPayload(targetQuestionIds, questionAnswers || {});
    const practiceQuestions = db.find('questions').filter(question => targetQuestionIds.includes(question.id));
    const knowledgePointChanges = buildPracticeKnowledgePointChanges(practiceQuestions, payload.questionResults, knowledgePointId === 'custom' ? null : knowledgePointId);
    const status = payload.hasSubjectiveQuestions ? 'submitted' : 'graded';
    const submittedAt = new Date().toISOString();

    const practiceAnswer = db.create('answers', {
      assignmentId: null,
      paperId: null,
      classId: student.classId || null,
      studentId: realStudentId,
      answers: questionAnswers || {},
      questionResults: payload.questionResults,
      totalScore: payload.totalScore,
      knowledgePointScores: payload.knowledgePointScores,
      submittedAt,
      status,
      recordType: 'practice',
      practiceMode: mode || 'weak-point',
      knowledgePointId: knowledgePointId === 'custom' ? null : knowledgePointId,
      title: title || '薄弱补练'
    });

    const practiceRecord = createLearningRecord({
      studentId: realStudentId,
      source: 'practice',
      recordType: 'practice',
      knowledgePointId: knowledgePointId === 'custom' ? null : knowledgePointId,
      title: title || '薄弱补练',
      score: payload.totalScore,
      status,
      completedAt: submittedAt,
      answerId: practiceAnswer.id,
      questionCount: payload.questionResults.length,
      correctCount: payload.questionResults.filter(item => item.correct).length,
      allCorrect: payload.questionResults.length > 0 && payload.questionResults.every(item => item.correct),
      questionIds: targetQuestionIds,
      mode: mode || 'weak-point'
    });

    syncWrongQuestionStatusFromPractice(realStudentId, payload.questionResults, practiceRecord, mode || 'weak-point');

    if (practiceRecord.recordType === 'practice' && practiceRecord.knowledgePointId) {
      const sourceHomeworkRecords = db.find('learningRecords')
        .filter(record => record.studentId === realStudentId && record.recordType === 'homework' && record.knowledgePointId === practiceRecord.knowledgePointId)
        .sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));

      if (sourceHomeworkRecords.length > 0) {
        db.updateById('learningRecords', sourceHomeworkRecords[0].id, {
          recommendationClearedAt: submittedAt
        });
      }
    }

    res.json({
      success: true,
      data: {
        answerId: practiceAnswer.id,
        recordId: practiceRecord.id,
        totalScore: payload.totalScore,
        questionResults: payload.questionResults,
        knowledgePointChanges,
        status,
        allCorrect: practiceRecord.allCorrect
      },
      message: '补练提交成功'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/practice-recommendations', (req, res) => {
  try {
    const studentId = req.headers['x-user-id'];
    const student = getStudentByUserId(studentId);
    const realStudentId = student ? student.id : studentId;

    const weakPoints = db.find('learningRecords')
      .filter(record => record.studentId === realStudentId && record.recordType === 'practice' && record.knowledgePointId)
      .reduce((acc, record) => {
        if (!acc[record.knowledgePointId]) {
          acc[record.knowledgePointId] = { practiceCount: 0, correctCount: 0 };
        }
        acc[record.knowledgePointId].practiceCount += record.questionCount || 0;
        acc[record.knowledgePointId].correctCount += record.correctCount || 0;
        return acc;
      }, {});

    const wrongQuestions = getWrongQuestionEntries(realStudentId);
    const wrongKnowledgePointIds = [...new Set(wrongQuestions.flatMap(item => item.knowledgePoints || []))];

    const recommendations = wrongKnowledgePointIds.map(kpId => {
      const kp = db.findById('knowledgePoints', kpId);
      const relatedWrongQuestions = wrongQuestions.filter(item => (item.knowledgePoints || []).includes(kpId));
      const practiceState = weakPoints[kpId] || { practiceCount: 0, correctCount: 0 };
      const chatPractice = buildChatPracticeData(realStudentId, kpId);

      return {
        knowledgePointId: kpId,
        knowledgePointName: kp ? kp.name : '未知知识点',
        masteryRate: practiceState.practiceCount > 0 ? Math.round(practiceState.correctCount / practiceState.practiceCount * 100) : 0,
        wrongQuestions: relatedWrongQuestions,
        recommendedQuestions: chatPractice.candidateQuestions.slice(0, 5),
        practiceMode: 'smart-recommendation'
      };
    });

    res.json({ success: true, data: recommendations });
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

    const wrongQuestions = getWrongQuestionEntries(realStudentId);

    res.json({ success: true, data: wrongQuestions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/wrong-questions/:questionId/master', (req, res) => {
  try {
    const studentId = req.headers['x-user-id'];
    const student = getStudentByUserId(studentId);
    const realStudentId = student ? student.id : studentId;
    const { questionId } = req.params;

    const question = db.findById('questions', questionId);
    if (!question) {
      return res.status(404).json({ success: false, message: '题目不存在' });
    }

    const existed = db.findOne('masteredWrongQuestions', { studentId: realStudentId, questionId });
    if (!existed) {
      db.create('masteredWrongQuestions', {
        studentId: realStudentId,
        questionId,
        masteredAt: new Date().toISOString()
      });
    }

    res.json({ success: true, message: '已标记为已掌握' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/wrong-questions/:questionId/unmaster', (req, res) => {
  try {
    const studentId = req.headers['x-user-id'];
    const student = getStudentByUserId(studentId);
    const realStudentId = student ? student.id : studentId;
    const { questionId } = req.params;

    markWrongQuestionAsActive(realStudentId, questionId);

    res.json({ success: true, message: '已回流到待巩固状态' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
