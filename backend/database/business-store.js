const { getDatabase } = require("./question-store");

// Keep the existing collection API while persisting all business collections.
// Nested proxies also capture older routes that directly mutate db.data.
function persistentData(defaults) {
  const sql = getDatabase();
  sql.exec(
    "CREATE TABLE IF NOT EXISTS business_collections (name TEXT PRIMARY KEY, payload TEXT NOT NULL)",
  );
  const rows = sql
    .prepare("SELECT name, payload FROM business_collections")
    .all();
  const raw = { ...defaults };
  for (const row of rows) raw[row.name] = JSON.parse(row.payload);
  const save = sql.prepare(
    "INSERT INTO business_collections(name,payload) VALUES (?,?) ON CONFLICT(name) DO UPDATE SET payload=excluded.payload",
  );
  const cache = new WeakMap();
  function persist(name) {
    if (name !== "questions") save.run(name, JSON.stringify(raw[name]));
  }
  function wrap(value, name) {
    if (!value || typeof value !== "object") return value;
    if (cache.has(value)) return cache.get(value);
    const proxy = new Proxy(value, {
      get(target, key) {
        return wrap(Reflect.get(target, key), name);
      },
      set(target, key, next) {
        Reflect.set(target, key, next);
        persist(name);
        return true;
      },
      deleteProperty(target, key) {
        Reflect.deleteProperty(target, key);
        persist(name);
        return true;
      },
    });
    cache.set(value, proxy);
    return proxy;
  }
  for (const name of Object.keys(raw)) persist(name);
  return new Proxy(raw, {
    get(target, key) {
      return wrap(target[key], key);
    },
    set(target, key, value) {
      target[key] = value;
      persist(key);
      return true;
    },
  });
}

function hasBusinessData() {
  const sql = getDatabase();
  const table = sql
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='business_collections'",
    )
    .get();
  return (
    !!table &&
    !!sql
      .prepare("SELECT name FROM business_collections WHERE name='users'")
      .get()
  );
}

module.exports = { persistentData, hasBusinessData };
