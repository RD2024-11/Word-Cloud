const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const MongoStore = require("connect-mongo");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const MONGODB_URI = process.env.MONGODB_URI;
const SESSION_SECRET = process.env.SESSION_SECRET || "change-me-in-production";

if (!MONGODB_URI) {
  console.error(
    "MONGODB_URI is not set. Add it as an environment variable (see README) before starting the server."
  );
  process.exit(1);
}

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  });

// ---- Schemas ----
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  passwordHash: { type: String, required: true },
  recoveryCodeHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
const User = mongoose.model("User", userSchema);

const questionSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  text: { type: String, required: true },
  words: { type: Map, of: new mongoose.Schema({ display: String, count: Number }, { _id: false }), default: {} },
  participantIds: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now },
  lastResponseAt: { type: Date, default: null },
  acceptingResponses: { type: Boolean, default: true },
});

const eventSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
  questions: { type: [questionSchema], default: [] },
});
const Event = mongoose.model("Event", eventSchema);

function genCode(len = 6) {
  return Math.random().toString(36).slice(2, 2 + len);
}

// ---- Middleware ----
app.set("trust proxy", 1); // required behind Render's proxy for secure cookies to work
app.use(express.json());
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: MONGODB_URI, collectionName: "sessions" }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  })
);
app.use(express.static(path.join(__dirname, "public")));

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: "Not logged in" });
  next();
}

// ---- Auth routes ----
app.post("/api/auth/signup", async (req, res) => {
  try {
    const username = (req.body.username || "").trim();
    const password = req.body.password || "";
    if (username.length < 3) return res.status(400).json({ error: "Username must be at least 3 characters" });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

    const existing = await User.findOne({ username: new RegExp(`^${username}$`, "i") });
    if (existing) return res.status(400).json({ error: "That username is already taken" });

    const passwordHash = await bcrypt.hash(password, 10);
    const recoveryCode = genCode(5) + "-" + genCode(5); // e.g. "ab12c-x9y8z"
    const recoveryCodeHash = await bcrypt.hash(recoveryCode, 10);
    const user = await User.create({ username, passwordHash, recoveryCodeHash });
    req.session.userId = user._id.toString();
    req.session.username = user.username;
    res.json({ username: user.username, recoveryCode });
  } catch (err) {
    res.status(500).json({ error: "Signup failed" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const username = (req.body.username || "").trim();
    const password = req.body.password || "";
    const user = await User.findOne({ username: new RegExp(`^${username}$`, "i") });
    if (!user) return res.status(401).json({ error: "Invalid username or password" });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid username or password" });
    req.session.userId = user._id.toString();
    req.session.username = user.username;
    res.json({ username: user.username });
  } catch (err) {
    res.status(500).json({ error: "Login failed" });
  }
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const username = (req.body.username || "").trim();
    const recoveryCode = (req.body.recoveryCode || "").trim();
    const newPassword = req.body.newPassword || "";
    if (newPassword.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

    const user = await User.findOne({ username: new RegExp(`^${username}$`, "i") });
    if (!user) return res.status(400).json({ error: "Invalid username or recovery code" });
    const ok = await bcrypt.compare(recoveryCode, user.recoveryCodeHash);
    if (!ok) return res.status(400).json({ error: "Invalid username or recovery code" });

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Reset failed" });
  }
});

app.get("/api/auth/me", (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: "Not logged in" });
  res.json({ username: req.session.username });
});

// ---- Helpers ----
function publicQuestion(q) {
  const words = q.words instanceof Map ? Array.from(q.words.values()) : Object.values(q.words || {});
  const responseCount = words.reduce((a, w) => a + (w.count || 0), 0);
  return {
    code: q.code,
    text: q.text,
    responseCount,
    participantCount: (q.participantIds || []).length,
    lastResponseAt: q.lastResponseAt,
    acceptingResponses: q.acceptingResponses !== false,
  };
}

function publicEvent(ev) {
  return {
    code: ev.code,
    title: ev.title,
    createdAt: ev.createdAt,
    questions: ev.questions.map(publicQuestion),
  };
}

function questionState(ev, q) {
  const words = q.words instanceof Map ? Array.from(q.words.values()) : Object.values(q.words || {});
  return {
    eventTitle: ev.title,
    text: q.text,
    words: words.sort((a, b) => b.count - a.count),
    responseCount: words.reduce((a, w) => a + w.count, 0),
    participantCount: (q.participantIds || []).length,
    acceptingResponses: q.acceptingResponses !== false,
  };
}

// ---- Event routes (auth required, scoped to the logged-in user) ----
app.get("/api/events", requireAuth, async (req, res) => {
  const evs = await Event.find({ ownerId: req.session.userId }).sort({ createdAt: -1 });
  res.json(
    evs.map((ev) => {
      const qs = ev.questions.map(publicQuestion);
      const totalResponses = qs.reduce((a, q) => a + q.responseCount, 0);
      const lastActivity = qs.reduce((latest, q) => {
        if (!q.lastResponseAt) return latest;
        return !latest || q.lastResponseAt > latest ? q.lastResponseAt : latest;
      }, null);
      return {
        code: ev.code,
        title: ev.title,
        createdAt: ev.createdAt,
        questionCount: qs.length,
        totalResponses,
        lastActivity,
      };
    })
  );
});

app.post("/api/events", requireAuth, async (req, res) => {
  const title = (req.body.title || "").trim() || "Untitled Event";
  const ev = await Event.create({ code: genCode(), title, ownerId: req.session.userId, questions: [] });
  res.json(publicEvent(ev));
});

async function findOwnedEvent(req, res) {
  const ev = await Event.findOne({ code: req.params.eventCode });
  if (!ev) {
    res.status(404).json({ error: "Event not found" });
    return null;
  }
  if (ev.ownerId.toString() !== req.session.userId) {
    res.status(403).json({ error: "Not your event" });
    return null;
  }
  return ev;
}

app.get("/api/events/:eventCode", requireAuth, async (req, res) => {
  const ev = await findOwnedEvent(req, res);
  if (!ev) return;
  res.json(publicEvent(ev));
});

app.patch("/api/events/:eventCode", requireAuth, async (req, res) => {
  const ev = await findOwnedEvent(req, res);
  if (!ev) return;
  if (req.body.title && req.body.title.trim()) ev.title = req.body.title.trim();
  await ev.save();
  res.json(publicEvent(ev));
});

app.delete("/api/events/:eventCode", requireAuth, async (req, res) => {
  const ev = await findOwnedEvent(req, res);
  if (!ev) return;
  await Event.deleteOne({ _id: ev._id });
  res.json({ ok: true });
});

app.post("/api/events/:eventCode/questions", requireAuth, async (req, res) => {
  const ev = await findOwnedEvent(req, res);
  if (!ev) return;
  const text = (req.body.text || "").trim() || "Untitled question";
  ev.questions.push({ code: genCode(), text, words: new Map(), participantIds: [] });
  await ev.save();
  res.json(publicEvent(ev));
});

app.patch("/api/events/:eventCode/questions/:qCode", requireAuth, async (req, res) => {
  const ev = await findOwnedEvent(req, res);
  if (!ev) return;
  const q = ev.questions.find((q) => q.code === req.params.qCode);
  if (!q) return res.status(404).json({ error: "Question not found" });
  if (req.body.text && req.body.text.trim()) q.text = req.body.text.trim();
  if (typeof req.body.acceptingResponses === "boolean") q.acceptingResponses = req.body.acceptingResponses;
  await ev.save();
  io.to(`${ev.code}:${q.code}`).emit("state", questionState(ev, q));
  res.json(publicEvent(ev));
});

app.post("/api/events/:eventCode/questions/:qCode/duplicate", requireAuth, async (req, res) => {
  const ev = await findOwnedEvent(req, res);
  if (!ev) return;
  const q = ev.questions.find((q) => q.code === req.params.qCode);
  if (!q) return res.status(404).json({ error: "Question not found" });
  const idx = ev.questions.indexOf(q);
  ev.questions.splice(idx + 1, 0, {
    code: genCode(),
    text: q.text,
    words: new Map(),
    participantIds: [],
    acceptingResponses: true,
  });
  await ev.save();
  res.json(publicEvent(ev));
});

app.post("/api/events/:eventCode/questions/reorder", requireAuth, async (req, res) => {
  const ev = await findOwnedEvent(req, res);
  if (!ev) return;
  const codes = Array.isArray(req.body.codes) ? req.body.codes : [];
  const byCode = new Map(ev.questions.map((q) => [q.code, q]));
  const reordered = codes.map((c) => byCode.get(c)).filter(Boolean);
  // Safety: if the code list doesn't perfectly match, fall back to existing order.
  if (reordered.length === ev.questions.length) {
    ev.questions = reordered;
    await ev.save();
  }
  res.json(publicEvent(ev));
});

app.delete("/api/events/:eventCode/questions/:qCode", requireAuth, async (req, res) => {
  const ev = await findOwnedEvent(req, res);
  if (!ev) return;
  ev.questions = ev.questions.filter((q) => q.code !== req.params.qCode);
  await ev.save();
  res.json(publicEvent(ev));
});

app.post("/api/events/:eventCode/questions/:qCode/clear", requireAuth, async (req, res) => {
  const ev = await findOwnedEvent(req, res);
  if (!ev) return;
  const q = ev.questions.find((q) => q.code === req.params.qCode);
  if (!q) return res.status(404).json({ error: "Question not found" });
  q.words = new Map();
  q.participantIds = [];
  q.lastResponseAt = null;
  await ev.save();
  io.to(`${ev.code}:${q.code}`).emit("state", questionState(ev, q));
  res.json({ ok: true });
});

// ---- Realtime (public — anyone with the link can view/answer a question) ----
io.on("connection", (socket) => {
  socket.on("join-question", async ({ eventCode, qCode }) => {
    const ev = await Event.findOne({ code: eventCode });
    const q = ev && ev.questions.find((q) => q.code === qCode);
    if (!ev || !q) {
      socket.emit("not-found");
      return;
    }
    socket.join(`${eventCode}:${qCode}`);
    socket.emit("state", questionState(ev, q));
  });

  socket.on("submit-word", async ({ eventCode, qCode, word, participantId }) => {
    if (!word || typeof word !== "string") return;
    const clean = word.trim().slice(0, 30);
    if (!clean) return;
    // Sanitize the map key: "." and "$" are unsafe in MongoDB field paths.
    const key = clean.toLowerCase().replace(/[.$]/g, "_");
    const pid = participantId && typeof participantId === "string" ? participantId.slice(0, 64) : null;

    // First check the question exists and is open (cheap read, not the hot path for races).
    const check = await Event.findOne(
      { code: eventCode, "questions.code": qCode },
      { "questions.$": 1 }
    );
    const existingQ = check && check.questions && check.questions[0];
    if (!existingQ) return;
    if (existingQ.acceptingResponses === false) {
      socket.emit("closed");
      return;
    }

    // Atomic increment: avoids lost updates when many people submit at once.
    const incUpdate = {
      $inc: { [`questions.$.words.${key}.count`]: 1 },
      $set: {
        [`questions.$.words.${key}.display`]: clean,
        "questions.$.lastResponseAt": new Date(),
      },
    };
    if (pid) incUpdate.$addToSet = { "questions.$.participantIds": pid };

    const updated = await Event.findOneAndUpdate(
      { code: eventCode, "questions.code": qCode },
      incUpdate,
      { new: true }
    );
    if (!updated) return;
    const q = updated.questions.find((q) => q.code === qCode);
    if (!q) return;

    io.to(`${eventCode}:${qCode}`).emit("state", questionState(updated, q));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Word cloud poll running on port ${PORT}`);
});
