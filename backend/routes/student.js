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

function normalizeChoiceAnswer(question, rawAnswer) {
  const answerText = String(rawAnswer || '').trim();
  const normalizedAnswer = normalizeText(answerText);
  const options = Array.isArray(question.options) ? question.options : [];

  if (!normalizedAnswer) {
    return {
      raw: answerText,
      normalized: '',
      label: '',
      content: ''
    };
  }

  const optionIndexByLabel = options.findIndex((option, index) => {
    return normalizeText(getOptionLabel(index)) === normalizedAnswer;
  });

  if (optionIndexByLabel >= 0) {
    return {
      raw: answerText,
      normalized: normalizeText(getOptionLabel(optionIndexByLabel)),
      label: getOptionLabel(optionIndexByLabel),
      content: options[optionIndexByLabel]
    };
  }

  const optionIndexByContent = options.findIndex(option => {
    return normalizeText(option) === normalizedAnswer;
  });

  if (optionIndexByContent >= 0) {
    return {
      raw: answerText,
      normalized: normalizeText(getOptionLabel(optionIndexByContent)),
      label: getOptionLabel(optionIndexByContent),
      content: options[optionIndexByContent]
    };
  }

  return {
    raw: answerText,
    normalized: normalizedAnswer,
    label: answerText.toUpperCase(),
    content: answerText
  };
}

function buildChoiceDisplay(question, rawAnswer) {
  const info = normalizeChoiceAnswer(question, rawAnswer);
  if (!info.normalized) {
    return '-';
  }
  if (info.label && info.content) {
    return `${info.label}（${info.content}）`;
  }
  return info.content || info.label || '-';
}

function evaluateQuestion(question, studentAnswer) {
  const answerText = String(studentAnswer || '').trim();
  let score = 0;
  let correct = false;
  let hasSubjective = false;

  if (question.type === 'choice') {
    const normalizedStudent = normalizeChoiceAnswer(question, answerText);
    const normalizedStandard = normalizeChoiceAnswer(question, question.answer);

    correct =
      !!normalizedStudent.normalized &&
      normalizedStudent.normalized === normalizedStandard.normalized;

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

function deriveKnowledgePointId(question, fallbackKnowledgePointId) {
  const direct = Array.isArray(question && question.knowledgePoints) && question.knowledgePoints.length
    ? question.knowledgePoints[0]
    : '';

  if (direct) return direct;

  const fallbackText = String((question && question.content) || '').toLowerCase();
  const allPoints = db.find('knowledgePoints');
  const matched = allPoints.find(item => fallbackText.includes(String(item.name || '').toLowerCase()));
  if (matched) return matched.id;

  return fallbackKnowledgePointId || '';
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
      const displayAnswer = question.type === 'choice'
        ? buildChoiceDisplay(question, qr.answer)
        : (qr.answer || '');
      const displayCorrectAnswer = question.type === 'choice'
        ? buildChoiceDisplay(question, question.answer)
        : (question.answer || '');

      if (!existing || new Date(latestSubmittedAt) >= new Date(existing.submittedAt || existing.createdAt || 0)) {
        wrongQuestionMap.set(qr.questionId, {
          ...question,
          studentAnswer: qr.answer,
          studentAnswerDisplay: displayAnswer,
          answerDisplay: displayCorrectAnswer,
          answerRecordId: answer.id,
          submittedAt: latestSubmittedAt,
          latestSourceType: answer.recordType || 'homework',
          wrongHistory,
          wrongCount: wrongHistory.length,
          latestPracticeStatus: answer.practiceStatus || null,
          mastered: false,
          note: existing && existing.note ? existing.note : ''
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
      target.mastered = !!item.masteredAt;
      if (item.note) {
        target.note = item.note;
      }
    }
  });

  return Array.from(wrongQuestionMap.values())
    .sort((a, b) => new Date(b.submittedAt || b.createdAt || 0) - new Date(a.submittedAt || a.createdAt || 0));
}

function markWrongQuestionAsActive(studentId, questionId) {
  const existed = db.findOne('masteredWrongQuestions', { studentId, questionId });
  if (existed) {
    db.delete('masteredWrongQuestions', { studentId, questionId });
  }
}

function createLearningRecord(payload) {
  return db.create('learningRecords', payload);
}

function buildPracticeKnowledgePointChanges(practiceQuestions, questionResults, targetKnowledgePointId) {
  const questionMap = {};
  practiceQuestions.forEach(question => {
    questionMap[question.id] = question;
  });

  const summary = {};
  questionResults.forEach(result => {
    const question = questionMap[result.questionId];
    if (!question) return;

    const kpIds = Array.isArray(question.knowledgePoints) ? question.knowledgePoints : [];
    kpIds.forEach(kpId => {
      if (targetKnowledgePointId && kpId !== targetKnowledgePointId) return;

      if (!summary[kpId]) {
        const kp = db.findById('knowledgePoints', kpId);
        summary[kpId] = {
          knowledgePointId: kpId,
          knowledgePointName: kp ? kp.name : kpId,
          questionCount: 0,
          correctCount: 0,
          wrongCount: 0
        };
      }

      summary[kpId].questionCount += 1;
      if (result.correct) {
        summary[kpId].correctCount += 1;
      } else {
        summary[kpId].wrongCount += 1;
      }
    });
  });

  return Object.values(summary).map(item => {
    const masteryAfter = item.questionCount > 0
      ? Math.round(item.correctCount / item.questionCount * 100)
      : 0;

    return {
      ...item,
      masteryAfter,
      statusLabel: masteryAfter >= 80 ? '已掌握' : (masteryAfter >= 60 ? '待巩固' : '薄弱'),
      statusType: masteryAfter >= 80 ? 'success' : (masteryAfter >= 60 ? 'warning' : 'danger')
    };
  });
}

function buildKnowledgePointSpecificQuestions(knowledgePoint, masteryRate) {
  if (!knowledgePoint) return [];

  const level = masteryRate < 40 ? 'easy' : (masteryRate < 60 ? 'medium' : 'hard');
  const name = knowledgePoint.name;

  const bank = {
    '有理数': [
      { type: 'choice', content: '下列各数中，属于有理数的是？', options: ['√2', 'π', '-3', '0.1010010001…'], answer: '-3', score: 10 },
      { type: 'fill', content: '计算：-8 + 13 = ____', answer: '5', score: 12 },
      { type: 'shortAnswer', content: '请说明什么是有理数，并举一个正有理数和一个负有理数的例子。', answer: '有理数是可以写成两个整数比的数，例如 3/4 和 -2。', score: 18 }
    ],
    '有理数的加减法': [
      { type: 'choice', content: '计算 7 + (-11) 的结果是？', options: ['18', '-4', '4', '-18'], answer: '-4', score: 10 },
      { type: 'fill', content: '计算：-6 - 9 = ____', answer: '-15', score: 12 },
      { type: 'shortAnswer', content: '简述进行有理数加减混合运算时的步骤。', answer: '先统一成加法，再根据同号相加、异号相减的规则计算。', score: 18 }
    ],
    '有理数的乘除法': [
      { type: 'choice', content: '计算 (-3) × 5 的结果是？', options: ['15', '-15', '8', '-8'], answer: '-15', score: 10 },
      { type: 'fill', content: '计算：24 ÷ (-6) = ____', answer: '-4', score: 12 },
      { type: 'shortAnswer', content: '简述有理数乘除法的符号法则。', answer: '同号得正，异号得负，再计算绝对值。', score: 18 }
    ],
    '整式的加减': [
      { type: 'choice', content: '化简 3x + 2x 的结果是？', options: ['5x', '6x²', '5', 'x'], answer: '5x', score: 10 },
      { type: 'fill', content: '化简：4a - 7a = ____', answer: '-3a', score: 12 },
      { type: 'shortAnswer', content: '简述合并同类项时需要满足的条件。', answer: '所含字母相同且相同字母的指数也分别相同。', score: 18 }
    ],
    '一元一次方程': [
      { type: 'choice', content: '方程 2x + 5 = 13 的解是？', options: ['3', '4', '5', '6'], answer: '4', score: 10 },
      { type: 'fill', content: '解方程：x - 7 = 9，则 x = ____', answer: '16', score: 12 },
      { type: 'shortAnswer', content: '解方程 3x - 2 = 10，并写出主要步骤。', answer: '先移项得 3x = 12，再两边同时除以 3，得 x = 4。', score: 18 }
    ],
    '几何初步': [
      { type: 'choice', content: '线段有几个端点？', options: ['0个', '1个', '2个', '无数个'], answer: '2个', score: 10 },
      { type: 'fill', content: '一个周角等于 ____ 度。', answer: '360', score: 12 },
      { type: 'shortAnswer', content: '请简述射线、线段、直线三者的区别。', answer: '射线有一个端点，线段有两个端点，直线没有端点。', score: 18 }
    ],
    '相交线与平行线': [
      { type: 'choice', content: '两条平行线被第三条直线所截，内错角的关系是？', options: ['互补', '相等', '互余', '没有关系'], answer: '相等', score: 10 },
      { type: 'fill', content: '同一平面内，两条不重合且永不相交的直线叫做 ____。', answer: '平行线', score: 12 },
      { type: 'shortAnswer', content: '请写出平行线的两个常见性质。', answer: '同位角相等，内错角相等，同旁内角互补。', score: 18 }
    ],
    '实数': [
      { type: 'choice', content: '下列各数中，属于无理数的是？', options: ['1/2', '0.3', '√3', '-7'], answer: '√3', score: 10 },
      { type: 'fill', content: '9 的平方根是 ____。', answer: '±3', score: 12 },
      { type: 'shortAnswer', content: '请简述有理数与无理数的关系。', answer: '有理数和无理数统称为实数。', score: 18 }
    ],
    '平面直角坐标系': [
      { type: 'choice', content: '点 (3,-2) 位于第几象限？', options: ['第一象限', '第二象限', '第三象限', '第四象限'], answer: '第四象限', score: 10 },
      { type: 'fill', content: '原点的坐标是 ____。', answer: '(0,0)', score: 12 },
      { type: 'shortAnswer', content: '请说明在平面直角坐标系中如何确定一个点的位置。', answer: '先确定横坐标，再确定纵坐标，用有序数对表示。', score: 18 }
    ],
    '二元一次方程组': [
      { type: 'choice', content: '下列哪组数是方程组 x+y=5, x-y=1 的解？', options: ['x=3,y=2', 'x=2,y=3', 'x=4,y=1', 'x=1,y=4'], answer: 'x=3,y=2', score: 10 },
      { type: 'fill', content: '若 x+y=7, x=3，则 y= ____。', answer: '4', score: 12 },
      { type: 'shortAnswer', content: '简述代入法解二元一次方程组的基本思路。', answer: '先由一个方程表示一个未知数，再代入另一个方程求解。', score: 18 }
    ],
    '不等式与不等式组': [
      { type: 'choice', content: '解不等式 x+2>5，结果是？', options: ['x>3', 'x<3', 'x>7', 'x<7'], answer: 'x>3', score: 10 },
      { type: 'fill', content: '不等式 2x<8 的解集是 ____。', answer: 'x<4', score: 12 },
      { type: 'shortAnswer', content: '请说明解不等式时什么时候需要改变不等号方向。', answer: '当不等式两边同时乘或除以负数时，需要改变不等号方向。', score: 18 }
    ],
    '数据的收集与整理': [
      { type: 'choice', content: '调查全班同学最喜欢的运动项目，较适合采用哪种方式整理数据？', options: ['条形统计图', '函数图像', '坐标作图', '几何证明'], answer: '条形统计图', score: 10 },
      { type: 'fill', content: '把收集到的数据按类别分组并统计数量，这个过程叫做数据的 ____。', answer: '整理', score: 12 },
      { type: 'shortAnswer', content: '请简述数据收集与整理的一般步骤。', answer: '先确定调查对象与方式，再收集数据，最后分类整理并进行分析。', score: 18 }
    ]
  };

  const selected = bank[name] || [
    { type: 'choice', content: `关于“${name}”的学习，下列做法最合理的是？`, options: [`先理解${name}的概念再练习`, '直接背答案', '忽略题干条件', '只看结论'], answer: `先理解${name}的概念再练习`, score: 10 },
    { type: 'fill', content: `完成“${name}”相关题目时，最关键的是掌握正确的 ____。`, answer: '方法', score: 12 },
    { type: 'shortAnswer', content: `请简述你解决“${name}”相关题目时的标准思路。`, answer: `先审题并提取与${name}相关的条件，再选择对应方法，按步骤作答并检查结果。`, score: 18 }
  ];

  return selected.map((item, idx) => ({
    id: `generated-${knowledgePoint.id}-${idx + 1}`,
    type: item.type,
    content: item.content,
    options: item.options || [],
    answer: item.answer,
    answerDisplay: item.type === 'choice'
      ? buildChoiceDisplay({ options: item.options || [], answer: item.answer }, item.answer)
      : item.answer,
    score: item.score,
    difficulty: level,
    knowledgePoints: [knowledgePoint.id]
  }));
}

function buildGeneratedPracticeQuestion(knowledgePoint, index, masteryRate) {
  const name = knowledgePoint ? knowledgePoint.name : '当前知识点';
  const description = knowledgePoint && knowledgePoint.description ? knowledgePoint.description : `${name}相关训练`;
  const difficulty = masteryRate < 40 ? 'easy' : (masteryRate < 60 ? 'medium' : 'hard');
  const seed = index + 1;

  return [
    {
      id: `generated-${knowledgePoint ? knowledgePoint.id : 'custom'}-choice-${seed}`,
      type: 'choice',
      content: `知识点【${name}】选择题 ${seed}：下列哪一项最符合“${description}”的学习目标？`,
      options: [
        `准确理解并应用${name}的核心方法`,
        `忽略题干条件直接套公式`,
        `只看结果不分析过程`,
        `将无关知识点混入解题步骤`
      ],
      answer: `准确理解并应用${name}的核心方法`,
      answerDisplay: `A（准确理解并应用${name}的核心方法）`,
      score: 10,
      difficulty,
      knowledgePoints: knowledgePoint ? [knowledgePoint.id] : []
    },
    {
      id: `generated-${knowledgePoint ? knowledgePoint.id : 'custom'}-fill-${seed}`,
      type: 'fill',
      content: `知识点【${name}】填空题 ${seed}：完成该知识点训练后，你应当能够独立完成“${name}”相关题目的________。`,
      answer: '关键步骤',
      answerDisplay: '关键步骤',
      score: 12,
      difficulty,
      knowledgePoints: knowledgePoint ? [knowledgePoint.id] : []
    },
    {
      id: `generated-${knowledgePoint ? knowledgePoint.id : 'custom'}-short-${seed}`,
      type: 'shortAnswer',
      content: `知识点【${name}】简答题 ${seed}：请简述你解决“${name}”相关题目时的标准思路。`,
      answer: `先审题并提取与${name}相关的条件，再选择对应方法，按步骤作答并检查结果。`,
      answerDisplay: `先审题并提取与${name}相关的条件，再选择对应方法，按步骤作答并检查结果。`,
      score: 18,
      difficulty,
      knowledgePoints: knowledgePoint ? [knowledgePoint.id] : []
    }
  ][index % 3];
}

function ensurePracticeQuestionsForKnowledgePoint(studentId, knowledgePointId) {
  const knowledgePoint = db.findById('knowledgePoints', knowledgePointId);
  if (!knowledgePoint) {
    return [];
  }

  const weakSummary = buildWeakPointSummary(studentId);
  const matchedWeak = weakSummary.find(item => item.id === knowledgePointId);
  const masteryRate = matchedWeak ? parseInt(matchedWeak.masteryRate || 0, 10) : 100;

  const specificQuestions = buildKnowledgePointSpecificQuestions(knowledgePoint, masteryRate);

  const existingQuestions = db.find('questions')
    .filter(question => {
      return Array.isArray(question.knowledgePoints) && question.knowledgePoints.includes(knowledgePointId);
    })
    .map(question => ({
      ...question,
      answerDisplay: question.type === 'choice'
        ? buildChoiceDisplay(question, question.answer)
        : (question.answer || '-')
    }));

  const mergedQuestions = specificQuestions.concat(
    existingQuestions.filter(question => !specificQuestions.some(item => item.content === question.content))
  );

  const targetLevel = masteryRate < 40 ? 35 : (masteryRate < 60 ? 60 : 85);

  return mergedQuestions
    .slice()
    .sort((a, b) => {
      const scoreA = Math.abs((a.difficulty === 'easy' ? 35 : a.difficulty === 'medium' ? 60 : 85) - targetLevel);
      const scoreB = Math.abs((b.difficulty === 'easy' ? 35 : b.difficulty === 'medium' ? 60 : 85) - targetLevel);
      return scoreA - scoreB;
    })
    .slice(0, Math.max(3, Math.min(6, masteryRate < 40 ? 5 : masteryRate < 60 ? 4 : 3)));
}

function syncWrongQuestionStatusFromPractice(studentId, questionResults, practiceRecord, mode) {
  questionResults.forEach(item => {
    if (item.correct) {
      const existed = db.findOne('masteredWrongQuestions', {
        studentId,
        questionId: item.questionId
      });

      if (!existed) {
        db.create('masteredWrongQuestions', {
          studentId,
          questionId: item.questionId,
          masteredAt: new Date().toISOString(),
          sourceRecordId: practiceRecord.id,
          mode
        });
      } else {
        db.updateById('masteredWrongQuestions', existed.id, {
          masteredAt: new Date().toISOString(),
          sourceRecordId: practiceRecord.id,
          mode
        });
      }
    } else {
      markWrongQuestionAsActive(studentId, item.questionId);
    }
  });
}

function buildWeakPointSummary(studentId) {
  const wrongEntries = getWrongQuestionEntries(studentId);
  const practiceRecords = db.find('learningRecords').filter(item => item.studentId === studentId);
  const knowledgePoints = db.find('knowledgePoints');

  return knowledgePoints.map(item => {
    const relatedWrongQuestions = wrongEntries.filter(question => {
      return Array.isArray(question.knowledgePoints) && question.knowledgePoints.includes(item.id);
    });

    const activeWrongQuestions = relatedWrongQuestions.filter(question => !question.mastered);

    const relatedPracticeRecords = practiceRecords.filter(record => {
      return Array.isArray(record.knowledgePointChanges) && record.knowledgePointChanges.some(change => change.knowledgePointId === item.id);
    });

    const latestPracticeChange = relatedPracticeRecords
      .slice()
      .sort((a, b) => new Date(b.createdAt || b.updatedAt || 0) - new Date(a.createdAt || a.updatedAt || 0))
      .map(record => {
        return (record.knowledgePointChanges || []).find(change => change.knowledgePointId === item.id);
      })
      .find(Boolean) || null;

    let masteryRate = latestPracticeChange ? latestPracticeChange.masteryAfter : 100;

    if (activeWrongQuestions.length > 0) {
      const penalty = activeWrongQuestions.length * 15;
      masteryRate = Math.min(masteryRate, Math.max(20, 55 - penalty + activeWrongQuestions.length * 5));
    }

    if (!latestPracticeChange && relatedWrongQuestions.length > 0 && activeWrongQuestions.length === 0) {
      masteryRate = 80;
    }

    if (activeWrongQuestions.length > 0) {
      masteryRate = Math.min(masteryRate, 59);
    }

    const practiceCount = buildKnowledgePointSpecificQuestions(item, masteryRate).length + db.find('questions').filter(question => {
      return Array.isArray(question.knowledgePoints) && question.knowledgePoints.includes(item.id);
    }).length;

    return {
      id: item.id,
      name: item.name,
      description: item.description || '',
      masteryRate,
      wrongCount: activeWrongQuestions.length,
      totalWrongCount: relatedWrongQuestions.length,
      practiceCount,
      hasNewRecommendation: activeWrongQuestions.length > 0,
      improved: masteryRate >= 60,
      lastHomeworkAt: relatedWrongQuestions.length
        ? relatedWrongQuestions[0].submittedAt || relatedWrongQuestions[0].createdAt || ''
        : ''
    };
  }).sort((a, b) => a.masteryRate - b.masteryRate);
}

function buildChatPracticeData(studentId, knowledgePointId) {
  const knowledgePoint = db.findById('knowledgePoints', knowledgePointId);
  const weakSummary = buildWeakPointSummary(studentId);
  const currentWeak = weakSummary.find(item => item.id === knowledgePointId);
  const candidateQuestions = ensurePracticeQuestionsForKnowledgePoint(studentId, knowledgePointId);

  const relatedKnowledgePoints = weakSummary
    .filter(item => item.id === knowledgePointId || item.masteryRate < 80 || item.wrongCount > 0)
    .slice(0, 6)
    .map(item => ({
      id: item.id,
      name: item.name,
      description: item.description || '',
      masteryRate: item.masteryRate,
      wrongCount: item.wrongCount,
      questionCount: ensurePracticeQuestionsForKnowledgePoint(studentId, item.id).length,
      hasNewRecommendation: item.wrongCount > 0 || item.masteryRate < 60
    }));

  return {
    openingMessage: knowledgePoint
      ? `当前聚焦知识点：${knowledgePoint.name}，系统已根据你当前掌握度 ${currentWeak ? currentWeak.masteryRate : 100}% 推送个性化补练。`
      : '请选择知识点开始练习。',
    knowledgePoint,
    candidateQuestions,
    relatedKnowledgePoints
  };
}

// 学生作业列表
router.get('/assignments', (req, res) => {
  try {
    const studentId = req.headers['x-user-id'];
    const student = getStudentByUserId(studentId);

    if (!student) {
      return res.status(404).json({ success: false, message: '学生不存在' });
    }

    const { status } = req.query;

    const assignments = db.find('assignments').filter(assignment => {
      if (Array.isArray(assignment.studentIds) && assignment.studentIds.length) {
        return assignment.studentIds.includes(student.id);
      }
      return assignment.classId === student.classId;
    });

    const result = assignments.map(assignment => {
      const paper = db.findById('papers', assignment.paperId);
      const latestAnswer = getLatestAnswerByAssignmentAndStudent(assignment.id, student.id);

      return {
        ...assignment,
        paperTitle: paper ? paper.title : '题库组卷',
        questionCount:
          paper && Array.isArray(paper.questions)
            ? paper.questions.length
            : (Array.isArray(assignment.questionIds) ? assignment.questionIds.length : 0),
        submitted: !!latestAnswer,
        score: latestAnswer ? latestAnswer.totalScore : undefined
      };
    });

    const filtered = status === 'pending'
      ? result.filter(item => !item.submitted)
      : status === 'completed'
        ? result.filter(item => item.submitted)
        : result;

    res.json({ success: true, data: filtered });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/learning-track', (req, res) => {
  try {
    const studentId = req.headers['x-user-id'];
    const student = getStudentByUserId(studentId);

    if (!student) {
      return res.status(404).json({ success: false, message: '学生不存在' });
    }

    const homeworkRecords = db.find('answers')
      .filter(item => item.studentId === student.id)
      .map(item => {
        const assignment = db.findById('assignments', item.assignmentId);
        const paper = assignment ? db.findById('papers', assignment.paperId) : null;
        const questionResults = Array.isArray(item.questionResults) ? item.questionResults : [];
        const correctCount = questionResults.filter(result => result.correct).length;
        const totalCount = questionResults.length;
        const correctRate = totalCount ? Math.round(correctCount / totalCount * 100) : 0;

        return {
          id: item.id,
          date: item.submittedAt || item.createdAt,
          recordType: 'homework',
          assignmentTitle: assignment ? assignment.title : '作业记录',
          paperTitle: paper ? paper.title : '题库组卷',
          status: item.status || 'submitted',
          score: item.totalScore || 0,
          correctRate,
          masteryAfter: correctRate
        };
      });

    const practiceRecords = db.find('learningRecords')
      .filter(item => item.studentId === student.id)
      .map(item => {
        const questionResults = Array.isArray(item.questionResults) ? item.questionResults : [];
        const correctCount = questionResults.filter(result => result.correct).length;
        const totalCount = questionResults.length;
        const correctRate = totalCount ? Math.round(correctCount / totalCount * 100) : 0;
        const firstKp = Array.isArray(item.knowledgePointChanges) && item.knowledgePointChanges.length
          ? item.knowledgePointChanges[0]
          : null;

        return {
          id: item.id,
          date: item.createdAt || item.submittedAt,
          recordType: 'practice',
          assignmentTitle: item.title || '个性化补练',
          paperTitle: firstKp ? firstKp.knowledgePointName : '专项练习',
          status: item.status || 'completed',
          score: item.totalScore || 0,
          correctRate,
          masteryAfter: firstKp ? firstKp.masteryAfter : correctRate
        };
      });

    const data = homeworkRecords.concat(practiceRecords)
      .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/assignments/:id/questions', (req, res) => {
  try {
    const studentId = req.headers['x-user-id'];
    const student = getStudentByUserId(studentId);
    const { id } = req.params;

    if (!student) {
      return res.status(404).json({ success: false, message: '学生不存在' });
    }

    const assignment = db.findById('assignments', id);
    if (!assignment) {
      return res.status(404).json({ success: false, message: '作业不存在' });
    }

    const allowed = Array.isArray(assignment.studentIds) && assignment.studentIds.length
      ? assignment.studentIds.includes(student.id)
      : assignment.classId === student.classId;

    if (!allowed) {
      return res.status(403).json({ success: false, message: '无权查看该作业' });
    }

    const paper = assignment.paperId ? db.findById('papers', assignment.paperId) : null;
    const questionIds = paper && Array.isArray(paper.questions)
      ? paper.questions
      : (Array.isArray(assignment.questionIds) ? assignment.questionIds : []);

    const questions = questionIds
      .map(questionId => db.findById('questions', questionId))
      .filter(Boolean);

    res.json({
      success: true,
      data: {
        assignment: {
          ...assignment,
          title: assignment.title || '作业',
          paperTitle: paper ? paper.title : '题库组卷'
        },
        questions
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/assignments/:id/latest-answer', (req, res) => {
  try {
    const studentId = req.headers['x-user-id'];
    const student = getStudentByUserId(studentId);
    const { id } = req.params;

    if (!student) {
      return res.status(404).json({ success: false, message: '学生不存在' });
    }

    const latestAnswer = getLatestAnswerByAssignmentAndStudent(id, student.id);
    if (!latestAnswer) {
      return res.json({ success: true, data: null });
    }

    res.json({ success: true, data: { answerId: latestAnswer.id } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/answers/:id', (req, res) => {
  try {
    const studentId = req.headers['x-user-id'];
    const student = getStudentByUserId(studentId);
    const { id } = req.params;

    if (!student) {
      return res.status(404).json({ success: false, message: '学生不存在' });
    }

    const answerRecord = db.findById('answers', id);
    if (!answerRecord || answerRecord.studentId !== student.id) {
      return res.status(404).json({ success: false, message: '答题记录不存在' });
    }

    const questions = (answerRecord.questionResults || []).map(item => {
      const question = db.findById('questions', item.questionId) || {};
      return {
        questionId: item.questionId,
        answer: item.answer || '',
        correct: !!item.correct,
        score: item.score || 0,
        correctAnswer: question.type === 'choice'
          ? buildChoiceDisplay(question, question.answer)
          : (question.answer || '')
      };
    });

    res.json({ success: true, data: { ...answerRecord, questions } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 薄弱知识点
router.get('/weak-points', (req, res) => {
  try {
    const studentId = req.headers['x-user-id'];
    const student = getStudentByUserId(studentId);

    if (!student) {
      return res.status(404).json({ success: false, message: '学生不存在' });
    }

    res.json({ success: true, data: buildWeakPointSummary(student.id) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 错题本
router.get('/wrong-questions', (req, res) => {
  try {
    const studentId = req.headers['x-user-id'];
    const student = getStudentByUserId(studentId);

    if (!student) {
      return res.status(404).json({ success: false, message: '学生不存在' });
    }

    res.json({ success: true, data: getWrongQuestionEntries(student.id) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 个性化补练推荐
router.get('/practice-recommendations', (req, res) => {
  try {
    const studentId = req.headers['x-user-id'];
    const student = getStudentByUserId(studentId);

    if (!student) {
      return res.status(404).json({ success: false, message: '学生不存在' });
    }

    const recommendations = buildWeakPointSummary(student.id)
      .filter(item => item.wrongCount > 0 || item.masteryRate < 80)
      .slice(0, 6)
      .map(item => ({
        knowledgePointId: item.id,
        knowledgePointName: item.name,
        masteryRate: item.masteryRate,
        wrongCount: item.wrongCount,
        questionCount: ensurePracticeQuestionsForKnowledgePoint(student.id, item.id).length,
        hasNewRecommendation: item.hasNewRecommendation
      }));

    res.json({ success: true, data: recommendations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取补练题 / 错题重做题
router.get('/practice/:knowledgePointId', (req, res) => {
  try {
    const studentId = req.headers['x-user-id'];
    const student = getStudentByUserId(studentId);
    const { knowledgePointId } = req.params;
    const { questionId } = req.query;

    if (!student) {
      return res.status(404).json({ success: false, message: '学生不存在' });
    }

    const wrongQuestions = getWrongQuestionEntries(student.id);
    const wrongQuestion = questionId ? wrongQuestions.find(item => item.id === questionId) : null;

    let questions = [];
    let mode = 'weak-point';
    let title = '知识点专项补练';

    if (wrongQuestion) {
      questions = [wrongQuestion];
      mode = 'wrong-question';
      title = '错题重做';
    } else if (knowledgePointId && knowledgePointId !== 'custom') {
      questions = ensurePracticeQuestionsForKnowledgePoint(student.id, knowledgePointId);

      const kp = db.findById('knowledgePoints', knowledgePointId);
      if (kp) {
        title = `${kp.name} · 个性化补练`;
      }
    }

    const latestPractice = db.find('learningRecords')
      .filter(record => {
        return (
          record.studentId === student.id &&
          record.recordType === 'practice' &&
          record.knowledgePointId === knowledgePointId
        );
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;

    res.json({
      success: true,
      data: {
        mode,
        title,
        knowledgePointId,
        latestPractice,
        chatPractice:
          knowledgePointId && knowledgePointId !== 'custom'
            ? buildChatPracticeData(student.id, knowledgePointId)
            : null,
        questions
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
    const { knowledgePointId } = req.params;
    const { answers, questionIds, mode, title } = req.body;

    if (!student) {
      return res.status(404).json({ success: false, message: '学生不存在' });
    }

    const targetQuestionIds =
      Array.isArray(questionIds) && questionIds.length
        ? questionIds
        : Object.keys(answers || {});

    const payload = calculateAnswerPayload(targetQuestionIds, answers || {});
    const practiceQuestions = targetQuestionIds
      .map(id => {
        const question = db.findById('questions', id);
        if (question) return question;
        return {
          id,
          knowledgePoints: [deriveKnowledgePointId({ id, content: '', knowledgePoints: [] }, knowledgePointId)],
          content: '',
          type: 'fill'
        };
      })
      .filter(Boolean);

    const knowledgePointChanges = buildPracticeKnowledgePointChanges(
      practiceQuestions,
      payload.questionResults,
      knowledgePointId === 'custom' ? null : knowledgePointId
    );

    const practiceRecord = createLearningRecord({
      studentId: student.id,
      title: title || '个性化补练',
      knowledgePointId,
      recordType: 'practice',
      mode: mode || 'weak-point',
      questionIds: targetQuestionIds,
      questionResults: payload.questionResults,
      totalScore: payload.totalScore,
      status: payload.hasSubjectiveQuestions ? 'pending_review' : 'completed',
      allCorrect: payload.questionResults.length > 0 && payload.questionResults.every(item => item.correct),
      knowledgePointChanges
    });

    syncWrongQuestionStatusFromPractice(
      student.id,
      payload.questionResults,
      practiceRecord,
      mode || 'weak-point'
    );

    res.json({
      success: true,
      message: '练习提交成功',
      data: {
        ...practiceRecord,
        questionResults: payload.questionResults,
        knowledgePointChanges
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/assignments/:id/submit', (req, res) => {
  try {
    const studentId = req.headers['x-user-id'];
    const student = getStudentByUserId(studentId);
    const { id } = req.params;
    const { answers } = req.body;

    if (!student) {
      return res.status(404).json({ success: false, message: '学生不存在' });
    }

    const assignment = db.findById('assignments', id);
    if (!assignment) {
      return res.status(404).json({ success: false, message: '作业不存在' });
    }

    const paper = assignment.paperId ? db.findById('papers', assignment.paperId) : null;
    const questionIds = paper && Array.isArray(paper.questions)
      ? paper.questions
      : (Array.isArray(assignment.questionIds) ? assignment.questionIds : []);

    const payload = calculateAnswerPayload(questionIds, answers || {});

    const answerRecord = db.create('answers', {
      assignmentId: assignment.id,
      paperId: assignment.paperId || '',
      classId: assignment.classId || '',
      studentId: student.id,
      questionResults: payload.questionResults,
      totalScore: payload.totalScore,
      status: payload.hasSubjectiveQuestions ? 'submitted' : 'graded',
      submittedAt: new Date().toISOString(),
      recordType: 'homework',
      knowledgePointScores: payload.knowledgePointScores
    });

    payload.questionResults.forEach(item => {
      if (!item.correct) {
        markWrongQuestionAsActive(student.id, item.questionId);
      }
    });

    res.json({ success: true, message: '提交成功', data: { answerId: answerRecord.id } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 标记已掌握
router.post('/wrong-questions/:id/master', (req, res) => {
  try {
    const studentId = req.headers['x-user-id'];
    const student = getStudentByUserId(studentId);
    const { id } = req.params;

    if (!student) {
      return res.status(404).json({ success: false, message: '学生不存在' });
    }

    const existed = db.findOne('masteredWrongQuestions', {
      studentId: student.id,
      questionId: id
    });

    if (existed) {
      db.updateById('masteredWrongQuestions', existed.id, {
        masteredAt: new Date().toISOString()
      });
    } else {
      db.create('masteredWrongQuestions', {
        studentId: student.id,
        questionId: id,
        masteredAt: new Date().toISOString()
      });
    }

    res.json({ success: true, message: '已标记为已掌握' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 标记未掌握
router.post('/wrong-questions/:id/unmaster', (req, res) => {
  try {
    const studentId = req.headers['x-user-id'];
    const student = getStudentByUserId(studentId);
    const { id } = req.params;

    if (!student) {
      return res.status(404).json({ success: false, message: '学生不存在' });
    }

    markWrongQuestionAsActive(student.id, id);
    res.json({ success: true, message: '已标记为待巩固' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 保存错题笔记
router.post('/wrong-questions/:id/note', (req, res) => {
  try {
    const studentId = req.headers['x-user-id'];
    const student = getStudentByUserId(studentId);
    const { id } = req.params;
    const { note } = req.body;

    if (!student) {
      return res.status(404).json({ success: false, message: '学生不存在' });
    }

    const existed = db.findOne('masteredWrongQuestions', {
      studentId: student.id,
      questionId: id
    });

    if (existed) {
      db.updateById('masteredWrongQuestions', existed.id, {
        note: note || ''
      });
    } else {
      db.create('masteredWrongQuestions', {
        studentId: student.id,
        questionId: id,
        note: note || '',
        masteredAt: null
      });
    }

    res.json({ success: true, message: '笔记已保存' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 学习聊天助手
router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: '消息内容不能为空' });
    }

    const settings = db.data.settings || {};
    const apiKey = settings.llmApiKey || process.env.LLM_API_KEY;
    const apiEndpoint = settings.llmApiEndpoint || process.env.LLM_API_ENDPOINT;
    const model = settings.llmModel || process.env.LLM_MODEL || 'gpt-4o-mini';

    if (!apiKey || !apiEndpoint) {
      return res.json({
        success: true,
        data: {
          reply: '当前尚未配置大模型接口，已为你切换到本地学习建议模式：建议先梳理题干条件，再结合错题本回顾易错点。',
          fallback: true
        }
      });
    }

    const response = await axios.post(
      apiEndpoint,
      {
        model,
        messages: [
          { role: 'system', content: '你是一名耐心的初中数学学习助手，请用中文回答。' },
          { role: 'user', content: message }
        ],
        temperature: 0.7
      },
      {
        headers: {
          Authorization: 'Bearer ' + apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const reply =
      response.data &&
      response.data.choices &&
      response.data.choices[0] &&
      response.data.choices[0].message
        ? response.data.choices[0].message.content
        : '暂时没有获取到回复，请稍后重试。';

    res.json({ success: true, data: { reply } });
  } catch (error) {
    res.json({
      success: true,
      data: {
        reply: '智能助教暂时繁忙，建议你先查看知识图谱中的薄弱点，并优先完成对应补练。',
        fallback: true,
        detail: error.message
      }
    });
  }
});

module.exports = router;