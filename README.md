# Word Cloud Poll — free, unlimited, self-hosted

A live word-cloud poll for presentations, like Slido/Mentimeter's word cloud
feature — but with no question limit, no participant limit, and no cost.

- **Host page** (`/host.html`) — shows the live word cloud + a QR code for
  people to join. Put this on your screen while presenting.
- **Join page** (`/join.html`) — participants scan the QR code and type a
  word. Updates the host's cloud in real time.

No database, no accounts, no API keys. State lives in memory on the server
for the duration of the event.

## 1. Run it locally (to try it out)

You need [Node.js](https://nodejs.org) 18+ installed.

```bash
cd wordcloud-poll
npm install
npm start
```

Then open:
- Host view: http://localhost:3000/host.html
- Join view (on your phone, same wifi, use your computer's local IP instead
  of localhost): http://YOUR_LOCAL_IP:3000/join.html

## 2. Deploy for free so a real audience can join

Pick any of these — all have free tiers that comfortably handle a live talk
(tens to hundreds of concurrent people is no problem for this app):

### Render.com (easiest)
1. Push this folder to a GitHub repo.
2. On [render.com](https://render.com), click **New → Web Service**, connect
   the repo.
3. Build command: `npm install`
   Start command: `npm start`
4. Deploy. You'll get a URL like `https://your-app.onrender.com`.
5. Open `https://your-app.onrender.com/host.html` for your presentation
   screen — participants go to the auto-generated join link/QR code shown
   there.

> Free Render web services sleep after inactivity and take ~30–60s to wake
> on the first request. Open the host page a couple minutes before you go
> live so it's already awake.

### Railway.app / Fly.io / Glitch.com
Same idea — point them at this repo, they auto-detect Node.js via
`package.json`, run `npm start`. All have no-cost tiers suitable for a
single event.

## 3. Using it during your presentation

1. Open `host.html` on the screen you're presenting from (or a browser tab
   you switch to). Add `?room=myevent` to the URL if you want a memorable,
   fixed room code instead of a random one — e.g.
   `https://your-app.onrender.com/host.html?room=myevent`.
2. In PowerPoint, add a slide with the QR code (screenshot it from the host
   page, or just read out / display the short link + room code shown there)
   — or literally leave your browser tab with `host.html` open and
   alt-tab/switch-display to it live during your talk.
3. Type your question into the "Update question" box, or set it via the
   `?room=` URL ahead of time by loading the host page once and typing it
   in before your session starts.
4. Participants scan the QR / visit the join link, type a word, hit submit.
   The cloud on your host screen updates instantly for everyone watching.
5. Click **Clear responses** to reset the cloud for your next question
   (the room stays the same, so you don't need a new QR code each time).

## Notes on "unlimited"

- No cap on number of questions — just type a new one and clear the board.
- No cap on number of participants — it's just WebSocket connections to
  your own server; free hosting tiers handle hundreds of concurrent users
  fine for something this lightweight.
- Data isn't persisted to a database — if the server restarts (e.g. a free
  host redeploying/sleeping), the current word cloud resets. Fine for
  single-event use; let me know if you want results saved/exportable
  afterward and I can add that.
