import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  analysesTable,
  testCasesTable,
  riskScoresTable,
  requirementsTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import {
  parseGitDiff,
  predictRisk,
  predictFailures,
  generateTestCases,
  buildAnalysisContext,
  validateInput,
} from "../services/ai-engine.js";

const router: IRouter = Router();

async function getFullAnalysis(analysisId: number) {
  const [analysis] = await db
    .select()
    .from(analysesTable)
    .where(eq(analysesTable.id, analysisId));
  if (!analysis) return null;

  const testCases = await db
    .select()
    .from(testCasesTable)
    .where(eq(testCasesTable.analysisId, analysisId));

  const [riskScore] = await db
    .select()
    .from(riskScoresTable)
    .where(eq(riskScoresTable.analysisId, analysisId));

  // Shape test cases for API response — include derivedFrom as object
  const shapedTestCases = testCases.map((tc) => ({
    ...tc,
    derivedFrom: {
      requirement: tc.derivedFromRequirement ?? null,
      code: tc.derivedFromCode ?? null,
    },
  }));

  return { ...analysis, testCases: shapedTestCases, riskScore: riskScore ?? null };
}

router.get("/", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(analysesTable)
      .orderBy(analysesTable.createdAt);

    const result = await Promise.all(rows.map((r) => getFullAnalysis(r.id)));
    res.json(result.filter(Boolean));
  } catch (err) {
    req.log.error({ err }, "Failed to list analyses");
    res.status(500).json({ error: "Failed to list analyses" });
  }
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  try {
    const analysis = await getFullAnalysis(id);
    if (!analysis) return res.status(404).json({ error: "Not found" });
    res.json(analysis);
  } catch (err) {
    req.log.error({ err }, "Failed to get analysis");
    res.status(500).json({ error: "Failed to get analysis" });
  }
});

router.post("/", async (req, res) => {
  const { title, gitDiff, requirementId, requirementText } = req.body;

  if (!title) {
    return res.status(400).json({ error: "title is required" });
  }

  // ── Change 5: Input Validation ────────────────────────────────────────────
  const validation = validateInput(gitDiff, requirementText);
  if (!validation.valid) {
    return res.status(422).json({
      error: validation.error,
      message: validation.message,
    });
  }

  let reqId: number | null = requirementId ?? null;

  const [newAnalysis] = await db
    .insert(analysesTable)
    .values({ title, gitDiff, requirementId: reqId, status: "processing" })
    .returning();

  const analysisId = newAnalysis.id;

  // Fire-and-forget: AI processing runs asynchronously
  (async () => {
    try {
      let reqText = requirementText ?? null;
      if (!reqText && reqId) {
        const [reqRow] = await db
          .select()
          .from(requirementsTable)
          .where(eq(requirementsTable.id, reqId));
        if (reqRow) reqText = reqRow.description;
      }

      // Step 1: Parse diff (Impact Extractor)
      await db.update(analysesTable).set({ status: "parsing" }).where(eq(analysesTable.id, analysisId));
      const diffAnalysis = parseGitDiff(gitDiff);
      const context = buildAnalysisContext(diffAnalysis, reqText);

      // Step 2: Risk scoring (deterministic formula)
      await db.update(analysesTable).set({ status: "analyzing_risk" }).where(eq(analysesTable.id, analysisId));
      const riskPrediction = predictRisk(diffAnalysis, context);

      // Step 3: Failure prediction (AI)
      await db.update(analysesTable).set({ status: "predicting_failures" }).where(eq(analysesTable.id, analysisId));
      const failures = await predictFailures(gitDiff, reqText, diffAnalysis, context);

      // Step 4: Test generation (linked to failures)
      await db.update(analysesTable).set({ status: "generating_tests" }).where(eq(analysesTable.id, analysisId));
      const testCases = await generateTestCases(gitDiff, reqText, diffAnalysis, context, failures);

      await db.insert(testCasesTable).values(
        testCases.map((tc) => ({
          analysisId,
          type: tc.type,
          priority: tc.priority,
          priorityReason: tc.priorityReason,
          title: tc.title,
          description: tc.description,
          steps: tc.steps,
          expectedResult: tc.expectedResult,
          derivedFromRequirement: tc.derivedFrom.requirement ?? null,
          derivedFromCode: tc.derivedFrom.code ?? null,
          linkedIssue: tc.linkedIssue ?? null,
        }))
      );

      await db.insert(riskScoresTable).values({
        analysisId,
        score: riskPrediction.score,
        confidence: riskPrediction.confidence,
        level: riskPrediction.level,
        explanation: riskPrediction.explanation,
        factors: riskPrediction.factors,
        codeChurn: riskPrediction.codeChurn,
        filesChanged: riskPrediction.filesChanged,
        complexity: riskPrediction.complexity,
        testCoverageSignal: riskPrediction.testCoverageSignal,
        impactedModules: diffAnalysis.impactedModules,
        predictedFailures: failures,
        riskBreakdown: riskPrediction.riskBreakdown,
      });

      await db
        .update(analysesTable)
        .set({ status: "completed" })
        .where(eq(analysesTable.id, analysisId));
    } catch (err) {
      req.log.error({ err }, "Analysis processing failed");
      await db
        .update(analysesTable)
        .set({ status: "failed" })
        .where(eq(analysesTable.id, analysisId));
    }
  })();

  res.status(201).json(newAnalysis);
});

export default router;
