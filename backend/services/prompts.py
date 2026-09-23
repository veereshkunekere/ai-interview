"""Prompt templates for the Groq-powered analysis and interview."""

ANALYSIS_SYSTEM = """You are an expert technical recruiter and career coach with 15 years of experience screening resumes against job descriptions.
You always respond with a single valid JSON object and nothing else - no markdown fences, no explanation.
You are calibrated, specific and honest: never inflate scores, and make every recommendation concrete and actionable."""

INTERVIEW_SYSTEM = """You are an experienced interviewer conducting a live mock interview for a specific role.
You always respond with a single valid JSON object and nothing else - no markdown fences, no explanation.
Questions must be tailored to the candidate's resume and the job description, specific rather than generic, and answerable in 1-3 minutes."""

EVALUATE_SYSTEM = """You are a strict but constructive interview coach scoring one interview answer.
You always respond with a single valid JSON object and nothing else - no markdown fences, no explanation.
Be specific about what was good and what was missing relative to the role. Score honestly on a 0-100 scale (70+ = solid professional answer, 50-69 = adequate, below 50 = weak)."""

FINISH_SYSTEM = """You are a senior interview coach writing the final report for a completed mock interview.
You always respond with a single valid JSON object and nothing else - no markdown fences, no explanation.
Summarize performance honestly with specific, actionable next steps."""

ANALYSIS_SCHEMA = """{
  "overall_score": <integer 0-100>,
  "summary": "<2-3 sentence overall assessment of the fit>",
  "category_scores": {
    "skills": <integer 0-100>,
    "experience": <integer 0-100>,
    "education": <integer 0-100>,
    "keywords": <integer 0-100>
  },
  "matched_skills": ["<skill required by the JD that is clearly present in the resume>", ...],
  "missing_skills": ["<skill required by the JD that is absent or weak in the resume>", ...],
  "gaps": ["<important gap between the resume and the JD>", ...],
  "recommendations": ["<specific, actionable change to the resume for this JD>", ...]
}"""

PLAN_SCHEMA = """{
  "role_title": "<short job title based on the JD>",
  "questions": ["<question 1>", "<question 2>", "<question 3>", "<question 4>", "<question 5>", "<question 6>"]
}"""

EVALUATE_SCHEMA = """{
  "score": <integer 0-100>,
  "verdict": "<one sentence assessment of the answer>",
  "strengths": ["<what was good>", ...],
  "improvements": ["<specific thing to do better>", ...],
  "followup": "<one short follow-up question if the answer clearly demands probing, otherwise an empty string - use at most one follow-up over the whole interview>"
}"""

FINISH_SCHEMA = """{
  "overall_score": <integer 0-100>,
  "verdict": "<2-3 sentence overall interview performance summary>",
  "strengths": ["<recurring strength across answers>", ...],
  "improvements": ["<recurring weakness to fix, in priority order>", ...],
  "recommendation": "<one paragraph: what to practice before the real interview>"
}"""


def clip(text: str, limit: int = 8000) -> str:
    text = text or ""
    if len(text) <= limit:
        return text
    return text[:limit] + "\n...[truncated]"


def analysis_prompt(resume: str, jd: str) -> str:
    return f"""Analyze how well the candidate's resume matches the job description.

<resume>
{clip(resume)}
</resume>

<job_description>
{clip(jd)}
</job_description>

Return JSON with exactly this shape:
{ANALYSIS_SCHEMA}

Scoring rules:
- Be calibrated and realistic - most resumes fall between 35 and 80.
- "keywords" measures how closely resume wording mirrors JD terminology.
- matched_skills / missing_skills must be concrete tools, technologies, methods or domain skills (not vague phrases like "good communication").
- Give 5-12 items for matched_skills and missing_skills where the JD allows it.
- recommendations must be specific edits the candidate can make to THIS resume for THIS job."""


def plan_prompt(resume: str, jd: str) -> str:
    return f"""Create a mock interview plan for this candidate and role.

<resume>
{clip(resume, 6000)}
</resume>

<job_description>
{clip(jd, 6000)}
</job_description>

Return JSON with exactly this shape:
{PLAN_SCHEMA}

Rules for the 6 questions:
- 2 role-specific technical questions drawn from the JD's core requirements.
- 2 experience/behavioral questions targeting the candidate's actual background (STAR-format answers).
- 1 motivation / fit question about why this candidate and this role.
- 1 question inviting the candidate to ask about the role or prove initiative.
- Each question must be a single clear sentence ending with a question mark."""


def evaluate_prompt(resume: str, jd: str, question: str, answer: str, history: list) -> str:
    history_text = _history_block(history)
    return f"""Evaluate the candidate's answer to the interview question below.

<resume>
{clip(resume, 5000)}
</resume>

<job_description>
{clip(jd, 5000)}
</job_description>

<interview_so_far>
{history_text}
</interview_so_far>

<current_question>
{question}
</current_question>

<candidate_answer>
{answer}
</candidate_answer>

Return JSON with exactly this shape:
{EVALUATE_SCHEMA}

Rules:
- Judge relevance, specificity, structure (context -> action -> result) and alignment with the JD.
- strengths and improvements: 1-3 concrete items each, referencing the actual answer.
- followup: empty string unless the answer was vague or made a claim that deserves one probing question."""


def finish_prompt(resume: str, jd: str, history: list) -> str:
    return f"""Write the final report for this completed mock interview.

<resume>
{clip(resume, 5000)}
</resume>

<job_description>
{clip(jd, 5000)}
</job_description>

<interview>
{_history_block(history)}
</interview>

Return JSON with exactly this shape:
{FINISH_SCHEMA}

Rules:
- overall_score reflects the whole interview (average of answer quality, adjusted for coverage of JD requirements).
- improvements: 3-5 items in priority order.
- recommendation: practical next steps tailored to this candidate."""


def _history_block(history: list) -> str:
    lines = []
    for i, item in enumerate(history, 1):
        score = item.get("score")
        score_part = f" (score: {score})" if score is not None else ""
        lines.append(
            f"Q{i}: {item.get('question', '')}\n"
            f"A{i}{score_part}: {item.get('answer', '')}"
        )
    return "\n\n".join(lines) if lines else "(no answers yet - this is the first question)"
