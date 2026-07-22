# SkyVoice — AI Voice Operations Platform

An intelligent voice-to-voice AI assistant for **Skyvion Technologies**. Visitors
talk (or type) to an AI that answers questions from a company knowledge base,
books appointments, and captures project inquiries — while admins manage
everything from a real-time operations dashboard.

Built by [Skyvion Technologies](https://github.com/sidharthravary/Skyvoice).

---

## ✨ Features

**For visitors**
- 🎙️ **Voice assistant** — tap the orb and speak; the AI answers out loud with a natural voice
- 💬 **Text chat** — a ChatGPT-style chat with the same AI brain (memory, threads, markdown replies)
- 📅 **Self-service booking** — schedule and cancel appointments by voice or chat
- 🌐 **Multilingual** — English, हिंदी, and മലയാളം speech in and out
- 📱 **Works on any phone** — server-side transcription means no special browser needed; installable as a PWA

**For admins**
- 📊 **Command Center & Analytics** — live metrics from the database (conversations, bookings, satisfaction, response latency)
- 📚 **Knowledge Base** — upload PDFs/DOCX or ingest web pages; semantic (vector) search powers the AI's answers
- 🗂️ **Conversations & Scheduling** — review every transcript and manage all appointments
- 🖥️ **System Monitoring** — real CPU, memory, WebSocket clients, and database ping
- ⚙️ **AI Config** — tune the assistant's greeting and voice

**Under the hood**
- 🧠 **RAG** — Gemini embeddings + MongoDB Atlas Vector Search (with keyword fallback)
- 🔒 **Security** — JWT auth in HttpOnly cookies, argon/bcrypt hashing, admin-only APIs, zod-validated input
- 📧 **Email** — booking confirmations, cancellations, and day-before reminders (opt-in)
- 🧪 **Tested** — Jest API/unit tests with an in-memory MongoDB, GitHub Actions CI

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Framer Motion, Recharts, Radix UI |
| **Backend** | Node.js, Express, TypeScript, Socket.io |
| **Database** | MongoDB Atlas (Mongoose), Redis (optional cache) |
| **AI** | Google Gemini — chat, embeddings, speech-to-text, and text-to-speech |
| **Auth** | JWT (HttpOnly cookies), bcrypt |
| **Testing / CI** | Jest, Supertest, mongodb-memory-server, GitHub Actions |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js 20+**
- A **MongoDB Atlas** connection string (free tier works)
- A **Google Gemini API key** ([aistudio.google.com](https://aistudio.google.com)) — powers chat, voice, and embeddings

### 1. Clone & install
```bash
git clone https://github.com/sidharthravary/Skyvoice.git
cd Skyvoice
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```
Open `.env` and set at minimum:
```env
MONGODB_URI=your-atlas-connection-string
GEMINI_API_KEY=your-gemini-key
JWT_SECRET=any-long-random-string
ADMIN_PASSWORD=choose-an-admin-password
```
Everything else has sensible defaults. `.env` is gitignored — your keys stay local.

### 3. Run
```bash
npm run dev
```
This starts three processes together:

| URL | What |
|-----|------|
| http://localhost:3010 | Frontend (the app) |
| http://localhost:3011 | Backend API + voice pipeline |
| https://localhost:3443 | HTTPS proxy (for phone access + microphone) |

### 4. Log in
- **Admin dashboard** → username `Admin`, password = your `ADMIN_PASSWORD`
- **Visitor / voice** → create any account from the sign-up tab

---

## 📱 Using it on your phone

Both servers bind to `0.0.0.0`, so any device on the same Wi-Fi can reach them.
For the **microphone to work**, use the HTTPS address (browsers block mic access
on plain-HTTP LAN sites):

```
https://<your-computer-LAN-IP>:3443
```

The backend prints its LAN IP on startup. You'll see a one-time certificate
warning (it's a self-signed dev cert) — tap **Advanced → Proceed**.

---

## 🧪 Testing

```bash
npm test -w backend        # Jest API + unit tests (spins up an in-memory MongoDB)
npm run lint               # ESLint across both workspaces
npx tsc --noEmit -p backend && npx tsc --noEmit -p frontend   # type-check
```

CI runs all of this automatically on every push and pull request
(`.github/workflows/ci.yml`).

---

## ☁️ Deployment

The project is deployment-ready for **Vercel** (frontend) + **Render** (backend).
See [`DEPLOYMENT.md`](DEPLOYMENT.md) for the step-by-step guide, plus
`render.yaml` and `frontend/vercel.json`.

You can also run the whole stack in Docker:
```bash
docker compose up --build
```

---

## ⚙️ Configuration reference

Key environment variables (full list in [`.env.example`](.env.example)):

| Variable | Purpose |
|----------|---------|
| `MONGODB_URI` | MongoDB Atlas connection string **(required)** |
| `GEMINI_API_KEY` | Google Gemini — chat, voice, embeddings **(required)** |
| `JWT_SECRET` | Signs auth tokens (required in production) |
| `ADMIN_PASSWORD` | Password for the `Admin` account |
| `EMAIL_ENABLED` + `SMTP_*` | Turn on booking/reminder emails (off by default) |
| `SENTRY_DSN` | Optional error tracking |
| `REDIS_URL` | Optional cache (falls back to in-memory) |

---

## 📁 Project structure

```
SkyVoice/
├── backend/          Express API + Socket.io voice pipeline
│   └── src/
│       ├── routes/       auth, knowledge, analytics, appointments, tts, email…
│       ├── services/     RAG, Gemini, TTS, voice pipeline, email, reminders
│       ├── models/       Mongoose schemas
│       └── middleware/    auth, validation, error handling
├── frontend/         Next.js App Router
│   └── src/
│       ├── app/          login, voice, chat, reservations, dashboard/*
│       ├── components/    UI components + chat panel
│       └── hooks/         useVoiceAI, useChatAI
├── scripts/          HTTPS dev proxy
├── docker-compose.yml
└── DEPLOYMENT.md
```

---

## 📄 License

Proprietary — © Skyvion Technologies. All rights reserved.
