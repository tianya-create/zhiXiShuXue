const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const bcrypt = require("bcryptjs");
const db = require("../database/memory-db");
const app = require("../app");
let server, base;
const tokens = {};
async function request(role, method, url, body, extraHeaders = {}) {
  const res = await fetch(base + url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(role ? { Authorization: "Bearer " + tokens[role] } : {}),
      ...extraHeaders,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await res.json();
  return { status: res.status, ...payload };
}
beforeAll(async () => {
  for (const [id, role] of [
    ["t-one", "teacher"],
    ["t-two", "teacher"],
    ["s-one", "student"],
    ["s-two", "student"],
  ]) {
    db.create("users", {
      id,
      username: id,
      name: id,
      password: bcrypt.hashSync("test-password", 4),
      role,
    });
    db.create(role === "teacher" ? "teachers" : "students", {
      id,
      userId: id,
      name: id,
      ...(role === "teacher"
        ? { classes: [id === "t-one" ? "class-one" : "class-two"] }
        : { classId: id === "s-one" ? "class-one" : "class-two" }),
    });
  }
  db.create("classes", {
    id: "class-one",
    teacherId: "t-one",
    grade: "七年级",
    students: ["s-one"],
  });
  db.create("classes", {
    id: "class-two",
    teacherId: "t-two",
    grade: "七年级",
    students: ["s-two"],
  });
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = "http://127.0.0.1:" + server.address().port;
  for (const role of ["admin", "t-one", "t-two", "s-one", "s-two"]) {
    const login = await request(null, "POST", "/api/auth/login", {
      username: role,
      password: role === "admin" ? "admin123" : "test-password",
    });
    assert.equal(login.success, true);
    tokens[role] = login.data.token;
  }
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

test("authentication, role boundaries, forged identity and class isolation", async () => {
  expect((await request(null, "GET", "/api/admin/users")).status).toBe(401);
  expect((await request("s-one", "GET", "/api/admin/users")).status).toBe(403);
  expect(
    (await request("t-two", "GET", "/api/teacher/classes/class-one/students"))
      .status,
  ).toBe(403);
  const profile = await request("s-one", "GET", "/api/student/profile", null, {
    "X-User-Id": "s-two",
  });
  expect(profile.data.id).toBe("s-one");
  expect(
    (await request("s-one", "GET", "/api/common/wrong-stats/s-two")).status,
  ).toBe(403);
  const classes = await request("t-one", "GET", "/api/common/classes");
  expect(classes.data.every((item) => item.id === "class-one")).toBe(true);
});

test("question-bank papers can be viewed and safely removed without deleting historical assignments", async () => {
  const paper = db.create("papers", {
    id: "manual-paper-removal",
    title: "题库组卷安全移除",
    teacherId: "t-one",
    classId: "class-one",
    filePath: "",
    fileType: "manual",
    source: "question-bank",
    status: "published",
    questions: [],
  });
  const assignment = db.create("assignments", {
    id: "manual-paper-assignment",
    title: "保留的历史作业",
    teacherId: "t-one",
    classId: "class-one",
    paperId: paper.id,
    questionIds: [],
    questionSnapshots: [],
    status: "published",
  });

  const detail = await request(
    "t-one",
    "GET",
    "/api/teacher/papers/" + paper.id,
  );
  expect(detail.status).toBe(200);
  expect(detail.data.questionDetails).toEqual([]);
  expect(detail.data.usage.assignmentCount).toBe(1);

  const removed = await request(
    "t-one",
    "DELETE",
    "/api/teacher/papers/" + paper.id,
  );
  expect(removed.status).toBe(200);
  expect(removed.data.archivedAt).toBeTruthy();
  expect(db.data.assignments.some((item) => item.id === assignment.id)).toBe(true);

  const list = await request("t-one", "GET", "/api/teacher/papers?pageSize=100");
  expect(list.data.data.some((item) => item.id === paper.id)).toBe(false);
});

test("teacher question -> assignment -> student -> step review -> practice", async () => {
  const question = await request("t-one", "POST", "/api/teacher/questions", {
    type: "subjective",
    knowledgePointId: "alg-1",
    content: "解释 2x+3x 为什么等于 5x。",
    answer: "合并同类项，系数相加。",
    analysis: "字母和指数相同，系数 2+3=5。",
    score: 5,
    reviewStatus: "approved",
    rubric: [
      { points: 2, description: "指出同类项" },
      { points: 3, description: "正确合并" },
    ],
  });
  expect(question.status).toBe(200);
  const q = question.data;
  const objective = await request("t-one", "POST", "/api/teacher/questions", {
    type: "fill",
    knowledgePointId: "alg-1",
    content: "计算 1÷2。",
    answer: "1/2",
    analysis: "1÷2=0.5。",
    score: 5,
    reviewStatus: "approved",
  });
  const f = objective.data;
  const unpublished = await request("t-one", "POST", "/api/teacher/questions", {
    type: "fill",
    knowledgePointId: "alg-1",
    content: "未审核测试题",
    answer: "1",
    score: 5,
  });
  expect(
    (
      await request("t-one", "POST", "/api/teacher/assignments", {
        title: "拒绝未审核题",
        classId: "class-one",
        questionIds: [unpublished.data.id],
      })
    ).status,
  ).toBe(400);
  await request("t-one", "PUT", "/api/teacher/classes/class-one/curriculum", {
    textbookVersion: "测试教材",
    taughtKnowledgePointIds: ["alg-1"],
  });
  const assignment = await request(
    "t-one",
    "POST",
    "/api/teacher/assignments",
    { title: "真实流程测试", classId: "class-one", questionIds: [q.id, f.id] },
  );
  expect(assignment.status).toBe(200);
  const aid = assignment.data.id;
  expect(
    (
      await request(
        "s-two",
        "GET",
        "/api/student/assignments/" + aid + "/questions",
      )
    ).status,
  ).toBe(400);
  const questions = await request(
    "s-one",
    "GET",
    "/api/student/assignments/" + aid + "/questions",
  );
  expect(
    questions.data.questions.every(
      (item) =>
        !("answer" in item) &&
        !("answer_text" in item) &&
        !("analysis" in item),
    ),
  ).toBe(true);
  expect(questions.data.assignment.questionSnapshots).toBeUndefined();
  await request("s-one", "PUT", "/api/student/drafts/assignment-" + aid, {
    answers: { [f.id]: "0.5" },
    requestId: "workflow-submit-1",
    questionIds: [f.id, q.id],
  });
  expect(
    (await request("s-two", "GET", "/api/student/drafts/assignment-" + aid))
      .data,
  ).toBeNull();
  const submission = await request(
    "s-one",
    "POST",
    "/api/student/assignments/" + aid + "/submit",
    {
      answers: { [q.id]: "同类项的系数相加。", [f.id]: "0.5" },
      requestId: "workflow-submit-1",
    },
  );
  expect(submission.status).toBe(200);
  expect(submission.data.status).toBe("submitted");
  expect(
    submission.data.questionResults.find((item) => item.questionId === q.id)
      .correct,
  ).toBeNull();
  expect(db.find("student_answer", { userId: "s-one" }).length).toBe(1);
  const repeat = await request(
    "s-one",
    "POST",
    "/api/student/assignments/" + aid + "/submit",
    { answers: {}, requestId: "workflow-submit-1" },
  );
  expect(repeat.data.id).toBe(submission.data.id);
  expect(db.find("student_answer", { userId: "s-one" }).length).toBe(1);
  expect(
    (
      await request(
        "t-two",
        "POST",
        "/api/teacher/answers/" + submission.data.id + "/grade",
        { scores: { [q.id]: 5 } },
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await request(
        "t-one",
        "POST",
        "/api/teacher/answers/" + submission.data.id + "/grade",
        { scores: { [q.id]: 5 } },
      )
    ).status,
  ).toBe(400);
  const reviewed = await request(
    "t-one",
    "POST",
    "/api/teacher/review-queue/" + submission.data.id,
    {
      collection: "answers",
      scores: { [f.id]: 5 },
      stepScores: { [q.id]: [2, 2] },
      comments: { [q.id]: "需要补充计算结论" },
    },
  );
  expect(reviewed.status).toBe(200);
  expect(reviewed.data.totalScore).toBe(9);
  const regraded = await request(
    "t-one",
    "POST",
    "/api/teacher/review-queue/" + submission.data.id,
    { collection: "answers", stepScores: { [q.id]: [2, 3] } },
  );
  expect(regraded.status).toBe(200);
  expect(db.find("student_answer", { userId: "s-one" }).length).toBe(2);
  const practice = await request(
    "s-one",
    "POST",
    "/api/student/practice/alg-1/submit",
    {
      questionIds: [q.id, f.id],
      answers: { [q.id]: "说明过程", [f.id]: "1/2" },
      requestId: "practice-test-1",
    },
  );
  expect(practice.status).toBe(200);
  expect(practice.data.status).toBe("pending_review");
  const queue = await request("t-one", "GET", "/api/teacher/review-queue");
  expect(queue.data.some((item) => item.id === practice.data.id)).toBe(true);
  const report = await request(
    "s-one",
    "POST",
    "/api/student/questions/" + q.id + "/report",
    { message: "这里的解题步骤不够清楚" },
  );
  expect(report.status).toBe(200);
  const reports = await request(
    "t-one",
    "GET",
    "/api/teacher/question-reports",
  );
  expect(reports.data.length).toBeGreaterThan(0);
  const otherReports = await request(
    "t-two",
    "GET",
    "/api/teacher/question-reports",
  );
  expect(otherReports.data.length).toBe(0);
});

test("backup, restore and failed transaction retain all business collections", async () => {
  const backup = await request("admin", "GET", "/api/admin/backup");
  const saved = backup.data.data;
  const before = db.data.drafts.length;
  expect(() =>
    db.transaction(() => {
      db.create("drafts", { studentId: "s-one", key: "rolled-back" });
      throw new Error("rollback");
    }),
  ).toThrow("rollback");
  expect(db.data.drafts.length).toBe(before);
  const restoring = await request("admin", "POST", "/api/admin/restore", {
    data: saved,
  });
  expect(restoring.status).toBe(200);
  const child = spawnSync(
    process.execPath,
    [
      "-e",
      "require('./app');const db=require('./database/memory-db');console.log('RESTART:'+JSON.stringify({users:db.data.users.length,answers:db.data.answers.length,classes:db.data.classes.length,drafts:db.data.drafts.length,approved:db.data.questions.filter(q=>q.reviewStatus==='approved').length}));",
    ],
    {
      cwd: require("node:path").join(__dirname, ".."),
      env: process.env,
      encoding: "utf8",
    },
  );
  expect(child.status).toBe(0);
  const restarted = JSON.parse(child.stdout.split("RESTART:")[1].trim());
  expect(restarted.answers).toBe(saved.answers.length);
  expect(restarted.classes).toBe(saved.classes.length);
  expect(restarted.users).toBe(saved.users.length);
  expect(restarted.approved).toBe(
    saved.questions.filter((q) => q.reviewStatus === "approved").length,
  );
});

test("curriculum changes are shared by question entry, class progress and graph queries", async () => {
  const created = await request(
    "admin",
    "POST",
    "/api/admin/knowledge-points",
    {
      name: "测试细分知识点",
      parentId: "cat-arith",
      grade: 7,
      prerequisites: ["alg-1"],
    },
  );
  expect(created.status).toBe(200);
  const id = created.data.id;
  const question = await request("t-one", "POST", "/api/teacher/questions", {
    type: "fill",
    knowledgePointId: id,
    content: "细分知识点测试：1+1=",
    answer: "2",
    analysis: "相加得到2。",
    reviewStatus: "approved",
    score: 5,
  });
  expect(question.status).toBe(200);
  const cls = await request(
    "t-one",
    "PUT",
    "/api/teacher/classes/class-one/curriculum",
    { textbookVersion: "测试教材", taughtKnowledgePointIds: [id] },
  );
  expect(cls.status).toBe(200);
  const graph = await request("s-one", "GET", "/api/student/weak-points");
  expect(graph.data.some((node) => node.id === id && node.eligible)).toBe(true);
  const questions = await request(
    "s-one",
    "GET",
    "/api/student/practice/" + id,
  );
  expect(
    questions.data.questions.some((item) => item.id === question.data.id),
  ).toBe(true);
  const loop = await request(
    "admin",
    "PUT",
    "/api/admin/knowledge-points/alg-1",
    { name: "整式", prerequisites: [id] },
  );
  expect(loop.status).toBe(400);
  expect(
    (await request("admin", "DELETE", "/api/admin/knowledge-points/" + id))
      .status,
  ).toBe(400);
});

test("uploaded handwritten work is private and invalid image formats are rejected", async () => {
  const data = new FormData();
  data.append(
    "file",
    new Blob(
      [
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRxoAAAAASUVORK5CYII=",
          "base64",
        ),
      ],
      { type: "image/png" },
    ),
    "answer.png",
  );
  const res = await fetch(base + "/api/student/answers/upload", {
    method: "POST",
    headers: { Authorization: "Bearer " + tokens["s-one"] },
    body: data,
  });
  expect(res.status).toBe(200);
  const uploaded = await res.json();
  expect(
    (
      await fetch(base + uploaded.data.filePath, {
        headers: { Authorization: "Bearer " + tokens["s-one"] },
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await fetch(base + uploaded.data.filePath, {
        headers: { Authorization: "Bearer " + tokens["s-two"] },
      })
    ).status,
  ).toBe(403);
  expect((await fetch(base + uploaded.data.filePath)).status).toBe(401);
  const invalid = new FormData();
  invalid.append(
    "file",
    new Blob(["<script>bad()</script>"], { type: "image/png" }),
    "fake.png",
  );
  expect(
    (
      await fetch(base + "/api/student/answers/upload", {
        method: "POST",
        headers: { Authorization: "Bearer " + tokens["s-one"] },
        body: invalid,
      })
    ).status,
  ).toBe(400);
});

test("invalid restore is rejected without changing accounts", async () => {
  const before = db.data.users.length;
  expect(
    (
      await request("admin", "POST", "/api/admin/restore", {
        data: { users: [] },
      })
    ).status,
  ).toBe(400);
  expect(db.data.users.length).toBe(before);
});

test("account creation rejects duplicate names and disabling revokes access", async () => {
  const user = await request("admin", "POST", "/api/admin/users", {
    username: "school-account",
    name: "账号测试",
    role: "student",
    classId: "class-one",
    password: "test-password",
  });
  expect(user.status).toBe(200);
  expect(
    (
      await request("admin", "POST", "/api/admin/users", {
        username: "school-account",
        name: "重复账号",
        role: "teacher",
        password: "test-password",
      })
    ).status,
  ).toBe(400);
  const login = await request(null, "POST", "/api/auth/login", {
    username: "school-account",
    password: "test-password",
  });
  tokens["school-account"] = login.data.token;
  await request("admin", "PUT", "/api/admin/users/" + user.data.id, {
    disabled: true,
  });
  expect(
    (await request("school-account", "GET", "/api/student/profile")).status,
  ).toBe(401);
});

test("a PDF-only assignment accepts handwritten work and can be reviewed", async () => {
  const data = new FormData();
  data.append(
    "file",
    new Blob(["%PDF-1.4\n%%EOF"], { type: "application/pdf" }),
    "worksheet.pdf.html",
  );
  data.append("title", "图片作答验收试卷");
  data.append("classId", "class-one");
  const uploaded = await fetch(base + "/api/teacher/papers/upload", {
    method: "POST",
    headers: { Authorization: "Bearer " + tokens["t-one"] },
    body: data,
  });
  expect(uploaded.status).toBe(200);
  const paper = (await uploaded.json()).data;
  expect(paper.filePath.endsWith(".pdf")).toBe(true);
  const assignment = await request(
    "t-one",
    "POST",
    "/api/teacher/assignments",
    { title: "图片作答验收", classId: "class-one", paperId: paper.id },
  );
  expect(assignment.status).toBe(200);
  const image = db.data.uploadedFiles.find((item) => item.ownerId === "s-one");
  const answer = await request(
    "s-one",
    "POST",
    "/api/student/assignments/" + assignment.data.id + "/submit",
    { answers: {}, images: [image.filePath], requestId: "image-only-submit" },
  );
  expect(answer.status).toBe(200);
  expect(answer.data.status).toBe("submitted");
  const reviewed = await request(
    "t-one",
    "POST",
    "/api/teacher/review-queue/" + answer.data.id,
    {
      collection: "answers",
      scores: { __image_review__: 85 },
      comments: { __image_review__: "过程基本正确" },
    },
  );
  expect(reviewed.status).toBe(200);
  expect(reviewed.data.totalScore).toBe(85);
  const studentAnswer = await request(
    "s-one",
    "GET",
    "/api/student/answers/" + answer.data.id,
  );
  expect(studentAnswer.data.totalScore).toBe(85);
  const privatePaper = await fetch(base + paper.filePath, {
    headers: { Authorization: "Bearer " + tokens["s-two"] },
  });
  expect(privatePaper.status).toBe(403);
  expect(
    (await request("t-one", "DELETE", "/api/teacher/papers/" + paper.id))
      .status,
  ).toBe(400);
  const regrade = await request(
    "t-one",
    "POST",
    "/api/teacher/review-queue/" + answer.data.id,
    { collection: "answers", scores: { __image_review__: 90 } },
  );
  expect(regrade.status).toBe(200);
  expect(regrade.data.totalScore).toBe(90);
});

test("administrator erasure removes student records and owned answer images", async () => {
  const created = await request("admin", "POST", "/api/admin/users", {
    username: "erase-account",
    name: "删除验收账号",
    role: "student",
    classId: "class-one",
    password: "test-password",
  });
  const student = db.findOne("students", { userId: created.data.id });
  db.create("drafts", {
    studentId: student.id,
    key: "erase-draft",
    answers: { q: "私人草稿" },
  });
  const directory = require("node:path").join(
    process.env.UPLOAD_DIR,
    "answers",
  );
  const filePath = require("node:path").join(directory, "erase-fixture.png");
  require("node:fs").mkdirSync(directory, { recursive: true });
  require("node:fs").writeFileSync(filePath, "fixture");
  db.create("uploadedFiles", {
    ownerId: created.data.id,
    kind: "answers",
    filePath: "/uploads/answers/erase-fixture.png",
  });
  expect(
    (await request("admin", "DELETE", "/api/admin/users/" + created.data.id))
      .status,
  ).toBe(200);
  expect(db.find("drafts", { studentId: student.id })).toHaveLength(0);
  expect(db.findById("users", created.data.id)).toBeUndefined();
  expect(require("node:fs").existsSync(filePath)).toBe(false);
});
