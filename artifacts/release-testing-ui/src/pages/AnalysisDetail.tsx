import { useRoute } from "wouter";
import { useGetAnalysis, useSubmitTestCaseFeedback, getGetAnalysisQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Gauge } from "@/components/Gauge";
import { formatScore, cn } from "@/lib/utils";
import { format } from "date-fns";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import {
  Loader2, AlertTriangle, FileCode2, CheckCircle2,
  XCircle, ThumbsUp, ThumbsDown, GitMerge, Beaker,
  Zap, ShieldAlert, BarChart3, Bug, Link2, Download, Printer, Info
} from "lucide-react";
import { useState, useEffect } from "react";
import { useQueryClient, type Query } from "@tanstack/react-query";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ─── Types ─────────────────────────────────────────────────────────────

interface PredictedFailure {
  issue: string;
  reason: string;
  affected_module: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
}

interface RiskBreakdown {
  changeSize: number;
  criticalModule: number;
  concurrencyRisk: number;
  validationMissing: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: "text-rose-400 bg-rose-500/10 border-rose-500/30",
  HIGH: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  MEDIUM: "text-sky-400 bg-sky-500/10 border-sky-500/30",
};

const SEVERITY_DOT: Record<string, string> = {
  CRITICAL: "bg-rose-500",
  HIGH: "bg-amber-500",
  MEDIUM: "bg-sky-500",
};

const SEVERITY_TOOLTIP: Record<string, string> = {
  CRITICAL: "Will likely cause data corruption, financial loss, or security breach in production. Must be fixed before release.",
  HIGH: "High probability of user-facing failure or data inconsistency. Strongly recommended to fix before release.",
  MEDIUM: "May surface under edge-case conditions. Plan a fix in the next sprint.",
};

const BREAKDOWN_TOOLTIP: Record<string, string> = {
  changeSize: "Weighted 35% — measures total lines added/deleted. High churn means more surface area for bugs to hide.",
  criticalModule: "Weighted 25% — payment, auth, or security modules carry 3–4× more business risk than general code.",
  concurrencyRisk: "Weighted 20% — async/await, Promise.all, and transactions without atomicity guarantees are a top source of production incidents.",
  validationMissing: "Weighted 20% — absence of input validation in changed code means malformed data can propagate silently.",
};

// ─── Page ─────────────────────────────────────────────────────────────────

// Progress steps mapping
const STATUS_STEPS = [
  { status: "parsing", label: "Parsing Git Diff", description: "Extracting files, functions, and code changes" },
  { status: "analyzing_risk", label: "Analyzing Risk", description: "Calculating risk score based on code metrics" },
  { status: "predicting_failures", label: "Predicting Failures", description: "AI identifying potential failure scenarios" },
  { status: "generating_tests", label: "Generating Tests", description: "Creating test cases linked to failures" },
];

export default function AnalysisDetail() {
  const [, params] = useRoute("/analyses/:id");
  const id = params?.id ? parseInt(params.id) : 0;

  const { data: analysis, isLoading, error, refetch } = useGetAnalysis(id, {
    query: { 
      enabled: !!id,
      refetchInterval: (query) => {
        const data = (query as any).state?.data;
        if (!data) return 1000;
        // Poll while processing, stop when completed or failed
        return data.status === "processing" || 
               data.status === "parsing" || 
               data.status === "analyzing_risk" || 
               data.status === "predicting_failures" || 
               data.status === "generating_tests" 
          ? 2000 
          : false;
      }
    }
  });

  // Show progress UI while analysis is processing
  const isProcessing = analysis?.status && [
    "pending", "processing", "parsing", "analyzing_risk", "predicting_failures", "generating_tests"
  ].includes(analysis.status);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
          <p className="text-muted-foreground font-medium animate-pulse">Loading analysis...</p>
        </div>
      </Layout>
    );
  }

  // Show progress UI while analysis is in progress
  if (isProcessing && analysis?.status !== "completed" && analysis?.status !== "failed") {
    const currentStepIndex = STATUS_STEPS.findIndex(s => s.status === analysis.status);
    const isPending = analysis.status === "pending" || analysis.status === "processing";
    
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
          <div className="max-w-md w-full">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-8"
            >
              <Loader2 className="w-16 h-16 text-primary animate-spin mx-auto mb-4" />
              <h2 className="text-2xl font-display font-bold text-white mb-2">Analyzing Code Changes</h2>
              <p className="text-muted-foreground">Please wait while our AI processes your analysis...</p>
            </motion.div>

            {/* Progress Steps */}
            <div className="space-y-3">
              {STATUS_STEPS.map((step, index) => {
                const isCompleted = currentStepIndex > index || analysis.status === "completed";
                const isCurrent = currentStepIndex === index;
                
                return (
                  <motion.div
                    key={step.status}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-xl border transition-all",
                      isCompleted ? "bg-emerald-500/10 border-emerald-500/30" :
                      isCurrent ? "bg-primary/10 border-primary/50 animate-pulse" :
                      "bg-secondary/50 border-border opacity-50"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                      isCompleted ? "bg-emerald-500 text-white" :
                      isCurrent ? "bg-primary text-white animate-pulse" :
                      "bg-secondary text-muted-foreground"
                    )}>
                      {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : 
                       isCurrent ? <Loader2 className="w-5 h-5 animate-spin" /> :
                       <span className="text-sm font-bold">{index + 1}</span>}
                    </div>
                    <div className="flex-1">
                      <div className={cn(
                        "font-semibold",
                        isCurrent ? "text-white" : "text-muted-foreground"
                      )}>
                        {step.label}
                      </div>
                      <div className="text-xs text-muted-foreground">{step.description}</div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Current status */}
            {currentStepIndex >= 0 && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-6 text-center"
              >
                <p className="text-sm text-muted-foreground">
                  Step {currentStepIndex + 1} of {STATUS_STEPS.length} • {STATUS_STEPS[currentStepIndex].label}
                </p>
              </motion.div>
            )}
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !analysis) {
    return (
      <Layout>
        <div className="p-6 bg-destructive/10 text-destructive rounded-xl border border-destructive/20 text-center">
          <AlertTriangle className="w-10 h-10 mx-auto mb-2" />
          <h2 className="text-xl font-bold">Analysis Not Found</h2>
          <p className="mt-2">The requested analysis report could not be loaded.</p>
        </div>
      </Layout>
    );
  }

  const { riskScore, testCases } = analysis;
  const failures: PredictedFailure[] = (riskScore as any)?.predictedFailures ?? [];
  const breakdown: RiskBreakdown | null = (riskScore as any)?.riskBreakdown ?? null;

  const isHighRisk = riskScore && riskScore.score >= 60;
  const coverageBefore = Math.max(10, Math.round(50 - (riskScore?.testCoverageSignal ?? 50) * 0.4));
  const coverageAfter = Math.min(95, coverageBefore + Math.round((testCases?.length ?? 0) * 4.2));

  const handleExportJSON = () => {
    const exportData = {
      id: analysis.id,
      title: analysis.title,
      createdAt: analysis.createdAt,
      riskScore: {
        score: riskScore?.score,
        level: riskScore?.level,
        recommendation: isHighRisk ? "DO NOT RELEASE" : "SAFE TO RELEASE",
        explanation: riskScore?.explanation,
        factors: riskScore?.factors,
        filesChanged: riskScore?.filesChanged,
        codeChurn: riskScore?.codeChurn,
        complexity: riskScore?.complexity,
        riskBreakdown: breakdown,
        impactedModules: riskScore?.impactedModules,
      },
      predictedFailures: failures,
      testCases: testCases?.map(tc => ({
        title: tc.title,
        priority: tc.priority,
        type: tc.type,
        linkedIssue: (tc as any).linkedIssue,
        steps: tc.steps,
        expectedResult: tc.expectedResult,
      })),
      coverage: { before: `${coverageBefore}%`, after: `${coverageAfter}%`, gain: `+${coverageAfter - coverageBefore}%` },
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analysis-${analysis.id}-${analysis.title.replace(/\s+/g, "-").toLowerCase().slice(0, 40)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => window.print();

  return (
    <TooltipProvider delayDuration={150}>
      <Layout>
        <div className="space-y-8 max-w-5xl mx-auto print:space-y-6">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2 font-mono">
                  <span className="text-primary">ANL-{analysis.id}</span>
                  <span>/</span>
                  <span>{format(new Date(analysis.createdAt), "MMMM d, yyyy HH:mm")}</span>
                </div>
                <h1 className="text-3xl md:text-4xl font-display font-bold text-white leading-tight">
                  {analysis.title}
                </h1>
              </div>

              {/* Export Controls */}
              <div className="flex items-center gap-2 shrink-0 print:hidden">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleExportJSON}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary border border-border text-sm font-semibold text-white hover:bg-secondary/80 transition-all"
                    >
                      <Download className="w-4 h-4 text-primary" />
                      Export JSON
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[200px]">
                    Download full analysis as structured JSON — include risk score, failures, and all test cases
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handlePrint}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary border border-border text-sm font-semibold text-white hover:bg-secondary/80 transition-all"
                    >
                      <Printer className="w-4 h-4 text-muted-foreground" />
                      PDF
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Print or save as PDF for judges / stakeholders
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </motion.div>

          {/* ── SECTION 1: RELEASE RISK ─────────────────────────── */}
          {riskScore && (
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 }}>
              <SectionLabel icon={ShieldAlert} label="Section 1 — Release Risk" />
              <div className="glass rounded-2xl overflow-hidden border border-white/5">
                <div className={cn(
                  "flex flex-col sm:flex-row items-center justify-between gap-6 p-6 border-b border-white/5",
                  isHighRisk ? "bg-rose-500/5" : "bg-emerald-500/5"
                )}>
                  <div className="flex items-center gap-6">
                    <Gauge value={riskScore.score} level={riskScore.level} size={100} />
                    <div>
                      <div className="text-4xl font-display font-black text-white">
                        {riskScore.score}<span className="text-xl text-muted-foreground font-normal">/100</span>
                      </div>
                      <div className={cn(
                        "mt-1 text-sm font-bold uppercase tracking-widest",
                        riskScore.level === "critical" || riskScore.level === "high" ? "text-rose-400" :
                        riskScore.level === "medium" ? "text-amber-400" : "text-emerald-400"
                      )}>
                        🚨 RELEASE RISK: {riskScore.level.toUpperCase()}
                      </div>
                    </div>
                  </div>
                  <div className={cn(
                    "flex items-center gap-3 px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider border",
                    isHighRisk
                      ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                      : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  )}>
                    {isHighRisk ? <XCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                    {isHighRisk ? "❌ DO NOT RELEASE" : "✅ SAFE TO RELEASE"}
                  </div>
                </div>
                <div className="p-6">
                  <p className="text-muted-foreground leading-relaxed">{riskScore.explanation}</p>
                  {riskScore.factors && riskScore.factors.length > 0 && (
                    <ul className="mt-4 space-y-1.5">
                      {riskScore.factors.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <span className="text-amber-500 mt-0.5 shrink-0">•</span> {f}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── SECTION 2: WHAT WILL BREAK ─────────────────────── */}
          {failures.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <SectionLabel icon={Bug} label="Section 2 — What Will Break" />
              <div className="glass rounded-2xl border border-white/5 overflow-hidden">
                <div className="px-6 pt-5 pb-3 border-b border-white/5 bg-rose-500/5">
                  <h2 className="text-xl font-display font-bold text-white">Predicted Failure Scenarios</h2>
                  <p className="text-sm text-muted-foreground mt-1">AI-identified issues specific to this code change — hover severity badges for details</p>
                </div>
                <div className="divide-y divide-white/5">
                  {failures.map((f, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.06 }}
                      className="p-5 flex gap-4 hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="shrink-0 flex flex-col items-center gap-1 pt-1">
                        <div className="w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center text-xs font-bold text-muted-foreground">
                          {i + 1}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="font-bold text-white">{f.issue}</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-xs font-bold uppercase border cursor-help",
                                SEVERITY_COLOR[f.severity] ?? "text-slate-400"
                              )}>
                                <span className={cn("inline-block w-1.5 h-1.5 rounded-full mr-1.5", SEVERITY_DOT[f.severity])} />
                                {f.severity}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[280px] text-xs leading-relaxed">
                              {SEVERITY_TOOLTIP[f.severity]}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          → {f.reason}
                        </p>
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                          <FileCode2 className="w-3 h-3" />
                          {f.affected_module}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── SECTION 3: IMPACT ──────────────────────────────── */}
          {riskScore && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <SectionLabel icon={GitMerge} label="Section 3 — Impact Analysis" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard label="Files Changed" value={riskScore.filesChanged} icon={FileCode2} tooltip="Total number of source files modified in this change" />
                <StatCard label="Code Churn" value={`${riskScore.codeChurn} lines`} icon={GitMerge} tooltip="Total lines added + deleted. High churn = more blast radius" />
                <StatCard label="Complexity" value={formatScore(riskScore.complexity)} icon={BarChart3} tooltip="Derived from churn depth and file spread — higher = harder to reason about" />
                <StatCard label="Confidence" value={`${Math.round(riskScore.confidence * 100)}%`} icon={Zap} tooltip="Model confidence based on available signals — auth/payment modules, churn size, and dependency changes" />
              </div>
              {riskScore.impactedModules && riskScore.impactedModules.length > 0 && (
                <div className="mt-4 glass rounded-2xl p-5 border border-white/5">
                  <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                    Functions / Modules Affected
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {riskScore.impactedModules.map((mod, i) => (
                      <span key={i} className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-sm font-mono text-white flex items-center gap-2 shadow-sm">
                        <FileCode2 className="w-3 h-3 text-primary" /> {mod}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ── SECTION 4: TEST CASES ──────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <SectionLabel icon={Beaker} label="Section 4 — Test Cases" />
            {testCases && testCases.length > 0 ? (
              <div className="space-y-4">
                {testCases.map((tc, index) => (
                  <TestCaseCard key={tc.id} tc={tc} index={index} />
                ))}
              </div>
            ) : (
              <div className="p-12 text-center border border-dashed border-border/50 rounded-2xl">
                <p className="text-muted-foreground">No test cases generated yet.</p>
              </div>
            )}
          </motion.div>

          {/* ── SECTION 5: COVERAGE ────────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <SectionLabel icon={BarChart3} label="Section 5 — Coverage Estimate" />
            <div className="glass rounded-2xl p-6 border border-white/5">
              <div className="flex flex-col sm:flex-row items-center gap-8">
                <CoverageBar label="Before" value={coverageBefore} color="bg-rose-500" />
                <div className="text-3xl font-display font-bold text-white shrink-0">→</div>
                <CoverageBar label="After" value={coverageAfter} color="bg-emerald-500" delay={0.4} />
                <div className="text-center">
                  <div className="text-2xl font-display font-black text-emerald-400">
                    +{coverageAfter - coverageBefore}%
                  </div>
                  <div className="text-xs text-muted-foreground uppercase tracking-widest mt-1">gain</div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4 text-center">
                Estimated coverage based on {testCases?.length ?? 0} generated test cases mapped to predicted failures
              </p>
            </div>
          </motion.div>

          {/* ── SECTION 6: RISK BREAKDOWN ──────────────────────── */}
          {breakdown && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <SectionLabel icon={Zap} label="Section 6 — Risk Breakdown (Explainability)" />
              <div className="glass rounded-2xl p-6 border border-white/5">
                <p className="text-xs text-muted-foreground mb-5">
                  Hover each factor to understand how it contributes to the final score
                </p>
                <div className="space-y-5">
                  <BreakdownRow label="Code Churn (35%)" value={breakdown.changeSize} maxVal={35} color="bg-amber-500" tooltipKey="changeSize" />
                  <BreakdownRow label="Critical Module (25%)" value={breakdown.criticalModule} maxVal={25} color="bg-rose-500" tooltipKey="criticalModule" />
                  <BreakdownRow label="Concurrency Risk (20%)" value={breakdown.concurrencyRisk} maxVal={20} color="bg-violet-500" tooltipKey="concurrencyRisk" />
                  <BreakdownRow label="Missing Validation (20%)" value={breakdown.validationMissing} maxVal={20} color="bg-sky-500" tooltipKey="validationMissing" />
                </div>
                <div className="mt-6 pt-5 border-t border-white/5 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground font-mono">Final Score</span>
                  <span className="text-2xl font-display font-black text-white">
                    {breakdown.changeSize + breakdown.criticalModule + breakdown.concurrencyRisk + breakdown.validationMissing}
                    <span className="text-base font-normal text-muted-foreground">/100</span>
                  </span>
                </div>
              </div>
            </motion.div>
          )}

        </div>
      </Layout>
    </TooltipProvider>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionLabel({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-primary" />
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tooltip }: { label: string; value: any; icon: any; tooltip: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="glass rounded-xl p-4 border border-white/5 cursor-help hover:border-white/10 transition-colors">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
            <Icon className="w-3.5 h-3.5" /> {label}
            <Info className="w-3 h-3 ml-auto opacity-40" />
          </div>
          <div className="text-xl font-display font-bold text-white">{value}</div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[220px] text-xs leading-relaxed">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

function CountUp({ target, delay = 0 }: { target: number; delay?: number }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, v => Math.round(v));
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const controls = animate(count, target, { duration: 1.2, ease: "easeOut" });
      return controls.stop;
    }, delay * 1000);
    return () => clearTimeout(timeout);
  }, [target]);

  useEffect(() => {
    return rounded.on("change", v => setDisplay(v));
  }, []);

  return <span>{display}</span>;
}

function CoverageBar({ label, value, color, delay = 0 }: { label: string; value: number; color: string; delay?: number }) {
  return (
    <div className="flex-1 min-w-[140px]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground uppercase tracking-widest">{label}</span>
        <span className="text-2xl font-display font-black text-white">
          <CountUp target={value} delay={delay} />%
        </span>
      </div>
      <div className="h-3 bg-secondary rounded-full overflow-hidden">
        <motion.div
          className={cn("h-full rounded-full", color)}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1.2, delay, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function BreakdownRow({ label, value, maxVal, color, tooltipKey }: {
  label: string; value: number; maxVal: number; color: string; tooltipKey: string;
}) {
  const pct = Math.round((value / maxVal) * 100);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="cursor-help group">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-muted-foreground group-hover:text-white transition-colors">{label}</span>
              <Info className="w-3 h-3 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
            </div>
            <span className="text-sm font-bold text-white font-mono">{value}</span>
          </div>
          <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
            <motion.div
              className={cn("h-full rounded-full", color)}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-[280px] text-xs leading-relaxed">
        {BREAKDOWN_TOOLTIP[tooltipKey]}
      </TooltipContent>
    </Tooltip>
  );
}

function TestCaseCard({ tc, index }: { tc: any; index: number }) {
  const queryClient = useQueryClient();
  const feedbackMutation = useSubmitTestCaseFeedback({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(tc.analysisId) })
    }
  });

  const handleFeedback = (type: "useful" | "not_useful") => {
    feedbackMutation.mutate({ id: tc.id, data: { feedback: type } });
  };

  const typeColor: Record<string, string> = {
    negative: "#fb7185",
    edge_case: "#fbbf24",
    functional: "#34d399",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}
      className="glass p-6 rounded-2xl border-l-4 hover:bg-white/[0.015] transition-colors"
      style={{ borderLeftColor: typeColor[tc.type] ?? "#6366f1" }}
    >
      <div className="flex flex-col md:flex-row justify-between gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={cn(
                  "px-2 py-0.5 rounded text-xs font-bold uppercase cursor-help",
                  tc.priority === "HIGH" ? "bg-rose-500/15 text-rose-400" :
                  tc.priority === "MEDIUM" ? "bg-amber-500/15 text-amber-400" :
                  "bg-sky-500/15 text-sky-400"
                )}>
                  {tc.priority}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[220px] text-xs">
                {tc.priorityReason ?? "Priority set based on severity of linked failure"}
              </TooltipContent>
            </Tooltip>
            <span className="px-2 py-0.5 rounded text-xs text-muted-foreground bg-secondary capitalize">
              {tc.type?.replace("_", " ")}
            </span>
          </div>
          <h4 className="text-base font-bold text-white mb-1">{tc.title}</h4>
          {tc.linkedIssue && (
            <div className="flex items-center gap-1.5 text-xs text-primary mt-1">
              <Link2 className="w-3 h-3" />
              <span className="font-mono">Covers: {tc.linkedIssue}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleFeedback("useful")}
                disabled={feedbackMutation.isPending || tc.feedback === "useful"}
                className={cn(
                  "p-2 rounded-lg border transition-all",
                  tc.feedback === "useful"
                    ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                    : "border-border/50 text-muted-foreground hover:bg-white/5 hover:text-emerald-400"
                )}
              >
                <ThumbsUp className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Mark as useful</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleFeedback("not_useful")}
                disabled={feedbackMutation.isPending || tc.feedback === "not_useful"}
                className={cn(
                  "p-2 rounded-lg border transition-all",
                  tc.feedback === "not_useful"
                    ? "bg-rose-500/20 border-rose-500/50 text-rose-400"
                    : "border-border/50 text-muted-foreground hover:bg-white/5 hover:text-rose-400"
                )}
              >
                <ThumbsDown className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Mark as not useful</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="bg-[#09090b] rounded-xl p-4 border border-white/5">
        <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Test Steps</h5>
        <ol className="list-decimal list-inside space-y-2 text-sm text-slate-300 font-mono">
          {tc.steps?.map((step: string, i: number) => (
            <li key={i} className="pl-2">{step}</li>
          ))}
        </ol>

        <div className="mt-4 pt-4 border-t border-white/5">
          <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Expected Result</h5>
          <p className="text-sm text-emerald-400 font-mono flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            {tc.expectedResult}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
