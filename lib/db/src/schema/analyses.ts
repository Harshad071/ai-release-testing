import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { requirementsTable } from "./requirements";

export const analysesTable = pgTable("analyses", {
  id: serial("id").primaryKey(),
  requirementId: integer("requirement_id").references(() => requirementsTable.id),
  title: text("title").notNull(),
  gitDiff: text("git_diff").notNull(),
  status: text("status", { enum: ["pending", "parsing", "analyzing_risk", "predicting_failures", "generating_tests", "completed", "failed"] }).notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAnalysisSchema = createInsertSchema(analysesTable).omit({ id: true, createdAt: true });
export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type Analysis = typeof analysesTable.$inferSelect;
