import { useState } from "react";
import { analyze } from "../api";
import type { AnalysisResult } from "../types";

const ACCEPT = ".pdf,.docx,.txt,.md";
const MAX_SIZE = 5 * 1024 * 1024;

export default function UploadPage({
  onAnalyzed,
}: {
  onAnalyzed: (result: AnalysisResult) => void;
}) {
  const [resume, setResume] = useState<File | null>(null);
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [jdText, setJdText] = useState("");
  const [jdMode, setJdMode] = useState<"text" | "file">("text");
  const [dragging, setDragging] = useState<"resume" | "jd" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validate(file: File | undefined | null): File | null {
    if (!file) return null;
    if (file.size > MAX_SIZE) {
      setError("File too large — maximum size is 5 MB.");
      return null;
    }
    if (!/\.(pdf|docx|txt|md)$/i.test(file.name)) {
      setError("Unsupported format — please use PDF, DOCX, or TXT.");
      return null;
    }
    setError(null);
    return file;
  }

  const ready =
    Boolean(resume) &&
    (jdMode === "text" ? jdText.trim().length > 10 : Boolean(jdFile)) &&
    !loading;

  async function handleSubmit() {
    if (!resume || !ready) return;
    setLoading(true);
    setError(null);
    try {
      const result = await analyze(
        resume,
        jdMode === "file" ? jdFile : null,
        jdMode === "text" ? jdText : "",
      );
      onAnalyzed(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Does your resume fit this job?
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-slate-400">
          Upload your resume and a job description to get an instant AI match score with
          gap analysis — then practice with an AI interviewer built for that exact role.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Resume dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging("resume");
          }}
          onDragLeave={() => setDragging(null)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(null);
            const file = validate(e.dataTransfer.files?.[0]);
            if (file) setResume(file);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition ${
            dragging === "resume"
              ? "border-indigo-400 bg-indigo-500/10"
              : resume
                ? "border-emerald-500/50 bg-emerald-500/5"
                : "border-white/15 bg-white/[0.03] hover:border-indigo-400/60 hover:bg-white/[0.05]"
          }`}
          onClick={() => document.getElementById("resume-input")?.click()}
        >
          <input
            id="resume-input"
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              const file = validate(e.target.files?.[0]);
              if (file) setResume(file);
            }}
          />
          <div className="mb-3 text-4xl">{resume ? "✅" : "📄"}</div>
          <div className="font-semibold">
            {resume ? resume.name : "Drop your resume here"}
          </div>
          <div className="mt-1 text-sm text-slate-400">
            {resume
              ? `${(resume.size / 1024).toFixed(0)} KB · click to change`
              : "or click to browse · PDF, DOCX, TXT · max 5 MB"}
          </div>
        </div>

        {/* Job description */}
        <div className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-semibold">Job description</span>
            <div className="flex rounded-lg bg-white/5 p-0.5 text-xs">
              <button
                onClick={() => setJdMode("text")}
                className={`rounded-md px-3 py-1 transition ${jdMode === "text" ? "bg-indigo-500 text-white" : "text-slate-400 hover:text-slate-200"}`}
              >
                Paste
              </button>
              <button
                onClick={() => setJdMode("file")}
                className={`rounded-md px-3 py-1 transition ${jdMode === "file" ? "bg-indigo-500 text-white" : "text-slate-400 hover:text-slate-200"}`}
              >
                Upload
              </button>
            </div>
          </div>

          {jdMode === "text" ? (
            <textarea
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              placeholder="Paste the job description here (responsibilities, required skills, qualifications)…"
              className="min-h-[200px] flex-1 resize-none rounded-xl border border-white/10 bg-slate-900/60 px-3 py-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
            />
          ) : (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging("jd");
              }}
              onDragLeave={() => setDragging(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(null);
                const file = validate(e.dataTransfer.files?.[0]);
                if (file) setJdFile(file);
              }}
              onClick={() => document.getElementById("jd-input")?.click()}
              className={`flex min-h-[200px] flex-1 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition ${
                dragging === "jd"
                  ? "border-indigo-400 bg-indigo-500/10"
                  : jdFile
                    ? "border-emerald-500/50 bg-emerald-500/5"
                    : "border-white/15 hover:border-indigo-400/60"
              }`}
            >
              <input
                id="jd-input"
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => {
                  const file = validate(e.target.files?.[0]);
                  if (file) setJdFile(file);
                }}
              />
              <div className="mb-2 text-3xl">{jdFile ? "✅" : "🧾"}</div>
              <div className="text-sm font-medium">
                {jdFile ? jdFile.name : "Drop the JD file or click to browse"}
              </div>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={!ready}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-6 py-4 text-base font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? (
          <>
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
              <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            </svg>
            Analyzing resume vs job description…
          </>
        ) : (
          <>Analyze my match →</>
        )}
      </button>
      {loading && (
        <p className="mt-3 text-center text-sm text-slate-400">
          This usually takes 5–15 seconds.
        </p>
      )}
    </div>
  );
}
