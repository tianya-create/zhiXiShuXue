const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(process.env.DATA_DIR || __dirname, 'questions.sqlite');
const LEGACY_JSON_PATH = path.join(__dirname, 'questions.json');

let database = null;

function getDatabase() {
  if (database) return database;

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  database = new DatabaseSync(DB_PATH);
  database.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;');
  database.exec(`
    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      type TEXT,
      content TEXT NOT NULL,
      difficulty TEXT,
      answer TEXT,
      score INTEGER,
      payload_json TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_questions_type ON questions(type);
    CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);
  `);

  return database;
}

function normalizeQuestion(question) {
  return {
    ...question,
    options: Array.isArray(question.options) ? question.options : [],
    knowledgePoints: Array.isArray(question.knowledgePoints) ? question.knowledgePoints : []
  };
}

function rowToQuestion(row) {
  const parsed = JSON.parse(row.payload_json);
  return normalizeQuestion(parsed);
}

function getAllQuestions() {
  const db = getDatabase();
  const stmt = db.prepare('SELECT payload_json FROM questions ORDER BY datetime(updated_at) DESC, rowid DESC');
  return stmt.all().map(row => normalizeQuestion(JSON.parse(row.payload_json)));
}

function readLegacyQuestions() {
  try {
    if (!fs.existsSync(LEGACY_JSON_PATH)) {
      return [];
    }
    const raw = fs.readFileSync(LEGACY_JSON_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeQuestion) : [];
  } catch (error) {
    console.error('读取旧 questions.json 失败:', error.message);
    return [];
  }
}

function upsertQuestion(question) {
  const db = getDatabase();
  const normalized = normalizeQuestion(question);
  const stmt = db.prepare(`
    INSERT INTO questions (id, type, content, difficulty, answer, score, payload_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      type = excluded.type,
      content = excluded.content,
      difficulty = excluded.difficulty,
      answer = excluded.answer,
      score = excluded.score,
      payload_json = excluded.payload_json,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at
  `);

  stmt.run(
    normalized.id,
    normalized.type || '',
    normalized.content || '',
    normalized.difficulty || '',
    normalized.answer || '',
    Number(normalized.score || 0),
    JSON.stringify(normalized),
    normalized.createdAt || new Date().toISOString(),
    normalized.updatedAt || new Date().toISOString()
  );

  return normalized;
}

function upsertQuestions(questions) {
  const db = getDatabase();
  db.exec('BEGIN');
  try {
    (questions || []).forEach(item => upsertQuestion(item));
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function replaceAllQuestions(questions) {
  const db = getDatabase();
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM questions').run();
    (questions || []).forEach(item => upsertQuestion(item));
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function deleteQuestion(id) {
  const db = getDatabase();
  db.prepare('DELETE FROM questions WHERE id = ?').run(id);
}

function loadQuestionsFromStore(fallbackQuestions = []) {
  const current = getAllQuestions();
  if (current.length) {
    return current;
  }

  const legacy = readLegacyQuestions();
  const seed = legacy.length ? legacy : (fallbackQuestions || []).map(normalizeQuestion);
  if (seed.length) {
    upsertQuestions(seed);
  }
  return seed;
}

module.exports = {
  getDatabase,
  DB_PATH,
  getAllQuestions,
  upsertQuestion,
  upsertQuestions,
  replaceAllQuestions,
  deleteQuestion,
  loadQuestionsFromStore
};
