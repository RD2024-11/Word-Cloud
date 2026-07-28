const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---- In-memory data store ----
// events[eventId] = { id, title, order: [questionId...], questions: { [qId]: { id, text, words: {}, participants: Set } } }
const events = {};

function genId(len = 6) {
  return Math.random().toString(36).slice(2, 2 + len);
}

function publicQuestion(q) {
  return {
    id: q.id,
    text: q.text,
    responseCount: Object.values(q.words).reduce((a, w) => a + w.count, 0),
    participantCount: q.participants.size,
  };
}

function publicEvent(ev) {
  return {
    id: ev.id,
    title: ev.title,
    questions: ev.order.map((qid) => publicQuestion(ev.questions[qid])),
  };
}

function questionState(ev, q) {
  return {
    eventTitle: ev.title,
    text: q.text,
    words: Object.values(q.words).sort((a, b) => b.count - a.count),
    responseCount: Object.values(q.words).reduce((a, w) => a + w.count, 0),
    participantCount: q.participants.size,
  };
}

// ---- REST API ----

// Create a new event
app.post("/api/events", (req, res) => {
  const title = (req.body.title || "").trim() || "Untitled Event";
  const id = genId();
  events[id] = { id, title, order: [], questions: {} };
  res.json(publicEvent(events[id]));
});

// Get event + its questions (for dashboard)
app.get("/api/events/:eventId", (req, res) => {
  const ev = events[req.params.eventId];
  if (!ev) return res.status(404).json({ error: "Event not found" });
  res.json(publicEvent(ev));
});

// Update event title
app.patch("/api/events/:eventId", (req, res) => {
  const ev = events[req.params.eventId];
  if (!ev) return res.status(404).json({ error: "Event not found" });
  if (req.body.title && req.body.title.trim()) ev.title = req.body.title.trim();
  res.json(publicEvent(ev));
});

// Add a question to an event
app.post("/api/events/:eventId/questions", (req, res) => {
  const ev = events[req.params.eventId];
  if (!ev) return res.status(404).json({ error: "Event not found" });
  const text = (req.body.text || "").trim() || "Untitled question";
  const id = genId();
  ev.questions[id] = { id, text, words: {}, participants: new Set() };
  ev.order.push(id);
  res.json(publicEvent(ev));
});

// Update a question's text
app.patch("/api/events/:eventId/questions/:qId", (req, res) => {
  const ev = events[req.params.eventId];
  if (!ev) return res.status(404).json({ error: "Event not found" });
  const q = ev.questions[req.params.qId];
  if (!q) return res.status(404).json({ error: "Question not found" });
  if (req.body.text && req.body.text.trim()) q.text = req.body.text.trim();
  io.to(`${ev.id}:${q.id}`).emit("state", questionState(ev, q));
  res.json(publicEvent(ev));
});

// Delete a question
app.delete("/api/events/:eventId/questions/:qId", (req, res) => {
  const ev = events[req.params.eventId];
  if (!ev) return res.status(404).json({ error: "Event not found" });
  delete ev.questions[req.params.qId];
  ev.order = ev.order.filter((id) => id !== req.params.qId);
  res.json(publicEvent(ev));
});

// ---- Realtime word cloud updates ----
io.on("connection", (socket) => {
  socket.on("join-question", ({ eventId, qId }) => {
    const ev = events[eventId];
    const q = ev && ev.questions[qId];
    if (!ev || !q) {
      socket.emit("not-found");
      return;
    }
    socket.join(`${eventId}:${qId}`);
    socket.emit("state", questionState(ev, q));
  });

  socket.on("submit-word", ({ eventId, qId, word, participantId }) => {
    const ev = events[eventId];
    const q = ev && ev.questions[qId];
    if (!ev || !q || !word || typeof word !== "string") return;
    const clean = word.trim().slice(0, 30);
    if (!clean) return;
    const key = clean.toLowerCase();
    if (!q.words[key]) q.words[key] = { display: clean, count: 0 };
    q.words[key].count += 1;
    if (participantId && typeof participantId === "string") {
      q.participants.add(participantId.slice(0, 64));
    }
    io.to(`${eventId}:${qId}`).emit("state", questionState(ev, q));
  });

  socket.on("clear-words", ({ eventId, qId }) => {
    const ev = events[eventId];
    const q = ev && ev.questions[qId];
    if (!ev || !q) return;
    q.words = {};
    io.to(`${eventId}:${qId}`).emit("state", questionState(ev, q));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Word cloud poll running on port ${PORT}`);
});
