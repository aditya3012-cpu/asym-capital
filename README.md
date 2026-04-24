# ASYM Capital — Website

ASYM Capital is a quantitative trading and algorithmic services firm based in Bengaluru, India (`asymcapital.in`). This repository contains the full website: a FastAPI backend that handles contact form submissions via SMTP email, and a vanilla-JS frontend served as static files from the same process.

---

## Local Development

### 1. Prerequisites
- Python 3.11+
- An SMTP account (Zoho Mail, Gmail with App Password, etc.)

### 2. Install dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env and fill in your SMTP credentials
```

### 4. Run the server

Run from the **repository root** (not inside `backend/`):

```bash
uvicorn backend.main:app --reload --port 8000
```

Open [http://localhost:8000](http://localhost:8000) — the frontend is served automatically.

Interactive API docs (development only): [http://localhost:8000/api/docs](http://localhost:8000/api/docs)

---

## API Endpoints

| Method | Path            | Description                                      |
|--------|-----------------|--------------------------------------------------|
| GET    | `/api/health`   | Health check — returns status, env, timestamp    |
| POST   | `/api/contact`  | Submit contact form — sends email via SMTP       |

### `POST /api/contact` — Request body

```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "company": "Acme Fund",
  "enquiry_type": "systematic_trading",
  "message": "We are interested in your systematic trading capabilities..."
}
```

**`enquiry_type` values:** `systematic_trading` · `algorithmic_execution` · `quantitative_analytics` · `backtesting` · `market_signals` · `risk_management` · `general`

**Rate limit:** 3 submissions per IP per hour (in-memory, resets on server restart).

---

## Environment Variables

| Variable             | Required | Default                    | Description                              |
|----------------------|----------|----------------------------|------------------------------------------|
| `SMTP_HOST`          | Yes      | `smtp.zoho.com`            | SMTP server hostname                     |
| `SMTP_PORT`          | No       | `587`                      | SMTP port (STARTTLS)                     |
| `SMTP_USER`          | Yes      | `contact@asymcapital.in`   | SMTP login / From address                |
| `SMTP_PASS`          | Yes      | —                          | SMTP password or App Password            |
| `CONTACT_TO_EMAIL`   | Yes      | `contact@asymcapital.in`   | Inbox that receives enquiries            |
| `APP_ENV`            | No       | `development`              | `development` or `production`            |
| `ALLOWED_ORIGINS`    | No       | `http://localhost:8000,...`| Comma-separated CORS allowed origins     |

---

## Deployment

### Frontend (Vercel / Netlify)
The `frontend/` directory is a single self-contained `index.html` + `main.js`. Deploy it to any static host. Set the API base URL by updating the `fetch('/api/contact', ...)` call in `main.js` to point at your backend URL if they are on separate domains.

### Backend (Railway / Render / Fly.io)

```bash
# Run from repo root
uvicorn backend.main:app --host 0.0.0.0 --port $PORT
```

Set all environment variables via the platform's dashboard. The `APP_ENV=production` flag disables the `/api/docs` endpoint.

**CORS:** Add your production frontend domain to `ALLOWED_ORIGINS`.

### Combined (single server)
If deploying backend + frontend together (e.g. a single Railway/Render service), the FastAPI app already serves `frontend/` as static files at `/`. Just run uvicorn and everything works from one URL.

---

## Project Structure

```
asymcapital/
├── backend/
│   ├── main.py              # FastAPI entry point, CORS, static files
│   ├── config.py            # pydantic-settings — loads .env
│   ├── routes/
│   │   ├── contact.py       # POST /api/contact  (+ rate limiting)
│   │   └── health.py        # GET  /api/health
│   ├── models/
│   │   └── contact.py       # Pydantic ContactForm model
│   ├── services/
│   │   └── email.py         # HTML email templates + async smtplib send
│   └── requirements.txt
├── frontend/
│   ├── index.html           # Full website (CSS + canvas animations inline)
│   └── main.js              # Smooth scroll, nav highlight, mobile menu, form
├── .env.example
├── .gitignore
└── README.md
```
