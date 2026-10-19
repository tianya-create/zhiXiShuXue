const db = require("../database/memory-db");
const { nodes } = require("./curriculum");
const { calculateMastery } = require("./masteryEngine");
function submissions(studentId) {
  return [
    ...db.find("answers", { studentId }),
    ...db.find("learningRecords", { studentId }),
  ];
}
function final(record) {
  return ["graded", "completed"].includes(record.status);
}
function percent(record) {
  const full = (record.questionResults || []).reduce(
    (sum, item) => sum + Number(item.fullScore || item.snapshot?.score || 0),
    0,
  );
  return full ? Math.round((record.totalScore / full) * 1000) / 10 : null;
}
function studentAnalytics(studentId) {
  const student = db.findById("students", studentId);
  if (!student) throw new Error("学生不存在或不属于你的班级");
  const records = submissions(studentId);
  const graded = records.filter(final);
  const knowledgePointMastery = {};
  for (const node of nodes) {
    const mastery = calculateMastery(studentId, node.id);
    if (mastery.mastery !== null)
      knowledgePointMastery[node.id] = {
        name: node.name,
        avgScore: mastery.mastery,
        count: mastery.attemptCount,
        status: mastery.status,
        confidence: mastery.confidence,
      };
  }
  return {
    student,
    scoreTrend: graded
      .map((record) => ({
        date: record.submittedAt || record.createdAt,
        score: percent(record),
        rawScore: record.totalScore,
        assignmentTitle:
          record.title ||
          db.findById("assignments", record.assignmentId)?.title ||
          "专项练习",
      }))
      .filter((item) => item.score !== null)
      .sort((a, b) => new Date(a.date) - new Date(b.date)),
    knowledgePointMastery,
    wrongQuestions: db
      .getAllMistakesForStudent(studentId)
      .filter((item) => !item.isResolved)
      .map((item) => {
        const q = db.findById("questions", item.questionId) || {};
        return {
          ...item,
          content: q.content,
          correctAnswer: q.answer,
          knowledgePoints: q.knowledgePoints,
        };
      }),
    pendingReviewCount: records.filter((record) => !final(record)).length,
  };
}
function classAnalytics(classId) {
  const cls = db.findById("classes", classId);
  if (!cls) throw new Error("班级不存在或未授权");
  const students = db.find("students", { classId });
  const graded = students
    .flatMap((student) => submissions(student.id))
    .filter(final);
  const all = students.flatMap((student) => submissions(student.id));
  const studentScores = students.map((student) => {
    const scores = submissions(student.id)
      .filter(final)
      .map(percent)
      .filter((value) => value !== null);
    const score = scores.length
      ? Math.round(
          (scores.reduce((sum, value) => sum + value, 0) / scores.length) * 10,
        ) / 10
      : null;
    return {
      studentId: student.id,
      studentName: student.name,
      score,
      level:
        score === null
          ? "unassessed"
          : score >= 90
            ? "strong"
            : score < 60
              ? "weak"
              : "normal",
      submissionCount: scores.length,
    };
  });
  const knowledgePointMasteryList = nodes
    .map((node) => {
      const mastery = students
        .map((student) => calculateMastery(student.id, node.id))
        .filter((item) => item.mastery !== null);
      return {
        id: node.id,
        name: node.name,
        mastery: mastery.length
          ? Math.round(
              mastery.reduce((sum, item) => sum + item.mastery, 0) /
                mastery.length,
            )
          : null,
        sampleCount: mastery.length,
      };
    })
    .filter((item) => item.mastery !== null);
  const errors = {};
  for (const record of graded)
    for (const result of record.questionResults || [])
      if (result.correct === false) {
        const type = result.questionType || result.snapshot?.type || "other";
        errors[type] = (errors[type] || 0) + 1;
      }
  const scores = graded.map(percent).filter((value) => value !== null);
  return {
    avgScore: scores.length
      ? Math.round(
          (scores.reduce((sum, value) => sum + value, 0) / scores.length) * 10,
        ) / 10
      : null,
    studentCount: students.length,
    completedCount: graded.length,
    pendingReviewCount: all.length - graded.length,
    studentScores,
    studentLevels: studentScores,
    knowledgePointMastery: Object.fromEntries(
      knowledgePointMasteryList.map((item) => [item.id, item.mastery]),
    ),
    knowledgePointMasteryList,
    errorTypeStats: Object.entries(errors).map(([type, count]) => ({
      type,
      count,
      label:
        { choice: "选择题", fill: "填空题", subjective: "解答题" }[type] ||
        "其他",
    })),
    levelDistribution: Object.fromEntries(
      ["weak", "normal", "strong", "unassessed"].map((level) => [
        level,
        studentScores.filter((item) => item.level === level).length,
      ]),
    ),
  };
}
module.exports = { studentAnalytics, classAnalytics };
