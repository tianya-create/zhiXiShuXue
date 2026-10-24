const db = require("../database/memory-db");
const { gradeAnswer } = require("./autoGrade");
const { updateMastery } = require("./masteryEngine");
const { enrichQuestion } = require("./curriculum");
const { canonicalKnowledgeId } = require("./question-map");
const { finalizePendingLearningRound } = require("./adaptive-learning");
function gradeQuestions(ids, answers, overrides = []) {
  return [...new Set(ids)].map((id) => {
    const question =
      overrides.find((item) => item.id === id) || db.findById("questions", id);
    if (!question) throw new Error("题目不存在：" + id);
    const answer = String(answers[id] ?? "").slice(0, 10000);
    const graded = gradeAnswer(question, answer);
    return {
      questionId: id,
      answer,
      correct: graded.isCorrect,
      needsReview: !!graded.needsReview,
      score: graded.isCorrect ? Number(question.score || 0) : 0,
      questionType: question.type,
      fullScore: Number(question.score || 0),
      correctAnswer: graded.needsReview ? "" : graded.correctAnswer,
      explanation: graded.needsReview ? "" : graded.explanation,
      snapshot: { ...enrichQuestion(question) },
    };
  });
}
function synchronize(record) {
  const affected = new Set();
  for (const result of record.questionResults || []) {
    const question =
      result.snapshot || db.findById("questions", result.questionId);
    if (
      !question ||
      result.needsReview ||
      result.correct === null ||
      !String(result.answer || "").trim()
    )
      continue;
    // 老题库题目挂在 kp-001/geo-3 这类编号上，统计前归一到教材目录节点，
    // 否则学情与掌握度会按老编号落库，页面上 30 个节点全是空的。
    const kpCode = canonicalKnowledgeId(
      question.knowledgePointId || question.knowledgePoints?.[0],
    );
    if (!kpCode) continue;
    affected.add(kpCode);
    const sourceRef = record.id + ":" + result.questionId;
    const existing = db.findOne("student_answer", { sourceRef });
    const value = {
      sourceRef,
      userId: record.studentId,
      questionId: result.questionId,
      kpCode,
      isCorrect: !!result.correct,
      earnedScore: result.score,
      fullScore: result.fullScore,
      costTime:
        Number(record.costTime || 0) /
        Math.max(1, record.questionResults.length),
      userAnswer: result.answer,
      createdAt: record.submittedAt || record.createdAt,
    };
    existing
      ? db.updateById("student_answer", existing.id, value)
      : db.create("student_answer", value);
    const attempts = db
      .find("student_answer", {
        userId: record.studentId,
        questionId: result.questionId,
      })
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const failures = attempts.filter((item) => !item.isCorrect);
    const last = attempts.at(-1);
    const lastTwo = attempts.slice(-2);
    const resolved =
      lastTwo.length === 2 &&
      lastTwo.every((item) => item.isCorrect) &&
      new Date(lastTwo[1].createdAt) - new Date(lastTwo[0].createdAt) >=
        86400000;
    let spacedSuccesses = 0,
      previousSuccessTime = -Infinity;
    for (const attempt of attempts) {
      if (!attempt.isCorrect) {
        spacedSuccesses = 0;
        previousSuccessTime = -Infinity;
      } else if (
        new Date(attempt.createdAt).getTime() - previousSuccessTime >=
        86400000
      ) {
        spacedSuccesses++;
        previousSuccessTime = new Date(attempt.createdAt).getTime();
      }
    }
    const reviewDays = last.isCorrect
      ? [1, 3, 7, 15][Math.min(3, Math.max(0, spacedSuccesses - 1))]
      : 1;
    const nextReviewAt = new Date(
      new Date(last.createdAt).getTime() + reviewDays * 86400000,
    ).toISOString();
    const mistake = db
      .getAllMistakesForStudent(record.studentId)
      .find((item) => item.questionId === result.questionId);
    if (failures.length)
      db.upsertStudentMistake(record.studentId, {
        questionId: question.id,
        content: question.content,
        kpCode,
        knowledgePointId: kpCode,
        difficulty: question.difficulty,
        errorType: mistake?.errorType || "待教师确认",
        wrongCount: failures.length,
        lastPracticeTime: last.createdAt,
        isResolved: resolved,
        masteryStatus: resolved ? "已掌握" : last.isCorrect ? "待巩固" : "薄弱",
      });
    else if (mistake)
      db.deleteById(db.getMistakeShardCollection(record.studentId), mistake.id);
    const aggregate = db.findOne("studentQuestionAttempts", {
      studentId: record.studentId,
      questionId: question.id,
    });
    const aggregateValue = {
      studentId: record.studentId,
      questionId: question.id,
      knowledgePoints: question.knowledgePoints || [kpCode],
      attemptCount: attempts.length,
      correctCount: attempts.filter((item) => item.isCorrect).length,
      wrongCount: failures.length,
      lastAnswerAt: last.createdAt,
      nextReviewAt,
      spacedSuccesses,
    };
    aggregate
      ? db.updateById("studentQuestionAttempts", aggregate.id, aggregateValue)
      : db.create("studentQuestionAttempts", aggregateValue);
  }
  const masteries = [...affected].map((id) => {
    const mastery = updateMastery(record.studentId, id);
    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
    }).format(new Date());
    const snapshot = db.findOne("mastery_snapshot", {
      userId: record.studentId,
      kpCode: id,
      day,
    });
    const value = {
      userId: record.studentId,
      kpCode: id,
      day,
      mastery: mastery.mastery,
      status: mastery.status,
      snapshotAt: new Date().toISOString(),
    };
    snapshot
      ? db.updateById("mastery_snapshot", snapshot.id, value)
      : db.create("mastery_snapshot", value);
    return mastery;
  });
  const values = masteries.filter((item) => item.mastery !== null);
  const collection =
    record.recordType === "practice" ? "learningRecords" : "answers";
  if (db.findById(collection, record.id))
    db.updateById(collection, record.id, {
      masteryAfter: values.length
        ? Math.round(
            values.reduce((sum, item) => sum + item.mastery, 0) / values.length,
          )
        : null,
      knowledgePointScores: Object.fromEntries(
        values.map((item) => [item.kpCode, item.mastery]),
      ),
    });
  return masteries;
}
function reviewRecord(collection, record, body, teacherId) {
  return db.transaction(() => {
    const results = (record.questionResults || []).map((result) => {
      const question = result.snapshot ||
        db.findById("questions", result.questionId) || {
          score: result.fullScore || 100,
          answer: "",
          analysis: "",
        };
      const steps = body.stepScores?.[result.questionId];
      let score = body.scores?.[result.questionId];
      if (
        Array.isArray(question?.rubric) &&
        question.rubric.length &&
        result.needsReview &&
        !Array.isArray(steps)
      )
        throw new Error("请填写每一步的评分");
      if (Array.isArray(steps)) {
        if (
          !question.rubric ||
          steps.length !== question.rubric.length ||
          steps.some(
            (value, index) =>
              !Number.isFinite(Number(value)) ||
              Number(value) < 0 ||
              Number(value) > Number(question.rubric[index].points),
          )
        )
          throw new Error("步骤评分超出范围");
        score = steps.reduce((sum, value) => sum + Number(value), 0);
      }
      if (result.needsReview && score === undefined)
        throw new Error("请为所有待复核题目评分");
      if (score === undefined) score = result.score;
      score = Number(score);
      const fullScore = Number(result.fullScore ?? question.score ?? 0);
      if (!Number.isFinite(score) || score < 0 || score > fullScore)
        throw new Error("评分超出题目分值范围");
      return {
        ...result,
        score,
        fullScore,
        correct:
          result.questionId === "__image_review__"
            ? null
            : fullScore > 0 && score >= fullScore * 0.8,
        needsReview: false,
        stepScores: steps || result.stepScores,
        correctAnswer: question.answer,
        explanation: question.analysis || question.explanation || "",
        comment: body.comments?.[result.questionId] || "",
        correction: body.corrections?.[result.questionId] || "",
      };
    });
    if (!results.length && record.images?.length) {
      const score = Number(body.scores?.__image_review__);
      if (!Number.isFinite(score) || score < 0 || score > 100)
        throw new Error("图片作答评分应为 0 到 100");
      results.push({
        questionId: "__image_review__",
        answer: "图片作答",
        score,
        fullScore: 100,
        correct: null,
        needsReview: false,
      });
    }
    const updated = db.updateById(collection, record.id, {
      questionResults: results,
      totalScore: results.reduce((sum, item) => sum + item.score, 0),
      status: collection === "answers" ? "graded" : "completed",
      gradedBy: teacherId,
      gradedAt: new Date().toISOString(),
      comments: body.comments || {},
      corrections: body.corrections || {},
    });
    synchronize(updated);
    finalizePendingLearningRound(updated);
    db.addLog(teacherId, "REVIEW_SUBMISSION", {
      recordId: record.id,
      collection,
    });
    return updated;
  });
}
module.exports = { gradeQuestions, synchronize, reviewRecord };
