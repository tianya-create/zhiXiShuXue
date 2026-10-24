const { AsyncLocalStorage } = require("node:async_hooks");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const jwt = require("jsonwebtoken");
const scope = new AsyncLocalStorage();
let secret;
function getSecret() {
  if (secret) return secret;
  if (process.env.JWT_SECRET) {
    if (
      process.env.NODE_ENV === "production" &&
      process.env.JWT_SECRET.length < 32
    )
      throw new Error("JWT_SECRET must contain at least 32 characters");
    return (secret = process.env.JWT_SECRET);
  }
  if (process.env.NODE_ENV === "production")
    throw new Error("Production requires JWT_SECRET");
  const file = path.join(
    process.env.DATA_DIR || path.join(__dirname, "../database"),
    ".jwt-secret",
  );
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file))
    fs.writeFileSync(file, crypto.randomBytes(48).toString("hex"), {
      mode: 0o600,
    });
  return (secret = fs.readFileSync(file, "utf8").trim());
}
function tokenFrom(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7);
  return (req.headers.cookie || "")
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("session="))
    ?.slice(8);
}
function authenticate(req, res, next) {
  try {
    const decoded = jwt.verify(tokenFrom(req) || "", getSecret(), {
      algorithms: ["HS256"],
    });
    const db = require("../database/memory-db");
    const user = db.data.users.find((item) => item.id === decoded.userId);
    if (
      !user ||
      user.disabled ||
      (user.tokenVersion || 0) !== (decoded.tokenVersion || 0)
    )
      throw new Error();
    req.user = { id: user.id, role: user.role };
    req.headers["x-user-id"] = user.id;
    next();
  } catch {
    res.status(401).json({ success: false, message: "请重新登录" });
  }
}
function roles(...allowed) {
  return (req, res, next) =>
    allowed.includes(req.user.role)
      ? next()
      : res.status(403).json({ success: false, message: "无权访问此功能" });
}
function allowedRecord(collection, item, actor = scope.getStore()) {
  if (!actor || actor.role === "admin" || !item) return true;
  const db = require("../database/memory-db").data;
  const teacher = db.teachers.find(
    (x) => x.id === actor.id || x.userId === actor.id,
  );
  const student = db.students.find(
    (x) => x.id === actor.id || x.userId === actor.id,
  );
  const ownClass = (id) =>
    db.classes.some(
      (x) =>
        x.id === id &&
        (x.teacherId === actor.id ||
          x.teacherId === teacher?.id ||
          teacher?.classes?.includes(x.id)),
    );
  const ownStudent = (id) =>
    db.students.some(
      (x) => (x.id === id || x.userId === id) && ownClass(x.classId),
    );
  if (actor.role === "teacher") {
    if (collection === "classes") return ownClass(item.id);
    if (collection === "students") return ownClass(item.classId);
    if (collection === "teachers") return item.id === teacher?.id;
    if (collection === "users")
      return (
        item.id === actor.id ||
        db.students.some((x) => x.userId === item.id && ownClass(x.classId))
      );
    if (collection === "papers" || collection === "assignments")
      return item.teacherId === actor.id || item.teacherId === teacher?.id;
    if (
      [
        "answers",
        "learningRecords",
        "studentQuestionAttempts",
        "masteredWrongQuestions",
        "questionReports",
        "learningRounds",
        "controlAssessments",
        "adaptationDecisions",
        "learnerPresentationProfiles",
        "presentationLearningEvidence",
        "presentationAdjustmentEvents",
        "teacherSupportRequests",
      ].includes(collection) ||
      collection.startsWith("student_mistake_")
    )
      return ownStudent(item.studentId);
    if (
      [
        "student_answer",
        "student_knowledge_mastery",
        "mastery_snapshot",
      ].includes(collection)
    )
      return ownStudent(item.userId);
    if (collection === "drafts") return false;
    if (collection === "questions")
      return (
        item.reviewStatus === "approved" ||
        item.createdBy === actor.id ||
        !item.createdBy
      );
  }
  if (actor.role === "student") {
    if (collection === "students") return item.id === student?.id;
    if (collection === "classes") return item.id === student?.classId;
    if (collection === "users") return item.id === actor.id;
    if (collection === "teachers")
      return db.classes.some(
        (x) => x.id === student?.classId && x.teacherId === item.id,
      );
    if (collection === "assignments")
      return item.studentIds?.length
        ? item.studentIds.includes(student?.id)
        : item.classId === student?.classId;
    if (collection === "papers")
      return db.assignments.some(
        (x) =>
          x.paperId === item.id &&
          (x.studentIds?.length
            ? x.studentIds.includes(student?.id)
            : x.classId === student?.classId),
      );
    if (
      [
        "answers",
        "learningRecords",
        "studentQuestionAttempts",
        "drafts",
        "masteredWrongQuestions",
        "recommendationLogs",
        "learningRounds",
        "controlAssessments",
        "adaptationDecisions",
        "learnerPresentationProfiles",
        "presentationLearningEvidence",
        "presentationAdjustmentEvents",
        "teacherSupportRequests",
      ].includes(collection) ||
      collection.startsWith("student_mistake_")
    )
      return item.studentId === student?.id;
    if (
      [
        "student_answer",
        "student_knowledge_mastery",
        "mastery_snapshot",
      ].includes(collection)
    )
      return item.userId === student?.id;
  }
  return true;
}
function privateResponse(req, res, next) {
  const original = res.json.bind(res);
  const clean = (value) => {
    if (Array.isArray(value)) return value.map(clean);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key]) =>
            !/password|secret|apiKey|tokenVersion/i.test(key) &&
            !(
              req.user.role === "student" &&
              ["snapshot", "questionSnapshots"].includes(key)
            ),
        )
        .map(([key, item]) => [key, clean(item)]),
    );
  };
  res.json = (payload) =>
    original(req.path === "/backup" ? payload : clean(payload));
  scope.run(req.user, next);
}
function teacherGuard(req, res, next) {
  const db = require("../database/memory-db");
  const parts = req.path.split("/").filter(Boolean);
  const collection = {
    classes: "classes",
    students: "students",
    papers: "papers",
    assignments: "assignments",
    answers: "answers",
    questions: "questions",
    practices: "learningRecords",
  }[parts[0]];
  if (
    collection &&
    parts[1] &&
    !["upload", "export", "curriculum"].includes(parts[1])
  ) {
    const item = db.data[collection]?.find((x) => x.id === parts[1]);
    const editQuestion = collection === "questions" && req.method !== "GET";
    // 系统预置题没有 createdBy。教师可补全、审核这类题，
    // 但仍不能修改其他教师录入的题目。
    const editSystemQuestion =
      collection === "questions" &&
      !item?.createdBy &&
      (req.method === "PUT" || parts[2] === "review");
    if (
      item &&
      (!allowedRecord(collection, item, req.user) ||
        (editQuestion && item.createdBy !== req.user.id && !editSystemQuestion))
    )
      return res
        .status(403)
        .json({ success: false, message: "无权操作此记录" });
  }
  for (const id of [
    req.body?.classId,
    req.query?.classId,
    parts[0] === "analytics" && parts[1] === "class" ? parts[2] : null,
  ].filter(Boolean)) {
    if (
      !allowedRecord(
        "classes",
        db.data.classes.find((x) => x.id === id),
        req.user,
      ) ||
      !db.data.classes.some((x) => x.id === id)
    )
      return res
        .status(403)
        .json({ success: false, message: "无权访问此班级" });
  }
  const studentIds = [
    ...(Array.isArray(req.body?.studentIds) ? req.body.studentIds : []),
    parts[0] === "analytics" && parts[1] === "student" ? parts[2] : null,
  ].filter(Boolean);
  if (
    studentIds.some(
      (id) =>
        !db.data.students.some(
          (x) => x.id === id && allowedRecord("students", x, req.user),
        ),
    )
  )
    return res.status(403).json({ success: false, message: "无权访问此学生" });
  if (
    req.body?.paperId &&
    !db.data.papers.some(
      (x) => x.id === req.body.paperId && allowedRecord("papers", x, req.user),
    )
  )
    return res.status(403).json({ success: false, message: "无权访问此试卷" });
  next();
}
module.exports = {
  scope,
  getSecret,
  tokenFrom,
  authenticate,
  roles,
  allowedRecord,
  privateResponse,
  teacherGuard,
};
