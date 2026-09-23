"""Groq API integration: resume/JD analysis, interview, and transcription."""

import json
import os
import re

from groq import Groq

from services import prompts

CHAT_MODEL = "openai/gpt-oss-120b"
WHISPER_MODEL = "whisper-large-v3"


def _client() -> Groq:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key or api_key.startswith("gsk_your"):
        raise RuntimeError(
            "GROQ_API_KEY is not configured. Copy backend/.env.example to "
            "backend/.env and add your free key from https://console.groq.com"
        )
    return Groq(api_key=api_key)


def _chat_json(system: str, user: str, temperature: float = 0.4) -> dict:
    response = _client().chat.completions.create(
        model=CHAT_MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=temperature,
        response_format={"type": "json_object"},
    )
    content = response.choices[0].message.content or ""
    return _parse_json(content)


def _parse_json(content: str) -> dict:
    text = content.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\s*|\s*```$", "", text).strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            raise ValueError(f"AI returned an unreadable response: {content[:300]}")
        data = json.loads(match.group(0))
    if not isinstance(data, dict):
        raise ValueError("AI returned an unexpected response format.")
    return data


def _score(value, default: int = 0) -> int:
    try:
        return max(0, min(100, int(float(value))))
    except (TypeError, ValueError):
        return default


def _str_list(value, limit: int = 20) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(v).strip() for v in value if str(v).strip()][:limit]


def analyze_match(resume_text: str, jd_text: str) -> dict:
    data = _chat_json(
        prompts.ANALYSIS_SYSTEM,
        prompts.analysis_prompt(resume_text, jd_text),
        temperature=0.3,
    )
    categories = data.get("category_scores") or {}
    return {
        "overall_score": _score(data.get("overall_score")),
        "summary": str(data.get("summary") or "").strip(),
        "category_scores": {
            "skills": _score(categories.get("skills")),
            "experience": _score(categories.get("experience")),
            "education": _score(categories.get("education")),
            "keywords": _score(categories.get("keywords")),
        },
        "matched_skills": _str_list(data.get("matched_skills"), 25),
        "missing_skills": _str_list(data.get("missing_skills"), 25),
        "gaps": _str_list(data.get("gaps"), 15),
        "recommendations": _str_list(data.get("recommendations"), 15),
    }


def start_interview(resume_text: str, jd_text: str) -> dict:
    data = _chat_json(prompts.INTERVIEW_SYSTEM, prompts.plan_prompt(resume_text, jd_text))
    questions = _str_list(data.get("questions"), 12)
    questions = [q for q in questions if q.endswith("?") or len(q) > 10]
    if not questions:
        raise ValueError("Could not generate interview questions for this input.")
    return {
        "role_title": str(data.get("role_title") or "Interview").strip(),
        "questions": questions[:8],
    }


def evaluate_answer(resume_text: str, jd_text: str, question: str, answer: str, history: list) -> dict:
    data = _chat_json(
        prompts.EVALUATE_SYSTEM,
        prompts.evaluate_prompt(resume_text, jd_text, question, answer, history),
        temperature=0.4,
    )
    return {
        "score": _score(data.get("score")),
        "verdict": str(data.get("verdict") or "").strip(),
        "strengths": _str_list(data.get("strengths"), 6),
        "improvements": _str_list(data.get("improvements"), 6),
        "followup": str(data.get("followup") or "").strip(),
    }


def finish_interview(resume_text: str, jd_text: str, history: list) -> dict:
    data = _chat_json(
        prompts.FINISH_SYSTEM,
        prompts.finish_prompt(resume_text, jd_text, history),
        temperature=0.4,
    )
    return {
        "overall_score": _score(data.get("overall_score")),
        "verdict": str(data.get("verdict") or "").strip(),
        "strengths": _str_list(data.get("strengths"), 8),
        "improvements": _str_list(data.get("improvements"), 8),
        "recommendation": str(data.get("recommendation") or "").strip(),
    }


def transcribe_audio(filename: str, data: bytes) -> str:
    client = _client()
    result = client.audio.transcriptions.create(
        model=WHISPER_MODEL,
        file=(filename or "recording.webm", data),
    )
    return (result.text or "").strip()
