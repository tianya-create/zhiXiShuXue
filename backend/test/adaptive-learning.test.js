const os = require("node:os");
const path = require("node:path");

process.env.APP_DB_PATH = path.join(
  os.tmpdir(),
  `zhixi-adaptive-${process.pid}-${Date.now()}.sqlite`,
);

const db = require("../database/memory-db");
const {
  createLearningRound,
  presentationMode,
  savePresentationProfile,
  submitReflection,
} = require("../services/adaptive-learning");

const student = { id: "adaptive-student", classId: "adaptive-class" };
const baseQuestion = {
  id: "adaptive-q-1",
  knowledgePointId: "alg-1",
  taskComplexity: "medium",
};

beforeAll(() => {
  if (!db.data.students.some((item) => item.id === student.id))
    db.create("students", { ...student, userId: student.id, name: "适配测试学生" });
});

beforeEach(() => {
  for (const name of [
    "learningRounds",
    "controlAssessments",
    "adaptationDecisions",
    "learnerPresentationProfiles",
    "presentationLearningEvidence",
    "presentationAdjustmentEvents",
    "teacherSupportRequests",
  ]) db.data[name].splice(0);
});

function record(id, correct) {
  return {
    id,
    questionResults: [
      {
        questionId: baseQuestion.id,
        correct,
        needsReview: false,
      },
    ],
  };
}

describe("认知—心理双维适配", () => {
  test("低正确率、低控制感和高努力会降低复杂度并增加支架", () => {
    const round = createLearningRound({
      student,
      sourceType: "practice",
      sourceRecord: record("adaptive-record-low", false),
      questions: [baseQuestion],
      knowledgePointId: "alg-1",
    });
    const result = submitReflection(student.id, round.id, {
      emotion: "worried",
      controlItem1: 2,
      controlItem2: 2,
      mentalEffort: 5,
    });
    expect(result.assessment.controlLevel).toBe("low");
    expect(result.decision.difficultyAdjustment).toBe(-1);
    expect(result.decision.targetComplexity).toBe("low");
    expect(result.decision.scaffoldLevel).toBe("high");
    expect(result.decision.guidance.tone).toBe("supportive");
    expect(result.decision.supportAvailable).toBe(false);

    const nextRound = createLearningRound({
      student,
      sourceType: "practice",
      sourceRecord: record("adaptive-record-low-2", false),
      questions: [baseQuestion],
      knowledgePointId: "alg-1",
    });
    const nextResult = submitReflection(student.id, nextRound.id, {
      emotion: "tired",
      controlItem1: 2,
      controlItem2: 2,
      mentalEffort: 4,
    });
    expect(nextResult.decision.supportAvailable).toBe(true);
  });

  test("升级需要连续两轮满足高表现、非高努力条件", () => {
    const first = createLearningRound({
      student,
      sourceType: "practice",
      sourceRecord: record("adaptive-record-high-1", true),
      questions: [baseQuestion],
      knowledgePointId: "alg-1",
    });
    const firstResult = submitReflection(student.id, first.id, {
      emotion: "confident",
      controlItem1: 5,
      controlItem2: 5,
      mentalEffort: 1,
    });
    expect(firstResult.decision.difficultyAdjustment).toBe(0);
    expect(firstResult.decision.upgradePending).toBe(true);

    const second = createLearningRound({
      student,
      sourceType: "practice",
      sourceRecord: record("adaptive-record-high-2", true),
      questions: [baseQuestion],
      knowledgePointId: "alg-1",
    });
    const secondResult = submitReflection(student.id, second.id, {
      emotion: "energized",
      controlItem1: 5,
      controlItem2: 4,
      mentalEffort: 2,
    });
    expect(secondResult.decision.difficultyAdjustment).toBe(1);
    expect(secondResult.decision.targetComplexity).toBe("high");
  });

  test("同一轮自评幂等，不重复生成心理记录", () => {
    const round = createLearningRound({
      student,
      sourceType: "practice",
      sourceRecord: record("adaptive-record-idempotent", true),
      questions: [baseQuestion],
      knowledgePointId: "alg-1",
    });
    const input = { emotion: "steady", controlItem1: 3, controlItem2: 3, mentalEffort: 3 };
    const first = submitReflection(student.id, round.id, input);
    const second = submitReflection(student.id, round.id, input);
    expect(second.assessment.id).toBe(first.assessment.id);
    expect(db.find("controlAssessments", { roundId: round.id })).toHaveLength(1);
  });
});

describe("多模态资源呈现偏好", () => {
  test("最高与次高均分差不超过 0.5 时保存混合偏好", () => {
    const answers = {
      V1: 5, V2: 5, V3: 5,
      A1: 5, A2: 5, A3: 4,
      R1: 3, R2: 3, R3: 3,
      K1: 2, K2: 2, K3: 2,
    };
    const profile = savePresentationProfile(student.id, student.classId, { answers });
    expect(profile.primaryDimensions).toEqual(["V", "A"]);
    expect(profile.mixed).toBe(true);
    expect(presentationMode(profile)).toMatchObject({
      primary: "visual",
      secondary: "workedExample",
      mixed: true,
    });
  });

  test("连续多轮低效时只扩展接近的第二通道，不依据单轮改写偏好", () => {
    const answers = {
      V1: 5, V2: 5, V3: 5,
      A1: 4, A2: 4, A3: 4,
      R1: 2, R2: 2, R3: 2,
      K1: 2, K2: 2, K3: 2,
    };
    const initial = savePresentationProfile(student.id, student.classId, { answers });
    expect(initial.primaryDimensions).toEqual(["V"]);

    for (let index = 1; index <= 6; index += 1) {
      const round = createLearningRound({
        student,
        sourceType: "practice",
        sourceRecord: record(`adaptive-record-calibration-${index}`, false),
        questions: [baseQuestion],
        knowledgePointId: "alg-1",
      });
      submitReflection(student.id, round.id, {
        emotion: "worried",
        controlItem1: 2,
        controlItem2: 2,
        mentalEffort: 5,
      });
    }
    const adjusted = require("../services/adaptive-learning").presentationProfile(student.id);
    expect(adjusted.primaryDimensions).toEqual(["V", "A"]);
    expect(adjusted.mixed).toBe(true);
    expect(adjusted.calibration.status).toBe("expanded");
    expect(db.find("presentationAdjustmentEvents", { studentId: student.id })).toHaveLength(1);
  });
});
