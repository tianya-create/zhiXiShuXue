/**
 * 行级访问控制（Row-Level ACL）
 *
 * 与 middleware/auth.js 的区别：
 *   auth.js        只做"登录了没有 + 角色门"，老师 A 拿到老师 B 的班级 ID 依然能读。
 *   access.js      在角色门之上再做"这条记录属不属于你"的判定，封堵 IDOR（越权访问对象）。
 *
 * 四件套：
 *   authenticate    校验 JWT，把身份写进 req.user，并覆盖客户端伪造的 x-user-id
 *   roles(...)      角色门
 *   allowedRecord   单条记录的行级判定（教师看自己班、学生只看自己）
 *   privateResponse 响应脱敏（剔除 password / apiKey / tokenVersion 等字段），并开启 ALS 上下文
 *   teacherGuard    针对 URL 参数与请求体的越权拦截
 */

const { AsyncLocalStorage } = require('node:async_hooks');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/auth-secret');
const db = require('../database/memory-db');

const scope = new AsyncLocalStorage();

/** 集合可能尚未建立（新功能首次上线），统一兜底为空数组，避免判定时抛错 */
function rows(collection) {
  const value = db.data[collection];
  return Array.isArray(value) ? value : [];
}

function tokenFrom(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  const cookie = String(req.headers.cookie || '');
  const hit = cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith('session='));
  return hit ? hit.slice(8) : '';
}

function authenticate(req, res, next) {
  if (req.method === 'OPTIONS') return next();
  const token = tokenFrom(req);
  if (!token) {
    return res.status(401).json({ success: false, message: '未登录或登录已过期，请重新登录' });
  }
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  } catch (e) {
    const expired = e && e.name === 'TokenExpiredError';
    return res
      .status(401)
      .json({ success: false, message: expired ? '登录已过期，请重新登录' : '身份凭证无效，请重新登录' });
  }
  const userId = decoded.userId || decoded.id;
  const user = rows('users').find((item) => item.id === userId);
  if (!user) {
    return res.status(401).json({ success: false, message: '账号不存在或已被禁用' });
  }
  if (user.disabled) {
    return res.status(401).json({ success: false, message: '账号已被禁用，请联系管理员' });
  }
  // 支持"改密即失效"：登录态里记录的 tokenVersion 必须与账号当前值一致
  if ((user.tokenVersion || 0) !== (decoded.tokenVersion || 0)) {
    return res.status(401).json({ success: false, message: '登录状态已失效，请重新登录' });
  }
  req.user = { id: user.id, username: user.username, role: user.role, name: user.name };
  // 以令牌身份为准，客户端自带的 x-user-id 一律覆盖
  req.headers['x-user-id'] = user.id;
  return next();
}

function roles(...allowed) {
  return (req, res, next) =>
    allowed.includes(req.user && req.user.role)
      ? next()
      : res.status(403).json({ success: false, message: '无权访问此功能' });
}

/**
 * 判断一条记录是否属于当前操作者。
 * admin 直接放行；教师看自己班级及其学生；学生只看自己。
 */
function allowedRecord(collection, item, actor = scope.getStore()) {
  if (!actor || actor.role === 'admin' || !item) return true;

  const teacher = rows('teachers').find((x) => x.id === actor.id || x.userId === actor.id);
  const student = rows('students').find((x) => x.id === actor.id || x.userId === actor.id);

  const ownClass = (id) =>
    !id
      ? false
      : rows('classes').some(
          (x) =>
            x.id === id &&
            (x.teacherId === actor.id ||
              x.teacherId === teacher?.id ||
              (Array.isArray(teacher?.classes) && teacher.classes.includes(x.id))),
        );

  const ownStudent = (id) =>
    !id
      ? false
      : rows('students').some((x) => (x.id === id || x.userId === id) && ownClass(x.classId));

  if (actor.role === 'teacher') {
    if (collection === 'classes') return ownClass(item.id);
    if (collection === 'students') return ownClass(item.classId);
    if (collection === 'teachers') return item.id === teacher?.id || item.id === actor.id;
    if (collection === 'users') {
      return (
        item.id === actor.id ||
        rows('students').some((x) => x.userId === item.id && ownClass(x.classId))
      );
    }
    if (collection === 'papers' || collection === 'assignments') {
      // 没有归属人的记录（系统内置 / 管理员统一上传）视为公共资源，教师可读可维护
      return !item.teacherId || item.teacherId === actor.id || item.teacherId === teacher?.id;
    }
    if (
      [
        'answers',
        'learningRecords',
        'studentQuestionAttempts',
        'masteredWrongQuestions',
        'questionReports',
      ].includes(collection) ||
      collection.startsWith('student_mistake_')
    ) {
      return ownStudent(item.studentId);
    }
    if (['student_answer', 'student_knowledge_mastery', 'mastery_snapshot'].includes(collection)) {
      return ownStudent(item.userId);
    }
    if (collection === 'drafts') return false;
    if (collection === 'questions') {
      return item.reviewStatus === 'approved' || item.createdBy === actor.id || !item.createdBy;
    }
  }

  if (actor.role === 'student') {
    if (collection === 'students') return item.id === student?.id || item.userId === actor.id;
    if (collection === 'classes') return item.id === student?.classId;
    if (collection === 'users') return item.id === actor.id;
    if (collection === 'teachers') {
      return rows('classes').some((x) => x.id === student?.classId && x.teacherId === item.id);
    }
    if (collection === 'assignments') {
      return Array.isArray(item.studentIds) && item.studentIds.length
        ? item.studentIds.includes(student?.id) || item.studentIds.includes(actor.id)
        : item.classId === student?.classId;
    }
    if (collection === 'papers') {
      return rows('assignments').some(
        (x) =>
          x.paperId === item.id &&
          (Array.isArray(x.studentIds) && x.studentIds.length
            ? x.studentIds.includes(student?.id) || x.studentIds.includes(actor.id)
            : x.classId === student?.classId),
      );
    }
    if (
      [
        'answers',
        'learningRecords',
        'studentQuestionAttempts',
        'drafts',
        'masteredWrongQuestions',
        'recommendationLogs',
      ].includes(collection) ||
      collection.startsWith('student_mistake_')
    ) {
      return item.studentId === student?.id || item.studentId === actor.id;
    }
    if (['student_answer', 'student_knowledge_mastery', 'mastery_snapshot'].includes(collection)) {
      return item.userId === student?.id || item.userId === actor.id;
    }
  }

  return true;
}

/** 响应脱敏：任何接口都不会把密码哈希、密钥、令牌版本号返回给前端 */
function privateResponse(req, res, next) {
  const original = res.json.bind(res);
  const clean = (value) => {
    if (Array.isArray(value)) return value.map(clean);
    if (!value || typeof value !== 'object') return value;
    // Date / Buffer 这类内置对象不能按普通对象拆解，否则会被清成空对象
    if (value instanceof Date) return value.toISOString();
    if (Buffer.isBuffer(value)) return value;
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key]) =>
            !/password|passwd|secret|apiKey|api_key|tokenVersion/i.test(key) &&
            !(req.user && req.user.role === 'student' && ['snapshot', 'questionSnapshots'].includes(key)),
        )
        .map(([key, item]) => [key, clean(item)]),
    );
  };
  res.json = (payload) => original(req.path === '/backup' ? payload : clean(payload));
  // 开启行级上下文：后续 allowedRecord 不传 actor 时自动取当前登录用户
  scope.run(req.user, next);
}

/**
 * 教师端越权拦截。
 * 覆盖三类常见绕过：URL 里的记录 ID、请求体/查询串里的 classId、批量操作里的 studentIds。
 */
function teacherGuard(req, res, next) {
  const parts = req.path.split('/').filter(Boolean);
  const collection = {
    classes: 'classes',
    students: 'students',
    papers: 'papers',
    assignments: 'assignments',
    answers: 'answers',
    questions: 'questions',
    practices: 'learningRecords',
  }[parts[0]];

  if (collection && parts[1] && !['upload', 'export', 'curriculum'].includes(parts[1])) {
    const item = rows(collection).find((x) => x.id === parts[1]);
    // 题目：可以改公共题库，但不能改别的老师自己录的题
    const editQuestion =
      collection === 'questions' && req.method !== 'GET' && !!item?.createdBy;
    if (
      item &&
      (!allowedRecord(collection, item, req.user) ||
        (editQuestion && item.createdBy !== req.user.id))
    ) {
      return res.status(403).json({ success: false, message: '无权操作此记录' });
    }
  }

  const classIds = [
    req.body?.classId,
    req.query?.classId,
    parts[0] === 'analytics' && parts[1] === 'class' ? parts[2] : null,
  ].filter(Boolean);
  for (const id of classIds) {
    if (
      !allowedRecord('classes', rows('classes').find((x) => x.id === id), req.user) ||
      !rows('classes').some((x) => x.id === id)
    ) {
      return res.status(403).json({ success: false, message: '无权访问此班级' });
    }
  }

  const studentIds = [
    ...(Array.isArray(req.body?.studentIds) ? req.body.studentIds : []),
    parts[0] === 'analytics' && parts[1] === 'student' ? parts[2] : null,
  ].filter(Boolean);
  if (
    studentIds.some(
      (id) =>
        !rows('students').some((x) => x.id === id && allowedRecord('students', x, req.user)),
    )
  ) {
    return res.status(403).json({ success: false, message: '无权访问此学生' });
  }

  if (
    req.body?.paperId &&
    !rows('papers').some((x) => x.id === req.body.paperId && allowedRecord('papers', x, req.user))
  ) {
    return res.status(403).json({ success: false, message: '无权访问此试卷' });
  }

  return next();
}

module.exports = {
  scope,
  rows,
  tokenFrom,
  authenticate,
  roles,
  allowedRecord,
  privateResponse,
  teacherGuard,
};
