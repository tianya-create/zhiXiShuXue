const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function runNode(dataDir, code) {
  return spawnSync(process.execPath, ["-e", code], {
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      DATA_DIR: dataDir,
      JWT_SECRET: "adaptive-persistence-test-secret",
    },
    encoding: "utf8",
  });
}

test("VARK 档案、长期学习证据和微调事件在重启后仍可读取", () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "zhixi-adaptive-persist-"));
  const write = runNode(dataDir, `
    const db = require('./database/memory-db');
    db.create('learnerPresentationProfiles', {
      id: 'profile-persist', studentId: 'student-persist', classId: 'class-persist',
      primaryDimensions: ['V', 'A'], mixed: true, active: true,
      calibration: { status: 'expanded', evidenceCount: 6 }
    });
    db.create('presentationLearningEvidence', {
      id: 'evidence-persist', studentId: 'student-persist', profileId: 'profile-persist',
      roundId: 'round-persist', accuracy: 0.5, controlScore: 2
    });
    db.create('presentationAdjustmentEvents', {
      id: 'event-persist', studentId: 'student-persist', profileId: 'profile-persist',
      type: 'expand_secondary_channel'
    });
  `);
  expect(write.status).toBe(0);

  const read = runNode(dataDir, `
    const db = require('./database/memory-db');
    console.log(JSON.stringify({
      profile: db.findById('learnerPresentationProfiles', 'profile-persist'),
      evidence: db.findById('presentationLearningEvidence', 'evidence-persist'),
      event: db.findById('presentationAdjustmentEvents', 'event-persist')
    }));
  `);
  expect(read.status).toBe(0);
  const payload = JSON.parse(read.stdout.trim().split("\n").at(-1));
  expect(payload.profile.primaryDimensions).toEqual(["V", "A"]);
  expect(payload.profile.calibration.status).toBe("expanded");
  expect(payload.evidence.roundId).toBe("round-persist");
  expect(payload.event.type).toBe("expand_secondary_channel");
});
