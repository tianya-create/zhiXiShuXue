const WebSocket = require('ws');

let wss = null;
const clients = new Map();

function initWebSocketServer(server) {
  wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', (socket, req) => {
    const url = new URL(req.url, 'http://localhost');
    let userId;
    try {
      const { tokenFrom, getSecret } = require('../middleware/access');
      const decoded = require('jsonwebtoken').verify(tokenFrom(req) || '', getSecret(), { algorithms: ['HS256'] });
      const user = require('../database/memory-db').data.users.find(item => item.id === decoded.userId);
      if (!user || (user.tokenVersion || 0) !== (decoded.tokenVersion || 0)) throw new Error('invalid session');
      userId = user.id;
    } catch { socket.close(1008, '请重新登录'); return; }
    if (userId) {
      if (!clients.has(userId)) clients.set(userId, new Set());
      clients.get(userId).add(socket);
    }

    socket.on('close', () => {
      if (userId && clients.has(userId)) {
        clients.get(userId).delete(socket);
        if (!clients.get(userId).size) clients.delete(userId);
      }
    });
  });

  return wss;
}

function broadcastToUser(userId, event, payload) {
  const group = clients.get(String(userId || ''));
  if (!group) return;
  const message = JSON.stringify({ event, payload });
  group.forEach((socket) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(message);
    }
  });
}

module.exports = {
  initWebSocketServer,
  broadcastToUser
};
