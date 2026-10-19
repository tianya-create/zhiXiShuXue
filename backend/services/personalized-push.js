const db = require("../database/memory-db");
const { calculateMastery } = require("./masteryEngine");
const { eligibleNodes, nodes } = require("./curriculum");
const { getQuestionBankByNode } = require("./manual-question-bank");
function computeMastery(studentId, knowledgePointId) {
  return calculateMastery(studentId, knowledgePointId).mastery;
}
function getColorStatus(studentId, knowledgePointId) {
  const value = calculateMastery(studentId, knowledgePointId);
  return {
    status:
      value.status === "尚未测评"
        ? "gray"
        : value.status === "样本不足"
          ? "blue"
          : value.mastery < 60
            ? "red"
            : value.mastery < 80
              ? "orange"
              : "green",
    mastery: value.mastery,
    label: value.status,
    confidence: value.confidence,
    attemptCount: value.attemptCount,
  };
}
function ensureDemoWrongHistory() {} // Kept temporarily for legacy callers; never creates data.
function getPersonalizedPush(studentId, options = {}) {
  const limit = Math.max(1, Math.min(12, Number(options.limit) || 3));
  const eligible = eligibleNodes(studentId);
  const ranked = eligible
    .map((node) => ({ ...node, ...getColorStatus(studentId, node.id) }))
    .sort((a, b) => (a.mastery ?? -1) - (b.mastery ?? -1));
  const now = Date.now();
  // 一次性取出该生的作答历史、复习计划与近 24h 推荐记录，避免逐题全表扫描
  const attemptsByQuestion = new Map();
  for (const item of db.find("student_answer", { userId: studentId })) {
    const list = attemptsByQuestion.get(item.questionId) || [];
    list.push(item);
    attemptsByQuestion.set(item.questionId, list);
  }
  const scheduleByQuestion = new Map(
    db
      .find("studentQuestionAttempts", { studentId })
      .map((item) => [item.questionId, item]),
  );
  const recentPushed = new Set(
    db
      .find("recommendationLogs")
      .filter(
        (log) =>
          log.studentId === studentId &&
          now - new Date(log.createdAt).getTime() < 86400000,
      )
      .flatMap((log) => log.questionIds || []),
  );
  const questions = [];
  for (const node of ranked) {
    const pool = getQuestionBankByNode({ knowledgePointId: node.id })
      .filter((question) => {
        const history = (attemptsByQuestion.get(question.id) || [])
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const latest = history[0];
        const schedule = scheduleByQuestion.get(question.id);
        if (
          schedule?.nextReviewAt &&
          new Date(schedule.nextReviewAt).getTime() > now
        )
          return false;
        if (
          !schedule?.nextReviewAt &&
          latest &&
          now - new Date(latest.createdAt).getTime() < 86400000
        )
          return false;
        return !recentPushed.has(question.id);
      })
      .sort((a, b) => a.difficultyLevel - b.difficultyLevel);
    const prerequisites = (node.prerequisites || [])
      .filter((id) => eligible.some((item) => item.id === id))
      .filter((id) => {
        const status = getColorStatus(studentId, id);
        return status.mastery !== null && status.mastery < 60;
      });
    if (prerequisites.length) continue;
    for (const question of pool) {
      if (questions.length >= limit) break;
      if (node.mastery === null && question.difficultyLevel > 2) continue;
      questions.push({
        ...question,
        recommendationReason:
          node.mastery === null
            ? "这个知识点尚未测评，先通过基础题了解学习情况。"
            : node.confidence === "limited"
              ? "目前作答样本不足，补充不同题目后再判断掌握情况。"
              : "根据真实答题记录复习已学知识点。",
      });
    }
    if (questions.length >= limit) break;
  }
  if (questions.length)
    db.create("recommendationLogs", {
      studentId,
      questionIds: questions.map((item) => item.id),
      reason: "按已学范围、真实作答和复习间隔选题",
    });
  return {
    studentId,
    questions,
    focusKnowledgePoints: [
      ...new Set(questions.map((item) => item.knowledgeNodeName)),
    ],
    recommendationReason: questions.length
      ? "按已学范围和真实作答推荐。"
      : eligible.length
        ? "当前没有符合复习间隔的已审核题目，可选择知识点专项练习或请老师补充题目。"
        : "请老师先设置班级已学知识点。",
    knowledgePointId: questions[0]?.knowledgePointId || "",
    knowledgePointName: questions[0]?.knowledgeNodeName || "",
  };
}
module.exports = {
  computeMastery,
  getColorStatus,
  getPersonalizedPush,
  ensureDemoWrongHistory,
};
