const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const dataDir = path.join(__dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, "wastewatch.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function initDatabase() {
  db.exec(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    date TEXT NOT NULL,
    location TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Reported' CHECK(status IN ('Reported','In progress','Cleaned')),
    photo TEXT,
    cleanup_photo TEXT,
    cleanup_review TEXT NOT NULL DEFAULT 'Pending' CHECK(cleanup_review IN ('Pending','Verified','Disputed')),
    simulated INTEGER NOT NULL DEFAULT 0,
    owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  const columns = new Set(
    db
      .prepare("PRAGMA table_info(reports)")
      .all()
      .map((column) => column.name),
  );
  if (!columns.has("latitude"))
    db.exec("ALTER TABLE reports ADD COLUMN latitude REAL");
  if (!columns.has("longitude"))
    db.exec("ALTER TABLE reports ADD COLUMN longitude REAL");
  if (!columns.has("owner_id"))
    db.exec(
      "ALTER TABLE reports ADD COLUMN owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL",
    );
}
function createUser({ name, email, passwordHash, role = "user" }) {
  const result = db
    .prepare(
      "INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)",
    )
    .run(name, email.toLowerCase(), passwordHash, role);
  return getUserById(result.lastInsertRowid);
}
function getUserByEmail(email) {
  return (
    db
      .prepare("SELECT * FROM users WHERE email = ?")
      .get(String(email).toLowerCase()) || null
  );
}
function getUserById(id) {
  const row = db
    .prepare("SELECT id,name,email,role,created_at FROM users WHERE id = ?")
    .get(id);
  return row
    ? {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        createdAt: row.created_at,
      }
    : null;
}
function mapRow(row) {
  if (!row) return null;
  return {
    ...row,
    cleanupPhoto: row.cleanup_photo,
    cleanupReview: row.cleanup_review,
    ownerId: row.owner_id,
    simulated: Boolean(row.simulated),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    cleanup_photo: undefined,
    cleanup_review: undefined,
    owner_id: undefined,
    created_at: undefined,
    updated_at: undefined,
  };
}
function listReports(filters = {}) {
  let rows = db
    .prepare("SELECT * FROM reports ORDER BY date DESC, created_at DESC")
    .all()
    .map(mapRow);
  const search = (filters.search || "").trim().toLowerCase();
  if (search)
    rows = rows.filter((r) =>
      [r.id, r.location, r.category, r.description].some((v) =>
        String(v || "")
          .toLowerCase()
          .includes(search),
      ),
    );
  if (filters.status && filters.status !== "all")
    rows = rows.filter((r) => r.status === filters.status);
  if (filters.category && filters.category !== "all")
    rows = rows.filter((r) => r.category === filters.category);
  return rows;
}
function getReport(id) {
  return mapRow(db.prepare("SELECT * FROM reports WHERE id = ?").get(id));
}
function createReport(data) {
  const id = `WW-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  db.prepare(
    "INSERT INTO reports (id, category, date, location, latitude, longitude, description, photo, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(
    id,
    data.category,
    data.date,
    data.location,
    data.latitude ?? null,
    data.longitude ?? null,
    data.description,
    data.photo || null,
    data.ownerId,
  );
  return getReport(id);
}
function updateReport(id, changes) {
  const current = getReport(id);
  if (!current) return null;
  const status = changes.status || current.status;
  const cleanupPhoto =
    changes.cleanupPhoto === undefined
      ? current.cleanupPhoto
      : changes.cleanupPhoto;
  const cleanupReview =
    status === "Cleaned" && cleanupPhoto
      ? "Verified"
      : changes.status && status !== "Cleaned"
        ? "Pending"
        : current.cleanupReview;
  db.prepare(
    "UPDATE reports SET status = ?, cleanup_photo = ?, cleanup_review = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
  ).run(status, cleanupPhoto, cleanupReview, id);
  return getReport(id);
}
function deleteReport(id) {
  return db.prepare("DELETE FROM reports WHERE id = ?").run(id).changes > 0;
}
function clearDemoReports() {
  return db.prepare("DELETE FROM reports WHERE simulated = 1").run().changes;
}
function seedDemoReports() {
  const demo = [
    [
      "Mixed garbage",
      "2026-10-08",
      "City Park Gate 2",
      "Mixed waste beside the public bin.",
      "Reported",
    ],
    [
      "Plastic waste",
      "2026-10-09",
      "City Park Gate 2",
      "Plastic wrappers have appeared again near the same bin.",
      "In progress",
    ],
    [
      "Overflowing bin",
      "2026-10-07",
      "Bus Stand North",
      "The public bin is overflowing onto the footpath.",
      "Reported",
    ],
    [
      "Organic waste",
      "2026-10-06",
      "Market Lane Corner",
      "Food waste is left beside the collection point.",
      "Cleaned",
    ],
    [
      "Construction debris",
      "2026-10-05",
      "River Road Turn",
      "Broken bricks and debris partly block the walkway.",
      "Reported",
    ],
  ];
  const insert = db.prepare(
    "INSERT INTO reports (id, category, date, location, description, status, simulated) VALUES (?, ?, ?, ?, ?, ?, 1)",
  );
  const transaction = db.transaction(() => {
    db.prepare("DELETE FROM reports WHERE simulated = 1").run();
    demo.forEach((r, i) => insert.run(`DEMO-${i + 1}`, ...r));
  });
  transaction();
  return listReports();
}
module.exports = {
  initDatabase,
  createUser,
  getUserByEmail,
  getUserById,
  listReports,
  getReport,
  createReport,
  updateReport,
  deleteReport,
  clearDemoReports,
  seedDemoReports,
};
