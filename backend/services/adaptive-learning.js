const db = require("../database/memory-db");
const { canonicalKnowledgeId } = require("./question-map");

const DEFAULT_CONFIG = Object.freeze({
  enabled: true,
  ruleVersion: "adaptive-v2.0",
  roundSize: 5,
  varkValidityDays: 7,
  mixedPreferenceGapMax: 0.5,
  controlLowMax: 4,
  controlHighMin: 8,
  perceivedLoadLowMax: 2,
  perceivedLoadHighMin: 4,
  accuracyLowMax: 0.6,
  accuracyHighMin: 0.8,
  presentationCalibration: {
    minEvidenceRounds: 6,
    windowSize: 8,
    lowAccuracyMax: 0.6,
    lowControlMax: 4,
    expansionScoreGapMax: 0.5,
  },
  enabledKnowledgePointIds: ["alg-1", "alg-2", "algebra-3", "alg-3"],
});
const COMPLEXITIES = ["low", "medium", "high"];
const EMOTIONS = ["tired", "worried", "steady", "confident", "energized"];
const PREFERENCE_DIMENSIONS = ["V", "A", "R", "K"];

const PREFERENCE_QUESTIONS = [
  ["V1", "V", "学习新数学知识点时，我喜欢看思维导图或示意图把关系“画出来”。"],
  ["V2", "V", "理解函数图像平移时，我更倾向于看图像动态变化的示意图。"],
  ["V3", "V", "整理错题时，我习惯在错题旁画个图来帮助理解。"],
  ["A1", "A", "学习数学概念时，我更喜欢听老师口头讲解思路。"],
  ["A2", "A", "遇到不会的题，我更容易从语音旁白中听懂关键步骤。"],
  ["A3", "A", "复习时，把解题思路说出来或听一遍讲解对我更有效。"],
  ["R1", "R", "复习时，我觉得重新整理一遍文字笔记和公式对我最有效。"],
  ["R2", "R", "自学新方法时，我喜欢找一篇文字教程从头读到尾。"],
  ["R3", "R", "记忆公式时，我通常会抄写几遍，边抄边看文字。"],
  ["K1", "K", "学习新知识时，我倾向于直接做几道例题，边做边体会。"],
  ["K2", "K", "面对几何证明题时，我通常会直接尝试从条件往下推导几步。"],
  ["K3", "K", "当想确认自己是否理解概念时，我会试着用它去解一道新题。"],
].map(([id, dimension, text]) => ({ id, dimension, text }));

function getConfig() {
  const saved = db.settings.adaptiveLearning || {};
  const legacy = !saved.ruleVersion || /^adaptive-v1\./.test(saved.ruleVersion);
  const compatibleSaved = legacy
    ? {
        ...(saved.enabled === undefined ? {} : { enabled: saved.enabled }),
        ...(Array.isArray(saved.enabledKnowledgePointIds)
          ? { enabledKnowledgePointIds: saved.enabledKnowledgePointIds }
          : {}),
      }
    : saved;
  return {
    ...DEFAULT_CONFIG,
    ...compatibleSaved,
    presentationCalibration: {
      ...DEFAULT_CONFIG.presentationCalibration,
      ...(!legacy ? saved.presentationCalibration || {} : {}),
    },
  };
}

function normalizedKnowledgePointId(value) {
  return canonicalKnowledgeId(value);
}

function isEnabledForKnowledgePoint(value) {
  const config = getConfig();
  return Boolean(
    config.enabled &&
      config.enabledKnowledgePointIds.includes(normalizedKnowledgePointId(value)),
  );
}

function complexityOf(question) {
  if (COMPLEXITIES.includes(question?.cognitiveLoadLevel)) return question.cognitiveLoadLevel;
  if (COMPLEXITIES.includes(question?.taskComplexity)) return question.taskComplexity;
  const level = Number(question?.difficultyLevel) || { easy: 1, medium: 3, hard: 5 }[question?.difficulty] || 3;
  return level <= 2 ? "low" : level >= 4 ? "high" : "medium";
}

function aggregateComplexity(questions) {
  if (!questions.length) return "medium";
  const average = questions.reduce((sum, item) => sum + COMPLEXITIES.indexOf(complexityOf(item)), 0) / questions.length;
  return COMPLEXITIES[Math.max(0, Math.min(2, Math.round(average)))];
}

function resolvedPerformance(results) {
  const resolved = (results || []).filter(
    (item) => !item.needsReview && typeof item.correct === "boolean",
  );
  return {
    resolvedCount: resolved.length,
    correctCount: resolved.filter((item) => item.correct).length,
    accuracy: resolved.length
      ? resolved.filter((item) => item.correct).length / resolved.length
      : null,
  };
}

function createLearningRound({ student, sourceType, sourceRecord, questions, knowledgePointId }) {
  const kp = normalizedKnowledgePointId(
    knowledgePointId || questions[0]?.knowledgePointId || questions[0]?.knowledgePoints?.[0],
  );
  if (!isEnabledForKnowledgePoint(kp)) return null;
  const config = getConfig();
  if (sourceType !== "practice") return null;
  if (questions.length !== config.roundSize) {
    const error = new Error(`一轮薄弱练习必须完整提交 ${config.roundSize} 道题`);
    error.status = 422;
    throw error;
  }
  if (questions.some((item) => normalizedKnowledgePointId(
    item.knowledgePointId || item.knowledgePoints?.[0],
  ) !== kp)) {
    const error = new Error("一轮薄弱练习的题目必须属于同一知识点");
    error.status = 422;
    throw error;
  }
  const existing = db.findOne("learningRounds", {
    studentId: student.id,
    sourceRecordId: sourceRecord.id,
  });
  if (existing) return existing;
  const questionIds = questions.map((item) => item.id);
  const performance = resolvedPerformance(
    (sourceRecord.questionResults || []).filter((item) => questionIds.includes(item.questionId)),
  );
  const awaitingReview = performance.resolvedCount === 0;
  return db.create("learningRounds", {
    studentId: student.id,
    classId: student.classId,
    sourceType,
    sourceRecordId: sourceRecord.id,
    knowledgePointId: kp,
    questionIds,
    taskComplexity: aggregateComplexity(questions),
    ...performance,
    status: awaitingReview ? "pending_review" : "awaiting_reflection",
    reflectionRequired: !awaitingReview,
    ruleVersion: config.ruleVersion,
  });
}

function finalizePendingLearningRound(sourceRecord) {
  const round = db.findOne("learningRounds", { sourceRecordId: sourceRecord.id });
  if (!round || round.status !== "pending_review") return round || null;
  const performance = resolvedPerformance(
    (sourceRecord.questionResults || []).filter((item) => round.questionIds.includes(item.questionId)),
  );
  if (!performance.resolvedCount) return round;
  return db.updateById("learningRounds", round.id, {
    ...performance,
    status: "awaiting_reflection",
    reflectionRequired: true,
  });
}

function controlLevel(score, config = getConfig()) {
  if (score <= config.controlLowMax) return "low";
  if (score >= config.controlHighMin) return "high";
  return "medium";
}

function accuracyLevel(accuracy, config = getConfig()) {
  if (accuracy < config.accuracyLowMax) return "low";
  if (accuracy > config.accuracyHighMin) return "high";
  return "medium";
}

function perceivedLoadLevel(score, config = getConfig()) {
  if (score <= config.perceivedLoadLowMax) return "low";
  if (score >= config.perceivedLoadHighMin) return "high";
  return "medium";
}

function guidanceFor(level, accuracyBand) {
  if (level === "low") {
    return {
      tone: "supportive",
      title: "先把这一步走稳，我们慢慢来",
      message: "暂时没把握很正常。下一轮会拆成更小的步骤、减少页面干扰；先完成一个看得见的小目标，再慢慢把方法理清。",
      emoji: "🌱",
    };
  }
  if (level === "high") {
    return {
      tone: "challenging",
      title: accuracyBand === "high" ? "有把握，更要把理由说清楚" : "信心很好，再用结果校准方法",
      message: accuracyBand === "high"
        ? "下一轮会增加变式或迁移要求。别只追求做得快，请写出关键依据，看看方法能否经得住变化。"
        : "你有信心是优势，但这轮还有可校准的地方。先定位错误步骤，再保持同等难度验证一次。",
      emoji: "🎯",
    };
  }
  return {
    tone: "steady",
    title: "节奏合适，继续稳稳推进",
    message: "保持现在的节奏，先核对关键步骤，再进入下一组。遇到卡点可以随时展开提示。",
    emoji: "✨",
  };
}

function shiftComplexity(current, adjustment) {
  const index = COMPLEXITIES.indexOf(current);
  return COMPLEXITIES[Math.max(0, Math.min(2, (index < 0 ? 1 : index) + adjustment))];
}

function proposeDecision(round, assessment) {
  const config = getConfig();
  const control = controlLevel(assessment.controlScore, config);
  const accuracyBand = accuracyLevel(round.accuracy, config);
  let adjustment = 0;
  let scaffoldLevel = "medium";
  let pageDensity = "standard";
  let strategy = "保持当前难度，继续观察表现与感受。";

  const load = assessment.perceivedLoadLevel;

  // 低控制感且主观认知负荷高时强制降一级；否则按正确率决定升降。
  if (control === "low" && load === "high") {
    adjustment = -1;
    scaffoldLevel = "high";
    pageDensity = "low";
    strategy = "推送低认知负荷的分步小题，精简题干并增加留白，先建立稳定的完成体验。";
  } else if (accuracyBand === "low") {
    adjustment = -1;
    scaffoldLevel = "high";
    pageDensity = "low";
    strategy = "正确率低于 60%，下一轮降低一级复杂度并增加分步提示。";
  } else if (accuracyBand === "high") {
    adjustment = 1;
    scaffoldLevel = "low";
    strategy = "正确率高于 80%，下一轮推送同知识点变式并适度提升复杂度。";
  }

  const targetComplexity = shiftComplexity(round.taskComplexity, adjustment);
  const previousAssessment = db
    .find("controlAssessments", { studentId: round.studentId })
    .filter(
      (item) =>
        item.id !== assessment.id &&
        item.knowledgePointId === round.knowledgePointId,
    )
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  return {
    controlLevel: control,
    perceivedLoadLevel: load,
    accuracyLevel: accuracyBand,
    difficultyAdjustment: adjustment,
    targetComplexity,
    scaffoldLevel,
    pageDensity,
    strategy,
    upgradeEligible: accuracyBand === "high" && !(control === "low" && load === "high"),
    upgradePending: false,
    supportAvailable:
      control === "low" && previousAssessment?.controlLevel === "low",
    guidance: guidanceFor(control, accuracyBand),
    ruleVersion: config.ruleVersion,
  };
}

function validateLikert(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 5)
    throw new Error(`${label}应为 1 到 5 分`);
  return number;
}

function submitReflection(studentId, roundId, input) {
  const round = db.findById("learningRounds", roundId);
  if (!round || round.studentId !== studentId) throw new Error("学习轮次不存在");
  if (round.status === "pending_review") throw new Error("本轮仍在等待教师复核");
  const existing = db.findOne("controlAssessments", { studentId, roundId });
  if (existing) {
    return {
      assessment: existing,
      decision: db.findOne("adaptationDecisions", { studentId, roundId }),
    };
  }
  const controlItem1 = validateLikert(input.controlItem1, "控制感第 1 题");
  const controlItem2 = validateLikert(input.controlItem2, "控制感第 2 题");
  const cognitiveLoadItem = validateLikert(input.cognitiveLoadItem, "认知负荷题");
  if (!EMOTIONS.includes(input.emotion)) throw new Error("请选择此刻的感受");
  const controlScore = controlItem1 + controlItem2;
  return db.transaction(() => {
    const assessment = db.create("controlAssessments", {
      studentId,
      classId: round.classId,
      roundId,
      knowledgePointId: round.knowledgePointId,
      emotion: input.emotion,
      answers: { controlItem1, controlItem2, cognitiveLoadItem },
      controlScore,
      controlLevel: controlLevel(controlScore),
      perceivedLoadScore: cognitiveLoadItem,
      perceivedLoadLevel: perceivedLoadLevel(cognitiveLoadItem),
      ruleVersion: getConfig().ruleVersion,
    });
    const decision = db.create("adaptationDecisions", {
      studentId,
      classId: round.classId,
      roundId,
      knowledgePointId: round.knowledgePointId,
      sourceComplexity: round.taskComplexity,
      accuracy: round.accuracy,
      ...proposeDecision(round, assessment),
    });
    const presentation = recordPresentationLearningEvidence(round, assessment);
    db.updateById("learningRounds", round.id, {
      status: "adapted",
      reflectionRequired: false,
      assessmentId: assessment.id,
      decisionId: decision.id,
    });
    return {
      assessment,
      decision,
      presentationProfile: presentation.profile,
      presentationEvent: presentation.event,
    };
  });
}

function latestDecision(studentId, knowledgePointId) {
  const kp = normalizedKnowledgePointId(knowledgePointId);
  return db
    .find("adaptationDecisions", { studentId })
    .filter((item) => item.knowledgePointId === kp)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
}

function questionnaire() {
  return {
    version: "vark-math-v2.0",
    scale: { min: 1, max: 5 },
    questions: PREFERENCE_QUESTIONS,
  };
}

function savePresentationProfile(studentId, classId, input) {
  const answers = input.answers || {};
  const normalized = {};
  for (const item of PREFERENCE_QUESTIONS)
    normalized[item.id] = validateLikert(answers[item.id], `题目 ${item.id}`);
  const scores = Object.fromEntries(
    PREFERENCE_DIMENSIONS.map((dimension) => {
      const items = PREFERENCE_QUESTIONS.filter((item) => item.dimension === dimension);
      const average = items.reduce((sum, item) => sum + normalized[item.id], 0) / items.length;
      return [dimension, Number(average.toFixed(2))];
    }),
  );
  const dimensionOrder = new Map(PREFERENCE_DIMENSIONS.map((item, index) => [item, index]));
  const ranked = Object.entries(scores).sort((a, b) =>
    b[1] - a[1] || dimensionOrder.get(a[0]) - dimensionOrder.get(b[0]),
  );
  const primaryDimensions = [ranked[0][0]];
  if (ranked[0][1] - ranked[1][1] <= getConfig().mixedPreferenceGapMax) {
    primaryDimensions.push(ranked[1][0]);
  }
  const existing = db.findOne("learnerPresentationProfiles", { studentId, active: true });
  const completedAt = new Date();
  const validUntil = new Date(completedAt);
  validUntil.setDate(validUntil.getDate() + getConfig().varkValidityDays);
  const profile = {
    studentId,
    classId,
    answers: normalized,
    scores,
    primaryDimensions,
    mixed: primaryDimensions.length > 1,
    active: true,
    source: "practice-session",
    baselineScores: scores,
    calibration: existing?.calibration || {
      status: "collecting",
      evidenceCount: 0,
      requiredEvidenceCount: getConfig().presentationCalibration.minEvidenceRounds,
      message: "系统会结合后续多轮学习表现，谨慎微调资源呈现方式。",
      lastReviewedAt: null,
    },
    questionnaireVersion: "vark-math-v2.0",
    completedAt: completedAt.toISOString(),
    validUntil: validUntil.toISOString(),
  };
  return db.transaction(() => {
    if (existing) db.updateById("learnerPresentationProfiles", existing.id, { active: false });
    return db.create("learnerPresentationProfiles", profile);
  });
}

function presentationProfile(studentId) {
  return db.findOne("learnerPresentationProfiles", { studentId, active: true }) || null;
}

function isPresentationProfileDue(profile, now = new Date()) {
  const expiresAt = profile?.validUntil ? new Date(profile.validUntil).getTime() : NaN;
  return !profile ||
    profile.questionnaireVersion !== "vark-math-v2.0" ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= now.getTime();
}

function presentationMode(profile) {
  const order = profile?.primaryDimensions || [];
  const modeByDimension = {
    V: "visual",
    A: "aural",
    R: "readWrite",
    K: "kinesthetic",
  };
  return {
    primary: modeByDimension[order[0]] || "readWrite",
    secondary: modeByDimension[order[1]] || null,
    primaryDimension: order[0] || "R",
    secondaryDimension: order[1] || null,
    mixed: Boolean(profile?.mixed),
    calibration: profile?.calibration || null,
  };
}

function average(items, key) {
  if (!items.length) return 0;
  return Number((items.reduce((sum, item) => sum + Number(item[key] || 0), 0) / items.length).toFixed(2));
}

function nextPresentationDimension(profile, config) {
  const current = new Set(profile.primaryDimensions || []);
  const ranked = Object.entries(profile.baselineScores || profile.scores || {})
    .sort((a, b) => b[1] - a[1]);
  const topScore = ranked[0]?.[1];
  return ranked.find(([dimension, score]) =>
    !current.has(dimension) && topScore - score <= config.expansionScoreGapMax,
  )?.[0] || null;
}

// VARK 是资源偏好而不是能力标签。系统不会依据单轮表现改写问卷结论；
// 只有多轮持续低效、且问卷中存在接近的第二偏好时，才扩展为双通道呈现。
function recordPresentationLearningEvidence(round, assessment) {
  const profile = presentationProfile(round.studentId);
  if (!profile) return { profile: null, event: null };
  const existing = db.findOne("presentationLearningEvidence", {
    studentId: round.studentId,
    roundId: round.id,
  });
  if (!existing) {
    db.create("presentationLearningEvidence", {
      studentId: round.studentId,
      classId: round.classId,
      profileId: profile.id,
      roundId: round.id,
      knowledgePointId: round.knowledgePointId,
      dimensions: [...(profile.primaryDimensions || [])],
      accuracy: Number(round.accuracy || 0),
      controlScore: assessment.controlScore,
      perceivedLoadScore: assessment.perceivedLoadScore,
      createdAt: new Date().toISOString(),
    });
  }

  const config = getConfig().presentationCalibration;
  const evidence = db
    .find("presentationLearningEvidence", { studentId: round.studentId })
    .filter((item) => item.profileId === profile.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, config.windowSize);
  const metrics = {
    evidenceCount: evidence.length,
    averageAccuracy: average(evidence, "accuracy"),
    averageControl: average(evidence, "controlScore"),
  };
  const persistCalibration = (calibration, event) => {
    const updated = db.updateById("learnerPresentationProfiles", profile.id, { calibration });
    if (event) db.create("presentationAdjustmentEvents", { studentId: round.studentId, classId: round.classId, profileId: profile.id, ...event });
    return { profile: updated, event: event || null };
  };
  if (evidence.length < config.minEvidenceRounds) {
    return persistCalibration({
      status: "collecting",
      ...metrics,
      requiredEvidenceCount: config.minEvidenceRounds,
      message: `已记录 ${evidence.length} 轮学习表现，满 ${config.minEvidenceRounds} 轮后再判断是否需要微调。`,
      lastReviewedAt: null,
    });
  }

  const weakRounds = evidence.filter((item) =>
    item.accuracy < config.lowAccuracyMax || item.controlScore <= config.lowControlMax,
  );
  const consistentlyWeak = weakRounds.length >= Math.ceil(evidence.length * 0.6);
  const candidate = !profile.mixed && consistentlyWeak
    ? nextPresentationDimension(profile, config)
    : null;
  if (candidate) {
    const primaryDimensions = [...profile.primaryDimensions, candidate];
    const calibration = {
      status: "expanded",
      ...metrics,
      requiredEvidenceCount: config.minEvidenceRounds,
      message: "最近多轮学习表现仍不稳定，已在原有偏好基础上补充第二种资源通道；这不是能力判断，你可随时重新测评。",
      lastReviewedAt: new Date().toISOString(),
    };
    const updated = db.updateById("learnerPresentationProfiles", profile.id, {
      primaryDimensions,
      mixed: true,
      calibration,
    });
    const event = db.create("presentationAdjustmentEvents", {
      studentId: round.studentId,
      classId: round.classId,
      profileId: profile.id,
      roundId: round.id,
      type: "expand_secondary_channel",
      fromDimensions: profile.primaryDimensions,
      toDimensions: primaryDimensions,
      metrics,
      createdAt: new Date().toISOString(),
    });
    return { profile: updated, event };
  }

  return persistCalibration({
    status: consistentlyWeak ? "reassessment_recommended" : "stable",
    ...metrics,
    requiredEvidenceCount: config.minEvidenceRounds,
    message: consistentlyWeak
      ? "系统观察到多轮学习仍较吃力。为避免误判，建议在个人设置中重新完成学习偏好测评。"
      : "最近多轮学习表现稳定，继续沿用当前资源呈现方式。",
    lastReviewedAt: new Date().toISOString(),
  }, consistentlyWeak ? {
    roundId: round.id,
    type: "recommend_reassessment",
    metrics,
    createdAt: new Date().toISOString(),
  } : null);
}

function adaptiveOverview(classIds) {
  const studentIds = db
    .find("students")
    .filter((student) => classIds.includes(student.classId))
    .map((student) => student.id);
  const assessments = db.find("controlAssessments").filter((item) => studentIds.includes(item.studentId));
  const latestByStudent = new Map();
  for (const item of assessments) {
    const current = latestByStudent.get(item.studentId);
    if (!current || new Date(item.createdAt) > new Date(current.createdAt)) latestByStudent.set(item.studentId, item);
  }
  const profiles = db.find("learnerPresentationProfiles").filter((item) => item.active && studentIds.includes(item.studentId));
  const rounds = db.find("learningRounds").filter((item) => studentIds.includes(item.studentId));
  const count = (items, value) => items.filter((item) => item === value).length;
  const levels = [...latestByStudent.values()].map((item) => item.controlLevel);
  const preferences = profiles.flatMap((item) => item.primaryDimensions);
  const perceivedLoads = [...latestByStudent.values()].map((item) => item.perceivedLoadLevel);
  return {
    studentCount: studentIds.length,
    assessedStudentCount: latestByStudent.size,
    controlDistribution: {
      low: count(levels, "low"),
      medium: count(levels, "medium"),
      high: count(levels, "high"),
    },
    perceivedLoadDistribution: {
      low: count(perceivedLoads, "low"),
      medium: count(perceivedLoads, "medium"),
      high: count(perceivedLoads, "high"),
    },
    preferenceDistribution: Object.fromEntries(
      PREFERENCE_DIMENSIONS.map((dimension) => [dimension, count(preferences, dimension)]),
    ),
    taskComplexityDistribution: Object.fromEntries(
      COMPLEXITIES.map((level) => [level, rounds.filter((item) => item.taskComplexity === level).length]),
    ),
    supportRequestCount: db
      .find("teacherSupportRequests")
      .filter((item) => classIds.includes(item.classId) && item.status === "open").length,
  };
}

module.exports = {
  COMPLEXITIES,
  PREFERENCE_QUESTIONS,
  adaptiveOverview,
  accuracyLevel,
  complexityOf,
  controlLevel,
  createLearningRound,
  finalizePendingLearningRound,
  getConfig,
  isEnabledForKnowledgePoint,
  isPresentationProfileDue,
  latestDecision,
  presentationMode,
  presentationProfile,
  perceivedLoadLevel,
  questionnaire,
  recordPresentationLearningEvidence,
  savePresentationProfile,
  submitReflection,
};
