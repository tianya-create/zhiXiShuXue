const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const bcrypt = require('bcryptjs');
const db = require('../database/memory-db');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

function normalizeText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizeGender(value) {
  const text = normalizeText(value).toLowerCase();
  if (['女', 'female', 'f', 'girl', 'woman'].includes(text)) {
    return 'female';
  }
  return 'male';
}

function createStudentUsername(studentNo, fallbackIndex) {
  const base = normalizeText(studentNo) || `student_${Date.now()}_${fallbackIndex}`;
  return base.replace(/\s+/g, '_');
}

function buildImportSummary(classes, students, users) {
  return {
    classCount: classes.length,
    studentCount: students.length,
    userCount: users.length
  };
}


// ========== 系统配置 ==========

// 获取系统配置
router.get('/settings', (req, res) => {
  try {
    res.json({ success: true, data: db.data.settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 更新系统配置
router.put('/settings', (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const updates = req.body;
    
    db.data.settings = {
      ...db.data.settings,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    db.addLog(userId, 'UPDATE_SETTINGS', updates);
    
    res.json({ success: true, data: db.data.settings, message: '配置更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== 知识点管理 ==========

// 获取知识点列表
router.get('/knowledge-points', (req, res) => {
  try {
    const knowledgePoints = db.find('knowledgePoints');
    
    // 构建树形结构
    const tree = [];
    const map = {};
    
    knowledgePoints.forEach(kp => {
      map[kp.id] = { ...kp, children: [] };
    });
    
    knowledgePoints.forEach(kp => {
      if (kp.parentId) {
        if (map[kp.parentId]) {
          map[kp.parentId].children.push(map[kp.id]);
        }
      } else {
        tree.push(map[kp.id]);
      }
    });
    
    res.json({ success: true, data: tree });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 添加知识点
router.post('/knowledge-points', (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { name, parentId, level, order, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, message: '知识点名称不能为空' });
    }
    
    const kp = db.create('knowledgePoints', {
      name,
      parentId: parentId || null,
      level: level || 1,
      order: order || 1,
      description: description || ''
    });
    
    db.addLog(userId, 'CREATE_KNOWLEDGE_POINT', { kpId: kp.id, name });
    
    res.json({ success: true, data: kp, message: '知识点添加成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 更新知识点
router.put('/knowledge-points/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, parentId, level, order, description } = req.body;
    
    const updated = db.updateById('knowledgePoints', id, {
      name, parentId, level, order, description
    });
    
    if (!updated) {
      return res.status(404).json({ success: false, message: '知识点不存在' });
    }
    
    res.json({ success: true, data: updated, message: '知识点更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 删除知识点
router.delete('/knowledge-points/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查是否有子知识点
    const children = db.find('knowledgePoints', { parentId: id });
    if (children.length > 0) {
      return res.status(400).json({
        success: false,
        message: '该知识点下还有子知识点，请先删除子知识点'
      });
    }
    
    const deleted = db.deleteById('knowledgePoints', id);
    
    if (!deleted) {
      return res.status(404).json({ success: false, message: '知识点不存在' });
    }
    
    res.json({ success: true, message: '知识点删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== 题库管理 ==========

// 获取题库列表
router.get('/questions', (req, res) => {
  try {
    const { type, difficulty, knowledgePoint, page = 1, pageSize = 20 } = req.query;
    
    let questions = db.find('questions');
    
    if (type) {
      questions = questions.filter(q => q.type === type);
    }
    if (difficulty) {
      questions = questions.filter(q => q.difficulty === difficulty);
    }
    if (knowledgePoint) {
      questions = questions.filter(q => q.knowledgePoints && q.knowledgePoints.includes(knowledgePoint));
    }
    
    const result = {
      data: questions.slice((page - 1) * pageSize, page * pageSize),
      total: questions.length,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    };
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 添加题目到题库
router.post('/questions', (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { type, content, options, answer, knowledgePoints, difficulty, score } = req.body;
    
    if (!type || !content) {
      return res.status(400).json({ success: false, message: '题目类型和内容不能为空' });
    }
    
    const question = db.create('questions', {
      type,
      content,
      options: options || [],
      answer,
      knowledgePoints: knowledgePoints || [],
      difficulty: difficulty || 'medium',
      score: score || 1,
      paperId: null // 题库中的题目不属于任何试卷
    });
    
    db.addLog(userId, 'CREATE_QUESTION', { questionId: question.id });
    
    res.json({ success: true, data: question, message: '题目添加成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 更新题目
router.put('/questions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { content, options, answer, knowledgePoints, difficulty, score } = req.body;
    
    const updated = db.updateById('questions', id, {
      content, options, answer, knowledgePoints, difficulty, score
    });
    
    if (!updated) {
      return res.status(404).json({ success: false, message: '题目不存在' });
    }
    
    res.json({ success: true, data: updated, message: '题目更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 删除题目
router.delete('/questions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const deleted = db.deleteById('questions', id);
    
    if (!deleted) {
      return res.status(404).json({ success: false, message: '题目不存在' });
    }
    
    res.json({ success: true, message: '题目删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== 班级导入 ==========

router.post('/import/classes', upload.single('file'), (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const currentUser = db.findById('users', userId);

    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({ success: false, message: '仅管理员可导入班级信息' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: '请上传 Excel 文件' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      return res.status(400).json({ success: false, message: 'Excel 中未找到工作表' });
    }

    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], { defval: '' });

    if (!rows.length) {
      return res.status(400).json({ success: false, message: 'Excel 数据不能为空' });
    }

    const importedClasses = [];
    const currentTeachers = db.find('teachers');
    const fallbackTeacherId = currentTeachers.length ? currentTeachers[0].id : null;

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const rowNumber = index + 2;
      const className = normalizeText(row['班级名称'] || row['班级'] || row.className);
      const grade = normalizeText(row['年级'] || row.grade);

      if (!className || !grade) {
        return res.status(400).json({
          success: false,
          message: `第 ${rowNumber} 行缺少必填字段，请确保包含班级名称、年级`
        });
      }

      const existsClass = db.findOne('classes', { name: className });
      if (existsClass) {
        if (existsClass.grade !== grade) {
          return res.status(400).json({
            success: false,
            message: `第 ${rowNumber} 行班级 ${className} 的年级与现有数据不一致`
          });
        }
        continue;
      }

      const newClass = db.create('classes', {
        name: className,
        grade,
        teacherId: fallbackTeacherId,
        students: []
      });
      importedClasses.push(newClass);

      if (fallbackTeacherId) {
        const teacher = db.findById('teachers', fallbackTeacherId);
        if (teacher && !teacher.classes.includes(newClass.id)) {
          db.updateById('teachers', fallbackTeacherId, {
            classes: [...teacher.classes, newClass.id]
          });
        }
      }
    }

    const summary = { classCount: importedClasses.length };
    db.addLog(userId, 'IMPORT_CLASSES', summary);

    res.json({
      success: true,
      data: summary,
      message: '班级信息导入成功'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== 用户管理 ==========

// 获取用户列表
router.get('/users', (req, res) => {
  try {
    const { role, page = 1, pageSize = 20 } = req.query;
    
    let users = db.find('users');
    
    if (role) {
      users = users.filter(u => u.role === role);
    }
    
    // 移除密码字段
    users = users.map(u => {
      const { password, ...userWithoutPassword } = u;
      return userWithoutPassword;
    });
    
    const result = {
      data: users.slice((page - 1) * pageSize, page * pageSize),
      total: users.length,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    };
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 更新用户信息
router.put('/users/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, role } = req.body;
    
    const updated = db.updateById('users', id, { name, email, phone, role });
    
    if (!updated) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    
    const { password, ...userWithoutPassword } = updated;
    
    res.json({ success: true, data: userWithoutPassword, message: '用户信息更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 删除用户
router.delete('/users/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查是否是管理员
    const user = db.findById('users', id);
    if (user && user.role === 'admin') {
      const adminCount = db.find('users', { role: 'admin' }).length;
      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: '至少保留一个管理员账号'
        });
      }
    }
    
    const deleted = db.deleteById('users', id);
    
    if (!deleted) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    
    // 同步删除学生或教师记录
    const student = db.findOne('students', { userId: id });
    if (student) {
      db.deleteById('students', student.id);
    }
    
    const teacher = db.findOne('teachers', { userId: id });
    if (teacher) {
      db.deleteById('teachers', teacher.id);
    }
    
    res.json({ success: true, message: '用户删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== 数据统计 ==========

// 数据概览
router.get('/statistics/overview', (req, res) => {
  try {
    const userCount = db.count('users');
    const teacherCount = db.count('users', { role: 'teacher' });
    const studentCount = db.count('users', { role: 'student' });
    const classCount = db.count('classes');
    const paperCount = db.count('papers');
    const questionCount = db.count('questions');
    const answerCount = db.count('answers');
    
    res.json({
      success: true,
      data: {
        userCount,
        teacherCount,
        studentCount,
        classCount,
        paperCount,
        questionCount,
        answerCount
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 操作日志
router.get('/logs', (req, res) => {
  try {
    const { page = 1, pageSize = 20, userId, action } = req.query;
    
    let logs = db.find('logs').sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    if (userId) {
      logs = logs.filter(l => l.userId === userId);
    }
    if (action) {
      logs = logs.filter(l => l.action === action);
    }
    
    const result = {
      data: logs.slice((page - 1) * pageSize, page * pageSize),
      total: logs.length,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    };
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 数据导出
router.get('/export/:type', (req, res) => {
  try {
    const { type } = req.params;
    let data = [];
    
    switch (type) {
      case 'users':
        data = db.find('users').map(u => {
          const { password, ...userWithoutPassword } = u;
          return userWithoutPassword;
        });
        break;
      case 'students':
        data = db.find('students');
        break;
      case 'teachers':
        data = db.find('teachers');
        break;
      case 'classes':
        data = db.find('classes');
        break;
      case 'papers':
        data = db.find('papers');
        break;
      case 'answers':
        data = db.find('answers');
        break;
      default:
        return res.status(400).json({ success: false, message: '不支持的导出类型' });
    }
    
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 数据备份（返回所有数据）
router.get('/backup', (req, res) => {
  try {
    const backup = {
      timestamp: new Date().toISOString(),
      data: db.data
    };
    
    res.json({ success: true, data: backup });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 数据恢复
router.post('/restore', (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { data } = req.body;
    
    if (!data) {
      return res.status(400).json({ success: false, message: '数据不能为空' });
    }
    
    // 恢复数据
    Object.keys(data).forEach(key => {
      db.data[key] = data[key];
    });
    
    db.addLog(userId, 'RESTORE_DATA', { timestamp: new Date().toISOString() });
    
    res.json({ success: true, message: '数据恢复成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;


