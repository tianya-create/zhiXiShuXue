/**
 * 内存数据库
 * 使用 JavaScript 对象模拟数据库操作
 */

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

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
  masteredWrongQuestions: [],
  logs: [],
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
    systemName: '智慧教育平台',
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
    createdAt: twoDaysAgo,
    updatedAt: twoDaysAgo
  });

  db.papers.push({
    id: 'paper-002',
    title: '第二次测试卷',
    teacherId: teacherId,
    classId: classId,
    questions: ['q1', 'q2', 'q3', 'q4', 'q5'],
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
  console.log('默认账号信息:');
  console.log('管理员 - 用户名: admin, 密码: admin123');
  console.log('教师 - 用户名: teacher, 密码: teacher123');
  console.log('学生 - 用户名: student, 密码: student123');
}

// 数据库操作类
class Database {
  constructor() {
    this.data = db;
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
    return this.data[collection][index];
  }

  deleteById(collection, id) {
    const index = this.data[collection].findIndex(item => item.id === id);
    if (index === -1) return false;

    this.data[collection].splice(index, 1);
    return true;
  }

  delete(collection, query = {}) {
    const initialLength = this.data[collection].length;
    this.data[collection] = this.data[collection].filter(item => {
      return !Object.keys(query).every(key => item[key] === query[key]);
    });
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
initializeData();

// 导出数据库实例
const database = new Database();
module.exports = database;
