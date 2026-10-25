const express = require("express");
const db = require("../database/memory-db");
const { adaptiveOverview } = require("../services/adaptive-learning");

const router = express.Router();
const teacherOf = (req) =>
  db.findById("teachers", req.user.id) || db.findOne("teachers", { userId: req.user.id });
const classIdsOf = (req) => {
  const teacher = teacherOf(req);
  const allowed = new Set([
    ...(teacher?.classes || []),
    ...db
      .find("classes")
      .filter((item) => item.teacherId === req.user.id || item.teacherId === teacher?.id)
      .map((item) => item.id),
  ]);
  if (req.query.classId) {
    if (!allowed.has(req.query.classId)) throw new Error("无权访问此班级");
    return [req.query.classId];
  }
  return [...allowed];
};
const run = (handler) => (req, res) => {
  try {
    handler(req, res);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

router.get(
  "/adaptation/overview",
  run((req, res) => res.json({ success: true, data: adaptiveOverview(classIdsOf(req)) })),
);

router.get(
  "/adaptation/students/:studentId/history",
  run((req, res) => {
    const student = db.findById("students", req.params.studentId);
    if (!student || !classIdsOf(req).includes(student.classId)) throw new Error("无权访问此学生");
    res.json({
      success: true,
      data: {
        student,
        assessments: db
          .find("controlAssessments", { studentId: student.id })
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
        decisions: db
          .find("adaptationDecisions", { studentId: student.id })
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
        profile: db.findOne("learnerPresentationProfiles", { studentId: student.id, active: true }),
        profiles: db
          .find("learnerPresentationProfiles", { studentId: student.id })
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
        presentationAdjustments: db
          .find("presentationAdjustmentEvents", { studentId: student.id })
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
      },
    });
  }),
);

router.get(
  "/adaptation/support-requests",
  run((req, res) => {
    const classIds = classIdsOf(req);
    const data = db
      .find("teacherSupportRequests")
      .filter((item) => classIds.includes(item.classId))
      .map((item) => ({
        ...item,
        studentName: db.findById("students", item.studentId)?.name || "学生",
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, data });
  }),
);

router.patch(
  "/adaptation/support-requests/:id",
  run((req, res) => {
    const item = db.findById("teacherSupportRequests", req.params.id);
    if (!item || !classIdsOf(req).includes(item.classId)) throw new Error("支持请求不存在");
    const status = ["open", "contacted", "closed"].includes(req.body.status)
      ? req.body.status
      : "contacted";
    res.json({ success: true, data: db.updateById("teacherSupportRequests", item.id, { status }) });
  }),
);

module.exports = router;
