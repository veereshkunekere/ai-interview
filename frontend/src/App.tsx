import { useState } from "react";
import UploadPage from "./components/UploadPage";
import ResultsPage from "./components/ResultsPage";
import InterviewPage from "./components/InterviewPage";
import ReportPage from "./components/ReportPage";
import type {
  AnalysisResult,
  AnswerRecord,
  FinalReport,
  InterviewPlan,
} from "./types";

type Step = "upload" | "results" | "interview" | "report";

const STEPS: { key: Step; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "results", label: "Analysis" },
  { key: "interview", label: "Interview" },
  { key: "report", label: "Report" },
];

export default function App() {
  const [step, setStep] = useState<Step>("upload");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [plan, setPlan] = useState<InterviewPlan | null>(null);
  const [report, setReport] = useState<FinalReport | null>(null);
  const [history, setHistory] = useState<AnswerRecord[]>([]);

  function restart() {
    setStep("upload");
    setAnalysis(null);
    setPlan(null);
    setReport(null);
    setHistory([]);
  }

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/70 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <button
            onClick={restart}
            className="flex items-center gap-2 font-bold tracking-tight"
          >
            <span className="text-xl">🎯</span>
            <span className="text-lg">
              HireSense <span className="text-indigo-400">AI</span>
            </span>
          </button>

          <nav className="hidden items-center gap-1 sm:flex">
            {STEPS.map((s, i) => (
              <div key={s.key} className="flex items-center">
                <div
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                    i === stepIndex
                      ? "bg-indigo-500/20 text-indigo-300"
                      : i < stepIndex
                        ? "text-emerald-400"
                        : "text-slate-500"
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${
                      i === stepIndex
                        ? "bg-indigo-500 text-white"
                        : i < stepIndex
                          ? "bg-emerald-500/30 text-emerald-300"
                          : "bg-white/10 text-slate-500"
                    }`}
                  >
                    {i < stepIndex ? "✓" : i + 1}
                  </span>
                  {s.label}
                </div>
                {i < STEPS.length - 1 && <span className="mx-1 text-slate-700">›</span>}
              </div>
            ))}
          </nav>

          <span className="hidden text-xs text-slate-500 md:block">
            powered by Groq · free tier
          </span>
        </div>
      </header>

      {/* Pages */}
      <main>
        {step === "upload" && (
          <UploadPage
            onAnalyzed={(result) => {
              setAnalysis(result);
              setStep("results");
            }}
          />
        )}

        {step === "results" && analysis && (
          <ResultsPage
            analysis={analysis}
            onStarted={(p) => {
              setPlan(p);
              setStep("interview");
            }}
          />
        )}

        {step === "interview" && analysis && plan && (
          <InterviewPage
            plan={plan}
            resumeText={analysis.resume_text}
            jdText={analysis.jd_text}
            onDone={(finalReport, answers) => {
              setReport(finalReport);
              setHistory(answers);
              setStep("report");
            }}
          />
        )}

        {step === "report" && report && (
          <ReportPage report={report} history={history} onRestart={restart} />
        )}
      </main>
    </div>
  );
}
