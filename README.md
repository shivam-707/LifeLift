# ⚡ LifeLift

> AI-powered lifestyle management platform for college hostel students who gym and study simultaneously.

---

## What it solves

| Problem | Feature |
|---|---|
| Balancing gym (1–1.5 hrs), study (3–4 hrs) & sleep for recovery | Weekly Schedule Optimizer + AI Chatbot |
| Hostel mess food is low-quality — what should I eat/order? | Smart Food Decision Engine |
| Scanning packaged food ingredients for health + budget | Ingredient Scanner |
| Gym days vary (3–5/week) due to academic load | Dynamic Workout Split Generator |

---

## Tech Stack

- **Frontend** — React.js 18 (functional components + hooks), React Router v6, Axios
- **Backend** — Node.js + Express.js (REST API)
- **Database** — MongoDB + Mongoose ODM
- **AI** — Anthropic Claude API (`claude-sonnet-4-6`)
- **Auth** — JWT (JSON Web Tokens) stored in localStorage
- **Styling** — Custom CSS (dark theme, no Bootstrap)

---

## Project Structure

```
peakmode/
├── client/                        # React frontend
│   ├── public/
│   │   └── index.html
│   └── src/
│       ├── App.js                 # Root component + routes
│       ├── index.js               # React entry point
│       ├── components/
│       │   └── PrivateRoute.jsx   # JWT-protected route wrapper
│       ├── context/
│       │   └── AuthContext.jsx    # Global auth state (useReducer)
│       ├── hooks/                 # Custom hooks (added in later steps)
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── Register.jsx
│       │   └── Dashboard.jsx      # Placeholder → full dashboard in Step 2
│       ├── styles/
│       │   ├── globals.css        # Design tokens + CSS reset
│       │   ├── Auth.css           # Login + Register styles
│       │   ├── Dashboard.css      # Dashboard styles
│       │   └── Spinner.css        # Loading spinner
│       └── utils/
│           └── api.js             # Axios instance + auth helpers
│
├── server/                        # Node + Express backend
│   ├── server.js                  # App entry point
│   ├── .env.example               # Environment variable template
│   ├── middleware/
│   │   └── auth.js                # JWT verification middleware
│   ├── models/
│   │   └── User.js                # Mongoose User schema
│   └── routes/
│       └── auth.js                # /api/auth/* endpoints
│
├── .gitignore
└── README.md
```

---

## Quick Start

### Prerequisites

- Node.js ≥ 18
- MongoDB running locally **or** a free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster
- An [Anthropic API key](https://console.anthropic.com/) (for AI features in later steps)

---

### 1 — Clone & install

```bash
git clone <your-repo-url>
cd peakmode
```

Install server dependencies:
```bash
cd server
npm install
```

Install client dependencies:
```bash
cd ../client
npm install
```

---

### 2 — Configure environment variables

```bash
cd server
cp .env.example .env
```

Open `server/.env` and fill in:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/lifelift   # or your Atlas URI
JWT_SECRET=replace_with_a_long_random_string
JWT_EXPIRES_IN=7d
ANTHROPIC_API_KEY=sk-ant-...                   # needed for Step 3+
```

> **Generate a secure JWT secret:**
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

---

### 3 — Run the development servers

**Terminal 1 — Backend:**
```bash
cd server
npm run dev        # uses nodemon for auto-reload
```
Server starts at `http://localhost:5000`

**Terminal 2 — Frontend:**
```bash
cd client
npm start          # CRA dev server with HMR
```
App opens at `http://localhost:3000`

> The `"proxy": "http://localhost:5000"` in `client/package.json` forwards all
> `/api/*` requests from React to Express — no CORS config needed in development.

---

### 4 — Test the API

```bash
# Health check
curl http://localhost:5000/api/health

# Register a new user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"arjun","email":"arjun@test.com","password":"secret123"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"arjun@test.com","password":"secret123"}'
```

---

## API Reference (Step 1)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET`  | `/api/health` | ✗ | Server health check |
| `POST` | `/api/auth/register` | ✗ | Create new user account |
| `POST` | `/api/auth/login` | ✗ | Login and receive JWT |
| `GET`  | `/api/auth/me` | ✅ Bearer | Get current user data |

### Request / Response examples

**POST `/api/auth/register`**
```json
// Request body
{ "username": "arjun", "email": "arjun@test.com", "password": "secret123" }

// Response 201
{
  "success": true,
  "token": "<jwt>",
  "user": { "_id": "...", "username": "arjun", "email": "arjun@test.com", ... }
}
```

**POST `/api/auth/login`**
```json
// Request body
{ "email": "arjun@test.com", "password": "secret123" }

// Response 200
{ "success": true, "token": "<jwt>", "user": { ... } }
```

---

## Roadmap

| Step | Features |
|------|----------|
| ✅ **Step 1** | Auth (Register/Login), JWT, Protected routes, Dark-theme UI |
| 🔜 **Step 2** | Dashboard + User Profile setup |
| 🔜 **Step 3** | AI Chatbot (Claude API) |
| 🔜 **Step 4** | Smart Food Decision Engine |
| 🔜 **Step 5** | Ingredient Scanner |
| 🔜 **Step 6** | Dynamic Workout Split Generator |
| 🔜 **Step 7** | Weekly Schedule Optimizer |
| 🔜 **Step 8** | Streaks & Progress Tracker |
| 🔜 **Step 9** | Weekly AI Report |

---

## Design System

| Token | Value | Use |
|-------|-------|-----|
| `--bg-base` | `#0a0a0f` | Page background |
| `--bg-surface` | `#111118` | Cards, panels |
| `--accent-blue` | `#3B82F6` | Primary CTA, links |
| `--accent-green` | `#22C55E` | Success, streaks |
| `--font-display` | Space Grotesk | Headings |
| `--font-body` | Inter | Body text |

---

## License

MIT — build freely, learn deeply. 💪
