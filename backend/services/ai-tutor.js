const axios = require('axios');
const crypto = require('crypto');
const db = require('../database/memory-db');

const JUNIOR_MATH_KEYWORDS = [
  '初中数学', '七年级', '八年级', '九年级', '有理数', '整式', '分式', '方程', '不等式', '函数', '一次函数',
  '反比例函数', '二次函数', '几何', '三角形', '四边形', '圆', '相似', '全等', '勾股', '统计', '概率', '坐标',
  '平面直角坐标系', '数据分析', '因式分解', '根式', '实数', '应用题', '证明题', '辅助线', '中位线', '角平分线',
  '相交线', '平行线', '一次方程组', '二元一次方程组', '代数式', '单项式', '多项式', '绝对值', '平均数', '中位数'
];

const MATH_SYMBOL_PATTERN = /[=><≤≥≠≈+\-×÷\/\^√π%]|\b[xyzabc]\b|\d+/i;
const DIRECT_ANSWER_RISK_PATTERN = /(最终答案|直接答案|给我答案|只要答案|答案是多少|求答案|告诉我结果|选[ABCD]|正确答案)/i;
const QUESTION_PATTERN = /(解|求|计算|证明|已知|若|如图|方程|不等式|函数|几何|题目|选择题|填空题)/i;

function getSecret() {
  return process.env.SETTINGS_SECRET || process.env.APP_SECRET || 'zhixi-math-secret';
}

function getEnvTutorConfig() {
  return {
    provider: String(process.env.AI_TUTOR_PROVIDER || process.env.BAILIAN_PROVIDER || 'aliyun-bailian').trim(),
    endpoint: String(process.env.AI_TUTOR_API_ENDPOINT || process.env.BAILIAN_API_ENDPOINT || '').trim(),
    model: String(process.env.AI_TUTOR_MODEL || process.env.BAILIAN_MODEL || '').trim(),
    apiKey: String(process.env.AI_TUTOR_API_KEY || process.env.BAILIAN_API_KEY || '').trim()
  };
}

function normalizeSettings(raw) {
  const settings = raw || {};
  return {
    aiTutorEnabled: settings.aiTutorEnabled !== false,
    aiTutorApiEndpoint: settings.aiTutorApiEndpoint || settings.llmApiEndpoint || '',
    aiTutorModel: settings.aiTutorModel || settings.llmModel || '',
    aiTutorProvider: settings.aiTutorProvider || 'openai-compatible',
    aiTutorApiKeyEncrypted: settings.aiTutorApiKeyEncrypted || '',
    aiTutorKnowledgeScope: Array.isArray(settings.aiTutorKnowledgeScope) && settings.aiTutorKnowledgeScope.length
      ? settings.aiTutorKnowledgeScope
      : db.find('knowledgePoints').map(function (item) { return item.name; })
  };
}

function encryptSecret(plainText) {
  if (!plainText) return '';
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash('sha256').update(getSecret()).digest();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decryptSecret(cipherText) {
  if (!cipherText) return '';
  const buffer = Buffer.from(cipherText, 'base64');
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);
  const key = crypto.createHash('sha256').update(getSecret()).digest();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

function maskSecret(secret) {
  if (!secret) return '';
  if (secret.length <= 8) return '*'.repeat(secret.length);
  return secret.slice(0, 3) + '*'.repeat(Math.max(4, secret.length - 7)) + secret.slice(-4);
}

function getTutorConfig() {
  const settings = normalizeSettings(db.settings);
  const envConfig = getEnvTutorConfig();
  const storedApiKey = settings.aiTutorApiKeyEncrypted ? decryptSecret(settings.aiTutorApiKeyEncrypted) : '';
  const apiKey = envConfig.apiKey || storedApiKey;
  return {
    enabled: settings.aiTutorEnabled,
    provider: envConfig.provider || settings.aiTutorProvider,
    endpoint: envConfig.endpoint || settings.aiTutorApiEndpoint,
    model: envConfig.model || settings.aiTutorModel,
    apiKey: apiKey,
    knowledgeScope: settings.aiTutorKnowledgeScope,
    managedByEnv: Boolean(envConfig.apiKey || envConfig.endpoint || envConfig.model)
  };
}

function buildAdminSettingsPayload(currentSettings, updates) {
  const next = { ...currentSettings };
  if (Object.prototype.hasOwnProperty.call(updates, 'aiTutorEnabled')) {
    next.aiTutorEnabled = updates.aiTutorEnabled !== false;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'aiTutorProvider')) {
    next.aiTutorProvider = String(updates.aiTutorProvider || 'openai-compatible').trim();
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'aiTutorApiEndpoint')) {
    next.aiTutorApiEndpoint = String(updates.aiTutorApiEndpoint || '').trim();
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'aiTutorModel')) {
    next.aiTutorModel = String(updates.aiTutorModel || '').trim();
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'aiTutorKnowledgeScope')) {
    next.aiTutorKnowledgeScope = Array.isArray(updates.aiTutorKnowledgeScope)
      ? updates.aiTutorKnowledgeScope.map(function (item) { return String(item || '').trim(); }).filter(Boolean)
      : next.aiTutorKnowledgeScope;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'aiTutorApiKey')) {
    const incomingKey = String(updates.aiTutorApiKey || '').trim();
    if (incomingKey) {
      next.aiTutorApiKeyEncrypted = encryptSecret(incomingKey);
    }
  }
  return next;
}

function getAdminSettingsView() {
  const config = getTutorConfig();
  return {
    aiTutorEnabled: config.enabled,
    aiTutorProvider: config.provider,
    aiTutorApiEndpoint: config.endpoint,
    aiTutorModel: config.model,
    aiTutorApiKeyMasked: maskSecret(config.apiKey),
    aiTutorConfigured: Boolean(config.apiKey && config.endpoint && config.model),
    aiTutorManagedByEnv: config.managedByEnv,
    aiTutorKnowledgeScope: config.knowledgeScope
  };
}

function getTutorConfigStatus() {
  const config = getTutorConfig();
  const missing = [];
  if (!config.endpoint) missing.push('API Endpoint');
  if (!config.model) missing.push('Model');
  if (!config.apiKey) missing.push('API Key');

  const configured = missing.length === 0;
  return {
    enabled: config.enabled,
    configured,
    ready: config.enabled && configured,
    provider: config.provider,
    endpoint: config.endpoint,
    model: config.model,
    apiKeyMasked: maskSecret(config.apiKey),
    managedByEnv: config.managedByEnv,
    missing,
    message: !config.enabled
      ? 'AI助教功能暂未开启'
      : configured
        ? 'AI助教配置完整，可正常发起对话'
        : 'AI助教配置不完整：缺少 ' + missing.join('、')
  };
}

function isJuniorMathRelated(text) {
  const normalized = String(text || '').trim();
  if (!normalized) return false;
  if (JUNIOR_MATH_KEYWORDS.some(function (keyword) { return normalized.includes(keyword); })) return true;
  if (MATH_SYMBOL_PATTERN.test(normalized) && QUESTION_PATTERN.test(normalized)) return true;
  return false;
}

function isProblemSolvingRequest(text) {
  const normalized = String(text || '').trim();
  return DIRECT_ANSWER_RISK_PATTERN.test(normalized) || (MATH_SYMBOL_PATTERN.test(normalized) && QUESTION_PATTERN.test(normalized));
}

function normalizeTutorMode(mode) {
  return String(mode || '').trim() === 'problem' ? 'problem' : 'chat';
}

function validateQuestion(text, mode) {
  const normalized = String(text || '').trim();
  const tutorMode = normalizeTutorMode(mode);
  if (!normalized) {
    return { valid: false, reason: '请输入内容后再发送。' };
  }
  if (normalized.length > 500) {
    return { valid: false, reason: '问题过长，请精简到 500 字以内。' };
  }
  if (tutorMode === 'chat') {
    if (/(作文|英语|历史|政治|地理|生物|化学|物理实验)/.test(normalized)) {
      return { valid: false, reason: '普通聊天模式也仅支持初中数学范围。' };
    }
    return { valid: true, reason: '' };
  }
  if (!isJuniorMathRelated(normalized)) {
    return { valid: false, reason: '题目提问模式仅支持初中数学题目或知识点。' };
  }
  return { valid: true, reason: '' };
}

function buildSystemPrompt(mode) {
  const tutorMode = normalizeTutorMode(mode);
  const knowledgePoints = db.find('knowledgePoints').map(function (item) { return item.name; }).join('、');
  const modeInstruction = tutorMode === 'problem'
    ? '当前是题目提问模式：如果用户给出具体题目或要求答案，只能提供分步思路、考点分析、易错点提醒、下一步提示，不得直接给出最终答案、选项字母或完整结果。'
    : '当前是普通聊天模式：可以像数学学习助手一样自然交流，解释概念、总结方法、安慰鼓励、规划复习，但仍然只讨论初中数学范围。';
  return [
    '你是“AI助教小智”，服务对象是初中学生。',
    '你只能讨论初中数学相关内容，范围以这些知识点为主：' + knowledgePoints + '。',
    '如果用户问题超出初中数学范围，必须礼貌拒绝，并提醒只能咨询初中数学。',
    modeInstruction,
    '优先使用“解题思路”“先做什么”“再检查什么”的表达。',
    '回答要简洁、友好、适合学生阅读。'
  ].join('\n');
}

function sanitizeTutorReply(reply, isProblem) {
  let text = String(reply || '').trim();
  if (!text) {
    text = '我可以帮你分析初中数学题目的考点、思路和步骤提示。';
  }
  if (isProblem) {
    text = text
      .replace(/最终答案[：:]/g, '关键结论：')
      .replace(/答案[：:]/g, '思路提示：')
      .replace(/正确选项[是为]?\s*[A-D]/gi, '可先根据题意逐项排除')
      .replace(/选[项]?\s*[A-D]/gi, '对应选项');
    if (/^\s*[A-D]\s*$/.test(text) || /^\s*\d+(\.\d+)?\s*$/.test(text)) {
      text = '这道题我不能直接给出结果，但可以带你一步步分析条件、列式并检查关键步骤。';
    }
  }
  return text;
}

async function validateRemoteConfig(config) {
  if (!config.endpoint || !config.model || !config.apiKey) {
    throw new Error('请先完善 AI 助教的 API Endpoint、Model 和 API Key 配置');
  }
  const payload = {
    model: config.model,
    messages: [
      { role: 'system', content: buildSystemPrompt(config.mode) },
      { role: 'user', content: '请用一句话回复：配置校验成功。' }
    ],
    temperature: 0.2,
    max_tokens: 60
  };

  const response = await axios.post(config.endpoint, payload, {
    timeout: 10000,
    headers: {
      Authorization: 'Bearer ' + config.apiKey,
      'Content-Type': 'application/json'
    }
  });
  return extractTextFromResponse(response.data);
}

function extractTextFromResponse(data) {
  if (data && Array.isArray(data.choices) && data.choices[0] && data.choices[0].message) {
    return String(data.choices[0].message.content || '').trim();
  }
  if (data && data.output_text) {
    return String(data.output_text).trim();
  }
  if (data && Array.isArray(data.output)) {
    const outputItem = data.output.find(function (item) { return item.type === 'message'; });
    if (outputItem && Array.isArray(outputItem.content)) {
      const textItem = outputItem.content.find(function (item) { return item.type === 'output_text' || item.type === 'text'; });
      if (textItem) return String(textItem.text || '').trim();
    }
  }
  return '';
}

async function askAiTutor(messages, question, mode) {
  const config = getTutorConfig();
  if (!config.enabled) {
    throw new Error('AI助教功能暂未开启');
  }
  if (!config.endpoint || !config.model || !config.apiKey) {
    throw new Error('AI助教尚未完成配置，请联系管理员');
  }

  const tutorMode = normalizeTutorMode(mode);
  const isProblem = tutorMode === 'problem' || isProblemSolvingRequest(question);
  const payload = {
    model: config.model,
    messages: [
      { role: 'system', content: buildSystemPrompt(tutorMode) },
      ...messages.map(function (item) {
        return { role: item.role === 'assistant' ? 'assistant' : 'user', content: String(item.content || '') };
      }),
      {
        role: 'user',
        content: tutorMode === 'problem'
          ? '当前是题目提问模式，请只给我解题思路、考点、关键步骤提示和易错点，不要直接给最终答案。题目：' + question
          : '当前是普通聊天模式，请用数学学习助手的语气自然回答：' + question
      }
    ],
    temperature: 0.4,
    max_tokens: 280
  };

  const response = await axios.post(config.endpoint, payload, {
    timeout: 10000,
    headers: {
      Authorization: 'Bearer ' + config.apiKey,
      'Content-Type': 'application/json'
    }
  });

  return {
    content: sanitizeTutorReply(extractTextFromResponse(response.data), isProblem),
    isProblem: isProblem
  };
}

module.exports = {
  buildAdminSettingsPayload,
  getAdminSettingsView,
  getTutorConfigStatus,
  getTutorConfig,
  validateQuestion,
  isJuniorMathRelated,
  isProblemSolvingRequest,
  askAiTutor,
  validateRemoteConfig,
  encryptSecret,
  decryptSecret,
  sanitizeTutorReply,
  getEnvTutorConfig,
  normalizeTutorMode
};
