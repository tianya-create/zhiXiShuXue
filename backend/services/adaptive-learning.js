const db = require("../database/memory-db");
const { canonicalKnowledgeId } = require("./question-map");

const DEFAULT_CONFIG = Object.freeze({
  enabled: true,
  ruleVersion: "adaptive-v1.0",
  controlLowMax: 2.4,
  controlHighMin: 3.8,
  highEffortMin: 4,
  accuracyLowMax: 0.6,
  accuracyHighMin: 0.85,
  presentationCalibration: {
    minEvidenceRounds: 6,
    windowSize: 8,
    lowAccuracyMax: 0.6,
    lowControlMax: 2.8,
    highEffortMin: 4,
    expansionScoreGapMax: 1,
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
  ["A1", "A", "学习数学概念时，我更喜欢听老师或微课口头讲解一遍。"],
  ["A2", "A", "遇到不会的题，我倾向于找人问，听别人讲一遍思路。"],
  ["A3", "A", "在数学课上，我更容易记住老师反复强调的口头解释。"],
  ["R1", "R", "复习时，我觉得重新整理一遍文字笔记和公式对我最有效。"],
  ["R2", "R", "自学新方法时，我喜欢找一篇文字教程从头读到尾。"],
  ["R3", "R", "记忆公式时，我通常会抄写几遍，边抄边看文字。"],
  ["K1", "K", "学习新知识时，我倾向于直接做几道例题，边做边体会。"],
  ["K2", "K", "面对几何证明题时，我通常会直接尝试从条件往下推导几步。"],
  ["K3", "K", "当想确认自己是否理解概念时，我会试着用它去解一道新题。"],
].map(([id, dimension, text]) => ({ id, dimension, text }));

function getConfig() {
  const saved = db.settings.adaptiveLearning || {};
  return {
    ...DEFAULT_CONFIG,
    ...saved,
    presentationCalibration: {
      ...DEFAULT_CONFIG.presentationCalibration,
      ...(saved.presentationCalibration || {}),
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
    ruleVersion: getConfig().ruleVersion,
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
  if (accuracy >= config.accuracyHighMin) return "high";
  return "medium";
}

function guidanceFor(level, effortHigh, accuracyBand) {
  if (level === "low") {
    return {
      tone: "supportive",
      title: "先把这一步走稳，我们慢慢来",
      message: effortHigh
        ? "刚才确实很费脑，这不代表你学不会。下一轮我会拆小步骤、减少干扰，先完成一个看得见的小目标。"
        : "暂时没把握很正常。先按提示完成第一步，做对一小步也算进步，我会陪你把方法理清。",
      emoji: effortHigh ? "🌧️" : "🌱",
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
  const effortHigh = assessment.mentalEffort >= config.highEffortMin;
  let adjustment = 0;
  let scaffoldLevel = "medium";
  let pageDensity = "standard";
  let strategy = "保持当前难度，继续观察表现与感受。";

  if (accuracyBand === "low" && control === "low") {
    if (assessment.mentalEffort <= 2) {
      scaffoldLevel = "medium";
      strategy = "暂不直接降级，先通过归因引导区分粗心、投入不足与真正的理解困难。";
    } else {
      adjustment = -1;
      scaffoldLevel = "high";
      pageDensity = "low";
      strategy = "降低一级任务复杂度，拆分步骤并建立小成功。";
    }
  } else if (accuracyBand === "low" && control === "medium") {
    adjustment = effortHigh ? -1 : 0;
    scaffoldLevel = "high";
    pageDensity = "low";
    strategy = effortHigh ? "降低一级复杂度并减少信息密度。" : "维持难度，增加步骤支架。";
  } else if (accuracyBand === "low" && control === "high") {
    scaffoldLevel = "medium";
    strategy = "维持难度，通过针对性反馈校准信心。";
  } else if (accuracyBand === "medium" && control === "low") {
    scaffoldLevel = "high";
    pageDensity = "low";
    strategy = "不降低知识目标，增加可控选择和步骤提示。";
  } else if (accuracyBand === "medium" && control === "high") {
    scaffoldLevel = effortHigh ? "medium" : "low";
    strategy = "维持难度，鼓励解释方法并核对关键步骤。";
  } else if (accuracyBand === "high" && control === "low") {
    scaffoldLevel = "medium";
    pageDensity = "low";
    strategy = "保持知识难度，用成功证据增强把握感。";
  } else if (accuracyBand === "high" && control !== "low") {
    adjustment = effortHigh ? 0 : 1;
    scaffoldLevel = control === "high" ? "low" : "medium";
    strategy = effortHigh ? "正确率较高但投入较大，暂不升级。" : "满足挑战条件，准备变式与迁移任务。";
  }

  let upgradePending = false;
  if (adjustment === 1) {
    const previous = db
      .find("adaptationDecisions", { studentId: round.studentId })
      .filter((item) => item.knowledgePointId === round.knowledgePointId && item.roundId !== round.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    if (!previous?.upgradeEligible) {
      adjustment = 0;
      upgradePending = true;
      strategy = "首次满足升级条件，本轮先保持难度；连续两轮稳定后再升级。";
    }
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
    accuracyLevel: accuracyBand,
    effortLevel: effortHigh ? "high" : assessment.mentalEffort <= 2 ? "low" : "medium",
    difficultyAdjustment: adjustment,
    targetComplexity,
    scaffoldLevel,
    pageDensity,
    strategy,
    upgradeEligible: accuracyBand === "high" && !effortHigh && control !== "low",
    upgradePending,
    supportAvailable:
      control === "low" && previousAssessment?.controlLevel === "low",
    guidance: guidanceFor(control, effortHigh, accuracyBand),
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
  const mentalEffort = validateLikert(input.mentalEffort, "心理努力题");
  if (!EMOTIONS.includes(input.emotion)) throw new Error("请选择此刻的感受");
  const controlScore = Number(((controlItem1 + controlItem2) / 2).toFixed(2));
  return db.transaction(() => {
    const assessment = db.create("controlAssessments", {
      studentId,
      classId: round.classId,
      roundId,
      knowledgePointId: round.knowledgePointId,
      emotion: input.emotion,
      answers: { controlItem1, controlItem2, mentalEffort },
      controlScore,
      controlLevel: controlLevel(controlScore),
      mentalEffort,
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
    version: "presentation-preference-v1.0",
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
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const primaryDimensions = ranked
    .filter(([, score]) => ranked[0][1] - score <= 0.5)
    .map(([dimension]) => dimension);
  const existing = db.findOne("learnerPresentationProfiles", { studentId, active: true });
  if (existing) db.updateById("learnerPresentationProfiles", existing.id, { active: false });
  return db.create("learnerPresentationProfiles", {
    studentId,
    classId,
    answers: normalized,
    scores,
    primaryDimensions,
    mixed: primaryDimensions.length > 1,
    active: true,
    source: existing ? "retake" : "onboarding",
    baselineScores: scores,
    calibration: {
      status: "collecting",
      evidenceCount: 0,
      requiredEvidenceCount: getConfig().presentationCalibration.minEvidenceRounds,
      message: "系统会结合后续多轮学习表现，谨慎微调资源呈现方式。",
      lastReviewedAt: null,
    },
    questionnaireVersion: "presentation-preference-v1.1",
  });
}

function presentationProfile(studentId) {
  return db.findOne("learnerPresentationProfiles", { studentId, active: true }) || null;
}

function presentationMode(profile) {
  const order = profile?.primaryDimensions || [];
  const modeByDimension = {
    V: "visual",
    A: "workedExample",
    R: "readWrite",
    K: "practice",
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
      mentalEffort: assessment.mentalEffort,
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
    averageEffort: average(evidence, "mentalEffort"),
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
    item.accuracy < config.lowAccuracyMax ||
    (item.controlScore <= config.lowControlMax && item.mentalEffort >= config.highEffortMin),
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
      message: "最近多轮学习投入较大，已在原有偏好基础上补充第二种资源通道；这不是能力判断，你可随时重新测评。",
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
  return {
    studentCount: studentIds.length,
    assessedStudentCount: latestByStudent.size,
    controlDistribution: {
      low: count(levels, "low"),
      medium: count(levels, "medium"),
      high: count(levels, "high"),
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
  latestDecision,
  presentationMode,
  presentationProfile,
  questionnaire,
  recordPresentationLearningEvidence,
  savePresentationProfile,
  submitReflection,
};
