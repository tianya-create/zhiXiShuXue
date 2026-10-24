const os = require("node:os");
const path = require("node:path");

process.env.APP_DB_PATH = path.join(
  os.tmpdir(),
  `zhixi-curriculum-chain-${process.pid}-${Date.now()}.sqlite`,
);

const db = require("../database/memory-db");
const { eligibleNodes } = require("../services/curriculum");
const {
  ensureManualQuestionBank,
  getQuestionBankByNode,
  GRAPH_NODES,
} = require("../services/manual-question-bank");
const { migrateQuestionQuality } = require("../services/question-quality");

describe("班级进度、题库审核与学生练习链路", () => {
  beforeAll(() => {
    ensureManualQuestionBank();
    migrateQuestionQuality();
  });

  test("已学范围包含知识点时，学生可获取同一知识点的已审核题目", () => {
    const student = db.findById("students", "student-001");
    const klass = db.findById("classes", student.classId);
    const originalScope = klass.taughtKnowledgePointIds;
    const originalVersion = klass.textbookVersion;

    db.updateById("classes", klass.id, {
      taughtKnowledgePointIds: ["number-1", "alg-1"],
      textbookVersion: "人教版，七年级",
    });

    expect(eligibleNodes(student.id).map((item) => item.id)).toContain("number-1");
    const questions = getQuestionBankByNode({ knowledgePointId: "number-1" });
    expect(questions.length).toBeGreaterThan(0);
    expect(questions.every((item) => item.reviewStatus === "approved")).toBe(true);

    db.updateById("classes", klass.id, {
      taughtKnowledgePointIds: originalScope,
      textbookVersion: originalVersion,
    });
  });

  test("系统自带题库会进入可发布池，教师新录入题不被自动审核", () => {
    const builtIn = db.find("questions", { source: "manual-curated" });
    expect(builtIn.length).toBeGreaterThan(0);
    expect(builtIn.every((item) => item.reviewStatus === "approved")).toBe(true);

    const manual = db.create("questions", {
      content: "审核链路测试题",
      knowledgePointId: "alg-1",
      knowledgePoints: ["alg-1"],
      type: "choice",
      options: ["A", "B"],
      answer: "A",
      analysis: "用于验证教师新录入题不会被自动审核。",
      score: 5,
      difficulty: "easy",
      reviewStatus: "pending",
      source: "teacher-manual",
      createdBy: "teacher-001",
      qualityVersion: 1,
    });

    migrateQuestionQuality();
    expect(db.findById("questions", manual.id).reviewStatus).toBe("pending");
  });

  test("知识图谱节点只返回自己标注的题目，节点间不会复用同一道题", () => {
    const allNodeIds = GRAPH_NODES.map(([id]) => id);
    const seenQuestionIds = new Set();

    for (const nodeId of allNodeIds) {
      const questions = getQuestionBankByNode({ knowledgePointId: nodeId });
      expect(questions.length).toBeGreaterThan(0);
      expect(questions.every((item) => item.knowledgePointId === nodeId)).toBe(true);
      for (const question of questions) {
        expect(seenQuestionIds.has(question.id)).toBe(false);
        seenQuestionIds.add(question.id);
      }
    }
  });
});
