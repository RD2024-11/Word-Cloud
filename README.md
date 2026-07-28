# Word Cloud Poll — free, unlimited, self-hosted, with login

A live word-cloud poll system for presentations, like Slido/Mentimeter's
word cloud feature — but with no limit on events, questions, or
participants, no cost, and your data actually persists.

## What's included

- **Login/signup** — your events belong to your account only.
- **My Events page** — every event you've created, with question counts,
  response counts, and last-activity status (Active/Idle).
- **Dashboard** — add/delete questions inside an event.
- **Present + QR** — a big-screen live word cloud with a unique QR code
  per question, plus edit/clear controls (only visible to you, since it
  requires login).
- **Join page** — fully public, no login needed. Anyone who scans the QR
  can submit a word.
- **Persistent storage** — event/question data is saved in MongoDB Atlas
  (free tier), so it survives server restarts and lasts as long as you
  want — weeks, months, indefinitely.

## Pages

| Page | Auth? | Purpose |
|---|---|---|
| `/login.html` | — | Log in or sign up |
| `/events.html` | required | List of your events, create new ones |
| `/dashboard.html?event=CODE` | required | Add/delete questions |
| `/present.html?event=CODE&q=QCODE` | required | Big-screen live cloud + QR + edit controls |
| `/join.html?event=CODE&q=QCODE` | public | What participants see after scanning |

## 1. Set up a free database (MongoDB Atlas)

This only needs to be done once.

1. Go to https://www.mongodb.com/cloud/atlas/register and create a free
   account.
2. Create a new project, then click **Build a Database** → choose the
   **M0 Free** tier → pick any region close to you → **Create**.
3. When prompted to create a database user, set a username and password
   (write these down).
4. Under **Network Access**, click **Add IP Address** → **Allow access
   from anywhere** (0.0.0.0/0) — needed since Render's server IP isn't
   fixed on the free tier.
5. Go to **Database** → click **Connect** on your cluster → **Drivers** →
   copy the connection string. It looks like:
   `mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
6. Replace `<username>` and `<password>` with the ones from step 3. Add a
   database name before the `?`, e.g.:



## 2. Add environment variables on Render

1. Open your service on render.com → **Environment** tab.
2. Add two environment variables:
   - `MONGODB_URI` = the connection string from step 1.6 above
   - `SESSION_SECRET` = any random long string you make up (e.g. mash your
     keyboard for 30 characters) — this keeps login sessions secure.
3. Save changes — Render will automatically redeploy with the new
   environment variables.

## 3. Run it locally (optional, to try it out first)

Requires [Node.js](https://nodejs.org) 18+.

```bash
cd wordcloud-poll
export MONGODB_URI="your connection string"
export SESSION_SECRET="some random string"
npm install
npm start
```

Open http://localhost:3000 — you'll be sent to the login page first.

## 4. Using it

1. Visit your Render URL, e.g. `https://word-cloud-4gb5.onrender.com`.
2. Sign up once (username + password — this is just for you, no email
   needed).
3. On **My Events**, create an event, e.g. your talk title.
4. Open it, add every question you want to ask — as many as you like, in
   advance or on the fly.
5. Click **Present + QR** on a question to get its live screen + QR code.
   Screenshot the QR into your PowerPoint slide ahead of time — it'll
   keep working whenever you open the present page, even weeks later.
6. On the day, open the present page, and you're live. Participants scan,
   type a word, done.
7. Come back anytime via **My Events** to see everything you've ever
   created, with response counts and Active/Idle status.

## Notes

- Free Render web services sleep after inactivity and take ~30–60s to
  wake on first load — open your present page a couple minutes before you
  need it live.
- MongoDB Atlas's M0 free tier doesn't expire on its own and comfortably
  fits thousands of events/questions/responses for personal use.
- Passwords are hashed (never stored in plain text). This app is meant for
  personal/internal use — no password-reset flow is built in, so if you
  forget your password, sign up again with a new username or ask me to
  add password reset.
