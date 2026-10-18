require('dotenv').config();
const express = require('express');
const compression = require('compression');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { initWebSocketServer } = require('./websocket/server');
const { startDailySnapshotJob } = require('./cron/dailySnapshot');
const { initializeSmartLearningModels } = require('./models');
const { seedDemoData } = require('./seed/demo_data');

const app = express();
const PORT = process.env.API_PORT || 5001;

app.use(compression());
app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(function (req, res, next) {
  req.setTimeout(15000);
  res.setTimeout(15000);
  next();
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

require('./database/migrate-questions-to-sqlite');
initializeSmartLearningModels();
seedDemoData();
// 把 shared/knowledge-tree.json 的教材目录同步进库（知识点扩容后自动补齐）
require('./services/curriculum-sync').syncCurriculum();

// 启动数据（默认账号/演示数据）落盘，避免首次启动后重启丢失
try {
  const db = require('./database/memory-db');
  db.flushAll();
  console.log('[persist] 启动数据已落盘');
} catch (e) {
  console.error('[persist] 启动落盘失败:', e.message);
}

const { authMiddleware } = require('./middleware');
const { privateResponse, teacherGuard } = require('./middleware/access');

// 统一鉴权：校验 JWT 并把令牌身份写入 x-user-id（封堵伪造身份）
app.use('/api', authMiddleware);

// 行级 ACL 的第一层：响应脱敏 + 建立当前请求的操作者上下文
// （放在鉴权之后、业务路由之前，确保每个响应都不会漏出密码哈希与密钥）
app.use('/api', privateResponse);

// 行级 ACL 的第二层：教师端的对象级越权拦截（防 IDOR）
app.use('/api/teacher', teacherGuard);

const authRoutes = require('./routes/auth');
const teacherRoutes = require('./routes/teacher');
const studentRoutes = require('./routes/student');
const adminRoutes = require('./routes/admin');
const accountRoutes = require('./routes/accounts');
const aiTutorAdminRoutes = require('./routes/ai-tutor-admin');
const commonRoutes = require('./routes/common');

app.use('/api/auth', authRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/student', studentRoutes);
// 账号治理路由先挂载：其中 PUT/DELETE /users/:id 是 admin.js 同名接口的加强版
app.use('/api/admin', accountRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/ai-tutor', aiTutorAdminRoutes);
app.use('/api/common', commonRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '服务运行正常' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: '服务器内部错误', error: err.message });
});

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const server = app.listen(PORT, () => {
  console.log(`后端服务运行在端口 ${PORT}`);
  console.log(`API 地址: http://localhost:${PORT}/api`);
});

server.on('error', (error) => {
  if (error && error.code === 'EADDRINUSE') {
    console.log(`端口 ${PORT} 已被占用，检测到可能已有后端服务正在运行，已跳过重复启动。`);
    process.exit(0);
  }
  throw error;
});

initWebSocketServer(server);
startDailySnapshotJob();
