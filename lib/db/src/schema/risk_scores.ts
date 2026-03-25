import { pgTable, text, serial, integer, real, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { analysesTable } from "./analyses";

export const riskScoresTable = pgTable("risk_scores", {
  id: serial("id").primaryKey(),
  analysisId: integer("analysis_id").references(() => analysesTable.id).notNull(),
  score: real("score").notNull(),
  confidence: real("confidence").notNull().default(0.5),
  level: text("level", { enum: ["low", "medium", "high", "critical"] }).notNull(),
  explanation: text("explanation").notNull(),
  factors: jsonb("factors").$type<string[]>().notNull().default([]),
  codeChurn: real("code_churn").notNull(),
  filesChanged: integer("files_changed").notNull(),
  complexity: real("complexity").notNull(),
  testCoverageSignal: real("test_coverage_signal").notNull().default(50),
  impactedModules: jsonb("impacted_modules").$type<string[]>().notNull().default([]),
  predictedFailures: jsonb("predicted_failures").$type<Array<{issue: string; reason: string; affected_module: string; severity: "CRITICAL" | "HIGH" | "MEDIUM"}>>().notNull().default([]),
  riskBreakdown: jsonb("risk_breakdown").$type<{changeSize: number; criticalModule: number; concurrencyRisk: number; validationMissing: number}>().default({changeSize: 0, criticalModule: 0, concurrencyRisk: 0, validationMissing: 0}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRiskScoreSchema = createInsertSchema(riskScoresTable).omit({ id: true, createdAt: true });
export type InsertRiskScore = z.infer<typeof insertRiskScoreSchema>;
export type RiskScore = typeof riskScoresTable.$inferSelect;
