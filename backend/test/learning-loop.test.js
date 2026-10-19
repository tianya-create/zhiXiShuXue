/**
 * 学习闭环与判分质量测试
 *
 * 使用独立临时库（APP_DB_PATH），不会读写开发/线上数据。
 */

const os = require('os');
const path = require('path');
const fs = require('fs');

const TMP_DB = path.join(os.tmpdir(), `zhixi-test-${process.pid}-${Date.now()}.sqlite`);
process.env.APP_DB_PATH = TMP_DB;

const tree = require('../../shared/knowledge-tree.json');
const db = require('../database/memory-db');
const { equivalent } = require('../services/math-equivalence');
const { gradeAnswer } = require('../services/autoGrade');
const { normalizeQuestion, publicQuestion } = require('../services/question-quality');
const { calculateMastery } = require('../services/masteryEngine');
const { nodes } = require('../services/curriculum');
const { gradeQuestions, synchronize, reviewRecord } = require('../services/learning');

const actor = { id: 'teacher-test', role: 'teacher' };
const admin = { id: 'admin-test', role: 'admin' };

// 目录节点在 require 时已由 curriculum 初始化，这里只补缺失的，避免重复编号报错
function ensure(collection, item) {
  if (db.findById(collection, item.id)) return;
  if (collection === 'users' && db.data.users.some((u) => u.username === item.username)) return;
  db.create(collection, item);
}

beforeAll(() => {
  for (const category of tree.categories) {
    for (const node of category.nodes) {
      ensure('knowledgePoints', {
        ...node,
        curriculum: true,
        parentId: category.id,
        categoryId: category.id,
        categoryName: category.name,
        level: 2
      });
    }
  }
  ensure('users', { id: 'student-user-1', username: 'stu1', role: 'student', name: '测试学生' });
  ensure('users', { id: 'teacher-user-1', username: 'teacher-test', role: 'teacher', name: '测试教师' });
  ensure('classes', { id: 'class-1', name: '七年级一班', grade: '七年级', teacherId: 'teacher-test' });
  ensure('students', {
    id: 'student-1',
    userId: 'student-user-1',
    name: '测试学生',
    studentNo: 'S001',
    classId: 'class-1'
  });
  ensure('teachers', { id: 'teacher-test', name: '测试教师', userId: 'teacher-user-1' });
});

afterAll(() => {
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      fs.unlinkSync(TMP_DB + suffix);
    } catch {}
  }
});

describe('数学等价判分', () => {
  test('分数、小数与展开式视为等价', () => {
    expect(equivalent('1/2', '0.5')).toBe(true);
    expect(equivalent('2(x+1)', '2x+2')).toBe(true);
    expect(equivalent('(x+1)^2', 'x^2+2x+1')).toBe(true);
    expect(equivalent('x=6', '6')).toBe(true);
  });

  test('不同答案不会被误判', () => {
    expect(equivalent('1/3', '1/4')).toBe(false);
    expect(equivalent('2x+1', '2x+3')).toBe(false);
    expect(equivalent('x=6', 'y=6')).toBe(false);
  });

  test('填空题使用等价判定而不是字符串比较', () => {
    expect(gradeAnswer({ type: 'fill', answer: '0.5' }, '1/2').isCorrect).toBe(true);
    expect(gradeAnswer({ type: 'fill', answer: '2x+2' }, '2(x+1)').isCorrect).toBe(true);
    expect(gradeAnswer({ type: 'fill', answer: '6' }, '5').isCorrect).toBe(false);
  });

  test('判断题兼容口语化写法', () => {
    expect(gradeAnswer({ type: 'judge', answer: '正确' }, '对').isCorrect).toBe(true);
    expect(gradeAnswer({ type: 'judge', answer: '正确' }, '错').isCorrect).toBe(false);
  });

  test('解析器无法确定的写法转人工复核', () => {
    const result = gradeAnswer({ type: 'fill', answer: '\\sqrt{2}' }, '1.414');
    expect(result.needsReview).toBe(true);
    expect(result.isCorrect).toBe(null);
  });

  test('解答题一律等待教师复核', () => {
    const result = gradeAnswer({ type: 'subjective', answer: 'x=3' }, 'x=3');
    expect(result.needsReview).toBe(true);
  });
});

describe('题库质量校验', () => {
  const base = {
    type: 'choice',
    content: '下列哪个是方程 x+1=2 的解？',
    options: ['1', '2', '3'],
    answer: '1',
    analysis: '把 1 代入成立',
    knowledgePointId: 'alg-1',
    score: 5
  };

  test('合规题目可以保存并进入待审核', () => {
    const question = normalizeQuestion(base, {}, actor);
    expect(question.reviewStatus).toBe('pending');
    expect(question.knowledgePointId).toBe('alg-1');
    expect(question.score).toBe(5);
    expect(question.version).toBe(1);
  });

  test('选项重复会被拒绝', () => {
    expect(() => normalizeQuestion({ ...base, options: ['1', '1'] }, {}, actor)).toThrow(/选项/);
  });

  test('答案字母超出选项范围会被拒绝', () => {
    expect(() => normalizeQuestion({ ...base, options: ['1', '2'], answer: 'D' }, {}, actor)).toThrow(/字母/);
  });

  test('分值越界会被拒绝', () => {
    expect(() => normalizeQuestion({ ...base, score: 0 }, {}, actor)).toThrow(/分值/);
  });

  test('评分步骤分值之和必须等于总分', () => {
    expect(() =>
      normalizeQuestion(
        { ...base, type: 'subjective', rubric: [{ description: '第一步', points: 2 }], score: 5 },
        {},
        actor
      )
    ).toThrow(/评分步骤/);
  });

  test('审核通过前必须有解析', () => {
    expect(() => normalizeQuestion({ ...base, analysis: '', reviewStatus: 'approved' }, {}, actor)).toThrow(/解析/);
  });

  test('学生端题目不返回答案与解析', () => {
    const safe = publicQuestion({ ...base, answer: '1', analysis: '解析' });
    expect(safe.answer).toBeUndefined();
    expect(safe.analysis).toBeUndefined();
  });
});

describe('掌握度样本规则', () => {
  test('样本不足时不认定已掌握', () => {
    db.create('student_answer', {
      userId: 'student-1',
      questionId: 'q-single',
      kpCode: 'alg-1',
      isCorrect: true,
      costTime: 60,
      createdAt: new Date().toISOString()
    });
    const mastery = calculateMastery('student-1', 'alg-1');
    expect(mastery.status).toBe('样本不足');
    expect(mastery.confidence).toBe('limited');
    expect(mastery.mastery).toBeLessThanOrEqual(79);
  });

  test('样本充足后给出正常状态', () => {
    for (let i = 0; i < 5; i++) {
      db.create('student_answer', {
        userId: 'student-2',
        questionId: `q-${i % 3}`,
        kpCode: 'alg-2',
        isCorrect: true,
        costTime: 60,
        createdAt: new Date().toISOString()
      });
    }
    const mastery = calculateMastery('student-2', 'alg-2');
    expect(mastery.confidence).toBe('sufficient');
    expect(['已掌握', '待巩固', '薄弱']).toContain(mastery.status);
  });
});

describe('教材目录', () => {
  test('教材目录共 30 个知识点且都有年级与章节', () => {
    expect(nodes.length).toBe(30);
    for (const node of nodes) {
      expect(node.name).toBeTruthy();
      expect([7, 8, 9]).toContain(Number(node.grade));
      expect(node.chapter).toBeTruthy();
    }
  });
});

describe('学习闭环', () => {
  let question;

  beforeAll(() => {
    question = db.create('questions', {
      id: 'q-loop-1',
      type: 'fill',
      content: '计算 1/2 + 1/2',
      answer: '1',
      score: 5,
      difficulty: 'easy',
      difficultyLevel: 1,
      knowledgePointId: 'alg-1',
      knowledgePoints: ['alg-1'],
      reviewStatus: 'approved',
      analysis: '等于 1',
      createdBy: 'teacher-test'
    });
  });

  test('判分结果带快照，主观题标记待复核', () => {
    const results = gradeQuestions(['q-loop-1'], { 'q-loop-1': '1.0' });
    expect(results).toHaveLength(1);
    expect(results[0].correct).toBe(true);
    expect(results[0].snapshot.knowledgePointId).toBe('alg-1');
  });

  test('同步后写入作答轨迹、错题与掌握度快照', () => {
    const results = gradeQuestions(['q-loop-1'], { 'q-loop-1': '0.5' });
    const record = db.create('learningRecords', {
      id: 'record-1',
      studentId: 'student-1',
      classId: 'class-1',
      recordType: 'practice',
      questionResults: results,
      totalScore: 0,
      status: 'pending_review',
      submittedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    });
    synchronize(record);

    const answers = db.find('student_answer', { userId: 'student-1', questionId: 'q-loop-1' });
    expect(answers.length).toBe(1);
    expect(answers[0].isCorrect).toBe(false);
    expect(db.getAllMistakesForStudent('student-1').some((item) => item.questionId === 'q-loop-1')).toBe(true);
    expect(db.find('studentQuestionAttempts', { studentId: 'student-1' }).length).toBe(1);
  });

  test('教师复核后成绩、错题与状态同步更新', () => {
    const record = db.findById('learningRecords', 'record-1');
    const updated = reviewRecord(
      'learningRecords',
      record,
      { scores: { 'q-loop-1': 5 }, comments: { 'q-loop-1': '订正后正确' } },
      'teacher-test'
    );
    expect(updated.status).toBe('completed');
    expect(updated.totalScore).toBe(5);
    expect(updated.questionResults[0].needsReview).toBe(false);
    expect(updated.comment).toBeUndefined();
    const attempts = db.find('studentQuestionAttempts', { studentId: 'student-1', questionId: 'q-loop-1' });
    // 复核不会新增作答次数，避免重复统计
    expect(attempts[0].attemptCount).toBe(1);
  });
});
