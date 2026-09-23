# HireSense AI — Resume Analyzer & Interview Coach

Upload a resume and a job description, get an AI match score with a gap analysis, then
practice with an AI interviewer (text **or** voice) tailored to that exact role.

All AI is powered by the **Groq free API** (no credit card).

## Features

- **Resume upload** — PDF, DOCX, or TXT (drag & drop, max 5 MB)
- **JD upload or paste** — file or text
- **Match analysis** — overall 0–100 score, per-category bars (skills / experience /
  education / keywords), matched skills, missing skills, gaps, and concrete
  recommendations to fix your resume for that job
- **AI interview** — 6 questions generated from *your* resume + this JD, with instant
  scored feedback (strengths + improvements) after every answer, optional AI follow-ups,
  and a final interview report card
- **Voice mode** — speak your answers: live browser dictation where supported, otherwise
  recording → Groq Whisper transcription; AI questions can be read aloud (browser TTS)

## Tech stack

| Layer    | Tech                                                        |
| -------- | ----------------------------------------------------------- |
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS v4               |
| Backend  | FastAPI (Python), pypdf / python-docx parsers               |
| AI       | Groq — `openai/gpt-oss-120b` (chat), `whisper-large-v3` (speech) |

## Setup

### 1. Backend

```powershell
cd backend
python -m venv .venv or (.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000)
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

# add your free Groq key (https://console.groq.com -> API Keys)
Copy-Item .env.example .env   # then edit .env and paste your key

.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

### 2. Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** — the API runs at `http://127.0.0.1:8000`
(override with a `VITE_API_BASE` env var in `frontend/.env`).

### Try it fast

`samples/sample_resume.txt` and `samples/sample_jd.txt` are included — upload them on
the home screen to see a full analysis and interview.

## API

| Method | Path                      | Purpose                                  |
| ------ | ------------------------- | ---------------------------------------- |
| GET    | `/api/health`             | Health + whether the Groq key is set     |
| POST   | `/api/analyze`            | multipart: `resume` file + `jd` file or `jd_text` |
| POST   | `/api/interview/start`    | Generate interview plan from resume + JD |
| POST   | `/api/interview/answer`   | Score an answer, get feedback/follow-up  |
| POST   | `/api/interview/finish`   | Final interview report                   |
| POST   | `/api/transcribe`         | Audio → text (Groq Whisper fallback)     |

## Notes

- Single-user demo: no login, no database — state resets on page refresh.
- Scanned/image PDFs can't be read; upload a text-based PDF, DOCX, or TXT.
- Voice dictation uses the browser's Web Speech API (Chrome/Edge); other browsers fall
  back to recording + Whisper transcription.
