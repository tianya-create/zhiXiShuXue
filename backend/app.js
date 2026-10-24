const express = require("express");
const compression = require("compression");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const { initializeSmartLearningModels } = require("./models");
const { ensureKnowledgeGraphDemoData } = require("./services/knowledge-graph");
const {
  authenticate,
  roles,
  privateResponse,
  teacherGuard,
  allowedRecord,
} = require("./middleware/access");
const db = require("./database/memory-db");
if (process.env.NODE_ENV === "production")
  require("./middleware/access").getSecret();

const app = express();

app.use(compression());
app.use(
  cors({
    origin: process.env.WEB_ORIGIN || "http://localhost:5000",
    credentials: true,
  }),
);
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Cache-Control", "no-store");
  if (
    ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) &&
    req.headers.origin &&
    req.headers.origin !== "http://" + req.headers.host &&
    req.headers.origin !== "https://" + req.headers.host &&
    ![
      process.env.WEB_ORIGIN || "http://localhost:5000",
      "http://127.0.0.1:5000",
    ].includes(req.headers.origin)
  )
    return res
      .status(403)
      .json({ success: false, message: "请求来源不受信任" });
  next();
});
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(function (req, res, next) {
  req.setTimeout(req.path.includes("upload") ? 120000 : 30000);
  res.setTimeout(req.path.includes("upload") ? 120000 : 30000);
  next();
});

app.use(
  "/uploads",
  authenticate,
  (req, res, next) => {
    const filePath = "/uploads" + req.path;
    const paper = db.data.papers.find((item) => item.filePath === filePath);
    const answer = db.data.answers.find((item) =>
      (item.images || []).some(
        (image) =>
          (typeof image === "string" ? image : image.filePath) === filePath,
      ),
    );
    const upload = db.data.uploadedFiles?.find(
      (item) => item.filePath === filePath && item.ownerId === req.user.id,
    );
    const question = db.data.questions.find(
      (item) => item.imageUrl === filePath && item.reviewStatus === "approved",
    );
    if (
      !upload &&
      !question &&
      req.user.role !== "admin" &&
      !(paper && allowedRecord("papers", paper, req.user)) &&
      !(answer && allowedRecord("answers", answer, req.user))
    )
      return res.sendStatus(403);
    next();
  },
  express.static(process.env.UPLOAD_DIR || path.join(__dirname, "uploads"), {
    dotfiles: "deny",
  }),
);

require("./services/math-bank").ensureKnowledgeGraph();
require("./services/manual-question-bank").ensureManualQuestionBank();
initializeSmartLearningModels();
require("./services/question-quality").migrateQuestionQuality();
ensureKnowledgeGraphDemoData();

const authRoutes = require("./routes/auth");
const teacherRoutes = require("./routes/teacher");
const studentRoutes = require("./routes/student");
const adminRoutes = require("./routes/admin");
const commonRoutes = require("./routes/common");
const teachingRoutes = require("./routes/teaching");
const accountRoutes = require("./routes/accounts");

app.use("/api/auth", authRoutes);
app.use("/api/ai-tutor", require("./routes/ai-tutor"));
app.use(
  "/api/teacher",
  authenticate,
  roles("teacher"),
  privateResponse,
  teacherGuard,
  require("./routes/teacher-adaptation"),
  teachingRoutes,
  teacherRoutes,
);
app.use(
  "/api/student",
  authenticate,
  roles("student"),
  privateResponse,
  require("./routes/student-adaptation"),
  studentRoutes,
);
app.use(
  "/api/admin",
  authenticate,
  roles("admin"),
  privateResponse,
  accountRoutes,
  teachingRoutes,
  adminRoutes,
);
app.use("/api/common", authenticate, privateResponse, commonRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "服务运行正常" });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  const status =
    err instanceof require("multer").MulterError ||
    err.message?.startsWith("只允许")
      ? 400
      : 500;
  res.status(status).json({
    success: false,
    message: status === 400 ? "上传文件无效或超过大小限制" : "服务器内部错误",
  });
});

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

module.exports = app;
