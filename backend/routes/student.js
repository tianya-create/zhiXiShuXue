const express = require("express");
const db = require("../database/memory-db");
const { nodes, eligibleNodes, classOf } = require("../services/curriculum");
const { publicQuestion } = require("../services/question-quality");
const { getQuestionBankByNode } = require("../services/manual-question-bank");
const {
  getPersonalizedPush,
  getColorStatus,
} = require("../services/personalized-push");
const { gradeQuestions, synchronize } = require("../services/learning");
const { getTrend } = require("../services/masteryEngine");
const { uploadImage } = require("../services/uploads");
const router = express.Router();
const studentOf = (req) =>
  db.findById("students", req.user.id) ||
  db.findOne("students", { userId: req.user.id });
const S = (id) =>
  db.findById("students", id) || db.findOne("students", { userId: id });
const run = (handler) => (req, res, next) => {
  try {
    const student = studentOf(req);
    if (!student)
      return res
        .status(404)
        .json({ success: false, message: "学生信息尚未建立" });
    handler(req, res, student);
  } catch (error) {
    res
      .status(error.status || 400)
      .json({ success: false, message: error.message });
  }
};
const latest = (assignmentId, studentId) =>
  db
    .find("answers", { assignmentId, studentId })
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))[0] ||
  null;
function assigned(id, student) {
  const assignment = db.findById("assignments", id);
  if (!assignment) throw new Error("作业不存在或不属于你");
  if (assignment.status !== "published") throw new Error("作业尚未发布");
  return assignment;
}
function assignmentQuestions(assignment) {
  return (
    assignment.questionSnapshots ||
    (
      assignment.questionIds ||
      db.findById("papers", assignment.paperId)?.questions ||
      []
    )
      .map((id) => db.findById("questions", id))
      .filter(Boolean)
  );
}
function practiceQuestions(student, kp) {
  if (!eligibleNodes(student.id).some((node) => node.id === kp)) return [];
  const mistakes = db
    .getAllMistakesForStudent(student.id)
    .filter((item) => !item.isResolved)
    .map((item) => item.questionId);
  return getQuestionBankByNode({ knowledgePointId: kp })
    .sort(
      (a, b) =>
        Number(mistakes.includes(b.id)) - Number(mistakes.includes(a.id)) ||
        a.difficultyLevel - b.difficultyLevel,
    )
    .slice(0, 6);
}
function weak(student) {
  const eligible = new Set(eligibleNodes(student.id).map((node) => node.id));
  return nodes.map((node) => {
    const state = getColorStatus(student.id, node.id);
    return {
      ...node,
      ...state,
      id: node.id,
      masteryRate: state.mastery,
      statusLabel: state.label,
      eligible: eligible.has(node.id),
      parentId: node.prerequisites?.[0] || "",
      isLeaf: !node.dependencies?.length,
      description: node.chapter,
      questionCount: getQuestionBankByNode({ knowledgePointId: node.id })
        .length,
      wrongCount: db
        .getAllMistakesForStudent(student.id)
        .filter((item) => item.kpCode === node.id && !item.isResolved).length,
    };
  });
}
function changes(student, questions) {
  return [...new Set(questions.map((item) => item.knowledgePointId))].map(
    (id) => {
      const state = getColorStatus(student.id, id);
      return {
        knowledgePointId: id,
        knowledgePointName: nodes.find((node) => node.id === id)?.name || id,
        masteryAfter: state.mastery,
        statusLabel: state.label,
        statusType:
          state.status === "green"
            ? "success"
            : state.status === "gray"
              ? "info"
              : "warning",
      };
    },
  );
}
function wrongs(student) {
  return db
    .getAllMistakesForStudent(student.id)
    .map((item) => {
      const question = db.findById("questions", item.questionId);
      return question
        ? {
            ...item,
            id: question.id,
            content: question.content,
            questionId: question.id,
            kpName:
              nodes.find((node) => node.id === item.kpCode)?.name ||
              item.kpCode,
            knowledgePointId: item.kpCode,
            question: question,
            answer: question.answer,
            options: question.options,
            type: question.type,
            statusLabel: item.masteryStatus,
          }
        : null;
    })
    .filter(Boolean);
}
function idempotent(req, student, collection) {
  const key = String(req.body.requestId || "");
  if (!/^[a-zA-Z0-9-]{8,100}$/.test(key))
    throw new Error("缺少有效提交编号，请刷新后重试");
  return {
    key,
    existing: db.findOne(collection, { studentId: student.id, requestId: key }),
  };
}
router.post("/answers/upload", uploadImage("answers"));
router.get(
  "/assignments",
  run((req, res, student) => {
    res.json({
      success: true,
      data: db
        .find("assignments")
        .map((assignment) => {
          const answer = latest(assignment.id, student.id);
          return {
            ...assignment,
            questionCount: assignmentQuestions(assignment).length,
            submitted: !!answer,
            score: answer?.totalScore,
            paperTitle:
              db.findById("papers", assignment.paperId)?.title || "题目集",
          };
        })
        .filter((item) =>
          req.query.status === "pending"
            ? !item.submitted
            : req.query.status === "completed"
              ? item.submitted
              : true,
        ),
    });
  }),
);
router.get(
  "/assignments/:id/questions",
  run((req, res, student) => {
    const assignment = assigned(req.params.id, student);
    res.json({
      success: true,
      data: {
        assignment,
        paper: db.findById("papers", assignment.paperId) || null,
        questions: assignmentQuestions(assignment).map(publicQuestion),
      },
    });
  }),
);
router.get(
  "/assignments/:id/latest-answer",
  run((req, res, student) => {
    assigned(req.params.id, student);
    const answer = latest(req.params.id, student.id);
    res.json({ success: true, data: answer ? { answerId: answer.id } : null });
  }),
);
router.get(
  "/answers/:id",
  run((req, res) => {
    const record = db.findById("answers", req.params.id);
    if (!record)
      return res.status(404).json({ success: false, message: "答卷不存在" });
    res.json({
      success: true,
      data: {
        ...record,
        questions: record.questionResults.map((result) => ({
          ...result,
          content: result.snapshot?.content || "",
          correctAnswer: result.needsReview ? "" : result.correctAnswer,
          teacherComment: result.comment || "",
          teacherCorrection: result.correction || "",
        })),
      },
    });
  }),
);
router.post(
  "/assignments/:id/submit",
  run((req, res, student) => {
    const assignment = assigned(req.params.id, student);
    const repeat = idempotent(req, student, "answers");
    if (repeat.existing) {
      if (repeat.existing.assignmentId !== assignment.id)
        throw new Error("提交编号已被使用");
      return res.json({
        success: true,
        data: { ...repeat.existing, answerId: repeat.existing.id },
      });
    }
    if (latest(assignment.id, student.id))
      return res
        .status(409)
        .json({ success: false, message: "这份作业已交卷，请查看答卷" });
    if (
      assignment.deadline &&
      Date.now() > new Date(assignment.deadline).getTime()
    )
      throw new Error("作业已截止");
    const questions = assignmentQuestions(assignment);
    const ids = questions.map((item) => item.id);
    if (Object.keys(req.body.answers || {}).some((id) => !ids.includes(id)))
      throw new Error("作答包含不属于该作业的题目");
    const images = Array.isArray(req.body.images) ? req.body.images : [];
    if (
      images.some(
        (file) =>
          !db.data.uploadedFiles?.some(
            (item) => item.filePath === file && item.ownerId === req.user.id,
          ),
      )
    )
      throw new Error("作答图片无效");
    if (!Object.keys(req.body.answers || {}).length && !images.length)
      throw new Error("请先完成作答");
    const results = gradeQuestions(ids, req.body.answers || {}, questions);
    const record = db.transaction(() => {
      const value = db.create("answers", {
        studentId: student.id,
        assignmentId: assignment.id,
        paperId: assignment.paperId,
        classId: student.classId,
        requestId: repeat.key,
        submittedAt: new Date().toISOString(),
        costTime: Math.max(0, Math.min(86400, Number(req.body.costTime) || 0)),
        questionResults: results,
        images,
        totalScore: results.reduce((sum, item) => sum + item.score, 0),
        status:
          images.length || results.some((item) => item.needsReview)
            ? "submitted"
            : "graded",
      });
      synchronize(value);
      const draft = db.findOne("drafts", {
        studentId: student.id,
        key: "assignment-" + assignment.id,
      });
      if (draft) db.deleteById("drafts", draft.id);
      return value;
    });
    res.json({
      success: true,
      data: {
        ...record,
        answerId: record.id,
        knowledgePointChanges: changes(student, questions),
      },
    });
  }),
);
router.get(
  "/weak-points",
  run((req, res, student) => res.json({ success: true, data: weak(student) })),
);
router.get(
  "/wrong-questions",
  run((req, res, student) =>
    res.json({ success: true, data: wrongs(student) }),
  ),
);
router.get(
  "/wrong-questions/stats",
  run((req, res, student) =>
    res.json({
      success: true,
      data: {
        questionBook: wrongs(student),
        total: wrongs(student).length,
        totalWrongQuestions: wrongs(student).filter((item) => !item.isResolved)
          .length,
      },
    }),
  ),
);
router.get(
  "/recommendations",
  run((req, res, student) => {
    const pack = getPersonalizedPush(student.id, req.query);
    res.json({
      success: true,
      data: pack.questions.map(publicQuestion),
      message: pack.recommendationReason,
    });
  }),
);
router.get(
  "/personalized-recommendations",
  run((req, res, student) => {
    const pack = getPersonalizedPush(student.id, req.query);
    res.json({
      success: true,
      data: { ...pack, questions: pack.questions.map(publicQuestion) },
    });
  }),
);
router.get(
  "/questions",
  run((req, res, student) => {
    const available = eligibleNodes(student.id);
    const data = req.query.knowledgePointId
      ? practiceQuestions(student, req.query.knowledgePointId)
      : available
          .flatMap((node) =>
            getQuestionBankByNode({ knowledgePointId: node.id }),
          )
          .slice(0, 20);
    res.json({ success: true, data: data.map(publicQuestion) });
  }),
);
router.get(
  "/practice/:knowledgePointId",
  run((req, res, student) => {
    const kp = req.params.knowledgePointId;
    const requested = String(
      req.query.questionIds || req.query.questionId || "",
    )
      .split(",")
      .filter(Boolean);
    const ownWrong = wrongs(student);
    const available = new Set(eligibleNodes(student.id).map((node) => node.id));
    const questions = requested.length
      ? requested
          .map((id) => db.findById("questions", id))
          .filter(
            (item) =>
              item &&
              item.reviewStatus === "approved" &&
              (available.has(item.knowledgePointId) ||
                ownWrong.some((wrong) => wrong.questionId === item.id)),
          )
      : practiceQuestions(student, kp);
    const node = nodes.find((item) => item.id === kp);
    res.json({
      success: true,
      data: {
        questions: questions.map(publicQuestion),
        knowledgePointId: kp,
        title: requested.length
          ? "错题重做"
          : (node?.name || "知识点") + "专项练习",
        mode: requested.length ? "wrong-question" : "weak-point",
      },
    });
  }),
);
router.post(
  "/practice/:knowledgePointId/submit",
  run((req, res, student) => {
    const repeat = idempotent(req, student, "learningRecords");
    if (repeat.existing)
      return res.json({ success: true, data: repeat.existing });
    const ids = [
      ...new Set(req.body.questionIds || Object.keys(req.body.answers || {})),
    ];
    if (!ids.length || ids.length > 20) throw new Error("请选择 1 到 20 道题");
    const eligible = new Set(eligibleNodes(student.id).map((node) => node.id));
    const wrongIds = new Set(wrongs(student).map((item) => item.questionId));
    if (
      ids.some((id) => {
        const question = db.findById("questions", id);
        return (
          !question ||
          question.reviewStatus !== "approved" ||
          (!eligible.has(question.knowledgePointId) && !wrongIds.has(id))
        );
      })
    )
      throw new Error("题目未审核或不在已学范围");
    const questions = ids.map((id) => db.findById("questions", id));
    const before = changes(student, questions);
    const results = gradeQuestions(ids, req.body.answers || {});
    const record = db.transaction(() => {
      const value = db.create("learningRecords", {
        studentId: student.id,
        classId: student.classId,
        recordType: "practice",
        requestId: repeat.key,
        knowledgePointId: req.params.knowledgePointId,
        title: req.body.title || "专项练习",
        questionIds: ids,
        questionResults: results,
        totalScore: results.reduce((sum, item) => sum + item.score, 0),
        status: results.some((item) => item.needsReview)
          ? "pending_review"
          : "completed",
        submittedAt: new Date().toISOString(),
        costTime: Math.max(0, Math.min(86400, Number(req.body.costTime) || 0)),
      });
      synchronize(value);
      const knowledgePointChanges = changes(student, questions).map((item) => ({
        ...item,
        masteryBefore: before.find(
          (old) => old.knowledgePointId === item.knowledgePointId,
        )?.masteryAfter,
        questionCount: results.filter(
          (result) =>
            result.snapshot.knowledgePointId === item.knowledgePointId &&
            !result.needsReview,
        ).length,
        correctCount: results.filter(
          (result) =>
            result.snapshot.knowledgePointId === item.knowledgePointId &&
            result.correct,
        ).length,
      }));
      return db.updateById("learningRecords", value.id, {
        knowledgePointChanges,
        report: results.some((item) => item.needsReview)
          ? "解答题正在等待老师复核，掌握度只统计已判定题目。"
          : "本次练习已保存，请结合解析检查解题过程。",
      });
    });
    res.json({ success: true, data: record });
  }),
);
router.get(
  "/review-plan",
  run((req, res, student) => {
    const eligible = new Set(eligibleNodes(student.id).map((node) => node.id));
    const data = db
      .find("studentQuestionAttempts", { studentId: student.id })
      .filter((item) => item.nextReviewAt)
      .map((item) => ({
        ...item,
        question: db.findById("questions", item.questionId),
      }))
      .filter(
        (item) =>
          item.question?.reviewStatus === "approved" &&
          eligible.has(item.question.knowledgePointId),
      )
      .sort((a, b) => new Date(a.nextReviewAt) - new Date(b.nextReviewAt))
      .slice(0, 10)
      .map((item) => ({
        questionId: item.questionId,
        content: item.question.content,
        knowledgePointId: item.question.knowledgePointId,
        nextReviewAt: item.nextReviewAt,
        due: new Date(item.nextReviewAt).getTime() <= Date.now(),
      }));
    res.json({ success: true, data });
  }),
);
router.get(
  "/mastery/trend",
  run((req, res, student) =>
    res.json({
      success: true,
      data: getTrend(student.id, req.query.kpCode, req.query.days || 30),
    }),
  ),
);
router.get(
  "/learning-track",
  run((req, res, student) => {
    const data = ["answers", "learningRecords"]
      .flatMap((collection) =>
        db.find(collection, { studentId: student.id }).map((record) => ({
          ...record,
          recordType: collection === "answers" ? "homework" : "practice",
          assignmentTitle:
            record.title ||
            db.findById("assignments", record.assignmentId)?.title ||
            "练习",
          score: record.totalScore,
          date: record.submittedAt || record.createdAt,
          correctRate: (record.questionResults || []).some(
            (item) => item.needsReview,
          )
            ? null
            : record.questionResults?.some(
                  (item) => typeof item.correct === "boolean",
                )
              ? Math.round(
                  (record.questionResults.filter((item) => item.correct)
                    .length /
                    record.questionResults.filter(
                      (item) => typeof item.correct === "boolean",
                    ).length) *
                    100,
                )
              : null,
        })),
      )
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json({
      success: true,
      data,
      stats: {
        homeworkCount: data.filter((item) => item.recordType === "homework")
          .length,
        practiceCount: data.filter((item) => item.recordType === "practice")
          .length,
        latestScore: data[0]?.score || 0,
        averageCorrectRate: data.filter((item) => item.correctRate !== null)
          .length
          ? Math.round(
              data
                .filter((item) => item.correctRate !== null)
                .reduce((sum, item) => sum + item.correctRate, 0) /
                data.filter((item) => item.correctRate !== null).length,
            )
          : null,
      },
    });
  }),
);
router.get(
  "/learning-track/:id/detail",
  run((req, res) => {
    const record =
      req.query.type === "homework"
        ? db.findById("answers", req.params.id)
        : db.findById("learningRecords", req.params.id);
    if (!record) return res.sendStatus(404);
    res.json({
      success: true,
      data: {
        title: record.title || "答题记录",
        score: record.totalScore,
        duration: record.costTime ? Math.round(record.costTime / 60) : null,
        radarData: [],
        questions: record.questionResults.map((result) => ({
          content: result.snapshot?.content || "",
          userAnswer: result.answer,
          answer: result.needsReview ? "等待教师复核" : result.correctAnswer,
          isCorrect: result.correct,
          needsReview: result.needsReview,
        })),
      },
    });
  }),
);
router.get(
  "/knowledge-point/:id/detail",
  run((req, res, student) => {
    const node = nodes.find((item) => item.id === req.params.id);
    if (!node) return res.sendStatus(404);
    res.json({
      success: true,
      data: {
        knowledgePoint: {
          ...node,
          ...getColorStatus(student.id, node.id),
          statusLabel: getColorStatus(student.id, node.id).label,
          masteryRate: getColorStatus(student.id, node.id).mastery,
        },
        wrongQuestions: wrongs(student).filter(
          (item) => item.knowledgePointId === node.id,
        ),
        recommendedQuestions: practiceQuestions(student, node.id).map(
          publicQuestion,
        ),
        recommendationText: "请结合已学范围练习，样本不足时先完成基础测评。",
      },
    });
  }),
);
router.get(
  "/drafts/:key",
  run((req, res, student) =>
    res.json({
      success: true,
      data:
        db.findOne("drafts", { studentId: student.id, key: req.params.key }) ||
        null,
    }),
  ),
);
router.put(
  "/drafts/:key",
  run((req, res, student) => {
    if (
      req.params.key.startsWith("assignment-") &&
      latest(req.params.key.slice(11), student.id)
    )
      return res.status(409).json({ success: false, message: "作业已经交卷" });
    if (
      req.body.requestId &&
      db.findOne("learningRecords", {
        studentId: student.id,
        requestId: req.body.requestId,
      })
    )
      return res.status(409).json({ success: false, message: "练习已提交" });
    if (req.params.key.length > 160) throw new Error("草稿编号过长");
    const existing = db.findOne("drafts", {
      studentId: student.id,
      key: req.params.key,
    });
    const value = {
      studentId: student.id,
      key: req.params.key,
      answers: req.body.answers || {},
      images: Array.isArray(req.body.images) ? req.body.images : [],
      questionIds: Array.isArray(req.body.questionIds)
        ? req.body.questionIds
        : [],
      requestId: req.body.requestId || "",
    };
    const draft = existing
      ? db.updateById("drafts", existing.id, value)
      : db.create("drafts", value);
    res.json({ success: true, data: draft });
  }),
);
router.delete(
  "/drafts/:key",
  run((req, res, student) => {
    const draft = db.findOne("drafts", {
      studentId: student.id,
      key: req.params.key,
    });
    if (draft) db.deleteById("drafts", draft.id);
    res.json({ success: true });
  }),
);
router.post(
  "/questions/:id/report",
  run((req, res, student) => {
    if (!db.findById("questions", req.params.id)) throw new Error("题目不存在");
    const message = String(req.body.message || "").trim();
    if (message.length < 3 || message.length > 1000)
      throw new Error("请填写 3 到 1000 字的问题描述");
    db.create("questionReports", {
      studentId: student.id,
      questionId: req.params.id,
      message,
      status: "open",
    });
    res.json({ success: true, message: "已提交给老师核查" });
  }),
);

// 个人信息：学号、姓名、性别和所在班级
function profileOf(student) {
  const cls = student.classId ? db.findById("classes", student.classId) : null;
  return {
    id: student.id,
    studentNo: student.studentNo || "",
    name: student.name || "",
    gender: student.gender || "male",
    classId: student.classId || null,
    class: cls ? { id: cls.id, name: cls.name } : null,
  };
}

router.get("/profile", (req, res) => {
  try {
    const s = S(req.headers["x-user-id"]);
    if (!s)
      return res.status(404).json({ success: false, message: "学生不存在" });
    res.json({ success: true, data: profileOf(s) });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.put("/profile", (req, res) => {
  try {
    const s = S(req.headers["x-user-id"]);
    if (!s)
      return res.status(404).json({ success: false, message: "学生不存在" });
    const name = String(req.body.name || "").trim();
    if (!name)
      return res.status(400).json({ success: false, message: "姓名不能为空" });
    const gender = req.body.gender === "female" ? "female" : "male";
    db.updateById("students", s.id, { name, gender });
    const user = db.findById("users", s.userId || s.id);
    if (user) db.updateById("users", user.id, { name });
    res.json({
      success: true,
      message: "已保存",
      data: profileOf(db.findById("students", s.id)),
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post("/bind-class", (req, res) => {
  try {
    const s = S(req.headers["x-user-id"]);
    if (!s)
      return res.status(404).json({ success: false, message: "学生不存在" });
    const cls = db.findById("classes", req.body.classId);
    if (!cls)
      return res.status(404).json({ success: false, message: "班级不存在" });
    if (s.classId && s.classId !== cls.id) {
      const oldCls = db.findById("classes", s.classId);
      if (oldCls && Array.isArray(oldCls.students)) {
        db.updateById("classes", oldCls.id, {
          students: oldCls.students.filter((id) => id !== s.id),
        });
      }
    }
    const members = Array.isArray(cls.students) ? cls.students : [];
    if (!members.includes(s.id))
      db.updateById("classes", cls.id, { students: members.concat(s.id) });
    db.updateById("students", s.id, { classId: cls.id });
    res.json({
      success: true,
      message: "已加入班级",
      data: profileOf(db.findById("students", s.id)),
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
