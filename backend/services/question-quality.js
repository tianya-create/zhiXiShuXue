const db = require("../database/memory-db");
const { enrichQuestion, nodes } = require("./curriculum");
function normalizeQuestion(input, existing = {}, actor) {
  const question = enrichQuestion({ ...existing, ...input });
  question.type =
    question.type === "shortAnswer" ? "subjective" : question.type;
  question.content = String(question.content || "").trim();
  question.answer = String(question.answer || "").trim();
  question.answer_text = question.answer;
  question.options = Array.isArray(question.options)
    ? question.options.map((x) => String(x).trim()).filter(Boolean)
    : [];
  question.analysis = String(
    question.analysis || question.explanation || "",
  ).trim();
  question.explanation = question.analysis;
  if (input.difficulty && input.difficulty !== existing.difficulty)
    question.difficultyLevel = { easy: 1, medium: 3, hard: 5 }[
      input.difficulty
    ];
  question.acceptedAnswers = Array.isArray(question.acceptedAnswers)
    ? question.acceptedAnswers.map(String).slice(0, 20)
    : [];
  question.hints = Array.isArray(question.hints)
    ? question.hints.map(String).slice(0, 5)
    : [];
  // 显式传 0 时不能被 || 吞成 5，否则「分值越界」永远校验不到
  question.score =
    question.score === undefined || question.score === null || question.score === ""
      ? 5
      : Number(question.score);
  question.difficulty = ["easy", "medium", "hard"].includes(question.difficulty)
    ? question.difficulty
    : "medium";
  const cognitiveLoadLevel = question.cognitiveLoadLevel || question.taskComplexity;
  question.cognitiveLoadLevel = ["low", "medium", "high"].includes(
    cognitiveLoadLevel,
  )
    ? cognitiveLoadLevel
    : question.difficulty === "easy"
      ? "low"
      : question.difficulty === "hard"
        ? "high"
        : "medium";
  question.taskComplexity = question.cognitiveLoadLevel;
  question.scaffoldSteps = Array.isArray(question.scaffoldSteps)
    ? question.scaffoldSteps.map((item) => String(item).trim()).filter(Boolean).slice(0, 8)
    : [];
  question.conciseStem = String(question.conciseStem || "").trim().slice(0, 1000);
  if (
    !question.content ||
    !question.answer ||
    !["choice", "fill", "subjective", "judge"].includes(question.type)
  )
    throw new Error("请填写有效题型、题干和答案");
  if (!nodes.some((node) => node.id === question.knowledgePointId))
    throw new Error("请选择课程目录中的知识点");
  if (
    !Number.isFinite(question.score) ||
    question.score <= 0 ||
    question.score > 100
  )
    throw new Error("题目分值应为 1 到 100");
  if (
    question.type === "choice" &&
    (question.options.length < 2 ||
      question.options.length > 8 ||
      new Set(question.options).size !== question.options.length ||
      (!question.options.includes(question.answer) &&
        !/^[A-H]$/.test(question.answer)))
  )
    throw new Error("选择题选项须唯一，且答案须对应有效选项");
  if (
    question.type === "choice" &&
    /^[A-H]$/.test(question.answer) &&
    question.answer.charCodeAt(0) - 65 >= question.options.length
  )
    throw new Error("答案字母超出选项范围");
  if (
    question.imageUrl &&
    !/^\/uploads\/questions\/[\w.-]+$/.test(question.imageUrl)
  )
    throw new Error("请使用题目图片上传入口");
  if (
    question.rubric &&
    (!Array.isArray(question.rubric) ||
      question.rubric.some(
        (step) =>
          !step.description ||
          !Number.isFinite(Number(step.points)) ||
          Number(step.points) < 0,
      ) ||
      (question.rubric.length &&
        question.rubric.reduce(
          (total, step) => total + Number(step.points),
          0,
        ) !== question.score))
  )
    throw new Error("评分步骤分值之和必须等于题目总分");
  const approved = input.reviewStatus === "approved";
  if (approved && !question.analysis) throw new Error("审核通过前请填写解析");
  question.reviewStatus = approved
    ? "approved"
    : input.reviewStatus === "withdrawn"
      ? "withdrawn"
      : "pending";
  question.source =
    existing.source ||
    (actor.role === "admin" ? "admin-manual" : "teacher-manual");
  question.createdBy = existing.createdBy || actor.id;
  question.reviewedBy = approved ? actor.id : null;
  question.reviewedAt = approved ? new Date().toISOString() : null;
  question.qualityVersion = 1;
  question.version = (existing.version || 0) + 1;
  return question;
}
function publicQuestion(question) {
  const {
    answer,
    answer_text,
    answerText,
    standardAnswer,
    answerDisplay,
    acceptedAnswers,
    analysis,
    explanation,
    rubric,
    hints,
    scaffoldSteps,
    conciseStem,
    ...safe
  } = question;
  return safe;
}
function migrateQuestionQuality() {
  for (const question of db.find("questions")) {
    // 仅将随系统提供、含完整解析的演示题库设为预审通过，
    // 不影响教师或管理员后续录入题目的审核工作流。
    if (question.source === "manual-curated" && question.reviewStatus !== "approved") {
      db.updateById("questions", question.id, {
        ...question,
        reviewStatus: "approved",
        reviewedBy: question.reviewedBy || "system-seed",
        reviewedAt: question.reviewedAt || new Date().toISOString(),
        qualityVersion: 1,
      });
      continue;
    }
    if (question.qualityVersion === 1) continue;
    const update = {
      ...enrichQuestion(question),
      reviewStatus: "pending",
      reviewedBy: null,
      reviewedAt: null,
      qualityVersion: 1,
    };
    if (question.id === "manual-alg-6-3") {
      update.options = [
        "第一、二象限",
        "第一、三象限",
        "第二、四象限",
        "第一、二、四象限",
      ];
      update.answer = "第一、二、四象限";
      update.answer_text = update.answer;
      update.analysis = update.explanation =
        "当 x<0 时 y>0，在第二象限；当 0<x<4 时 y>0，在第一象限；当 x>4 时 y<0，在第四象限。";
    }
    db.updateById("questions", question.id, update);
  }
}
module.exports = { normalizeQuestion, publicQuestion, migrateQuestionQuality };
