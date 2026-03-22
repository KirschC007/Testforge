import { CheckCircle2, XCircle, AlertCircle, Info, Star } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface SpecHealthDimension {
  name: string;
  label: string;
  passed: boolean;
  score: number;
  maxScore: number;
  tip: string;
  detail?: string;
}

export interface SpecHealth {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  dimensions: SpecHealthDimension[];
  summary: string;
}

interface SpecHealthPanelProps {
  specHealth: SpecHealth;
  compact?: boolean;
}

function gradeColor(grade: string): { text: string; bg: string; border: string } {
  switch (grade) {
    case "A": return { text: "text-[var(--tf-green)]",  bg: "bg-[var(--tf-green)]/10",  border: "border-[var(--tf-green)]/30" };
    case "B": return { text: "text-[var(--tf-blue)]",   bg: "bg-[var(--tf-blue)]/10",   border: "border-[var(--tf-blue)]/30" };
    case "C": return { text: "text-[var(--tf-yellow)]", bg: "bg-[var(--tf-yellow)]/10", border: "border-[var(--tf-yellow)]/30" };
    case "D": return { text: "text-[var(--tf-orange)]", bg: "bg-[var(--tf-orange)]/10", border: "border-[var(--tf-orange)]/30" };
    case "F": return { text: "text-[var(--tf-red)]",    bg: "bg-[var(--tf-red)]/10",    border: "border-[var(--tf-red)]/30" };
    default:  return { text: "text-muted-foreground",   bg: "bg-muted",                 border: "border-border" };
  }
}

function barColor(score: number, maxScore: number): string {
  const ratio = score / maxScore;
  if (ratio >= 0.9) return "var(--tf-green)";
  if (ratio >= 0.7) return "var(--tf-blue)";
  if (ratio >= 0.5) return "var(--tf-yellow)";
  if (ratio >= 0.3) return "var(--tf-orange)";
  return "var(--tf-red)";
}

export function SpecHealthPanel({ specHealth, compact = false }: SpecHealthPanelProps) {
  const failedCount = specHealth.dimensions.filter(d => !d.passed).length;
  const gc = gradeColor(specHealth.grade);

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border">
        <div className={`text-xl font-black w-9 h-9 rounded-lg border flex items-center justify-center ${gc.text} ${gc.bg} ${gc.border}`}>
          {specHealth.grade}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Spec Health</span>
            <span className="text-xs text-muted-foreground">{specHealth.score}/100</span>
          </div>
          <p className="text-xs text-muted-foreground truncate">{specHealth.summary}</p>
        </div>
        {failedCount > 0 && (
          <span className="text-xs text-[var(--tf-orange)] border border-[var(--tf-orange)]/30 px-2 py-0.5 rounded shrink-0">
            {failedCount} issue{failedCount > 1 ? "s" : ""}
          </span>
        )}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-[var(--tf-yellow)]" />
              <h3 className="font-semibold text-sm">Spec Health Score</h3>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">Bewertet die Vollständigkeit deiner Spec in 6 Dimensionen. Bessere Specs erzeugen präzisere Tests mit typisierten Payloads statt TODO_-Platzhaltern.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-2xl font-bold font-mono">{specHealth.score}</div>
                <div className="text-xs text-muted-foreground">/ 100 pts</div>
              </div>
              <div className={`text-2xl font-black w-11 h-11 rounded-xl border-2 flex items-center justify-center font-mono ${gc.text} ${gc.bg} ${gc.border}`}>
                {specHealth.grade}
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">{specHealth.summary}</p>
        </div>

        {/* Dimensions */}
        <div className="p-5 space-y-3">
          {specHealth.dimensions.map((dim) => (
            <Tooltip key={dim.name}>
              <TooltipTrigger asChild>
                <div className="cursor-help">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      {dim.passed
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-[var(--tf-green)] shrink-0" />
                        : <XCircle className="w-3.5 h-3.5 text-[var(--tf-red)] shrink-0" />
                      }
                      <span className="text-xs font-medium">{dim.label}</span>
                    </div>
                    <span className="text-xs font-mono text-muted-foreground">{dim.score}/{dim.maxScore}pts</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{
                        width: `${(dim.score / dim.maxScore) * 100}%`,
                        background: barColor(dim.score, dim.maxScore),
                      }}
                    />
                  </div>
                  {dim.detail && (
                    <p className="text-xs text-muted-foreground mt-0.5">{dim.detail}</p>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                {!dim.passed ? (
                  <div className="flex items-start gap-1.5">
                    <AlertCircle className="w-3 h-3 text-[var(--tf-yellow)] shrink-0 mt-0.5" />
                    <p className="text-xs">{dim.tip}</p>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--tf-green)]">✓ Passed — {dim.tip}</p>
                )}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* Footer tip */}
        {failedCount > 0 && (
          <div className="px-5 py-3 border-t border-border bg-[var(--tf-orange)]/5">
            <p className="text-xs text-muted-foreground">
              <span className="text-[var(--tf-orange)] font-medium">{failedCount} dimension{failedCount > 1 ? "s" : ""} can be improved</span>
              {" "}— hover each bar for specific tips on how to improve your spec.
            </p>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
