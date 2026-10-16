const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../database/memory-db');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/auth-secret');

// 用户登录
router.post('/login', (req, res) => {
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
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }
    
    // 验证密码
    const isMatch = bcrypt.compareSync(password, user.password);
    
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }
    
    // 生成 JWT token
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    
    // 记录日志
    db.addLog(user.id, 'LOGIN', { username: user.username, role: user.role });
    
    // 返回用户信息和 token
    const userInfo = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      email: user.email,
      phone: user.phone
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
router.post('/logout', (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
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
router.post('/change-password', (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    // 只允许修改自己的密码：以令牌身份为准，忽略请求体中的 userId
    const userId = (req.user && req.user.id) || req.headers['x-user-id'];

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
    
    // 更新密码
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    db.updateById('users', userId, { password: hashedPassword });
    
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
router.get('/verify', (req, res) => {
  try {
    var token = req.headers['authorization']
    if (token && token.startsWith('Bearer ')) {
      token = token.replace('Bearer ', '')
    }
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: '未登录'
      });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.findById('users', decoded.userId);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        email: user.email,
        phone: user.phone
      }
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'token 无效或已过期'
    });
  }
});

module.exports = router;
