export interface CategoryScores {
  skills: number;
  experience: number;
  education: number;
  keywords: number;
}

export interface AnalysisResult {
  overall_score: number;
  summary: string;
  category_scores: CategoryScores;
  matched_skills: string[];
  missing_skills: string[];
  gaps: string[];
  recommendations: string[];
  resume_text: string;
  jd_text: string;
}

export interface InterviewPlan {
  role_title: string;
  questions: string[];
}

export interface AnswerFeedback {
  score: number;
  verdict: string;
  strengths: string[];
  improvements: string[];
  followup: string;
}

export interface AnswerRecord {
  question: string;
  answer: string;
  score: number;
  verdict: string;
}

export interface FinalReport {
  overall_score: number;
  verdict: string;
  strengths: string[];
  improvements: string[];
  recommendation: string;
}
