[Uploading README.md…]()
# Word Cloud Poll — free, unlimited, self-hosted

A live word-cloud poll system for presentations, like Slido/Mentimeter's
word cloud feature — but with no limit on events, questions, or
participants, and no cost.

## How it works

- **Create an event** (e.g. "Team Offsite 2026") on the home page.
- Inside the event **dashboard**, add as many **questions** as you like.
- Each question has its own **Present + QR** page — a big screen view with
  a live word cloud and a unique QR code just for that question. Put a
  screenshot of that QR on the matching slide in your deck, or keep the
  browser tab open and switch to it live.
- Participants scan the QR for whichever question is on screen, type a
  word, hit submit — the cloud updates instantly for everyone watching.
- No database, no accounts, no API keys. Everything is created on the fly
  and lives in memory on the server for the event.

## Pages

| Page | Purpose |
|---|---|
| `/` | Create a new event, or open one by its code |
| `/dashboard.html?event=ID` | Add/delete questions for an event |
| `/present.html?event=ID&q=QID` | Big-screen live word cloud + QR code for one question |
| `/join.html?event=ID&q=QID` | What participants see after scanning — type a word |

## 1. Run it locally (to try it out)

Requires [Node.js](https://nodejs.org) 18+.

```bash
cd wordcloud-poll
npm install
npm start
```

Open http://localhost:3000 to create your first event.

## 2. Deploy for free so a real audience can join

### Render.com (recommended, easiest)
1. Push this folder to a GitHub repo.
2. On [render.com](https://render.com), **New → Web Service**, connect the
   repo.
3. Build command: `npm install`
   Start command: `npm start`
4. Instance type: **Free**
5. Deploy. You'll get a URL like `https://your-app.onrender.com`.

> Free Render services sleep after inactivity and take ~30–60s to wake on
> the first request. Open your event's present page a couple minutes
> before you go live so it's already awake.

Railway.app, Fly.io, and Glitch.com work the same way if you'd rather use
one of those — they all auto-detect Node.js from `package.json`.

## 3. Using it during your presentation

1. Go to `https://your-app.onrender.com/`, create an event (e.g. your talk
   title).
2. On the dashboard, add every question you want to ask during the talk —
   as many as you like, in advance or on the fly mid-event.
3. For each question, click **Present + QR** — this opens the big-screen
   view with that question's own QR code.
4. Screenshot each QR code and put it on the matching PowerPoint slide (or
   just alt-tab/switch display to the live present page when you reach
   that question).
5. Save your **event code** (shown on the dashboard) somewhere — it lets
   you come back to the same event later, e.g. for a follow-up session.
6. Use **Clear responses** on the present page if you want to reset a
   question's cloud (e.g. re-running it with a new group).

## Notes on "unlimited"

- No cap on number of events, questions, or participants — it's just
  WebSocket connections and small JSON objects on your own server. Free
  hosting tiers handle this fine for live-audience use.
- Data isn't persisted to a database — if the server restarts (e.g. a free
  host redeploying or sleeping for long enough), events/questions/results
  reset. Fine for single-event or single-day use. Let me know if you want
  results saved permanently or exportable to CSV afterward — that's a
  straightforward addition.
