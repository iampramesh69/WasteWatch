const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const multer = require("multer");
const {
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
} = require("./src/database");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const UPLOAD_DIR = path.join(ROOT, "uploads");
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  "local-demo-only-change-this-secret-before-deployment";
const SESSION_MS = 12 * 60 * 60 * 1000;
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
initDatabase();

function passwordHash(password, salt = crypto.randomBytes(16).toString("hex")) {
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString("hex")}`;
}
function passwordMatches(password, saved) {
  try {
    const [salt, hex] = saved.split(":");
    const actual = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(hex, "hex");
    return (
      actual.length === expected.length &&
      crypto.timingSafeEqual(actual, expected)
    );
  } catch {
    return false;
  }
}
function sign(value) {
  return crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(value)
    .digest("base64url");
}
function issueCookie(res, user) {
  const payload = Buffer.from(
    JSON.stringify({ id: user.id, exp: Date.now() + SESSION_MS }),
  ).toString("base64url");
  const value = `${payload}.${sign(payload)}`;
  res.setHeader(
    "Set-Cookie",
    `ww_session=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(SESSION_MS / 1000)}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  );
}
function clearCookie(res) {
  res.setHeader(
    "Set-Cookie",
    "ww_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
  );
}
function getCurrentUser(req) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/(?:^|;\s*)ww_session=([^;]+)/);
  if (!match) return null;
  try {
    const [payload, signature] = match[1].split(".");
    if (
      !payload ||
      !signature ||
      !crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(sign(payload)),
      )
    )
      return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.exp || data.exp < Date.now()) return null;
    return getUserById(data.id);
  } catch {
    return null;
  }
}
function auth(req, res, next) {
  req.user = getCurrentUser(req);
  if (!req.user)
    return res.status(401).json({ error: "Please log in to do that." });
  next();
}
function adminOnly(req, res, next) {
  if (req.user?.role !== "admin")
    return res
      .status(403)
      .json({ error: "Admin access is required for this action." });
  next();
}

// Create a local demo admin on first run. Override these with environment variables for deployment.
const adminEmail = (
  process.env.ADMIN_EMAIL || "admin@wastewatch.local"
).toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD || "ChangeMe123!";
if (!getUserByEmail(adminEmail)) {
  createUser({
    name: "WasteWatch Admin",
    email: adminEmail,
    passwordHash: passwordHash(adminPassword),
    role: "admin",
  });
  if (!process.env.ADMIN_PASSWORD)
    console.warn(
      "DEMO ADMIN: admin@wastewatch.local / ChangeMe123! — change before any public deployment.",
    );
}

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(UPLOAD_DIR));
app.use(express.static(PUBLIC_DIR));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path
      .extname(file.originalname)
      .toLowerCase()
      .replace(/[^.a-z0-9]/g, "");
    cb(
      null,
      `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext || ".jpg"}`,
    );
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)
      ? cb(null, true)
      : cb(new Error("Please upload a JPEG, PNG, WEBP or GIF image.")),
});

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, service: "WasteWatch API" }),
);
app.get("/api/auth/me", (req, res) => res.json({ user: getCurrentUser(req) }));
app.post("/api/auth/register", (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "")
    .trim()
    .toLowerCase();
  const password = String(req.body.password || "");
  if (name.length < 2 || name.length > 70)
    return res
      .status(400)
      .json({ error: "Name must be between 2 and 70 characters." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 190)
    return res.status(400).json({ error: "Enter a valid email address." });
  if (password.length < 8 || password.length > 200)
    return res
      .status(400)
      .json({ error: "Password must be at least 8 characters." });
  if (getUserByEmail(email))
    return res
      .status(409)
      .json({ error: "An account with this email already exists." });
  try {
    const user = createUser({
      name,
      email,
      passwordHash: passwordHash(password),
      role: "user",
    });
    issueCookie(res, user);
    res.status(201).json({ user });
  } catch {
    res.status(500).json({ error: "Could not create account." });
  }
});
app.post("/api/auth/login", (req, res) => {
  const email = String(req.body.email || "")
    .trim()
    .toLowerCase();
  const password = String(req.body.password || "");
  const row = getUserByEmail(email);
  if (!row || !passwordMatches(password, row.password_hash))
    return res.status(401).json({ error: "Email or password is incorrect." });
  const user = getUserById(row.id);
  issueCookie(res, user);
  res.json({ user });
});
app.post("/api/auth/logout", (_req, res) => {
  clearCookie(res);
  res.json({ ok: true });
});

app.get("/api/reports", (req, res) => {
  const filters = {
    search: String(req.query.search || ""),
    status: String(req.query.status || "all"),
    category: String(req.query.category || "all"),
  };
  res.json({ reports: listReports(filters), user: getCurrentUser(req) });
});
app.get("/api/reports/:id", (req, res) => {
  const report = getReport(req.params.id);
  if (!report) return res.status(404).json({ error: "Report not found." });
  res.json({ report });
});
app.post("/api/reports", auth, upload.single("photo"), (req, res) => {
  const { category, date, location, description } = req.body;
  const parseCoordinate = (value) =>
    value === undefined || value === "" ? null : Number(value);
  const latitude = parseCoordinate(req.body.latitude);
  const longitude = parseCoordinate(req.body.longitude);
  const hasLat = latitude !== null && Number.isFinite(latitude);
  const hasLng = longitude !== null && Number.isFinite(longitude);
  if (
    (req.body.latitude !== undefined && req.body.latitude !== "" && !hasLat) ||
    (req.body.longitude !== undefined &&
      req.body.longitude !== "" &&
      !hasLng) ||
    hasLat !== hasLng ||
    (hasLat &&
      (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180))
  ) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res
      .status(400)
      .json({
        error:
          "Map coordinates are invalid. Choose a point on the map or use device location.",
      });
  }
  if (
    ![category, date, location, description].every(
      (v) => typeof v === "string" && v.trim(),
    )
  ) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res
      .status(400)
      .json({
        error: "Category, date, location and description are required.",
      });
  }
  if (location.trim().length > 120 || description.trim().length > 500) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res
      .status(400)
      .json({ error: "Location or description is too long." });
  }
  const report = createReport({
    category: category.trim(),
    date,
    location: location.trim(),
    latitude: hasLat ? latitude : null,
    longitude: hasLng ? longitude : null,
    description: description.trim(),
    photo: req.file ? `/uploads/${req.file.filename}` : null,
    ownerId: req.user.id,
  });
  res.status(201).json({ report });
});
app.patch(
  "/api/reports/:id",
  auth,
  adminOnly,
  upload.single("cleanupPhoto"),
  (req, res) => {
    const allowed = ["Reported", "In progress", "Cleaned"];
    const status = req.body.status;
    if (status && !allowed.includes(status)) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: "Invalid status." });
    }
    if (status === "Cleaned" && !req.file) {
      const existing = getReport(req.params.id);
      if (existing && !existing.cleanupPhoto)
        return res
          .status(400)
          .json({
            error:
              "Upload an after-cleanup photo before marking this report as Cleaned.",
          });
    }
    const report = updateReport(req.params.id, {
      status,
      cleanupPhoto: req.file ? `/uploads/${req.file.filename}` : undefined,
    });
    if (!report) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: "Report not found." });
    }
    res.json({ report });
  },
);
app.delete("/api/reports/:id", auth, (req, res) => {
  const report = getReport(req.params.id);
  if (!report) return res.status(404).json({ error: "Report not found." });
  if (req.user.role !== "admin" && report.ownerId !== req.user.id)
    return res
      .status(403)
      .json({ error: "You can only delete reports you submitted." });
  deleteReport(req.params.id);
  res.status(204).end();
});
app.post("/api/demo/seed", auth, adminOnly, (_req, res) =>
  res.json({ reports: seedDemoReports() }),
);
app.delete("/api/demo", auth, adminOnly, (_req, res) =>
  res.json({ deleted: clearDemoReports() }),
);
app.get("/", (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "index.html")));
app.use((err, _req, res, _next) => {
  console.error(err);
  const message =
    err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE"
      ? "Images must be 5 MB or smaller."
      : err.message && err.message.startsWith("Please upload")
        ? err.message
        : "Something went wrong on the server.";
  res.status(400).json({ error: message });
});
app.listen(PORT, "0.0.0.0", () =>
  console.log(`WasteWatch running at http://localhost:${PORT}`),
);
