import { useState } from "react";
import { startInterview } from "../api";
import type { AnalysisResult, InterviewPlan } from "../types";
import ScoreDial from "./ScoreDial";
import { scoreColor, scoreLabel } from "./ui";

const CATEGORY_LABELS: Record<string, string> = {
  skills: "Skills match",
  experience: "Experience match",
  education: "Education match",
  keywords: "Keywords / ATS",
};

export default function ResultsPage({
  analysis,
  onStarted,
}: {
  analysis: AnalysisResult;
  onStarted: (plan: InterviewPlan) => void;
}) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    if (starting) return;
    setStarting(true);
    setError(null);
    try {
      const plan = await startInterview(analysis.resume_text, analysis.jd_text);
      onStarted(plan);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the interview.");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-8 text-center text-3xl font-bold tracking-tight">
        Your match analysis
      </h1>

      {/* Overview */}
      <div className="flex flex-col items-center gap-8 rounded-2xl border border-white/10 bg-white/[0.03] p-8 sm:flex-row">
        <div className="flex flex-col items-center">
          <ScoreDial score={analysis.overall_score} label="overall" />
          <span className="mt-3 text-sm font-medium text-slate-300">
            {scoreLabel(analysis.overall_score)}
          </span>
        </div>
        <div className="flex-1">
          <p className="text-lg leading-relaxed text-slate-200">{analysis.summary}</p>
          <div className="mt-5 space-y-3">
            {Object.entries(analysis.category_scores).map(([key, value]) => (
              <div key={key}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-slate-400">{CATEGORY_LABELS[key] ?? key}</span>
                  <span className="font-semibold" style={{ color: scoreColor(value) }}>
                    {value}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/10">
                  <div
                    className="h-2 rounded-full transition-all duration-700"
                    style={{ width: `${value}%`, background: scoreColor(value) }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Skills */}
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] p-6">
          <h2 className="mb-4 font-semibold text-emerald-300">
            ✅ Skills you match ({analysis.matched_skills.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {analysis.matched_skills.length ? (
              analysis.matched_skills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-sm text-emerald-200"
                >
                  {skill}
                </span>
              ))
            ) : (
              <span className="text-sm text-slate-400">No clear skill overlaps found.</span>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-red-500/25 bg-red-500/[0.06] p-6">
          <h2 className="mb-4 font-semibold text-red-300">
            ⚠️ Missing / weak skills ({analysis.missing_skills.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {analysis.missing_skills.length ? (
              analysis.missing_skills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-full border border-red-500/40 bg-red-500/15 px-3 py-1 text-sm text-red-200"
                >
                  {skill}
                </span>
              ))
            ) : (
              <span className="text-sm text-slate-400">Nothing major missing — nice.</span>
            )}
          </div>
        </div>
      </div>

      {/* Gaps + recommendations */}
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="mb-4 font-semibold text-slate-200">🔍 Gaps vs the JD</h2>
          <ul className="space-y-3">
            {analysis.gaps.length ? (
              analysis.gaps.map((gap, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed text-slate-300">
                  <span className="text-amber-400">•</span>
                  {gap}
                </li>
              ))
            ) : (
              <li className="text-sm text-slate-400">No significant gaps detected.</li>
            )}
          </ul>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="mb-4 font-semibold text-slate-200">💡 How to improve</h2>
          <ul className="space-y-3">
            {analysis.recommendations.length ? (
              analysis.recommendations.map((rec, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed text-slate-300">
                  <span className="text-indigo-400">{i + 1}.</span>
                  {rec}
                </li>
              ))
            ) : (
              <li className="text-sm text-slate-400">No extra recommendations.</li>
            )}
          </ul>
        </div>
      </div>

      {/* CTA */}
      <div className="mt-8 rounded-2xl border border-indigo-500/30 bg-indigo-500/[0.08] p-6 text-center">
        <h2 className="text-xl font-semibold">Ready to prove it out loud?</h2>
        <p className="mt-1 text-sm text-slate-400">
          Get 6 interview questions tailored to this resume and this job — with instant
          feedback on every answer.
        </p>
        {error && (
          <div className="mx-auto mt-4 max-w-xl rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}
        <button
          onClick={handleStart}
          disabled={starting}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-8 py-3.5 font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50"
        >
          {starting ? (
            <>
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              </svg>
              Building your interview…
            </>
          ) : (
            <>🎤 Start AI interview</>
          )}
        </button>
      </div>
    </div>
  );
}
