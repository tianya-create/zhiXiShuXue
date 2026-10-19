const express = require('express');
const tutor = require('../services/ai-tutor');
const db = require('../database/memory-db');
const { authenticate, roles } = require('../middleware/access');
const router = express.Router();
router.use(authenticate);
function modelError(error) {
  if (error.response?.status === 402) return '模型服务余额或额度不足，请联系管理员充值或更换可用模型配置';
  if ([401, 403].includes(error.response?.status)) return '模型密钥无效或没有访问权限，请联系管理员检查配置';
  if (error.response?.status === 429) return '模型服务请求过于频繁，请稍后重试';
  if (error.code === 'ECONNABORTED') return '小智响应超时，请稍后重试';
  return '小智暂时无法回复，请联系管理员检查模型配置及网络';
}

// Only configuration status is visible to students; credentials stay on the server.
router.get('/status', (req, res) => {
  try {
    const status = tutor.getTutorConfigStatus();
    const { enabled, configured, ready, model, message } = status;
    res.json({ success: true, data: { enabled, configured, ready, model, message } });
  } catch {
    res.json({ success: true, data: { ready: false, message: 'AI助教配置无法读取，请联系管理员重新配置密钥' } });
  }
});

const requests = new Map();
router.post('/chat', roles('student'), async (req, res) => {
  const { question, history = [], mode = 'chat' } = req.body || {};
  if (typeof question !== 'string' || !['chat', 'problem'].includes(mode) ||
      !Array.isArray(history) || history.length > 8 || history.some(item =>
        !item || !['user', 'assistant'].includes(item.role) || typeof item.content !== 'string' || item.content.length > 5000)) {
    return res.status(400).json({ success: false, message: '对话内容格式无效' });
  }
  const validation = tutor.validateQuestion(question, mode);
  if (!validation.valid) return res.status(400).json({ success: false, message: validation.reason });
  const now = Date.now();
  for (const [id, entry] of requests) if (!entry.busy && now - entry.start > 60000) requests.delete(id);
  const state = requests.get(req.user.id) || { start: now, count: 0, busy: false };
  if (state.busy || state.count >= 12) return res.status(429).json({ success: false, message: '提问较频繁，请稍后再试' });
  state.count++; state.busy = true; requests.set(req.user.id, state);
  try {
    const status = tutor.getTutorConfigStatus();
    if (!status.ready) return res.status(503).json({ success: false, message: status.message });
    const answer = await tutor.askAiTutor(history, question.trim(), mode);
    res.json({ success: true, data: { role: 'assistant', ...answer, mode } });
  } catch (error) {
    const timeout = error.code === 'ECONNABORTED';
    res.status(timeout ? 504 : 502).json({ success: false, message: modelError(error) });
  } finally { state.busy = false; }
});

router.use('/settings', roles('admin'));
router.get('/settings', (req, res) => {
  try { res.json({ success: true, data: tutor.getAdminSettingsView() }); }
  catch { res.status(400).json({ success: false, message: '配置密钥无法读取，请检查 SETTINGS_SECRET 是否发生变更' }); }
});
function nextSettings(body) {
  const next = tutor.buildAdminSettingsPayload(db.data.settings, body);
  if (next.aiTutorApiEndpoint) {
    const url = new URL(next.aiTutorApiEndpoint);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('INVALID_ENDPOINT');
  }
  if ((next.aiTutorModel || '').length > 200) throw new Error('INVALID_MODEL');
  return next;
}
router.put('/settings', (req, res) => {
  try {
    db.data.settings = nextSettings(req.body || {});
    db.addLog(req.user.id, 'UPDATE_AI_TUTOR_SETTINGS', { enabled: db.data.settings.aiTutorEnabled });
    res.json({ success: true, data: tutor.getAdminSettingsView() });
  } catch { res.status(400).json({ success: false, message: '配置无效，请检查接口地址、模型及加密密钥' }); }
});
router.post('/validate', roles('admin'), async (req, res) => {
  try {
    const config = tutor.getTutorConfig(nextSettings(req.body || {}));
    const message = await tutor.validateRemoteConfig(config);
    if (!message) throw new Error('EMPTY_TUTOR_REPLY');
    res.json({ success: true, data: { message: '连接测试成功' } });
  } catch (error) { res.status(400).json({ success: false, message: modelError(error) }); }
});
module.exports = router;
