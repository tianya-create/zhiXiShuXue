/**
 * 内存数据库
 * 使用 JavaScript 对象模拟数据库操作
 */

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { loadQuestionsFromStore, getAllQuestions, upsertQuestion, deleteQuestion: deleteQuestionFromStore } = require('./question-store');
const store = require('./persistent-store');

/**
 * 首次初始化时的默认账号密码
 * 不再硬编码明文（源码公开，硬编码等于公开密码）：
 * - 可用环境变量指定：INIT_ADMIN_PASSWORD / INIT_TEACHER_PASSWORD / INIT_STUDENT_PASSWORD
 * - 未指定则随机生成，仅在首次启动日志中打印一次
 */
const generatedCredentials = [];

function generatePassword(length = 12) {
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

function resolveInitialPassword(envKey, label) {
  const fromEnv = process.env[envKey];
  if (fromEnv && String(fromEnv).trim()) {
    return String(fromEnv).trim();
  }
  const plain = generatePassword(12);
  generatedCredentials.push({ label, plain });
  return plain;
}

// 内存存储
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
  settings: {}
};

// 初始化默认数据
function initializeData() {
  // 创建默认管理员
  const adminPassword = bcrypt.hashSync(resolveInitialPassword('INIT_ADMIN_PASSWORD', '管理员'), 10);
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
  const teacherPassword = bcrypt.hashSync(resolveInitialPassword('INIT_TEACHER_PASSWORD', '教师'), 10);
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
    const password = bcrypt.hashSync(resolveInitialPassword('INIT_STUDENT_PASSWORD', '学生'), 10);
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
    logo: '/logo.png'
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
  console.log('默认账号用户名: admin / teacher / student');

  const envMap = {
    管理员: 'INIT_ADMIN_PASSWORD',
    教师: 'INIT_TEACHER_PASSWORD',
    学生: 'INIT_STUDENT_PASSWORD'
  };
  const seen = new Set();
  generatedCredentials.forEach(({ label, plain }) => {
    if (!seen.has(label)) {
      seen.add(label);
      console.log(`[首次密码] ${label}: ${plain}  （请立即登录后修改，此密码仅在首次初始化时生成一次）`);
    }
  });
  ['管理员', '教师', '学生'].forEach((label) => {
    if (!seen.has(label) && process.env[envMap[label]]) {
      console.log(`[首次密码] ${label}: 由环境变量 ${envMap[label]} 指定`);
    }
  });
  console.log('提示：可通过环境变量 INIT_ADMIN_PASSWORD / INIT_TEACHER_PASSWORD / INIT_STUDENT_PASSWORD 预先指定初始密码');
}

// 数据库操作类
class Database {
  constructor() {
    this.data = db;
  }

  reloadQuestionsFromStore() {
    this.data.questions = getAllQuestions();
    return this.data.questions;
  }

  /**
   * 持久化单个变更
   * - questions 由 question-store 独立管理
   * - 其余集合写入 persistent-store（SQLite）
   */
  persistCollection(collection, payload) {
    if (collection === 'questions') {
      if (payload && payload.type === 'delete') {
        deleteQuestionFromStore(payload.id);
        return;
      }
      if (payload && payload.item) {
        upsertQuestion(payload.item);
      }
      return;
    }

    try {
      if (payload && payload.type === 'delete') {
        store.removeItem(collection, payload.id);
        return;
      }
      if (payload && payload.item !== undefined) {
        const item = payload.item;
        const id = (item && item.id) !== undefined ? item.id : store.OBJECT_ROW_ID;
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          store.upsertItem(collection, id, item);
        }
      }
    } catch (e) {
      console.error(`[persist] 写入失败 ${collection}:`, e.message);
    }
  }

  /** 全量落盘：把内存里所有集合写入 SQLite（兜底直连内存的写入路径） */
  flushAll() {
    const collections = Object.keys(this.data);
    collections.forEach((collection) => {
      if (collection === 'questions') return;
      const value = this.data[collection];
      try {
        if (Array.isArray(value)) {
          // 日志类集合只保留最近 5000 条，避免无限增长
          const trimmed = collection === 'logs' && value.length > 5000 ? value.slice(-5000) : value;
          if (collection === 'logs' && trimmed !== value) this.data[collection] = trimmed;
          store.replaceCollection(collection, trimmed);
        } else if (value && typeof value === 'object') {
          store.saveObject(collection, value);
        }
      } catch (e) {
        console.error(`[persist] 集合落盘失败 ${collection}:`, e.message);
      }
    });
    return collections.length;
  }

  // 通用 CRUD 操作
  create(collection, item) {
    const newItem = {
      ...item,
      id: item.id || uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.data[collection].push(newItem);
    this.persistCollection(collection, { item: newItem });
    return newItem;
  }

  findById(collection, id) {
    return this.data[collection].find(item => item.id === id);
  }

  find(collection, query = {}) {
    return this.data[collection].filter(item => {
      return Object.keys(query).every(key => item[key] === query[key]);
    });
  }

  findOne(collection, query = {}) {
    return this.data[collection].find(item => {
      return Object.keys(query).every(key => item[key] === query[key]);
    });
  }

  updateById(collection, id, updates) {
    const index = this.data[collection].findIndex(item => item.id === id);
    if (index === -1) return null;

    this.data[collection][index] = {
      ...this.data[collection][index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.persistCollection(collection, { item: this.data[collection][index] });
    return this.data[collection][index];
  }

  deleteById(collection, id) {
    const index = this.data[collection].findIndex(item => item.id === id);
    if (index === -1) return false;

    const removed = this.data[collection][index];
    this.data[collection].splice(index, 1);
    this.persistCollection(collection, { type: 'delete', id: removed.id });
    return true;
  }

  delete(collection, query = {}) {
    const initialLength = this.data[collection].length;
    const removedItems = this.data[collection].filter(item => {
      return Object.keys(query).every(key => item[key] === query[key]);
    });
    this.data[collection] = this.data[collection].filter(item => {
      return !Object.keys(query).every(key => item[key] === query[key]);
    });
    if (initialLength != this.data[collection].length) {
      removedItems.forEach((item) => {
        if (collection === 'questions') {
          this.persistCollection(collection, { item });
        } else if (item && item.id !== undefined) {
          this.persistCollection(collection, { type: 'delete', id: item.id });
        }
      });
    }
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
      details,
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

// ---------- 启动：优先加载持久化数据，首次启动才写入默认数据 ----------
function bootstrapData() {
  let restored = false;
  try {
    const persisted = store.loadAll();
    const collections = Object.keys(persisted);
    if (collections.length) {
      collections.forEach((collection) => {
        const value = persisted[collection];
        if (Array.isArray(value)) {
          db[collection] = value;
        } else if (value && typeof value === 'object') {
          db[collection] = value;
        }
      });
      restored = collections.length > 0;
    }
  } catch (e) {
    console.error('[persist] 读取持久化数据失败，将使用内存模式:', e.message);
  }

  if (!restored) {
    console.log('[persist] 未发现历史数据，按默认数据初始化并落盘');
    initializeData();
    try {
      store.replaceCollection('users', db.users);
    } catch (e) {
      console.error('[persist] 初始化落盘失败:', e.message);
    }
  } else {
    console.log(`[persist] 已从 SQLite 恢复数据：${Object.keys(db).filter(k => Array.isArray(db[k]) && db[k].length).map(k => k + '(' + db[k].length + ')').join(', ')}`);
  }
}

bootstrapData();

// 导出数据库实例
const database = new Database();

// 题库从独立存储载入（questions.sqlite）
try {
  database.reloadQuestionsFromStore();
} catch (e) {
  console.error('[persist] 题库加载失败:', e.message);
}

// 兜底落盘：这些集合在业务代码里被直接改内存（绕过 CRUD），需要定时同步
const VOLATILE_COLLECTIONS = ['settings', 'knowledgeGraphNodes', 'knowledgeGraphWrong', 'knowledgeGraphRecommend'];
const FLUSH_INTERVAL_MS = 5000;
const flushTimer = setInterval(() => {
  VOLATILE_COLLECTIONS.forEach((collection) => {
    const value = database.data[collection];
    if (value === undefined) return;
    try {
      if (Array.isArray(value)) {
        store.replaceCollection(collection, value);
      } else if (value && typeof value === 'object') {
        store.saveObject(collection, value);
      }
    } catch (e) {
      console.error(`[persist] 定时落盘失败 ${collection}:`, e.message);
    }
  });
}, FLUSH_INTERVAL_MS);
if (flushTimer.unref) flushTimer.unref();

// 退出前全量落盘，兜住所有写入路径（docker stop 会发 SIGTERM）
function flushAndExit() {
  try {
    database.flushAll();
    console.log('[persist] 退出前已全量落盘');
  } catch (e) {
    console.error('[persist] 退出落盘失败:', e.message);
  }
  process.exit(0);
}
['SIGTERM', 'SIGINT', 'SIGHUP'].forEach((signal) => {
  process.on(signal, flushAndExit);
});

module.exports = database;
