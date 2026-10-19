// Isolated browser acceptance environment; never writes the user's database.
const fs = require("node:fs");
const path = require("node:path");
process.env.DATA_DIR = fs.mkdtempSync(
  path.join(require("node:os").tmpdir(), "zhixi-browser-"),
);
process.env.UPLOAD_DIR = path.join(process.env.DATA_DIR, "uploads");
process.env.WEB_ORIGIN = "http://localhost:5003";
const app = require("../app");
const db = require("../database/memory-db");
const student = db.data.students.find(
  (item) => item.userId === "student-001" || item.id === "student-001",
);
const cls = db.findById("classes", student.classId);
db.updateById("classes", cls.id, {
  textbookVersion: "验收测试教材",
  taughtKnowledgePointIds: ["alg-1", "alg-3"],
});
const questions = [
  {
    id: "qa-fill",
    type: "fill",
    knowledgePointId: "alg-1",
    knowledgePoints: ["alg-1"],
    knowledgeNodeName: "整式",
    content: "验收练习：计算 1÷2。",
    answer: "1/2",
    analysis: "1÷2=0.5。",
    score: 5,
    difficulty: "easy",
    difficultyLevel: 1,
    hints: ["可以把除法写成分数。"],
  },
  {
    id: "qa-proof",
    type: "subjective",
    knowledgePointId: "alg-1",
    knowledgePoints: ["alg-1"],
    knowledgeNodeName: "整式",
    content: "验收练习：说明 2x+3x 的化简步骤。",
    answer: "同类项系数相加，得到 5x。",
    analysis: "同类项的字母部分不变，系数相加。",
    score: 5,
    difficulty: "easy",
    difficultyLevel: 2,
    rubric: [
      { points: 2, description: "说明同类项" },
      { points: 3, description: "正确合并系数" },
    ],
  },
].map((question) =>
  db.create("questions", {
    ...question,
    source: "teacher-manual",
    reviewStatus: "approved",
    createdBy: "teacher-001",
    qualityVersion: 1,
  }),
);
db.create("assignments", {
  id: "qa-assignment",
  title: "浏览器验收作业",
  classId: cls.id,
  teacherId: "teacher-001",
  status: "published",
  studentIds: [student.id],
  questionIds: questions.map((question) => question.id),
  questionSnapshots: questions,
});
app.listen(5002, "127.0.0.1", () =>
  console.log("Browser acceptance API ready on 5002 (isolated data)"),
);
