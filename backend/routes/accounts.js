/**
 * 账号治理（仅管理员）
 *
 * 相比 routes/admin.js 里原有的用户接口，这里补上了三件事：
 *   1. 创建账号时联动建立教师/学生档案，并把学生挂到班级
 *   2. 改密或禁用时递增 tokenVersion —— 已签发的令牌立刻失效（改密即踢下线）
 *   3. 删除账号时级联清理学习记录，避免留下孤儿数据
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/memory-db');

const router = express.Router();
const BCRYPT_ROUNDS = 10;

const run = (action) => (req, res) => {
  try {
    action(req, res);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

router.post(
  '/users',
  run((req, res) => {
    const { username, name, role, password, classId } = req.body || {};
    if (
      !/^[\w-]{3,60}$/.test(String(username || '')) ||
      !String(name || '').trim() ||
      !['admin', 'teacher', 'student'].includes(role) ||
      String(password || '').length < 8
    ) {
      throw new Error('请填写姓名、3 到 60 位账号、有效角色及至少 8 位密码');
    }
    if (db.find('users', { username }).length) {
      throw new Error('该登录账号已存在');
    }
    if (role === 'student' && !db.findById('classes', classId)) {
      throw new Error('请先选择学生所在班级');
    }

    const user = db.transaction(() => {
      const item = db.create('users', {
        username,
        name: String(name).trim(),
        role,
        password: bcrypt.hashSync(password, BCRYPT_ROUNDS)
      });
      if (role === 'teacher') {
        db.create('teachers', {
          id: item.id,
          userId: item.id,
          name: item.name,
          classes: [],
          subject: '数学'
        });
      }
      if (role === 'student') {
        const student = db.create('students', {
          userId: item.id,
          name: item.name,
          studentNo: username,
          username,
          classId
        });
        const cls = db.findById('classes', classId);
        db.updateById('classes', classId, {
          students: [...(cls.students || []), student.id]
        });
      }
      db.addLog(req.user.id, 'CREATE_USER', { userId: item.id, role });
      return item;
    });

    res.json({ success: true, data: user, message: '账号已创建' });
  })
);

router.put(
  '/users/:id',
  run((req, res) => {
    const user = db.findById('users', req.params.id);
    if (!user) throw new Error('用户不存在');

    const body = req.body || {};
    if (body.role && body.role !== user.role) {
      throw new Error('已有账号的角色不可直接切换，请创建对应角色账号');
    }
    if (
      body.disabled &&
      user.role === 'admin' &&
      db.find('users', { role: 'admin' }).filter((item) => !item.disabled).length <= 1
    ) {
      throw new Error('至少保留一个可用管理员');
    }

    const value = {
      name: body.name || user.name,
      email: body.email === undefined ? user.email : body.email,
      phone: body.phone === undefined ? user.phone : body.phone,
      disabled: body.disabled === undefined ? !!user.disabled : !!body.disabled
    };
    if (body.newPassword) {
      if (String(body.newPassword).length < 8) throw new Error('新密码至少需要 8 位');
      value.password = bcrypt.hashSync(body.newPassword, BCRYPT_ROUNDS);
    }
    // 改密 / 禁用后旧令牌立即失效
    if (value.password || value.disabled !== !!user.disabled) {
      value.tokenVersion = (user.tokenVersion || 0) + 1;
    }

    const updated = db.transaction(() => {
      const item = db.updateById('users', user.id, value);
      for (const collection of ['students', 'teachers']) {
        const record = db.findOne(collection, { userId: user.id });
        if (record) db.updateById(collection, record.id, { name: item.name });
      }
      db.addLog(req.user.id, 'UPDATE_USER', {
        userId: user.id,
        disabled: item.disabled,
        passwordReset: !!value.password
      });
      return item;
    });

    const { password, ...safe } = updated;
    res.json({ success: true, data: safe, message: '账号已更新' });
  })
);

router.get(
  '/students/:id/data-export',
  run((req, res) => {
    const student = db.findById('students', req.params.id);
    if (!student) throw new Error('学生不存在');
    const data = { student };
    for (const collection of [
      'answers',
      'learningRecords',
      'drafts',
      'student_answer',
      'student_knowledge_mastery',
      'mastery_snapshot'
    ]) {
      data[collection] = db
        .find(collection)
        .filter((item) => item.studentId === student.id || item.userId === student.id);
    }
    data.mistakes = db.getAllMistakesForStudent(student.id);
    res.json({ success: true, data });
  })
);

router.delete(
  '/users/:id',
  run((req, res) => {
    const user = db.findById('users', req.params.id);
    if (!user) throw new Error('用户不存在');
    if (
      user.role === 'admin' &&
      db.find('users', { role: 'admin' }).filter((item) => !item.disabled).length <= 1
    ) {
      throw new Error('至少保留一个可用管理员');
    }
    const teacher = db.findOne('teachers', { userId: user.id });
    if (teacher && db.find('classes').some((cls) => cls.teacherId === teacher.id)) {
      throw new Error('教师仍有班级，请先移交班级');
    }

    db.transaction(() => {
      const student = db.findOne('students', { userId: user.id });
      if (student) {
        for (const collection of Object.keys(db.data)) {
          if (
            ['users', 'students', 'classes', 'questions', 'teachers', 'settings'].includes(collection) ||
            !Array.isArray(db.data[collection])
          ) {
            continue;
          }
          for (const record of db
            .find(collection)
            .filter((item) => item.studentId === student.id || item.userId === student.id)) {
            db.deleteById(collection, record.id);
          }
        }
        const cls = db.findById('classes', student.classId);
        if (cls) {
          db.updateById('classes', cls.id, {
            students: (cls.students || []).filter((id) => id !== student.id)
          });
        }
        db.deleteById('students', student.id);
        // 日志里不留个人身份，只保留"已删除学生"占位
        for (const log of db.find('logs', { userId: user.id })) {
          db.updateById('logs', log.id, { userId: 'deleted-student', details: {} });
        }
      }
      if (teacher) db.deleteById('teachers', teacher.id);
      db.deleteById('users', user.id);
      db.addLog(req.user.id, 'DELETE_USER', { userId: user.id });
    });

    res.json({ success: true, message: '账号及其学习记录已删除' });
  })
);

module.exports = router;
