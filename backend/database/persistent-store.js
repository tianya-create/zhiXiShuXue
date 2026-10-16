/**
 * 持久化存储层
 *
 * 为 memory-db 提供落盘能力：把内存中的各集合写入 SQLite 文件，
 * 进程重启后自动恢复，避免"容器一重启数据清零"。
 *
 * 存储结构：
 *   collections(seq INTEGER PRIMARY KEY AUTOINCREMENT, collection TEXT, id TEXT, data TEXT)
 *   - 数组型集合：每个元素一行，id 为元素 id（无 id 时用下标）
 *   - 对象型集合（如 settings）：整体一行，id 为 '__object__'
 *
 * 题库（questions）由 question-store.js 独立管理，这里显式排除，避免双重写入。
 */

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = process.env.APP_DB_PATH || path.join(__dirname, 'app.sqlite');
const OBJECT_ROW_ID = '__object__';
const EXCLUDED_COLLECTIONS = new Set(['questions']);

let database = null;

function getDatabase() {
  if (database) return database;

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  database = new DatabaseSync(DB_PATH);
  // WAL 模式：读不阻塞写、写不阻塞读，避免偶发 "database is locked"；
  // busy_timeout：遇到锁时最多等待 5 秒再报错，而非立即失败。
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 5000;
  `);
  database.exec(`
    CREATE TABLE IF NOT EXISTS collections (
      seq        INTEGER PRIMARY KEY AUTOINCREMENT,
      collection TEXT NOT NULL,
      id         TEXT NOT NULL,
      data       TEXT NOT NULL,
      updatedAt  TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_collections_key
      ON collections (collection, id);
    CREATE INDEX IF NOT EXISTS idx_collections_name
      ON collections (collection);
  `);
  return database;
}

/** 读取全部持久化数据，返回 { collection: 数组或对象 } */
function loadAll() {
  const db = getDatabase();
  const rows = db.prepare('SELECT collection, id, data FROM collections ORDER BY seq ASC').all();
  const result = {};

  rows.forEach((row) => {
    let parsed;
    try {
      parsed = JSON.parse(row.data);
    } catch (e) {
      return; // 跳过损坏行，不影响启动
    }

    if (row.id === OBJECT_ROW_ID) {
      result[row.collection] = parsed;
    } else {
      if (!Array.isArray(result[row.collection])) result[row.collection] = [];
      result[row.collection].push(parsed);
    }
  });

  return result;
}

/** 是否已有持久化数据（用于判断首次启动） */
function hasAnyData() {
  const db = getDatabase();
  const row = db.prepare("SELECT COUNT(*) AS c FROM collections WHERE collection != 'logs'").get();
  return (row && Number(row.c)) > 0;
}

/** 写入/更新单个元素 */
function upsertItem(collection, id, item) {
  if (EXCLUDED_COLLECTIONS.has(collection)) return;
  const db = getDatabase();
  const existing = db.prepare('SELECT seq FROM collections WHERE collection = ? AND id = ?').get(collection, String(id));
  const now = new Date().toISOString();
  const payload = JSON.stringify(item);

  if (existing) {
    db.prepare('UPDATE collections SET data = ?, updatedAt = ? WHERE seq = ?').run(payload, now, existing.seq);
  } else {
    db.prepare('INSERT INTO collections (collection, id, data, updatedAt) VALUES (?, ?, ?, ?)')
      .run(collection, String(id), payload, now);
  }
}

/** 写入/更新一个对象型集合 */
function saveObject(collection, value) {
  if (EXCLUDED_COLLECTIONS.has(collection)) return;
  upsertItem(collection, OBJECT_ROW_ID, value === undefined ? null : value);
}

/** 删除单个元素 */
function removeItem(collection, id) {
  if (EXCLUDED_COLLECTIONS.has(collection)) return;
  const db = getDatabase();
  db.prepare('DELETE FROM collections WHERE collection = ? AND id = ?').run(collection, String(id));
}

/** 整体覆盖一个集合（先清空再写入），用于 flushAll 与批量替换 */
function replaceCollection(collection, value) {
  if (EXCLUDED_COLLECTIONS.has(collection)) return;
  const db = getDatabase();

  if (Array.isArray(value)) {
    const nextIds = new Set(value.map((item, index) => String((item && item.id) !== undefined ? item.id : 'idx:' + index)));

    // 删除已不存在的行
    const existing = db.prepare('SELECT seq, id FROM collections WHERE collection = ?').all(collection);
    existing.forEach((row) => {
      if (!nextIds.has(row.id)) {
        db.prepare('DELETE FROM collections WHERE seq = ?').run(row.seq);
      }
    });

    value.forEach((item, index) => {
      const id = (item && item.id) !== undefined ? item.id : 'idx:' + index;
      upsertItem(collection, id, item);
    });
    return;
  }

  if (value && typeof value === 'object') {
    saveObject(collection, value);
    return;
  }

  // null / undefined：清空
  db.prepare('DELETE FROM collections WHERE collection = ?').run(collection);
}

/** 清空全部持久化数据（仅用于重置） */
function clearAll() {
  const db = getDatabase();
  db.exec('DELETE FROM collections');
}

module.exports = {
  DB_PATH,
  getDatabase,
  loadAll,
  hasAnyData,
  upsertItem,
  saveObject,
  removeItem,
  replaceCollection,
  clearAll,
  OBJECT_ROW_ID,
  EXCLUDED_COLLECTIONS
};
