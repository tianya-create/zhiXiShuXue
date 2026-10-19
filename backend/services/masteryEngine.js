const db = require('../database/memory-db');

function getStatus(mastery) {
  if (mastery === null || mastery === undefined) return '尚未测评';
  if (mastery >= 80) return '已掌握';
  if (mastery >= 60) return '待巩固';
  return '薄弱';
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, item) => sum + item, 0) / values.length;
}

function getKnowledgeAttempts(userId, kpCode) {
  return db.find('student_answer')
    .filter((item) => item.userId === userId && item.kpCode === kpCode)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

// 掌握度按（用户, 知识点, 数据版本）缓存：学生端 weak-points 会连算 30+ 个知识点，
// 不缓存时每个请求都要对答题记录做几十次全表过滤。
let masteryCache = { key: null, value: null };

function calculateMastery(userId, kpCode) {
  const key = userId + '|' + kpCode + '|' + db.version;
  if (masteryCache.key === key) return masteryCache.value;
  const attempts = getKnowledgeAttempts(userId, kpCode);
  const latest10 = attempts.slice(-10);
  const distinctQuestions = new Set(latest10.map(item => item.questionId)).size;
  const sufficient = latest10.length >= 5 && distinctQuestions >= 3;
  const correctRate = latest10.length
    ? latest10.filter((item) => item.isCorrect).length / latest10.length
    : 0;
  let mastery = latest10.length ? Math.round(correctRate * 100) : null;

  const last3 = attempts.slice(-3);
  const last2 = attempts.slice(-2);
  const historicalTime = average(attempts.slice(0, -3).map((item) => Number(item.costTime || 0)).filter(Boolean));
  const last3Time = average(last3.map((item) => Number(item.costTime || 0)).filter(Boolean));

  if (last3.length === 3 && last3.every((item) => item.isCorrect) && (!historicalTime || last3Time <= historicalTime * 1.2)) {
    mastery = Math.min(100, mastery + 10);
  }

  if (last2.length === 2 && last2.every((item) => !item.isCorrect)) {
    mastery = Math.max(0, mastery - 10);
  }

  const result = {
    userId,
    kpCode,
    mastery: !sufficient && mastery !== null ? Math.min(79, mastery) : mastery,
    status: !attempts.length ? '尚未测评' : !sufficient ? '样本不足' : getStatus(mastery),
    confidence: sufficient ? 'sufficient' : attempts.length ? 'limited' : 'none',
    distinctQuestions,
    correctRate: Number(correctRate.toFixed(2)),
    attemptCount: attempts.length,
    updatedAt: new Date().toISOString()
  };
  masteryCache = { key, value: result };
  return result;

}

function updateMastery(userId, kpCode) {
  const payload = calculateMastery(userId, kpCode);
  const existing = db.findOne('student_knowledge_mastery', { userId, kpCode });
  if (existing) {
    return db.updateById('student_knowledge_mastery', existing.id, payload);
  }

  return db.create('student_knowledge_mastery', payload);
}

function getTrend(userId, kpCode, days) {
  const since = Date.now() - Number(days || 30) * 24 * 60 * 60 * 1000;
  return db.find('mastery_snapshot')
    .filter((item) => item.userId === userId && item.kpCode === kpCode && new Date(item.snapshotAt).getTime() >= since)
    .sort((a, b) => new Date(a.snapshotAt) - new Date(b.snapshotAt));
}

module.exports = {
  getStatus,
  calculateMastery,
  updateMastery,
  getTrend
};
