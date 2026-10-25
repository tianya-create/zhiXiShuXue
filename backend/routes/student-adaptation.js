const express = require("express");
const db = require("../database/memory-db");
const {
  latestDecision,
  getConfig,
  isPresentationProfileDue,
  presentationMode,
  presentationProfile,
  questionnaire,
  savePresentationProfile,
  submitReflection,
} = require("../services/adaptive-learning");

const router = express.Router();
const studentOf = (req) =>
  db.findById("students", req.user.id) ||
  db.findOne("students", { userId: req.user.id });
const run = (handler) => (req, res) => {
  try {
    const student = studentOf(req);
    if (!student) return res.status(404).json({ success: false, message: "学生信息尚未建立" });
    handler(req, res, student);
  } catch (error) {
    res.status(error.status || 400).json({ success: false, message: error.message });
  }
};

const studentProfile = (profile) => profile ? {
  primaryDimensions: profile.primaryDimensions,
  mixed: profile.mixed,
  completedAt: profile.completedAt,
  validUntil: profile.validUntil,
  calibration: profile.calibration,
} : null;
const studentDecision = (decision) => decision ? {
  targetComplexity: decision.targetComplexity,
  sourceComplexity: decision.sourceComplexity,
  difficultyAdjustment: decision.difficultyAdjustment,
  scaffoldLevel: decision.scaffoldLevel,
  pageDensity: decision.pageDensity,
  strategy: decision.strategy,
  guidance: decision.guidance,
  supportAvailable: decision.supportAvailable,
} : null;

router.get(
  "/adaptation/status",
  run((req, res, student) => {
    const profile = presentationProfile(student.id);
    const pendingRound = db
      .find("learningRounds", { studentId: student.id })
      .filter((item) => item.reflectionRequired)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
    res.json({
      success: true,
      data: {
        questionnaireCompleted: Boolean(profile) && !isPresentationProfileDue(profile),
        varkDue: isPresentationProfileDue(profile),
        varkValidityDays: getConfig().varkValidityDays,
        enabledKnowledgePointIds: getConfig().enabledKnowledgePointIds,
        presentationProfile: studentProfile(profile),
        presentationMode: presentationMode(profile),
        pendingRound,
      },
    });
  }),
);

router.get("/presentation-preference/questionnaire", (req, res) =>
  res.json({ success: true, data: questionnaire() }),
);

router.post(
  "/presentation-preference",
  run((req, res, student) => {
    const profile = savePresentationProfile(student.id, student.classId, req.body || {});
    res.json({
      success: true,
      data: { profile: studentProfile(profile), presentationMode: presentationMode(profile) },
      message: "学习资源呈现偏好已保存",
    });
  }),
);

router.get(
  "/learning-rounds/:id/reflection",
  run((req, res, student) => {
    const round = db.findById("learningRounds", req.params.id);
    if (!round || round.studentId !== student.id) return res.sendStatus(404);
    res.json({
      success: true,
      data: {
        round,
        items: [
          { id: "controlItem1", dimension: "control", text: "我有信心掌握刚才涉及的知识点。" },
          { id: "controlItem2", dimension: "control", text: "再遇到相似题，我有信心独立完成。" },
          { id: "cognitiveLoadItem", dimension: "load", text: "完成这组题时，我需要同时处理的信息很多，感觉比较费力。" },
        ],
      },
    });
  }),
);

router.post(
  "/learning-rounds/:id/reflection",
  run((req, res, student) => {
    const data = submitReflection(student.id, req.params.id, req.body || {});
    res.json({
      success: true,
      data: {
        decision: studentDecision(data.decision),
        presentationMode: presentationMode(data.presentationProfile || presentationProfile(student.id)),
      },
      message: "感受已记录，下一轮任务已调整",
    });
  }),
);

// 学生反馈页只返回下一轮安排和鼓励，不暴露控制感分数、等级与原始答案。
router.get(
  "/learning-rounds/:id/feedback",
  run((req, res, student) => {
    const round = db.findById("learningRounds", req.params.id);
    if (!round || round.studentId !== student.id) return res.sendStatus(404);
    const assessment = db.findOne("controlAssessments", { studentId: student.id, roundId: round.id });
    const decision = db.findOne("adaptationDecisions", { studentId: student.id, roundId: round.id });
    const profile = presentationProfile(student.id);
    res.json({
      success: true,
      data: {
        round,
        decision: studentDecision(decision),
        feedbackReady: Boolean(assessment && decision),
        presentationMode: presentationMode(profile),
        presentationProfile: studentProfile(profile),
      },
    });
  }),
);

router.post(
  "/support-requests",
  run((req, res, student) => {
    const round = db.findById("learningRounds", req.body.roundId);
    if (!round || round.studentId !== student.id) throw new Error("学习轮次不存在");
    const existing = db.findOne("teacherSupportRequests", {
      studentId: student.id,
      roundId: round.id,
      status: "open",
    });
    const request = existing || db.create("teacherSupportRequests", {
      studentId: student.id,
      classId: student.classId,
      roundId: round.id,
      knowledgePointId: round.knowledgePointId,
      message: String(req.body.message || "我想请老师帮我梳理一下这组题。 ").trim().slice(0, 300),
      status: "open",
    });
    res.json({ success: true, data: request, message: "已把你的请求告诉老师" });
  }),
);

router.get(
  "/adaptation/next/:knowledgePointId",
  run((req, res, student) => {
    const profile = presentationProfile(student.id);
    res.json({
      success: true,
      data: {
        decision: studentDecision(latestDecision(student.id, req.params.knowledgePointId)),
        presentationMode: presentationMode(profile),
      },
    });
  }),
);

module.exports = router;
