const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../database/memory-db');

const { getSecret, authenticate } = require('../middleware/access');

// 用户登录
const loginFailures = new Map();
router.post('/login', (req, res) => {
  const key = req.ip + ':' + String(req.body.username || '');
  const attempts = loginFailures.get(key);
  if (attempts && attempts.until > Date.now() && attempts.count >= 10) return res.status(429).json({ success: false, message: '登录尝试过多，请稍后重试' });
  const fail = () => { const entry = loginFailures.get(key); loginFailures.set(key, { count: entry && entry.until > Date.now() ? entry.count + 1 : 1, until: Date.now() + 15 * 60000 }); };
  if (loginFailures.size > 5000) for (const [id, entry] of loginFailures) if (entry.until < Date.now()) loginFailures.delete(id);
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '用户名和密码不能为空'
      });
    }
    
    // 查找用户
    const user = db.findOne('users', { username });
    
    if (!user || user.disabled) {
      fail();
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }
    
    // 验证密码
    const isMatch = bcrypt.compareSync(password, user.password);
    
    if (!isMatch) {
      fail();
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }
    
    loginFailures.delete(key);
    // 生成 JWT token
    const token = jwt.sign(
      { userId: user.id, role: user.role, tokenVersion: user.tokenVersion || 0 },
      getSecret(),
      { expiresIn: '8h' }
    );
    
    // 记录日志
    db.addLog(user.id, 'LOGIN', { username: user.username, role: user.role });
    
    res.cookie('session', token, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', maxAge: 8 * 3600000 });
    // 返回用户信息和 token
    const userInfo = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,

    };
    
    res.json({
      success: true,
      message: '登录成功',
      data: {
        token,
        user: userInfo
      }
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({
      success: false,
      message: '登录失败',
      error: error.message
    });
  }
});

// 用户退出登录
router.post('/logout', authenticate, (req, res) => {
  try {
    const userId = req.user.id;
    const user = db.findById('users', userId);
    db.updateById('users', userId, { tokenVersion: (user.tokenVersion || 0) + 1 });
    res.clearCookie('session');
    if (userId) {
      db.addLog(userId, 'LOGOUT', { timestamp: new Date().toISOString() });
    }
    
    res.json({
      success: true,
      message: '退出成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '退出失败',
      error: error.message
    });
  }
});

// 修改密码
router.post('/change-password', authenticate, (req, res) => {
  try {
    const userId = req.user.id;
    const { oldPassword, newPassword } = req.body;
    
    if (!userId || !oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: '参数不完整'
      });
    }
    
    const user = db.findById('users', userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    // 验证旧密码
    const isMatch = bcrypt.compareSync(oldPassword, user.password);
    
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: '原密码错误'
      });
    }
    
    if (newPassword.length < 8) return res.status(400).json({ success: false, message: '新密码至少需要 8 位' });
    // 更新密码
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    db.updateById('users', userId, { password: hashedPassword, tokenVersion: (user.tokenVersion || 0) + 1 });
    
    db.addLog(userId, 'CHANGE_PASSWORD', { username: user.username });
    
    res.json({
      success: true,
      message: '密码修改成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '密码修改失败',
      error: error.message
    });
  }
});

// 验证 token
router.get('/verify', authenticate, (req, res) => {
  const user = db.findById('users', req.user.id);
  res.json({ success: true, data: { id: user.id, username: user.username, name: user.name, role: user.role } });
});

module.exports = router;
