import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatScore(score: number | undefined | null): string {
  if (score === undefined || score === null) return "N/A";
  return score.toFixed(1);
}

export function getRiskColorClass(level: string | undefined): string {
  switch (level?.toLowerCase()) {
    case 'low': return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
    case 'medium': return "text-amber-400 bg-amber-400/10 border-amber-400/20";
    case 'high': return "text-orange-400 bg-orange-400/10 border-orange-400/20";
    case 'critical': return "text-rose-400 bg-rose-400/10 border-rose-400/20";
    default: return "text-slate-400 bg-slate-400/10 border-slate-400/20";
  }
}

export function getRiskColorHex(level: string | undefined): string {
  switch (level?.toLowerCase()) {
    case 'low': return "#34d399";
    case 'medium': return "#fbbf24";
    case 'high': return "#fb923c";
    case 'critical': return "#fb7185";
    default: return "#94a3b8";
  }
}
