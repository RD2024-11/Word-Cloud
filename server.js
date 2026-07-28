const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

// In-memory state, keyed by room code. No database needed.
// rooms[room] = { question: string, words: { [normalizedWord]: { display, count } } }
const rooms = {};

function getRoom(room) {
  if (!rooms[room]) {
    rooms[room] = {
      question: "What's one word that comes to mind?",
      words: {},
    };
  }
  return rooms[room];
}

function roomState(room) {
  const r = getRoom(room);
  return {
    question: r.question,
    words: Object.values(r.words).sort((a, b) => b.count - a.count),
  };
}

io.on("connection", (socket) => {
  let currentRoom = null;

  socket.on("join-room", (room) => {
    currentRoom = room || "default";
    socket.join(currentRoom);
    socket.emit("state", roomState(currentRoom));
  });

  // Participant submits a word
  socket.on("submit-word", ({ room, word }) => {
    if (!word || typeof word !== "string") return;
    const clean = word.trim().slice(0, 30); // cap length, no need for more
    if (!clean) return;
    const key = clean.toLowerCase();

    const r = getRoom(room || "default");
    if (!r.words[key]) {
      r.words[key] = { display: clean, count: 0 };
    }
    r.words[key].count += 1;

    io.to(room || "default").emit("state", roomState(room || "default"));
  });

  // Host changes the question
  socket.on("set-question", ({ room, question }) => {
    const r = getRoom(room || "default");
    r.question = (question || "").trim() || r.question;
    io.to(room || "default").emit("state", roomState(room || "default"));
  });

  // Host clears the current cloud (keeps the question)
  socket.on("clear-words", ({ room }) => {
    const r = getRoom(room || "default");
    r.words = {};
    io.to(room || "default").emit("state", roomState(room || "default"));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Word cloud poll running on port ${PORT}`);
});
