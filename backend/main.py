"""AI Resume Analyzer & Interview Coach - FastAPI backend."""

import os
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from services import groq_service
from services.parser import extract_text

load_dotenv()

app = FastAPI(title="AI Resume Analyzer & Interview Coach", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "groq_key_configured": bool(os.getenv("GROQ_API_KEY")),
    }


@app.post("/api/analyze")
async def analyze(
    resume: UploadFile = File(...),
    jd: Optional[UploadFile] = File(None),
    jd_text: Optional[str] = Form(None),
) -> dict:
    resume_text = _parse_upload(resume.filename, await resume.read(), "resume")

    if jd is not None and jd.filename:
        jd_body = _parse_upload(jd.filename, await jd.read(), "job description")
    else:
        jd_body = (jd_text or "").strip()

    if not jd_body:
        raise HTTPException(status_code=400, detail="Provide a job description (file or pasted text).")

    result = _ai_call(groq_service.analyze_match, resume_text, jd_body)
    # Return extracted texts so the interview step can reuse them without re-uploading.
    return {**result, "resume_text": resume_text, "jd_text": jd_body}


class InterviewStartRequest(BaseModel):
    resume_text: str
    jd_text: str


class HistoryItem(BaseModel):
    question: str
    answer: str
    score: Optional[int] = None
    verdict: Optional[str] = None


class InterviewAnswerRequest(BaseModel):
    resume_text: str
    jd_text: str
    question: str
    answer: str
    history: list[HistoryItem] = []


class InterviewFinishRequest(BaseModel):
    resume_text: str
    jd_text: str
    history: list[HistoryItem]


@app.post("/api/interview/start")
def interview_start(payload: InterviewStartRequest) -> dict:
    if not payload.resume_text.strip() or not payload.jd_text.strip():
        raise HTTPException(status_code=400, detail="Resume and job description are required.")
    return _ai_call(groq_service.start_interview, payload.resume_text, payload.jd_text)


@app.post("/api/interview/answer")
def interview_answer(payload: InterviewAnswerRequest) -> dict:
    if not payload.answer.strip():
        raise HTTPException(status_code=400, detail="Answer cannot be empty.")
    history = [h.model_dump() for h in payload.history]
    return _ai_call(
        groq_service.evaluate_answer,
        payload.resume_text,
        payload.jd_text,
        payload.question,
        payload.answer.strip(),
        history,
    )


@app.post("/api/interview/finish")
def interview_finish(payload: InterviewFinishRequest) -> dict:
    if not payload.history:
        raise HTTPException(status_code=400, detail="No answers recorded for this interview.")
    history = [h.model_dump() for h in payload.history]
    return _ai_call(groq_service.finish_interview, payload.resume_text, payload.jd_text, history)


@app.post("/api/transcribe")
async def transcribe(audio: UploadFile = File(...)) -> dict:
    data = await audio.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty audio recording.")
    try:
        text = _ai_call(groq_service.transcribe_audio, audio.filename or "recording.webm", data)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="Transcription failed. The audio format may be unsupported - try Chrome's built-in dictation instead.",
        )
    return {"text": text}


def _parse_upload(filename: Optional[str], data: bytes, label: str) -> str:
    try:
        text = extract_text(filename or "", data)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Could not read the {label} file: {exc} Please upload a text-based PDF, DOCX, or TXT file.",
        )
    if not text.strip():
        raise HTTPException(status_code=400, detail=f"The {label} file contains no readable text.")
    return text


def _ai_call(fn, *args):
    """Run an AI service call and translate failures into HTTP errors."""
    try:
        return fn(*args)
    except HTTPException:
        raise
    except RuntimeError as exc:  # missing/invalid API key
        raise HTTPException(status_code=500, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI request failed: {exc}")
