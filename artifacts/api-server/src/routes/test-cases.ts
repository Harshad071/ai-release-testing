import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { testCasesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.post("/:id/feedback", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const { feedback, relevanceScore } = req.body;
  if (!["useful", "not_useful"].includes(feedback)) {
    return res.status(400).json({ error: "feedback must be 'useful' or 'not_useful'" });
  }

  try {
    const [updated] = await db
      .update(testCasesTable)
      .set({
        feedback,
        relevanceScore: relevanceScore ?? null,
      })
      .where(eq(testCasesTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Test case not found" });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to submit feedback");
    res.status(500).json({ error: "Failed to submit feedback" });
  }
});

export default router;
