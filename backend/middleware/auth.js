/**
 * 鉴权中间件
 *
 * 作用：校验 Authorization: Bearer <token>，把令牌中的身份写入 req.user，
 * 并用它覆盖客户端传来的 x-user-id 请求头 —— 从而彻底封堵
 * "伪造 x-user-id 冒充任意用户（含管理员）" 的越权漏洞。
 *
 * 挂载方式：app.use('/api', authMiddleware)
 */

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/auth-secret');
const db = require('../database/memory-db');

// 无需登录即可访问的接口（挂载在 /api 下，路径不含 /api 前缀）
const PUBLIC_PATHS = new Set([
  '/auth/login',
  '/auth/register',
  '/health'
]);

function isPublicPath(pathname) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  return false;
}

function extractToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  return '';
}

module.exports = function authMiddleware(req, res, next) {
  // 预检请求直接放行
  if (req.method === 'OPTIONS') return next();

  const pathname = (req.path || '/').replace(/\/+$/, '') || '/';
  if (isPublicPath(pathname)) return next();

  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ success: false, message: '未登录或登录已过期，请重新登录' });
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (e) {
    const expired = e && e.name === 'TokenExpiredError';
    return res.status(401).json({ success: false, message: expired ? '登录已过期，请重新登录' : '身份凭证无效，请重新登录' });
  }

  const userId = payload.userId || payload.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: '身份凭证无效，请重新登录' });
  }

  const user = db.findById('users', userId);
  if (!user) {
    return res.status(401).json({ success: false, message: '账号不存在或已被禁用' });
  }

  // 关键：以令牌身份为准，客户端自带的 x-user-id 一律忽略并覆盖
  req.user = { id: user.id, username: user.username, role: user.role, name: user.name };
  req.headers['x-user-id'] = user.id;

  // 角色权限校验
  const fullPath = (req.originalUrl || '').split('?')[0];
  if (fullPath.startsWith('/api/admin') && user.role !== 'admin') {
    return res.status(403).json({ success: false, message: '无权限访问该资源' });
  }
  if (fullPath.startsWith('/api/teacher') && user.role !== 'teacher' && user.role !== 'admin') {
    return res.status(403).json({ success: false, message: '无权限访问该资源' });
  }

  return next();
};
