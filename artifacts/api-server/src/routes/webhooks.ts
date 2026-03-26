import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { analysesTable } from "@workspace/db/schema";
import { parseGitDiff, predictRisk, generateTestCases, buildAnalysisContext } from "../services/ai-engine.js";
import { testCasesTable, riskScoresTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.post("/github", async (req, res) => {
  const payload = req.body;
  if (!payload.repository || !payload.ref) {
    return res.status(400).json({ received: false, message: "Invalid GitHub webhook payload" });
  }

  const repo = payload.repository.full_name;
  const ref = payload.ref;
  const commits = payload.commits ?? [];

  const changedFiles: string[] = [];
  for (const commit of commits) {
    changedFiles.push(...(commit.added ?? []), ...(commit.modified ?? []), ...(commit.removed ?? []));
  }

  const pseudoDiff = commits
    .map((c: { message: string; id: string; added: string[]; modified: string[]; removed: string[] }) =>
      [
        `diff --git a/... b/...`,
        `commit: ${c.id}`,
        `message: ${c.message}`,
        ...(c.added ?? []).map((f: string) => `+++ ${f}`),
        ...(c.modified ?? []).map((f: string) => `--- ${f}\n+++ ${f}`),
        ...(c.removed ?? []).map((f: string) => `--- ${f}`),
      ].join("\n")
    )
    .join("\n\n");

  const title = `GitHub webhook: ${repo} @ ${ref} (${commits.length} commit${commits.length !== 1 ? "s" : ""})`;

  const [newAnalysis] = await db
    .insert(analysesTable)
    .values({ title, gitDiff: pseudoDiff, status: "processing" })
    .returning();

  const analysisId = newAnalysis.id;

  (async () => {
    try {
      const diffAnalysis = parseGitDiff(pseudoDiff);
      const context = buildAnalysisContext(diffAnalysis, null);
      const riskPrediction = predictRisk(diffAnalysis, context);
      const failures: any[] = [];
      const testCases = await generateTestCases(pseudoDiff, null, diffAnalysis, context, failures);

      await db.insert(testCasesTable).values(
        testCases.map((tc) => ({
          analysisId,
          type: tc.type,
          title: tc.title,
          description: tc.description,
          steps: tc.steps,
          expectedResult: tc.expectedResult,
        }))
      );

      await db.insert(riskScoresTable).values({
        analysisId,
        score: riskPrediction.score,
        level: riskPrediction.level,
        explanation: riskPrediction.explanation,
        codeChurn: diffAnalysis.codeChurn,
        filesChanged: diffAnalysis.filesChanged,
        complexity: diffAnalysis.complexity,
        testCoverageSignal: riskPrediction.testCoverageSignal,
        impactedModules: diffAnalysis.impactedModules,
      });

      await db
        .update(analysesTable)
        .set({ status: "completed" })
        .where(eq(analysesTable.id, analysisId));
    } catch (err) {
      console.error("Webhook analysis failed:", err);
      await db
        .update(analysesTable)
        .set({ status: "failed" })
        .where(eq(analysesTable.id, analysisId));
    }
  })();

  res.json({ received: true, analysisId, message: `Processing analysis for ${repo}` });
});

export default router;
