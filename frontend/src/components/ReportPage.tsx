import ScoreDial from "./ScoreDial";
import type { AnswerRecord, FinalReport } from "../types";
import { scoreBadge, scoreLabel } from "./ui";

export default function ReportPage({
  report,
  history,
  onRestart,
}: {
  report: FinalReport;
  history: AnswerRecord[];
  onRestart: () => void;
}) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-8 text-center text-3xl font-bold tracking-tight">
        Interview report
      </h1>

      <div className="flex flex-col items-center gap-8 rounded-2xl border border-white/10 bg-white/[0.03] p-8 sm:flex-row">
        <ScoreDial score={report.overall_score} label="interview score" />
        <div className="flex-1">
          <div className="mb-2 text-sm font-medium text-indigo-300">
            {scoreLabel(report.overall_score)}
          </div>
          <p className="leading-relaxed text-slate-200">{report.verdict}</p>
          <p className="mt-4 rounded-xl border border-white/10 bg-slate-900/50 p-4 text-sm leading-relaxed text-slate-300">
            <span className="font-semibold text-indigo-300">Coach's note: </span>
            {report.recommendation}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] p-6">
          <h2 className="mb-4 font-semibold text-emerald-300">✅ What went well</h2>
          <ul className="space-y-3">
            {report.strengths.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm leading-relaxed text-slate-300">
                <span className="text-emerald-400">•</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-6">
          <h2 className="mb-4 font-semibold text-amber-300">📈 What to improve</h2>
          <ul className="space-y-3">
            {report.improvements.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm leading-relaxed text-slate-300">
                <span className="text-amber-400">•</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="mb-4 font-semibold text-slate-200">Answer-by-answer breakdown</h2>
        <div className="space-y-3">
          {history.map((item, i) => (
            <div
              key={i}
              className="rounded-xl border border-white/10 bg-slate-900/40 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <p className="text-sm font-medium text-slate-200">
                  {i + 1}. {item.question}
                </p>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-bold ${scoreBadge(item.score)}`}
                >
                  {item.score}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-slate-400">{item.answer}</p>
              {item.verdict && (
                <p className="mt-2 text-sm italic text-slate-500">“{item.verdict}”</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 flex justify-center">
        <button
          onClick={onRestart}
          className="rounded-xl bg-indigo-500 px-8 py-3.5 font-semibold text-white transition hover:bg-indigo-400"
        >
          ← Analyze another resume
        </button>
      </div>
    </div>
  );
}
