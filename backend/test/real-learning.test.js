const { equivalent } = require("../services/math-equivalence");
const { updateMastery } = require("../services/masteryEngine");
const { getPersonalizedPush } = require("../services/personalized-push");
const db = require("../database/memory-db");

test.each([
  ["1/2", "0.5", true],
  ["2(x+1)", "2x+2", true],
  ["\\frac{1}{2}", "0.5", true],
  ["50%", "1/2", true],
  ["(x+1)^2", "x²+2x+1", true],
  ["x=3", "3", true],
  ["x/x", "1", false],
  ["x+1", "x-1", false],
  ["1/0", "0", false],
  ["0.3", "0.3001", false],
  ["process.exit()", "1", false],
  ["x=2", "y=2", false],
])("math equivalence %s and %s", (a, b, expected) =>
  expect(equivalent(a, b)).toBe(expected),
);

test("new students have no fabricated proficiency or mistakes", () => {
  const mastery = updateMastery("never-answered", "alg-1");
  expect(mastery.mastery).toBeNull();
  expect(mastery.status).toBe("尚未测评");
  const before = db.data.knowledgeGraphWrong.length;
  getPersonalizedPush("never-answered");
  expect(db.data.knowledgeGraphWrong.length).toBe(before);
});

test("a repeated single question does not prove mastery", () => {
  for (let i = 0; i < 5; i++)
    db.create("student_answer", {
      userId: "repeat-student",
      questionId: "same",
      kpCode: "alg-1",
      isCorrect: true,
    });
  const mastery = updateMastery("repeat-student", "alg-1");
  expect(mastery.status).toBe("样本不足");
  expect(mastery.mastery).toBeLessThan(80);
});
