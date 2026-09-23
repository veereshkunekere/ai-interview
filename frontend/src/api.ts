import type {
  AnalysisResult,
  AnswerFeedback,
  AnswerRecord,
  FinalReport,
  InterviewPlan,
} from "./types";

const BASE: string =
  (import.meta.env.VITE_API_BASE as string | undefined) ?? "http://127.0.0.1:8000";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText || `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (typeof data.detail === "string") detail = data.detail;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

export async function health(): Promise<{ status: string; groq_key_configured: boolean }> {
  return handle(await fetch(`${BASE}/api/health`));
}

export async function analyze(
  resume: File,
  jdFile: File | null,
  jdText: string,
): Promise<AnalysisResult> {
  const fd = new FormData();
  fd.append("resume", resume);
  if (jdFile) fd.append("jd", jdFile);
  if (jdText.trim()) fd.append("jd_text", jdText);
  return handle(await fetch(`${BASE}/api/analyze`, { method: "POST", body: fd }));
}

export async function startInterview(
  resumeText: string,
  jdText: string,
): Promise<InterviewPlan> {
  return handle(
    await fetch(`${BASE}/api/interview/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resume_text: resumeText, jd_text: jdText }),
    }),
  );
}

export async function evaluateAnswer(payload: {
  resume_text: string;
  jd_text: string;
  question: string;
  answer: string;
  history: AnswerRecord[];
}): Promise<AnswerFeedback> {
  return handle(
    await fetch(`${BASE}/api/interview/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}

export async function finishInterview(
  resumeText: string,
  jdText: string,
  history: AnswerRecord[],
): Promise<FinalReport> {
  return handle(
    await fetch(`${BASE}/api/interview/finish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resume_text: resumeText, jd_text: jdText, history }),
    }),
  );
}

export async function transcribe(audio: Blob, filename: string): Promise<string> {
  const fd = new FormData();
  fd.append("audio", audio, filename);
  const data = await handle<{ text: string }>(
    await fetch(`${BASE}/api/transcribe`, { method: "POST", body: fd }),
  );
  return data.text;
}
