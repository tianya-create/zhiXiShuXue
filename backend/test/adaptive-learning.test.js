const os = require("node:os");
const path = require("node:path");

process.env.APP_DB_PATH = path.join(
  os.tmpdir(),
  `zhixi-adaptive-${process.pid}-${Date.now()}.sqlite`,
);

const db = require("../database/memory-db");
const {
  createLearningRound,
  isPresentationProfileDue,
  presentationMode,
  savePresentationProfile,
  submitReflection,
} = require("../services/adaptive-learning");

const student = { id: "adaptive-student", classId: "adaptive-class" };
const baseQuestions = Array.from({ length: 5 }, (_, index) => ({
  id: `adaptive-q-${index + 1}`,
  knowledgePointId: "alg-1",
  cognitiveLoadLevel: "medium",
}));

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

function record(id, correctCount) {
  return {
    id,
    questionResults: baseQuestions.map((question, index) => ({
        questionId: question.id,
        correct: index < correctCount,
        needsReview: false,
      })),
  };
}

describe("认知—心理双维适配", () => {
  test("低正确率、低控制感会降低复杂度并增加支架", () => {
    const round = createLearningRound({
      student,
      sourceType: "practice",
      sourceRecord: record("adaptive-record-low", 2),
      questions: baseQuestions,
      knowledgePointId: "alg-1",
    });
    const result = submitReflection(student.id, round.id, {
      emotion: "worried",
      controlItem1: 2,
      controlItem2: 2,
      cognitiveLoadItem: 5,
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
      sourceRecord: record("adaptive-record-low-2", 2),
      questions: baseQuestions,
      knowledgePointId: "alg-1",
    });
    const nextResult = submitReflection(student.id, nextRound.id, {
      emotion: "tired",
      controlItem1: 2,
      controlItem2: 2,
      cognitiveLoadItem: 5,
    });
    expect(nextResult.decision.supportAvailable).toBe(true);
  });

  test("高控制感与高正确率会推送同知识点进阶变式", () => {
    const first = createLearningRound({
      student,
      sourceType: "practice",
      sourceRecord: record("adaptive-record-high-1", 5),
      questions: baseQuestions,
      knowledgePointId: "alg-1",
    });
    const firstResult = submitReflection(student.id, first.id, {
      emotion: "confident",
      controlItem1: 5,
      controlItem2: 5,
      cognitiveLoadItem: 2,
    });
    expect(firstResult.decision.difficultyAdjustment).toBe(1);
    expect(firstResult.decision.targetComplexity).toBe("high");
  });

  test("低控制感且高主观负荷会覆盖高正确率，强制降一级", () => {
    const round = createLearningRound({
      student,
      sourceType: "practice",
      sourceRecord: record("adaptive-record-priority", 5),
      questions: baseQuestions,
      knowledgePointId: "alg-1",
    });
    const result = submitReflection(student.id, round.id, {
      emotion: "worried",
      controlItem1: 2,
      controlItem2: 2,
      cognitiveLoadItem: 5,
    });
    expect(result.decision.accuracyLevel).toBe("high");
    expect(result.decision.difficultyAdjustment).toBe(-1);
    expect(result.decision.pageDensity).toBe("low");
  });

  test("60% 与 80% 正确率都维持难度", () => {
    for (const [name, correctCount] of [["sixty", 3], ["eighty", 4]]) {
      const round = createLearningRound({
        student,
        sourceType: "practice",
        sourceRecord: record(`adaptive-record-${name}`, correctCount),
        questions: baseQuestions,
        knowledgePointId: "alg-1",
      });
      const result = submitReflection(student.id, round.id, {
        emotion: "steady",
        controlItem1: 3,
        controlItem2: 3,
        cognitiveLoadItem: 3,
      });
      expect(result.decision.difficultyAdjustment).toBe(0);
      expect(result.decision.targetComplexity).toBe("medium");
    }
  });

  test("不足 5 题不能创建有效学习轮次", () => {
    expect(() => createLearningRound({
      student,
      sourceType: "practice",
      sourceRecord: record("adaptive-record-incomplete", 4),
      questions: baseQuestions.slice(0, 4),
      knowledgePointId: "alg-1",
    })).toThrow("必须完整提交 5 道题");
  });

  test("同一轮自评幂等，不重复生成心理记录", () => {
    const round = createLearningRound({
      student,
      sourceType: "practice",
      sourceRecord: record("adaptive-record-idempotent", 4),
      questions: baseQuestions,
      knowledgePointId: "alg-1",
    });
    const input = { emotion: "steady", controlItem1: 3, controlItem2: 3, cognitiveLoadItem: 3 };
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
      secondary: "aural",
      mixed: true,
    });
    expect(isPresentationProfileDue(profile)).toBe(false);
    expect(isPresentationProfileDue({ ...profile, validUntil: "2020-01-01T00:00:00.000Z" })).toBe(true);
  });

  test("三个维度并列时也只保留前两个偏好", () => {
    const answers = {
      V1: 5, V2: 5, V3: 5,
      A1: 5, A2: 5, A3: 5,
      R1: 5, R2: 5, R3: 5,
      K1: 1, K2: 1, K3: 1,
    };
    const profile = savePresentationProfile(student.id, student.classId, { answers });
    expect(profile.primaryDimensions).toEqual(["V", "A"]);
  });

  test("连续多轮低效时建议复测，不突破 0.5 分混合偏好边界", () => {
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
        sourceRecord: record(`adaptive-record-calibration-${index}`, 2),
        questions: baseQuestions,
        knowledgePointId: "alg-1",
      });
      submitReflection(student.id, round.id, {
        emotion: "worried",
        controlItem1: 2,
        controlItem2: 2,
        cognitiveLoadItem: 5,
      });
    }
    const adjusted = require("../services/adaptive-learning").presentationProfile(student.id);
    expect(adjusted.primaryDimensions).toEqual(["V"]);
    expect(adjusted.mixed).toBe(false);
    expect(adjusted.calibration.status).toBe("reassessment_recommended");
    expect(db.find("presentationAdjustmentEvents", { studentId: student.id })).toHaveLength(1);
  });
});
