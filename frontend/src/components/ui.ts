/** Shared visual helpers. */

export function scoreColor(score: number): string {
  if (score >= 75) return "#34d399"; // emerald-400
  if (score >= 50) return "#fbbf24"; // amber-400
  return "#f87171"; // red-400
}

export function scoreLabel(score: number): string {
  if (score >= 85) return "Excellent match";
  if (score >= 75) return "Strong match";
  if (score >= 60) return "Good, with gaps";
  if (score >= 45) return "Partial match";
  return "Weak match";
}

export function scoreBadge(score: number): string {
  if (score >= 75) return "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";
  if (score >= 50) return "bg-amber-500/15 text-amber-300 border-amber-500/40";
  return "bg-red-500/15 text-red-300 border-red-500/40";
}
