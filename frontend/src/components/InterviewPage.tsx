import { useEffect, useRef, useState } from "react";
import { evaluateAnswer, finishInterview, transcribe } from "../api";
import type { AnswerRecord, FinalReport, InterviewPlan } from "../types";
import { scoreBadge } from "./ui";

type Msg =
  | { role: "ai"; text: string }
  | { role: "user"; text: string }
  | {
      role: "feedback";
      score: number;
      verdict: string;
      strengths: string[];
      improvements: string[];
    };

type BusyState = null | "eval" | "finish";

const hasDictation =
  typeof window !== "undefined" &&
  Boolean(
    (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition,
  );

export default function InterviewPage({
  plan,
  resumeText,
  jdText,
  onDone,
}: {
  plan: InterviewPlan;
  resumeText: string;
  jdText: string;
  onDone: (report: FinalReport, history: AnswerRecord[]) => void;
}) {
  const [questions, setQuestions] = useState<string[]>(plan.questions);
  const [qIndex, setQIndex] = useState(0);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "ai", text: plan.questions[0] },
  ]);
  const [answer, setAnswer] = useState("");
  const [history, setHistory] = useState<AnswerRecord[]>([]);
  const [busy, setBusy] = useState<BusyState>(null);
  const [error, setError] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [speakOn, setSpeakOn] = useState(true);
  const [listening, setListening] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  const recognitionRef = useRef<any>(null);
  const liveRef = useRef("");
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const logRef = useRef<HTMLDivElement | null>(null);

  const plannedCount = plan.questions.length;
  const answeredCount = Math.min(history.length, plannedCount);

  /* ---------- speech output ---------- */
  function speak(text: string) {
    if (!speakOn || typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => speak(plan.questions[0]), 300);
    return () => {
      window.clearTimeout(timer);
      window.speechSynthesis?.cancel();
      recognitionRef.current?.stop?.();
      if (mediaRef.current && mediaRef.current.state === "recording") {
        mediaRef.current.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  /* ---------- browser dictation (Chrome) ---------- */
  function toggleDictation() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const Ctor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.continuous = true;
    liveRef.current = answer;
    rec.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const piece = event.results[i][0].transcript.trim();
          if (piece) {
            liveRef.current = `${liveRef.current} ${piece}`.trim();
            setAnswer(liveRef.current);
          }
        }
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => {
      setListening(false);
      setVoiceError("Microphone access failed. Check browser permissions.");
    };
    rec.start();
    recognitionRef.current = rec;
    setListening(true);
    setVoiceError(null);
  }

  /* ---------- fallback: record + Groq Whisper ---------- */
  async function toggleRecording() {
    if (recording) {
      mediaRef.current?.stop();
      return;
    }
    if (transcribing) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/ogg")
          ? "audio/ogg"
          : "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
        if (blob.size === 0) return;
        setTranscribing(true);
        setVoiceError(null);
        try {
          const text = await transcribe(blob, `recording.${mimeType.includes("ogg") ? "ogg" : "webm"}`);
          if (text) setAnswer((prev) => (prev ? `${prev} ${text}` : text));
        } catch (e) {
          setVoiceError(
            e instanceof Error ? e.message : "Transcription failed — type your answer instead.",
          );
        } finally {
          setTranscribing(false);
        }
      };
      recorder.start();
      mediaRef.current = recorder;
      setRecording(true);
      setVoiceError(null);
    } catch {
      setVoiceError("Microphone access denied. Please allow the mic or type your answer.");
    }
  }

  function toggleVoice() {
    if (hasDictation) toggleDictation();
    else void toggleRecording();
  }

  /* ---------- submit answer ---------- */
  async function submit() {
    const text = answer.trim();
    if (!text || busy) return;
    const question = questions[qIndex];

    recognitionRef.current?.stop();
    setListening(false);
    window.speechSynthesis?.cancel();

    setMessages((m) => [...m, { role: "user", text }]);
    setAnswer("");
    setVoiceError(null);
    setBusy("eval");

    try {
      const feedback = await evaluateAnswer({
        resume_text: resumeText,
        jd_text: jdText,
        question,
        answer: text,
        history,
      });

      const updatedHistory: AnswerRecord[] = [
        ...history,
        { question, answer: text, score: feedback.score, verdict: feedback.verdict },
      ];
      setHistory(updatedHistory);
      setMessages((m) => [
        ...m,
        {
          role: "feedback",
          score: feedback.score,
          verdict: feedback.verdict,
          strengths: feedback.strengths,
          improvements: feedback.improvements,
        },
      ]);

      let queue = questions;
      const followup = feedback.followup.trim();
      if (followup) {
        queue = [
          ...questions.slice(0, qIndex + 1),
          followup,
          ...questions.slice(qIndex + 1),
        ];
        setQuestions(queue);
      }

      const nextIdx = qIndex + 1;
      if (nextIdx < queue.length) {
        setQIndex(nextIdx);
        setMessages((m) => [...m, { role: "ai", text: queue[nextIdx] }]);
        speak(queue[nextIdx]);
        setBusy(null);
      } else {
        setBusy("finish");
        const report = await finishInterview(resumeText, jdText, updatedHistory);
        onDone(report, updatedHistory);
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? `${e.message} — your answer is still here, please try again.`
          : "Something went wrong — please try again.",
      );
      setAnswer(text);
      setBusy(null);
    }
  }

  async function endEarly() {
    if (!history.length || busy) return;
    setError(null);
    setBusy("finish");
    try {
      const report = await finishInterview(resumeText, jdText, history);
      onDone(report, history);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not finish the interview.");
      setBusy(null);
    }
  }

  const voiceActive = listening || recording || transcribing;
  const voiceLabel = transcribing
    ? "Transcribing…"
    : listening
      ? "Listening… click to stop"
      : recording
        ? "Recording… click to stop"
        : hasDictation
          ? "🎤 Answer with voice"
          : "🎙️ Record answer";

  return (
    <div className="mx-auto flex h-[calc(100vh-64px)] max-w-3xl flex-col px-4 py-6">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold">{plan.role_title}</h1>
            <p className="text-xs text-slate-400">
              AI mock interview · question {Math.min(qIndex + 1, questions.length)} of{" "}
              {plannedCount}
              {history.length > plannedCount ? ` (+${history.length - plannedCount} follow-ups)` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                window.speechSynthesis?.cancel();
                setSpeakOn((v) => !v);
              }}
              title={speakOn ? "Mute spoken questions" : "Read questions aloud"}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                speakOn
                  ? "border-indigo-400/50 bg-indigo-500/15 text-indigo-200"
                  : "border-white/10 bg-white/5 text-slate-400 hover:text-slate-200"
              }`}
            >
              {speakOn ? "🔊 Voice on" : "🔇 Voice off"}
            </button>
            <button
              onClick={endEarly}
              disabled={busy !== null || history.length === 0}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-400 transition hover:text-slate-200 disabled:opacity-40"
            >
              End & get report
            </button>
          </div>
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-white/10">
          <div
            className="h-1.5 rounded-full bg-indigo-500 transition-all duration-500"
            style={{ width: `${(answeredCount / plannedCount) * 100}%` }}
          />
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          {error}
        </div>
      )}
      {voiceError && (
        <div className="mb-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-300">
          {voiceError}
        </div>
      )}

      {/* Chat log */}
      <div ref={logRef} className="flex-1 space-y-4 overflow-y-auto pb-4 pr-1">
        {messages.map((m, i) => {
          if (m.role === "ai") {
            return (
              <div key={i} className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-sm">
                  🤖
                </div>
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-indigo-400/30 bg-indigo-500/10 px-4 py-3 text-[15px] leading-relaxed text-slate-100">
                  {m.text}
                </div>
              </div>
            );
          }
          if (m.role === "user") {
            return (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm border border-white/10 bg-white/10 px-4 py-3 text-[15px] leading-relaxed text-slate-200">
                  {m.text}
                </div>
              </div>
            );
          }
          return (
            <div key={i} className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-sm">
                📝
              </div>
              <div className="max-w-[90%] flex-1 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                <div className="mb-2 flex items-center gap-3">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${scoreBadge(m.score)}`}
                  >
                    {m.score}/100
                  </span>
                  <span className="text-sm text-slate-300">{m.verdict}</span>
                </div>
                {m.strengths.length > 0 && (
                  <ul className="mb-1 space-y-1">
                    {m.strengths.map((s, j) => (
                      <li key={j} className="text-sm text-emerald-300/90">
                        ✅ {s}
                      </li>
                    ))}
                  </ul>
                )}
                {m.improvements.length > 0 && (
                  <ul className="space-y-1">
                    {m.improvements.map((s, j) => (
                      <li key={j} className="text-sm text-amber-300/90">
                        💡 {s}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          );
        })}

        {busy === "eval" && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-sm">
              🤖
            </div>
            <div className="flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400 [animation-delay:-0.2s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400 [animation-delay:-0.1s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400" />
              <span className="ml-1 text-xs text-slate-400">evaluating your answer…</span>
            </div>
          </div>
        )}
        {busy === "finish" && (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-400">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
              <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            </svg>
            writing your final interview report…
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void submit();
            }
          }}
          disabled={busy !== null}
          rows={3}
          placeholder="Type your answer… (Ctrl+Enter to send)"
          className="w-full resize-none bg-transparent px-2 py-2 text-[15px] text-slate-200 placeholder:text-slate-500 focus:outline-none disabled:opacity-60"
        />
        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            onClick={toggleVoice}
            disabled={busy !== null || transcribing}
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${
              voiceActive
                ? "border-red-400/60 bg-red-500/15 text-red-300"
                : "border-white/15 bg-white/5 text-slate-300 hover:border-indigo-400/60 hover:text-indigo-200"
            }`}
          >
            {voiceActive && !transcribing && (
              <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-red-400" />
            )}
            {voiceLabel}
          </button>
          <button
            onClick={() => void submit()}
            disabled={!answer.trim() || busy !== null}
            className="rounded-xl bg-indigo-500 px-6 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy === "eval" ? "Evaluating…" : "Submit answer →"}
          </button>
        </div>
        {!hasDictation && (
          <p className="px-2 pt-2 text-[11px] text-slate-500">
            Live browser dictation isn't available here — your recording is transcribed by
            AI instead.
          </p>
        )}
      </div>
    </div>
  );
}
