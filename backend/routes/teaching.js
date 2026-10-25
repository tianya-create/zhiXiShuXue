const express = require("express");
const db = require("../database/memory-db");
const {
  nodes,
  curriculumTree,
  saveNode,
  deleteNode,
  enrichQuestion,
} = require("../services/curriculum");
const { roles } = require("../middleware/access");
const { normalizeQuestion } = require("../services/question-quality");
const { reviewRecord } = require("../services/learning");
const { uploadImage } = require("../services/uploads");
const bcrypt = require("bcryptjs");
const router = express.Router();
const run = (action) => (req, res) => {
  try {
    action(req, res);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
router.post("/students", (req, res) => {
  try {
    const { name, studentNo, classId, initialPassword } = req.body;
    const cls = db.findById("classes", classId);
    if (
      !cls ||
      !String(name || "").trim() ||
      !/^[\w-]{3,60}$/.test(studentNo || "") ||
      String(initialPassword || "").length < 8
    )
      throw new Error("请填写姓名、有效学号、授权班级及至少 8 位初始密码");
    const student = db.transaction(() => {
      const user = db.create("users", {
        username: studentNo,
        name,
        role: "student",
        password: bcrypt.hashSync(initialPassword, 12),
      });
      const item = db.create("students", {
        userId: user.id,
        name,
        studentNo,
        classId,
      });
      db.updateById("classes", classId, {
        students: [...(cls.students || []), item.id],
      });
      db.addLog(req.user.id, "CREATE_STUDENT", { studentId: item.id, classId });
      return item;
    });
    res.json({ success: true, data: student });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});
router.get("/knowledge-points/flat", (req, res) =>
  res.json({ success: true, data: nodes }),
);
router.get("/knowledge-points", (req, res) =>
  res.json({ success: true, data: curriculumTree() }),
);
router.post(
  "/knowledge-points",
  roles("admin"),
  run((req, res) => res.json({ success: true, data: saveNode(req.body) })),
);
router.put(
  "/knowledge-points/:id",
  roles("admin"),
  run((req, res) =>
    res.json({ success: true, data: saveNode(req.body, req.params.id) }),
  ),
);
router.delete(
  "/knowledge-points/:id",
  roles("admin"),
  run((req, res) => {
    deleteNode(req.params.id);
    res.json({ success: true });
  }),
);
router.get(
  "/questions",
  run((req, res) => {
    let items = db
      .find("questions")
      .filter(
        (question) =>
          (!req.query.type || question.type === req.query.type) &&
          (!req.query.difficulty ||
            question.difficulty === req.query.difficulty) &&
          (!req.query.cognitiveLoadLevel ||
            (question.cognitiveLoadLevel || question.taskComplexity) === req.query.cognitiveLoadLevel) &&
          (!req.query.reviewStatus ||
            question.reviewStatus === req.query.reviewStatus) &&
          (!req.query.knowledgePoint ||
            question.knowledgePointId === req.query.knowledgePoint) &&
          (!req.query.keyword || question.content.includes(req.query.keyword)),
      );
    items = items.map(enrichQuestion);
    if (req.user.role === "teacher" && !req.query.page)
      items = items.filter((item) => item.reviewStatus === "approved");
    if (req.user.role === "admin" || req.query.page) {
      const page = Math.max(1, Number(req.query.page) || 1),
        pageSize = Math.max(1, Math.min(100, Number(req.query.pageSize) || 20));
      return res.json({
        success: true,
        data: {
          data: items.slice((page - 1) * pageSize, page * pageSize),
          total: items.length,
          page,
          pageSize,
        },
      });
    }
    res.json({ success: true, data: items });
  }),
);
router.post(
  "/questions",
  run((req, res) => {
    const question = normalizeQuestion(req.body, {}, req.user);
    if (
      question.imageUrl &&
      !db.data.uploadedFiles.some(
        (file) =>
          file.filePath === question.imageUrl && file.ownerId === req.user.id,
      )
    )
      throw new Error("题目图片不属于你");
    const saved = db.transaction(() => {
      const item = db.create("questions", question);
      db.addLog(req.user.id, "CREATE_QUESTION", {
        questionId: item.id,
        reviewStatus: item.reviewStatus,
      });
      return item;
    });
    res.json({ success: true, data: saved, message: "题目已保存" });
  }),
);
router.put(
  "/questions/:id",
  run((req, res) => {
    const existing = db.findById("questions", req.params.id);
    if (!existing) throw new Error("题目不存在");
    if (
      req.user.role === "teacher" &&
      existing.createdBy &&
      existing.createdBy !== req.user.id
    )
      return res
        .status(403)
        .json({ success: false, message: "仅可修改自己录入的题目" });
    const question = normalizeQuestion(req.body, existing, req.user);
    const saved = db.transaction(() => {
      const item = db.updateById("questions", existing.id, question);
      db.addLog(req.user.id, "UPDATE_QUESTION", {
        questionId: item.id,
        version: item.version,
        reviewStatus: item.reviewStatus,
      });
      return item;
    });
    res.json({
      success: true,
      data: saved,
      message: "题目已更新，审核状态已同步",
    });
  }),
);
router.post(
  "/questions/:id/review",
  run((req, res) => {
    const existing = db.findById("questions", req.params.id);
    if (!existing) throw new Error("题目不存在");
    if (
      req.user.role === "teacher" &&
      existing.createdBy &&
      existing.createdBy !== req.user.id
    )
      return res
        .status(403)
        .json({ success: false, message: "请管理员审核公共题目" });
    const status = req.body.reviewStatus;
    if (!["approved", "pending", "withdrawn"].includes(status))
      throw new Error("审核状态无效");
    const saved = db.updateById(
      "questions",
      existing.id,
      normalizeQuestion(
        { ...existing, reviewStatus: status },
        existing,
        req.user,
      ),
    );
    db.addLog(req.user.id, "REVIEW_QUESTION", {
      questionId: existing.id,
      reviewStatus: status,
    });
    res.json({ success: true, data: saved });
  }),
);
router.delete(
  "/questions/:id",
  run((req, res) => {
    const item = db.findById("questions", req.params.id);
    if (!item) throw new Error("题目不存在");
    if (req.user.role === "teacher" && item.createdBy !== req.user.id)
      return res
        .status(403)
        .json({ success: false, message: "仅可删除自己录入的题目" });
    if (
      db
        .find("assignments")
        .some((assignment) =>
          (
            assignment.questionIds ||
            db.findById("papers", assignment.paperId)?.questions ||
            []
          ).includes(item.id),
        )
    )
      throw new Error("题目已用于作业，请下架并保留历史答卷");
    db.deleteById("questions", item.id);
    res.json({ success: true, message: "题目已删除" });
  }),
);
router.post("/questions/upload-image", uploadImage("questions"));
router.get(
  "/classes/:id/curriculum",
  run((req, res) => {
    const cls = db.findById("classes", req.params.id);
    if (!cls) throw new Error("班级不存在");
    res.json({ success: true, data: { class: cls, nodes } });
  }),
);
router.put(
  "/classes/:id/curriculum",
  run((req, res) => {
    const cls = db.findById("classes", req.params.id);
    if (!cls) throw new Error("班级不存在");
    const ids = req.body.taughtKnowledgePointIds;
    if (
      !Array.isArray(ids) ||
      ids.some((id) => !nodes.some((node) => node.id === id))
    )
      throw new Error("已学知识点列表无效");
    const version = String(req.body.textbookVersion || "").trim();
    if (!version || version.length > 80) throw new Error("请填写教材版本");
    const saved = db.updateById("classes", cls.id, {
      taughtKnowledgePointIds: [...new Set(ids)],
      textbookVersion: version,
    });
    res.json({ success: true, data: saved });
  }),
);
router.get(
  "/analytics/student/:studentId",
  run((req, res) =>
    res.json({
      success: true,
      data: require("../services/analytics").studentAnalytics(
        req.params.studentId,
      ),
    }),
  ),
);
router.get(
  "/analytics/class/:classId",
  run((req, res) =>
    res.json({
      success: true,
      data: require("../services/analytics").classAnalytics(req.params.classId),
    }),
  ),
);
router.get(
  "/review-queue",
  run((req, res) =>
    res.json({
      success: true,
      data: ["answers", "learningRecords"].flatMap((collection) =>
        db
          .find(collection)
          .filter((record) =>
            ["submitted", "pending_review"].includes(record.status),
          )
          .map((record) => ({
            ...record,
            collection,
            studentName: db.findById("students", record.studentId)?.name || "",
            title:
              record.title ||
              db.findById("assignments", record.assignmentId)?.title ||
              "专项练习",
          })),
      ),
    }),
  ),
);
router.post(
  "/review-queue/:id",
  run((req, res) => {
    const collection =
      req.body.collection === "learningRecords" ? "learningRecords" : "answers";
    const record = db.findById(collection, req.params.id);
    if (!record) throw new Error("答卷不存在或不属于你的班级");
    res.json({
      success: true,
      data: reviewRecord(collection, record, req.body, req.user.id),
    });
  }),
);
router.post(
  "/answers/:id/grade",
  run((req, res) => {
    const record = db.findById("answers", req.params.id);
    if (!record) throw new Error("答卷不存在");
    res.json({
      success: true,
      data: reviewRecord("answers", record, req.body, req.user.id),
      message: "已复核并更新学习记录",
    });
  }),
);
router.get(
  "/question-reports",
  run((req, res) =>
    res.json({
      success: true,
      data: db
        .find("questionReports")
        .map((report) => ({
          ...report,
          question: db.findById("questions", report.questionId),
          studentName: db.findById("students", report.studentId)?.name || "",
        })),
    }),
  ),
);
router.put(
  "/question-reports/:id",
  run((req, res) => {
    const report = db.findById("questionReports", req.params.id);
    if (!report) throw new Error("纠错记录不存在");
    const resolution = String(req.body.resolution || "").trim();
    if (!resolution) throw new Error("请填写处理结果");
    res.json({
      success: true,
      data: db.updateById("questionReports", report.id, {
        status: "resolved",
        resolution,
        resolvedBy: req.user.id,
      }),
    });
  }),
);
module.exports = router;
