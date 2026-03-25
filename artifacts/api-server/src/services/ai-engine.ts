import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface ExtractedRequirement {
  entities: string[];
  actions: string[];
  constraints: string[];
}

export interface TestCaseDerivedFrom {
  requirement: string | null;
  code: string | null;
}

export interface PredictedFailure {
  issue: string;
  reason: string;
  affected_module: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
}

export interface GeneratedTestCase {
  type: "functional" | "edge_case" | "negative";
  priority: "HIGH" | "MEDIUM" | "LOW";
  priorityReason: string;
  title: string;
  description: string;
  steps: string[];
  expectedResult: string;
  linkedIssue: string | null;
  derivedFrom: TestCaseDerivedFrom;
}

export interface ParsedDiff {
  filesChanged: number;
  additions: number;
  deletions: number;
  impactedModules: string[];
  impactedFiles: string[];
  complexity: number;
  codeChurn: number;
  criticalModuleDetected: boolean;
  externalDependencyDetected: boolean;
  concurrencyDetected: boolean;
  validationMissing: boolean;
}

export interface AnalysisContext {
  requirementSummary: string[];
  constraints: string[];
  changedFunctions: string[];
  riskSignals: {
    authModule: boolean;
    paymentModule: boolean;
    externalApi: boolean;
    criticalPath: boolean;
  };
}

export interface RiskBreakdown {
  changeSize: number;
  criticalModule: number;
  concurrencyRisk: number;
  validationMissing: number;
}

export interface RiskPrediction {
  score: number;
  confidence: number;
  level: "low" | "medium" | "high" | "critical";
  explanation: string;
  factors: string[];
  codeChurn: number;
  filesChanged: number;
  complexity: number;
  testCoverageSignal: number;
  riskBreakdown: RiskBreakdown;
}

export interface InputValidationResult {
  valid: boolean;
  error?: string;
  message?: string;
}

// ─── Input Validation ────────────────────────────────────────────────────────

export function validateInput(gitDiff: string, requirementText?: string | null): InputValidationResult {
  const trimmedDiff = gitDiff?.trim() ?? "";

  if (!trimmedDiff) {
    return { valid: false, error: "Insufficient input", message: "Provide a valid git diff with code changes." };
  }

  if (trimmedDiff.length < 30) {
    return { valid: false, error: "Insufficient input", message: "Provide detailed code changes. The diff is too short to analyze." };
  }

  const looksLikeDiff =
    trimmedDiff.includes("diff --git") ||
    trimmedDiff.includes("+++") ||
    trimmedDiff.includes("---") ||
    trimmedDiff.includes("@@") ||
    trimmedDiff.startsWith("+") ||
    trimmedDiff.startsWith("-");

  if (!looksLikeDiff) {
    return {
      valid: false,
      error: "Invalid git diff",
      message: "Provide a valid code diff. Expected format: git diff output with +/- lines showing changes.",
    };
  }

  return { valid: true };
}

// ─── Context Builder ─────────────────────────────────────────────────────────

const CRITICAL_MODULE_KEYWORDS = ["auth", "login", "logout", "password", "token", "session", "jwt", "oauth", "security", "permission", "role", "privilege"];
const PAYMENT_MODULE_KEYWORDS = ["payment", "billing", "stripe", "invoice", "charge", "subscription", "checkout", "price"];
const EXTERNAL_API_KEYWORDS = ["fetch", "axios", "http", "request", "api", "webhook", "oauth", "google", "aws", "s3", "redis", "kafka"];
const CONCURRENCY_KEYWORDS = ["async", "await", "promise", "parallel", "concurrent", "race", "mutex", "lock", "transaction", "atomic", "thread", "worker"];
const VALIDATION_KEYWORDS = ["validate", "validation", "sanitize", "check", "assert", "verify", "guard", "schema", "required", "constraint"];

export function buildAnalysisContext(
  diff: ParsedDiff,
  requirementText: string | null
): AnalysisContext {
  const requirementLower = (requirementText ?? "").toLowerCase();
  const moduleNames = diff.impactedModules.map((m) => m.toLowerCase());
  const allText = (requirementLower + " " + moduleNames.join(" ")).toLowerCase();

  const authModule = CRITICAL_MODULE_KEYWORDS.some((k) => allText.includes(k));
  const paymentModule = PAYMENT_MODULE_KEYWORDS.some((k) => allText.includes(k));
  const externalApi = EXTERNAL_API_KEYWORDS.some((k) => allText.includes(k));
  const criticalPath = authModule || paymentModule;

  const requirementSummary: string[] = [];
  const constraints: string[] = [];

  if (requirementText) {
    const sentences = requirementText.split(/[.!?\n]+/).map((s) => s.trim()).filter(Boolean);
    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      const isConstraint = lower.startsWith("must") || lower.startsWith("should") || lower.includes("must not") || lower.includes("invalid") || lower.includes("reject") || lower.includes("require") || lower.includes("only") || lower.includes("limit");
      if (isConstraint) constraints.push(sentence);
      else if (sentence.length > 10) requirementSummary.push(sentence);
    }
  }

  return {
    requirementSummary: requirementSummary.slice(0, 5),
    constraints: constraints.slice(0, 5),
    changedFunctions: diff.impactedModules,
    riskSignals: { authModule, paymentModule, externalApi, criticalPath },
  };
}

// ─── Diff Parser (Impact Extractor) ──────────────────────────────────────────

export function parseGitDiff(diff: string): ParsedDiff {
  const lines = diff.split("\n");
  const addedLines = lines.filter((l) => l.startsWith("+") && !l.startsWith("+++")).length;
  const deletedLines = lines.filter((l) => l.startsWith("-") && !l.startsWith("---")).length;
  const filesChangedRaw = lines.filter((l) => l.startsWith("diff --git")).length;
  const filesChanged = Math.max(filesChangedRaw, 1);

  // Extract file paths
  const filePattern = /diff --git a\/(.+?) b\//g;
  const impactedFilesSet = new Set<string>();
  let fileMatch;
  while ((fileMatch = filePattern.exec(diff)) !== null) {
    if (fileMatch[1]) impactedFilesSet.add(fileMatch[1]);
  }

  // Extract functions/modules
  const modulePattern = /(?:class |def |function |const |export (?:default |function |class |const |async function ))(\w+)/g;
  const impactedModulesSet = new Set<string>();
  for (const line of lines.filter((l) => l.startsWith("+"))) {
    let match;
    while ((match = modulePattern.exec(line)) !== null) {
      if (match[1] && match[1].length > 2) {
        impactedModulesSet.add(match[1]);
      }
    }
  }

  const allDiffText = diff.toLowerCase();
  const criticalModuleDetected = CRITICAL_MODULE_KEYWORDS.some((k) => allDiffText.includes(k));
  const externalDependencyDetected = EXTERNAL_API_KEYWORDS.some((k) => allDiffText.includes(k));
  const concurrencyDetected = CONCURRENCY_KEYWORDS.some((k) => allDiffText.includes(k));
  const validationMissing = !VALIDATION_KEYWORDS.some((k) => allDiffText.includes(k));

  const codeChurn = addedLines + deletedLines;
  const complexity = Math.min(10, Math.log2(codeChurn + 1) + filesChanged * 0.5);
  const impactedModules = [...impactedModulesSet].slice(0, 10);

  return {
    filesChanged,
    additions: addedLines,
    deletions: deletedLines,
    impactedModules: impactedModules.length > 0 ? impactedModules : ["unknown"],
    impactedFiles: [...impactedFilesSet].slice(0, 10),
    complexity: parseFloat(complexity.toFixed(2)),
    codeChurn,
    criticalModuleDetected,
    externalDependencyDetected,
    concurrencyDetected,
    validationMissing,
  };
}

// ─── Risk Engine (Deterministic Formula) ─────────────────────────────────────

export function predictRisk(diff: ParsedDiff, context: AnalysisContext): RiskPrediction {
  const { codeChurn, filesChanged, complexity } = diff;

  // Deterministic risk formula components (each 0–100)
  const changeSizeScore = Math.min(100, Math.round((codeChurn / 500) * 100));
  const criticalModuleScore = (context.riskSignals.criticalPath ? 70 : 0) +
    (context.riskSignals.paymentModule ? 30 : 0) +
    (context.riskSignals.authModule ? 20 : 0);
  const concurrencyScore = diff.concurrencyDetected ? 80 : 10;
  const validationMissingScore = diff.validationMissing ? 75 : 15;

  // Weighted formula: 0.35 * change_size + 0.25 * critical_module + 0.20 * concurrency + 0.20 * validation_missing
  const rawWeighted =
    0.35 * changeSizeScore +
    0.25 * Math.min(100, criticalModuleScore) +
    0.20 * concurrencyScore +
    0.20 * validationMissingScore;

  const score = Math.min(100, Math.round(rawWeighted));

  const riskBreakdown: RiskBreakdown = {
    changeSize: Math.round(0.35 * changeSizeScore),
    criticalModule: Math.round(0.25 * Math.min(100, criticalModuleScore)),
    concurrencyRisk: Math.round(0.20 * concurrencyScore),
    validationMissing: Math.round(0.20 * validationMissingScore),
  };

  // Test coverage signal
  const addRatio = diff.additions / Math.max(diff.additions + diff.deletions, 1);
  const normalizedChurn = Math.min(codeChurn / 500, 1);
  const testCoverageSignal = Math.max(0.1, Math.min(0.9, 1 - addRatio * normalizedChurn * 0.8));

  const factors: string[] = [];
  if (context.riskSignals.paymentModule) factors.push("Payment/billing module modified (critical path)");
  if (context.riskSignals.authModule) factors.push("Authentication module modified (critical path)");
  if (diff.concurrencyDetected) factors.push("Concurrency patterns detected (async/Promise/transactions)");
  if (diff.validationMissing) factors.push("No validation logic found in changed code");
  if (context.riskSignals.externalApi) factors.push("External API dependency introduced or modified");
  if (codeChurn > 200) factors.push(`High code churn: ${codeChurn} lines changed`);
  if (filesChanged > 5) factors.push(`Broad impact: ${filesChanged} files modified`);
  if (complexity > 6) factors.push(`High complexity score: ${complexity.toFixed(1)}`);
  if (diff.impactedModules.length > 5) factors.push(`Wide module impact: ${diff.impactedModules.slice(0, 4).join(", ")}`);

  if (factors.length === 0) {
    factors.push(`${filesChanged} file(s) changed, ${codeChurn} lines of churn`);
  }

  const signalCount = (diff.criticalModuleDetected ? 1 : 0) + (diff.externalDependencyDetected ? 1 : 0) + (codeChurn > 50 ? 1 : 0) + (filesChanged > 1 ? 1 : 0);
  const confidence = parseFloat(Math.min(0.95, 0.45 + signalCount * 0.12).toFixed(2));

  let level: "low" | "medium" | "high" | "critical";
  let explanation: string;

  if (score < 25) {
    level = "low";
    explanation = `Low risk. Minimal changes with limited blast radius. Standard smoke tests should suffice.`;
  } else if (score < 50) {
    level = "medium";
    explanation = `Moderate risk. Changes affect ${filesChanged} file(s) with identifiable impact on: ${diff.impactedModules.slice(0, 3).join(", ")}. Regression tests recommended.`;
  } else if (score < 75) {
    level = "high";
    explanation = `High risk. Significant changes across ${filesChanged} file(s), complexity ${complexity.toFixed(1)}. ${factors.slice(0, 2).join(". ")}. Thorough testing required.`;
  } else {
    level = "critical";
    explanation = `Critical risk. ${factors.join(". ")}. Full regression suite + manual QA required before release.`;
  }

  return {
    score,
    confidence,
    level,
    explanation,
    factors,
    codeChurn,
    filesChanged,
    complexity,
    testCoverageSignal: parseFloat((testCoverageSignal * 100).toFixed(1)),
    riskBreakdown,
  };
}

// ─── Failure Prediction Engine (AI) ──────────────────────────────────────────

export async function predictFailures(
  gitDiff: string,
  requirementText: string | null,
  diff: ParsedDiff,
  context: AnalysisContext
): Promise<PredictedFailure[]> {
  const modules = diff.impactedModules.slice(0, 8).join(", ");
  const diffBlock = gitDiff.slice(0, 3000);

  const prompt = `You are a senior backend reliability engineer.

Analyze the following software change and predict what will break in production.

Context:
- Requirement:
${requirementText ?? "Not provided"}

- Code Changes (Git Diff):
${diffBlock}

- Impacted Modules:
${modules}

Your task:
1. Identify EXACTLY 3–5 realistic failure scenarios.
2. Focus on:
   - concurrency issues
   - data consistency / partial failures
   - idempotency problems
   - retry logic risks
   - API contract changes
3. Each failure must include:
   - issue (short title)
   - reason (technical cause)
   - affected_module
   - severity (CRITICAL / HIGH / MEDIUM)

STRICT RULES:
- Do NOT be generic
- Do NOT say "system may fail"
- Be specific and technical
- Tie each failure to the code change

Output format (JSON only):
[
  {
    "issue": "...",
    "reason": "...",
    "affected_module": "...",
    "severity": "CRITICAL"
  }
]`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 2048,
      messages: [
        { role: "system", content: "You are a senior backend reliability engineer. Output only valid JSON." },
        { role: "user", content: prompt },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "[]";
    const parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim());
    if (!Array.isArray(parsed)) return generateFallbackFailures(diff, context);

    return parsed.slice(0, 5).map((f: any) => ({
      issue: f.issue ?? "Unknown failure",
      reason: f.reason ?? "No reason provided",
      affected_module: f.affected_module ?? diff.impactedModules[0] ?? "unknown",
      severity: (["CRITICAL", "HIGH", "MEDIUM"].includes(f.severity) ? f.severity : "HIGH") as "CRITICAL" | "HIGH" | "MEDIUM",
    }));
  } catch {
    return generateFallbackFailures(diff, context);
  }
}

function generateFallbackFailures(diff: ParsedDiff, context: AnalysisContext): PredictedFailure[] {
  const mod = diff.impactedModules[0] ?? "core";
  const failures: PredictedFailure[] = [];

  if (diff.concurrencyDetected) {
    failures.push({
      issue: `Race condition under concurrent requests in ${mod}`,
      reason: "Async operations without atomic checks can allow multiple requests to pass the same guard simultaneously",
      affected_module: mod,
      severity: "CRITICAL",
    });
  }
  if (context.riskSignals.paymentModule) {
    failures.push({
      issue: "Double charge under concurrent payment requests",
      reason: "Idempotency check is not atomic — two simultaneous requests may both pass validation before either commits",
      affected_module: mod,
      severity: "CRITICAL",
    });
  }
  if (diff.validationMissing) {
    failures.push({
      issue: `Missing input validation in ${mod}`,
      reason: "No validation layer found in changed code — malformed data can propagate to downstream systems",
      affected_module: mod,
      severity: "HIGH",
    });
  }
  if (context.riskSignals.externalApi) {
    failures.push({
      issue: "Partial failure on external API timeout",
      reason: "Promise.all pattern fails entirely if any dependency times out, with no fallback or retry circuit",
      affected_module: mod,
      severity: "HIGH",
    });
  }

  if (failures.length < 3) {
    failures.push({
      issue: `State inconsistency on partial rollback in ${mod}`,
      reason: "Multi-step operation lacks transactional integrity — partial success leaves system in undefined state",
      affected_module: mod,
      severity: "HIGH",
    });
  }

  return failures.slice(0, 5);
}

// ─── Helper: Sort test cases by priority (HIGH → MEDIUM → LOW) ──────

function sortByPriority(testCases: GeneratedTestCase[]): GeneratedTestCase[] {
  const priorityOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  return testCases.sort((a, b) => {
    const orderA = priorityOrder[a.priority] ?? 2;
    const orderB = priorityOrder[b.priority] ?? 2;
    return orderA - orderB;
  });
}

// ─── Test Case Generation (Linked to Failures) ───────────────────────────────

export async function generateTestCases(
  gitDiff: string,
  requirementText: string | null,
  diffAnalysis: ParsedDiff,
  context: AnalysisContext,
  predictedFailures: PredictedFailure[]
): Promise<GeneratedTestCase[]> {
  const failuresJson = JSON.stringify(predictedFailures, null, 2);
  const diffBlock = gitDiff.slice(0, 2000);

  const prompt = `You are a senior QA engineer.

Given the following predicted failures, generate targeted test cases.

Failures:
${failuresJson}

Code context (git diff excerpt):
${diffBlock}

Rules:
- Each test must directly validate one failure
- Include:
  - title
  - linked_issue (must match the "issue" field from one of the failures exactly)
  - type: "functional" | "edge_case" | "negative"
  - steps (3–5 steps, each specific and actionable)
  - expected_result
  - priority (CRITICAL→HIGH, HIGH→HIGH, MEDIUM→MEDIUM)

Output JSON only:
[
  {
    "title": "...",
    "linked_issue": "...",
    "type": "functional",
    "priority": "HIGH",
    "steps": ["...", "..."],
    "expected_result": "..."
  }
]`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 4096,
      messages: [
        { role: "system", content: "You are a senior QA engineer. Output only valid JSON." },
        { role: "user", content: prompt },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "[]";
    const parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim());
    if (!Array.isArray(parsed)) return generateFallbackTestCases(diffAnalysis, predictedFailures);

    const testCases = parsed.slice(0, 15).map((tc: any) => {
      const linkedFailure = predictedFailures.find((f) => f.issue === tc.linked_issue);
      const severityToPriority: Record<string, "HIGH" | "MEDIUM" | "LOW"> = {
        CRITICAL: "HIGH",
        HIGH: "HIGH",
        MEDIUM: "MEDIUM",
      };
      const priority = (tc.priority as "HIGH" | "MEDIUM" | "LOW") ??
        (linkedFailure ? severityToPriority[linkedFailure.severity] ?? "MEDIUM" : "MEDIUM");

      return {
        type: (["functional", "edge_case", "negative"].includes(tc.type) ? tc.type : "functional") as "functional" | "edge_case" | "negative",
        title: tc.title ?? "Untitled test case",
        description: tc.linked_issue ? `Validates: ${tc.linked_issue}` : "",
        steps: Array.isArray(tc.steps) ? tc.steps : [],
        expectedResult: tc.expected_result ?? tc.expectedResult ?? "",
        priority,
        priorityReason: linkedFailure
          ? `${linkedFailure.severity} severity — ${linkedFailure.reason.slice(0, 80)}`
          : "Derived from predicted failure",
        linkedIssue: tc.linked_issue ?? null,
        derivedFrom: {
          requirement: requirementText ? requirementText.slice(0, 100) : null,
          code: diffAnalysis.impactedModules[0] ?? null,
        },
      };
    });

    return sortByPriority(testCases);
  } catch {
    return generateFallbackTestCases(diffAnalysis, predictedFailures);
  }
}

function generateFallbackTestCases(diff: ParsedDiff, failures: PredictedFailure[]): GeneratedTestCase[] {
  const testCases = failures.slice(0, 15).map((f, i) => ({
    type: (i % 3 === 0 ? "functional" : i % 3 === 1 ? "edge_case" : "negative") as "functional" | "edge_case" | "negative",
    title: `Test: ${f.issue}`,
    description: `Validates: ${f.issue}`,
    steps: [
      "Set up the test environment with required preconditions",
      `Trigger the scenario that causes: ${f.reason.slice(0, 80)}`,
      `Verify the behavior of ${f.affected_module}`,
      "Assert the expected outcome matches specification",
    ],
    expectedResult: `${f.affected_module} handles the scenario correctly without ${f.issue.toLowerCase()}`,
    priority: (f.severity === "CRITICAL" ? "HIGH" : f.severity === "HIGH" ? "HIGH" : "MEDIUM") as "HIGH" | "MEDIUM" | "LOW",
    priorityReason: `${f.severity} severity — ${f.reason.slice(0, 80)}`,
    linkedIssue: f.issue,
    derivedFrom: { requirement: null, code: f.affected_module },
  }));

  return sortByPriority(testCases);
}

// ─── Requirement Entity Extractor ────────────────────────────────────────────

export async function extractRequirementEntities(description: string): Promise<ExtractedRequirement> {
  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 1024,
    messages: [
      {
        role: "system",
        content: `You are a requirements analyst. Extract structured information from software requirements.
Return ONLY valid JSON:
{
  "entities": ["nouns/objects involved"],
  "actions": ["verbs/operations"],
  "constraints": ["rules, limits, validations"]
}`,
      },
      {
        role: "user",
        content: `Extract entities, actions, and constraints:\n\n${description}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(content);
    return {
      entities: parsed.entities ?? [],
      actions: parsed.actions ?? [],
      constraints: parsed.constraints ?? [],
    };
  } catch {
    return { entities: [], actions: [], constraints: [] };
  }
}
