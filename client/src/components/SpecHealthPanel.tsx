import { CheckCircle, XCircle, AlertCircle, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

function gradeColor(grade: string) {
  switch (grade) {
    case "A": return "text-emerald-400 bg-emerald-400/10 border-emerald-400/30";
    case "B": return "text-blue-400 bg-blue-400/10 border-blue-400/30";
    case "C": return "text-yellow-400 bg-yellow-400/10 border-yellow-400/30";
    case "D": return "text-orange-400 bg-orange-400/10 border-orange-400/30";
    case "F": return "text-red-400 bg-red-400/10 border-red-400/30";
    default: return "text-slate-400 bg-slate-400/10 border-slate-400/30";
  }
}

function scoreBarColor(score: number, maxScore: number) {
  const ratio = score / maxScore;
  if (ratio >= 0.9) return "bg-emerald-500";
  if (ratio >= 0.7) return "bg-blue-500";
  if (ratio >= 0.5) return "bg-yellow-500";
  if (ratio >= 0.3) return "bg-orange-500";
  return "bg-red-500";
}

export function SpecHealthPanel({ specHealth, compact = false }: SpecHealthPanelProps) {
  const failedCount = specHealth.dimensions.filter(d => !d.passed).length;

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
        <div className={`text-2xl font-black w-10 h-10 rounded-lg border flex items-center justify-center ${gradeColor(specHealth.grade)}`}>
          {specHealth.grade}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-200">Spec Health</span>
            <span className="text-xs text-slate-400">{specHealth.score}/100</span>
          </div>
          <p className="text-xs text-slate-400 truncate">{specHealth.summary}</p>
        </div>
        {failedCount > 0 && (
          <Badge variant="outline" className="text-orange-400 border-orange-400/30 text-xs shrink-0">
            {failedCount} issue{failedCount > 1 ? "s" : ""}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-slate-200 text-base font-semibold flex items-center gap-2">
              <span>Spec Health</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-slate-500 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">Bewertet die Vollständigkeit deiner Spec in 6 Dimensionen. Bessere Specs erzeugen präzisere Tests mit weniger TODO_-Platzhaltern.</p>
                </TooltipContent>
              </Tooltip>
            </CardTitle>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-2xl font-black text-slate-100">{specHealth.score}</div>
                <div className="text-xs text-slate-500">/ 100</div>
              </div>
              <div className={`text-3xl font-black w-12 h-12 rounded-xl border-2 flex items-center justify-center ${gradeColor(specHealth.grade)}`}>
                {specHealth.grade}
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-1">{specHealth.summary}</p>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {specHealth.dimensions.map((dim) => (
            <Tooltip key={dim.name}>
              <TooltipTrigger asChild>
                <div className="cursor-help">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      {dim.passed ? (
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                      )}
                      <span className="text-xs font-medium text-slate-300">{dim.label}</span>
                    </div>
                    <span className="text-xs text-slate-500">{dim.score}/{dim.maxScore}</span>
                  </div>
                  <div className="w-full bg-slate-700/50 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${scoreBarColor(dim.score, dim.maxScore)}`}
                      style={{ width: `${(dim.score / dim.maxScore) * 100}%` }}
                    />
                  </div>
                  {dim.detail && (
                    <p className="text-xs text-slate-500 mt-0.5">{dim.detail}</p>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <div className="space-y-1">
                  {!dim.passed && (
                    <div className="flex items-start gap-1.5">
                      <AlertCircle className="h-3 w-3 text-yellow-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-yellow-200">{dim.tip}</p>
                    </div>
                  )}
                  {dim.passed && (
                    <p className="text-xs text-emerald-300">✓ Passed</p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
