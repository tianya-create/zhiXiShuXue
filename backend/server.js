require('dotenv').config();
const app = require('./app');
const { initWebSocketServer } = require('./websocket/server');
const { startDailySnapshotJob } = require('./cron/dailySnapshot');
const PORT = process.env.API_PORT || 5001;
const server = app.listen(PORT, process.env.API_HOST || '127.0.0.1', () => {
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
