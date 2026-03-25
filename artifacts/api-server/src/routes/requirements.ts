import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { requirementsTable } from "@workspace/db/schema";
import { extractRequirementEntities } from "../services/ai-engine.js";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  try {
    const rows = await db.select().from(requirementsTable).orderBy(requirementsTable.createdAt);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list requirements");
    res.status(500).json({ error: "Failed to list requirements" });
  }
});

router.post("/", async (req, res) => {
  const { title, description } = req.body;
  if (!title || !description) {
    return res.status(400).json({ error: "title and description are required" });
  }
  try {
    const extracted = await extractRequirementEntities(description);
    const [row] = await db
      .insert(requirementsTable)
      .values({
        title,
        description,
        entities: extracted.entities,
        actions: extracted.actions,
        constraints: extracted.constraints,
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to create requirement");
    res.status(500).json({ error: "Failed to create requirement" });
  }
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(requirementsTable).where(eq(requirementsTable.id, id));
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to get requirement");
    res.status(500).json({ error: "Failed to get requirement" });
  }
});

export default router;
