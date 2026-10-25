/**
 * 内存数据库
 * 使用 JavaScript 对象模拟数据库操作
 */

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { getDatabase, replaceAllQuestions, loadQuestionsFromStore, getAllQuestions, upsertQuestion, deleteQuestion: deleteQuestionFromStore } = require('./question-store');

const { persistentData, hasBusinessData } = require('./business-store');

// SQLite-backed collections
const db = {
  users: [],
  students: [],
  teachers: [],
  classes: [],
  papers: [],
  questions: [],
  assignments: [],
  answers: [],
  knowledgePoints: [],
  learningRecords: [],
  studentQuestionAttempts: [], // 学生题目掌握记录
  masteredWrongQuestions: [],
  student_answer: [],
  student_knowledge_mastery: [],
  mastery_snapshot: [],
  student_mistake_0: [],
  student_mistake_1: [],
  student_mistake_2: [],
  student_mistake_3: [],
  logs: [],
  drafts: [],
  uploadedFiles: [],
  questionReports: [],
  recommendationLogs: [],
  learningRounds: [],
  controlAssessments: [],
  adaptationDecisions: [],
  learnerPresentationProfiles: [],
  presentationLearningEvidence: [],
  presentationAdjustmentEvents: [],
  teacherSupportRequests: [],
  knowledgeGraphNodes: [],
  knowledgeGraphWrong: [],
  knowledgeGraphRecommend: [],
  settings: {}
};

// 初始化默认数据
function initializeData() {
  // 创建默认管理员
  const adminPassword = bcrypt.hashSync('admin123', 10);
  db.users.push({
    id: 'admin-001',
    username: 'admin',
    password: adminPassword,
    role: 'admin',
    name: '系统管理员',
    email: 'admin@example.com',
    phone: '13800138000',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // 创建默认教师
  const teacherPassword = bcrypt.hashSync('teacher123', 10);
  const teacherId = 'teacher-001';
  db.users.push({
    id: teacherId,
    username: 'teacher',
    password: teacherPassword,
    role: 'teacher',
    name: '张老师',
    email: 'teacher@example.com',
    phone: '13800138001',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  db.teachers.push({
    id: teacherId,
    userId: teacherId,
    name: '张老师',
    subject: '数学',
    classes: [],
    createdAt: new Date().toISOString()
  });

  // 创建10个不同的学生数据
  const students = [
    { id: 'student-001', username: 'student', name: '李明', gender: 'male', score: 95 },
    { id: 'student-002', username: 'student2', name: '王芳', gender: 'female', score: 75 },
    { id: 'student-003', username: 'student3', name: '张伟', gender: 'male', score: 45 },
    { id: 'student-004', username: 'student4', name: '刘洋', gender: 'male', score: 92 },
    { id: 'student-005', username: 'student5', name: '陈静', gender: 'female', score: 88 },
    { id: 'student-006', username: 'student6', name: '赵强', gender: 'male', score: 72 },
    { id: 'student-007', username: 'student7', name: '孙丽', gender: 'female', score: 68 },
    { id: 'student-008', username: 'student8', name: '周杰', gender: 'male', score: 55 },
    { id: 'student-009', username: 'student9', name: '吴敏', gender: 'female', score: 50 },
    { id: 'student-010', username: 'student10', name: '郑华', gender: 'male', score: 85 }
  ];

  students.forEach((student, index) => {
    const password = bcrypt.hashSync('student123', 10);
    db.users.push({
      id: student.id,
      username: student.username,
      password: password,
      role: 'student',
      name: student.name,
      email: `${student.username}@example.com`,
      phone: `138001380${10 + index}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    db.students.push({
      id: student.id,
      userId: student.id,
      name: student.name,
      studentNo: `202400${index + 1}`,
      classId: null,
      gender: student.gender,
      createdAt: new Date().toISOString()
    });
  });

  // 创建默认班级
  const classId = 'class-001';
  const studentIds = students.map(s => s.id);
  db.classes.push({
    id: classId,
    name: '七年级一班',
    grade: '七年级',
    teacherId: teacherId,
    students: studentIds,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // 更新教师和学生的班级信息
  db.teachers[0].classes.push(classId);
  db.students.forEach(student => {
    student.classId = classId;
  });

  // 初始化知识点体系（初中数学）
  const knowledgePoints = [
    { id: 'kp-001', name: '有理数', parentId: null, level: 1, order: 1, description: '正数、负数、有理数的概念' },
    { id: 'kp-002', name: '有理数的加减法', parentId: 'kp-001', level: 2, order: 1, description: '有理数加减法运算' },
    { id: 'kp-003', name: '有理数的乘除法', parentId: 'kp-001', level: 2, order: 2, description: '有理数乘除法运算' },
    { id: 'kp-004', name: '整式的加减', parentId: null, level: 1, order: 2, description: '整式概念及加减运算' },
    { id: 'kp-005', name: '一元一次方程', parentId: null, level: 1, order: 3, description: '一元一次方程的解法' },
    { id: 'kp-006', name: '几何初步', parentId: null, level: 1, order: 4, description: '线段、角的概念' },
    { id: 'kp-007', name: '相交线与平行线', parentId: null, level: 1, order: 5, description: '相交线、平行线的性质' },
    { id: 'kp-008', name: '实数', parentId: null, level: 1, order: 6, description: '无理数、实数的概念' },
    { id: 'kp-009', name: '平面直角坐标系', parentId: null, level: 1, order: 7, description: '坐标系的概念' },
    { id: 'kp-010', name: '二元一次方程组', parentId: null, level: 1, order: 8, description: '二元一次方程组的解法' },
    { id: 'kp-011', name: '不等式与不等式组', parentId: null, level: 1, order: 9, description: '不等式的性质与解法' },
    { id: 'kp-012', name: '数据的收集与整理', parentId: null, level: 1, order: 10, description: '统计初步' }
  ];

  knowledgePoints.forEach(kp => {
    db.knowledgePoints.push({
      ...kp,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  });

  // 系统设置
  db.settings = {
    ocrApiKey: process.env.OCR_API_KEY || '',
    ocrApiSecret: process.env.OCR_API_SECRET || '',
    llmApiKey: process.env.LLM_API_KEY || '',
    llmApiEndpoint: process.env.LLM_API_ENDPOINT || '',
    llmModel: process.env.LLM_MODEL || '',
    maxUploadSize: 10, // MB
    allowedFileTypes: ['jpg', 'jpeg', 'png', 'pdf'],
    systemName: '智析数学',
    logo: '/logo.png',
    adaptiveLearning: {
      enabled: true,
      ruleVersion: 'adaptive-v2.0',
      roundSize: 5,
      varkValidityDays: 7,
      mixedPreferenceGapMax: 0.5,
      controlLowMax: 4,
      controlHighMin: 8,
      perceivedLoadLowMax: 2,
      perceivedLoadHighMin: 4,
      accuracyLowMax: 0.6,
      accuracyHighMin: 0.8,
      enabledKnowledgePointIds: ['alg-1', 'alg-2', 'algebra-3', 'alg-3']
    }
  }

  // 初始化题目数据
  const questions = [
    {
      id: 'q1',
      type: 'choice',
      content: '下列哪个数是有理数？',
      options: ['√2', 'π', '0.5', 'e'],
      answer: '0.5',
      score: 10,
      difficulty: 'easy',
      knowledgePoints: ['kp-001'],
      knowledgePointId: 'kp-001',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'q2',
      type: 'choice',
      content: '3 + (-5) 的结果是？',
      options: ['-2', '2', '8', '-8'],
      answer: '-2',
      score: 10,
      difficulty: 'easy',
      knowledgePoints: ['kp-002'],
      knowledgePointId: 'kp-002',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'q3',
      type: 'fill',
      content: '方程 2x + 3 = 7 的解是 x = ?',
      answer: '2',
      score: 15,
      difficulty: 'medium',
      knowledgePoints: ['kp-005'],
      knowledgePointId: 'kp-005',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'q4',
      type: 'choice',
      content: '下列哪组是平行线？',
      options: ['相交的两条直线', '永不相交的两条直线', '垂直的两条直线', '重合的两条直线'],
      answer: '永不相交的两条直线',
      score: 15,
      difficulty: 'medium',
      knowledgePoints: ['kp-007'],
      knowledgePointId: 'kp-007',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'q5',
      type: 'choice',
      content: '(-3) × (-4) 的结果是？',
      options: ['-12', '12', '-7', '7'],
      answer: '12',
      score: 10,
      difficulty: 'easy',
      knowledgePoints: ['kp-003'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    // 添加主观题（简答题）
    {
      id: 'q6',
      type: 'shortAnswer',
      content: '请简述有理数的定义和性质。',
      answer: '有理数是可以表示为两个整数之比的数，包括整数和分数。性质包括：封闭性、交换律、结合律、分配律等。',
      score: 20,
      difficulty: 'hard',
      knowledgePoints: ['kp-001'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'q7',
      type: 'shortAnswer',
      content: '请解一元一次方程 3x - 5 = 10，并写出详细步骤。',
      answer: '3x - 5 = 10\n3x = 15\nx = 5',
      score: 20,
      difficulty: 'medium',
      knowledgePoints: ['kp-005'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'q8',
      type: 'shortAnswer',
      content: '请解释平行线的定义和性质。',
      answer: '平行线是在同一平面内永不相交的两条直线。性质包括：同位角相等、内错角相等、同旁内角互补等。',
      score: 20,
      difficulty: 'medium',
      knowledgePoints: ['kp-007'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]
  questions.forEach(q => db.questions.push(q))

  db.questions = loadQuestionsFromStore(db.questions);

  // 初始化学生答题记录
  const studentId = 'student-001';
  db.studentQuestionAttempts = [
    {
      studentId: studentId,
      questionId: 'q1',
      correctCount: 5,
      attemptCount: 5,
      lastResult: 'correct',
      lastAnsweredAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      studentId: studentId,
      questionId: 'q2',
      correctCount: 1,
      attemptCount: 4,
      lastResult: 'wrong',
      lastAnsweredAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      studentId: studentId,
      questionId: 'q3',
      correctCount: 0,
      attemptCount: 3,
      lastResult: 'wrong',
      lastAnsweredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];

  // 初始化模拟答题记录
  const now = new Date().toISOString()
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()

  // 创建试卷数据
  db.papers.push({
    id: 'paper-001',
    title: '第一次测试卷',
    teacherId: teacherId,
    classId: classId,
    questions: ['q1', 'q2', 'q3', 'q4', 'q5'],
    status: 'pending',
    createdAt: twoDaysAgo,
    updatedAt: twoDaysAgo
  });

  db.papers.push({
    id: 'paper-002',
    title: '第二次测试卷',
    teacherId: teacherId,
    classId: classId,
    questions: ['q1', 'q2', 'q3', 'q4', 'q5'],
    status: 'pending',
    createdAt: yesterday,
    updatedAt: yesterday
  });

  // 创建模拟作业
  const assignment1 = {
    id: 'assignment-001',
    title: '第一次测试',
    paperId: 'paper-001',
    classId: classId,
    teacherId: teacherId,
    studentIds: studentIds,
    deadline: now,
    type: 'exam',
    level: 'normal',
    status: 'published',
    createdAt: twoDaysAgo,
    updatedAt: twoDaysAgo
  }
  db.assignments.push(assignment1)

  // 创建包含主观题的作业
  const assignment3 = {
    id: 'assignment-003',
    title: '主观题测试',
    paperId: 'paper-003',
    classId: classId,
    teacherId: teacherId,
    studentIds: studentIds,
    deadline: now,
    type: 'exam',
    level: 'normal',
    status: 'published',
    createdAt: twoDaysAgo,
    updatedAt: twoDaysAgo
  }
  db.assignments.push(assignment3)

  // 创建模拟答题记录（包含错题）
  const answer1 = {
    id: 'answer-001',
    assignmentId: assignment1.id,
    paperId: 'paper-001',
    classId: classId,
    studentId: students[0].id,
    submittedAt: yesterday,
    totalScore: 60,
    status: 'graded',
    scores: { 'q1': 10, 'q2': 0, 'q3': 0, 'q4': 15, 'q5': 35 },
    comments: '需要加强有理数的运算',
    gradedBy: teacherId,
    gradedAt: now,
    knowledgePointScores: {
      'kp-001': 100,
      'kp-002': 0,
      'kp-003': 100,
      'kp-005': 0,
      'kp-007': 100
    },
    questionResults: [
      { questionId: 'q1', answer: '0.5', correct: true, score: 10 },
      { questionId: 'q2', answer: '2', correct: false, score: 0 },
      { questionId: 'q3', answer: '3', correct: false, score: 0 },
      { questionId: 'q4', answer: '永不相交的两条直线', correct: true, score: 15 },
      { questionId: 'q5', answer: '12', correct: true, score: 35 }
    ],
    createdAt: yesterday,
    updatedAt: now
  }
  db.answers.push(answer1)

  // 创建第二次模拟作业
  const assignment2 = {
    id: 'assignment-002',
    title: '第二次测试',
    paperId: 'paper-002',
    classId: classId,
    teacherId: teacherId,
    studentIds: studentIds,
    deadline: now,
    type: 'exam',
    level: 'normal',
    status: 'published',
    createdAt: yesterday,
    updatedAt: yesterday
  }
  db.assignments.push(assignment2)

  // 创建第二次模拟答题记录（包含错题）
  const answer2 = {
    id: 'answer-002',
    assignmentId: assignment2.id,
    paperId: 'paper-002',
    classId: classId,
    studentId: students[0].id,
    submittedAt: now,
    totalScore: 95,
    status: 'graded',
    scores: { 'q1': 10, 'q2': 10, 'q3': 15, 'q4': 15, 'q5': 45 },
    comments: '表现优秀',
    gradedBy: teacherId,
    gradedAt: now,
    knowledgePointScores: {
      'kp-001': 100,
      'kp-002': 100,
      'kp-003': 100,
      'kp-005': 100,
      'kp-007': 100
    },
    questionResults: [
      { questionId: 'q1', answer: '0.5', correct: true, score: 10 },
      { questionId: 'q2', answer: '-2', correct: true, score: 10 },
      { questionId: 'q3', answer: '2', correct: true, score: 15 },
      { questionId: 'q4', answer: '永不相交的两条直线', correct: true, score: 15 },
      { questionId: 'q5', answer: '12', correct: true, score: 45 }
    ],
    createdAt: now,
    updatedAt: now
  }
  db.answers.push(answer2)

  // 为王芳（中等层次）创建答题记录
  const answer3 = {
    id: 'answer-003',
    assignmentId: assignment1.id,
    paperId: 'paper-001',
    classId: classId,
    studentId: students[1].id,
    submittedAt: yesterday,
    totalScore: 75,
    status: 'graded',
    scores: { 'q1': 10, 'q2': 10, 'q3': 15, 'q4': 15, 'q5': 25 },
    comments: '表现良好',
    gradedBy: teacherId,
    gradedAt: now,
    knowledgePointScores: {
      'kp-001': 100,
      'kp-002': 100,
      'kp-003': 100,
      'kp-005': 50,
      'kp-007': 100
    },
    questionResults: [
      { questionId: 'q1', answer: '0.5', correct: true, score: 10 },
      { questionId: 'q2', answer: '-2', correct: true, score: 10 },
      { questionId: 'q3', answer: '2', correct: true, score: 15 },
      { questionId: 'q4', answer: '永不相交的两条直线', correct: true, score: 15 },
      { questionId: 'q5', answer: '-12', correct: false, score: 25 }
    ],
    createdAt: yesterday,
    updatedAt: now
  }
  db.answers.push(answer3)

  // 为张伟（薄弱层次）创建答题记录
  const answer4 = {
    id: 'answer-004',
    assignmentId: assignment1.id,
    paperId: 'paper-001',
    classId: classId,
    studentId: students[2].id,
    submittedAt: yesterday,
    totalScore: 45,
    status: 'graded',
    scores: { 'q1': 0, 'q2': 0, 'q3': 0, 'q4': 15, 'q5': 30 },
    comments: '需要加强基础知识',
    gradedBy: teacherId,
    gradedAt: now,
    knowledgePointScores: {
      'kp-001': 0,
      'kp-002': 0,
      'kp-003': 100,
      'kp-005': 0,
      'kp-007': 100
    },
    questionResults: [
      { questionId: 'q1', answer: '√2', correct: false, score: 0 },
      { questionId: 'q2', answer: '2', correct: false, score: 0 },
      { questionId: 'q3', answer: '3', correct: false, score: 0 },
      { questionId: 'q4', answer: '永不相交的两条直线', correct: true, score: 15 },
      { questionId: 'q5', answer: '12', correct: true, score: 30 }
    ],
    createdAt: yesterday,
    updatedAt: now
  }
  db.answers.push(answer4)

  // 为其他学生创建答题记录
  const otherStudents = students.slice(3); // 跳过前3个已创建记录的学生
  otherStudents.forEach((student, index) => {
    const answerId = `answer-00${5 + index}`;
    const answer = {
      id: answerId,
      assignmentId: assignment1.id,
      paperId: 'paper-001',
      classId: classId,
      studentId: student.id,
      submittedAt: yesterday,
      totalScore: student.score,
      status: 'graded',
      scores: { 'q1': 10, 'q2': 10, 'q3': 15, 'q4': 15, 'q5': 50 },
      comments: student.score >= 90 ? '表现优秀' : student.score >= 60 ? '表现良好' : '需要加强',
      gradedBy: teacherId,
      gradedAt: now,
      knowledgePointScores: {
        'kp-001': student.score >= 80 ? 100 : 50,
        'kp-002': student.score >= 80 ? 100 : 50,
        'kp-003': student.score >= 80 ? 100 : 50,
        'kp-005': student.score >= 80 ? 100 : 50,
        'kp-007': student.score >= 80 ? 100 : 50
      },
      questionResults: [
        { questionId: 'q1', answer: '0.5', correct: student.score >= 80, score: student.score >= 80 ? 10 : 0 },
        { questionId: 'q2', answer: '-2', correct: student.score >= 80, score: student.score >= 80 ? 10 : 0 },
        { questionId: 'q3', answer: '2', correct: student.score >= 80, score: student.score >= 80 ? 15 : 0 },
        { questionId: 'q4', answer: '永不相交的两条直线', correct: student.score >= 60, score: student.score >= 60 ? 15 : 0 },
        { questionId: 'q5', answer: '12', correct: student.score >= 60, score: student.score >= 60 ? 50 : 30 }
      ],
      createdAt: yesterday,
      updatedAt: now
    };
    db.answers.push(answer);
  });

  // 创建包含主观题的试卷
  db.papers.push({
    id: 'paper-003',
    title: '主观题测试卷',
    teacherId: teacherId,
    classId: classId,
    questions: ['q6', 'q7', 'q8'],
    status: 'pending',
    createdAt: twoDaysAgo,
    updatedAt: twoDaysAgo
  });

  // 为李明创建包含主观题的答题记录（需要手动批改）
  const answerSubjective1 = {
    id: 'answer-011',
    assignmentId: assignment3.id,
    paperId: 'paper-003',
    classId: classId,
    studentId: students[0].id,
    submittedAt: now,
    totalScore: 0,
    status: 'submitted',
    knowledgePointScores: {
      'kp-001': 0,
      'kp-005': 0,
      'kp-007': 0
    },
    questionResults: [
      {
        questionId: 'q6',
        answer: '有理数是整数和分数的统称，可以表示为两个整数的比值。',
        correct: false,
        score: 0,
        questionType: 'shortAnswer'
      },
      {
        questionId: 'q7',
        answer: '3x - 5 = 10\n3x = 15\nx = 5',
        correct: true,
        score: 0,
        questionType: 'shortAnswer'
      },
      {
        questionId: 'q8',
        answer: '平行线是永远不会相交的直线。',
        correct: false,
        score: 0,
        questionType: 'shortAnswer'
      }
    ],
    createdAt: now,
    updatedAt: now
  };
  db.answers.push(answerSubjective1);

  // 为王芳创建包含主观题的答题记录（需要手动批改）
  const answerSubjective2 = {
    id: 'answer-012',
    assignmentId: assignment3.id,
    paperId: 'paper-003',
    classId: classId,
    studentId: students[1].id,
    submittedAt: now,
    totalScore: 0,
    status: 'submitted',
    knowledgePointScores: {
      'kp-001': 0,
      'kp-005': 0,
      'kp-007': 0
    },
    questionResults: [
      {
        questionId: 'q6',
        answer: '有理数包括整数和分数，它们可以用分数形式表示。',
        correct: false,
        score: 0,
        questionType: 'shortAnswer'
      },
      {
        questionId: 'q7',
        answer: '3x - 5 = 10\n3x = 15\nx = 5',
        correct: true,
        score: 0,
        questionType: 'shortAnswer'
      },
      {
        questionId: 'q8',
        answer: '平行线在同一平面内不相交，同位角相等。',
        correct: false,
        score: 0,
        questionType: 'shortAnswer'
      }
    ],
    createdAt: now,
    updatedAt: now
  };
  db.answers.push(answerSubjective2);

  console.log('数据库初始化完成');

}

// 数据库操作类
class Database {
  constructor() {
    this._version = 1;
    this._idIndexes = new Map();
    this._idIndexVersion = -1;
    this.data = persistentData(db);
    this.data.questions = loadQuestionsFromStore([]);
    if (process.env.NODE_ENV === 'production' && this.data.users.some(user => !user.disabled && ['admin123', 'teacher123', 'student123', '123456'].some(password => bcrypt.compareSync(password, user.password)))) throw new Error('生产环境禁止默认密码，请使用独立 DATA_DIR 初始化，或先重设现有账号密码');
  }

  transaction(work) {
    const sql = getDatabase();
    const snapshot = JSON.stringify(this.data);
    sql.exec('BEGIN IMMEDIATE');
    try { const result = work(); sql.exec('COMMIT'); return result; }
    catch (error) {
      sql.exec('ROLLBACK');
      const restored = JSON.parse(snapshot);
      this.data = persistentData(restored);
      this.data.questions = restored.questions;
      throw error;
    }
  }

  restore(data) {
    if (!data || !Array.isArray(data.users) || !data.users.some(user => user.role === 'admin')) throw new Error('备份必须包含管理员账号');
    if (new Set(data.users.map(user => user.id)).size !== data.users.length || new Set(data.users.map(user => user.username)).size !== data.users.length || data.users.some(user => !user.id || !user.username || !['admin','teacher','student'].includes(user.role) || !/^\$2[aby]\$/.test(user.password || ''))) throw new Error('备份账号无效或重复');
    if (!data.users.some(user => user.role === 'admin' && !user.disabled)) throw new Error('备份中至少需要一个可用管理员');
    if (!data.settings || typeof data.settings !== 'object' || Array.isArray(data.settings)) throw new Error('备份必须包含系统配置');
    for (const [name, value] of Object.entries(data)) {
      if (!Object.hasOwn(this.data, name) || name === '__proto__') throw new Error('未知的数据集合：' + name);
      if (name !== 'settings' && !Array.isArray(value)) throw new Error('无效的数据集合：' + name);
      if (Array.isArray(value) && value.some(item => !item || typeof item !== 'object')) throw new Error('数据集合记录格式无效：' + name);
    }
    return this.transaction(() => {
      for (const [name, value] of Object.entries(data)) this.data[name] = value;
      getDatabase().prepare('DELETE FROM questions').run();
      this.data.questions.forEach(question => upsertQuestion(question));
      this.touch();
    });
  }

  // 数据版本号：任何写操作自增，供上层做缓存失效判断
  get version() {
    return this._version;
  }

  touch() {
    this._version += 1;
  }

  reloadQuestionsFromStore() {
    this.data.questions = getAllQuestions();
    this.touch();
    return this.data.questions;
  }

  persistCollection(collection, payload) {
    if (collection !== 'questions') {
      return;
    }

    if (payload && payload.type === 'delete') {
      deleteQuestionFromStore(payload.id);
      return;
    }

    if (payload && payload.item) {
      upsertQuestion(payload.item);
    }
  }

  // 通用 CRUD 操作
  create(collection, item) {
    if (!Array.isArray(this.data[collection])) throw new Error('数据集合不存在');
    if (item.id && this.data[collection].some(existing => existing.id === item.id)) throw new Error('记录编号重复');
    if (collection === 'users' && this.data.users.some(user => user.username === item.username)) throw new Error('用户名已存在');
    const newItem = {
      ...item,
      id: item.id || uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.data[collection].push(newItem);
    this.persistCollection(collection, { item: newItem });
    this.touch();
    return newItem;
  }

  // 按 id 的索引：findById 原先每次都全表 find()（含逐条权限判断），
  // 列表接口里动辄上千次调用。这里按数据版本缓存 Map<id, record>。
  idIndex(collection) {
    if (this._idIndexVersion !== this._version) {
      this._idIndexes = new Map();
      this._idIndexVersion = this._version;
    }
    let map = this._idIndexes.get(collection);
    if (!map) {
      map = new Map();
      for (const item of this.data[collection] || []) {
        if (!item || item.id === undefined || item.id === null) continue;
        if (!map.has(item.id)) map.set(item.id, item);
      }
      this._idIndexes.set(collection, map);
    }
    return map;
  }

  findById(collection, id) {
    const item = this.idIndex(collection).get(id);
    if (!item) return undefined;
    return require('../middleware/access').allowedRecord(collection, item) ? item : undefined;
  }

  find(collection, query = {}) {
    return (this.data[collection] || []).filter(item => require('../middleware/access').allowedRecord(collection, item)).filter(item => {
      return Object.keys(query).every(key => item[key] === query[key]);
    });
  }

  findOne(collection, query = {}) {
    return this.find(collection).find(item => {
      return Object.keys(query).every(key => item[key] === query[key]);
    });
  }

  updateById(collection, id, updates) {
    if (!this.findById(collection, id)) return null;
    const index = this.data[collection].findIndex(item => item.id === id);
    if (index === -1) return null;

    if (collection === 'users' && updates.username && this.data.users.some(user => user.id !== id && user.username === updates.username)) throw new Error('用户名已存在');
    this.data[collection][index] = {
      ...this.data[collection][index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.persistCollection(collection, { item: this.data[collection][index] });
    this.touch();
    return this.data[collection][index];
  }

  deleteById(collection, id) {
    if (!this.findById(collection, id)) return false;
    const index = this.data[collection].findIndex(item => item.id === id);
    if (index === -1) return false;

    const removed = this.data[collection][index];
    this.data[collection].splice(index, 1);
    this.persistCollection(collection, { type: 'delete', id: removed.id });
    this.touch();
    return true;
  }

  delete(collection, query = {}) {
    const initialLength = this.data[collection].length;
    this.data[collection] = this.data[collection].filter(item => {
      return !Object.keys(query).every(key => item[key] === query[key]);
    });
    if (initialLength !== this.data[collection].length && collection === 'questions') replaceAllQuestions(this.data.questions);
    if (initialLength !== this.data[collection].length) this.touch();
    return initialLength - this.data[collection].length;
  }

  count(collection, query = {}) {
    return this.find(collection, query).length;
  }

  // 分页查询
  paginate(collection, query = {}, page = 1, pageSize = 10, sortField = 'createdAt', sortOrder = 'desc') {
    const items = this.find(collection, query);

    // 排序
    items.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });

    const total = items.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    return {
      data: items.slice(start, end),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  // 聚合操作
  aggregate(collection, pipeline) {
    // 简化版的聚合实现
    let result = [...this.data[collection]];

    for (const stage of pipeline) {
      if (stage.$match) {
        result = result.filter(item => {
          return Object.keys(stage.$match).every(key => {
            const condition = stage.$match[key];
            if (typeof condition === 'object' && condition.$eq) {
              return item[key] === condition.$eq;
            }
            return item[key] === condition;
          });
        });
      }
      if (stage.$group) {
        // 简化的分组实现
        const groups = {};
        result.forEach(item => {
          const groupKey = stage.$group._id ? item[stage.$group._id.replace('$', '')] : 'all';
          if (!groups[groupKey]) {
            groups[groupKey] = [];
          }
          groups[groupKey].push(item);
        });
        result = Object.entries(groups).map(([key, items]) => ({
          _id: key,
          count: items.length
        }));
      }
    }

    return result;
  }

  // 日志记录
  addLog(userId, action, details) {
    this.data.logs.push({
      id: uuidv4(),
      userId,
      action,
      details: JSON.parse(JSON.stringify(details || {}, (key, value) => /password|secret|apiKey|authorization|token/i.test(key) ? '[FILTERED]' : value)),
      timestamp: new Date().toISOString()
    });
  }

  get settings() {
    return this.data.settings;
  }

  set settings(value) {
    this.data.settings = value;
  }
}

// 初始化数据
Database.prototype.getMistakeShardCollection = function(studentId) {
  const digits = String(studentId || '').replace(/\D/g, '');
  const num = digits ? parseInt(digits, 10) : 0;
  return `student_mistake_${num % 4}`;
};

Database.prototype.getAllMistakesForStudent = function(studentId) {
  return [0, 1, 2, 3]
    .flatMap(index => this.data[`student_mistake_${index}`] || [])
    .filter(item => item.studentId === studentId)
    .sort((a, b) => new Date(b.lastPracticeTime || b.createdAt || 0) - new Date(a.lastPracticeTime || a.createdAt || 0));
};

Database.prototype.upsertStudentMistake = function(studentId, payload) {
  const collection = this.getMistakeShardCollection(studentId);
  const existing = (this.data[collection] || []).find(item => item.studentId === studentId && item.questionId === payload.questionId);
  if (existing) {
    return this.updateById(collection, existing.id, payload);
  }
  return this.create(collection, { studentId, ...payload });
};

Database.prototype.resolveStudentMistake = function(studentId, questionId) {
  const collection = this.getMistakeShardCollection(studentId);
  const existing = (this.data[collection] || []).find(item => item.studentId === studentId && item.questionId === questionId);
  if (!existing) return null;

  const currentStatus = String(existing.masteryStatus || '待强化');
  let nextStatus = '已掌握';
  if (currentStatus === '待强化') nextStatus = '待巩固';
  else if (currentStatus === '待巩固' || currentStatus === '学习中') nextStatus = '已掌握';

  return this.updateById(collection, existing.id, {
    masteryStatus: nextStatus,
    isResolved: nextStatus === '已掌握',
    lastPracticeTime: new Date().toISOString()
  });
};

if (!hasBusinessData()) {
  initializeData();
  for (const name of ['answers', 'assignments', 'papers', 'learningRecords', 'studentQuestionAttempts', 'masteredWrongQuestions', 'student_answer', 'student_knowledge_mastery', 'mastery_snapshot', 'student_mistake_0', 'student_mistake_1', 'student_mistake_2', 'student_mistake_3', 'logs']) db[name] = [];
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 12) throw new Error('Production requires ADMIN_PASSWORD with at least 12 characters');
    db.users = db.users.filter(user => user.role === 'admin');
    db.users[0].password = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 12);
    db.students = []; db.teachers = []; db.classes = [];
  }
}

// 导出数据库实例
const database = new Database();
module.exports = database;
