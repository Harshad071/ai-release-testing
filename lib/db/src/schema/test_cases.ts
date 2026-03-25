import { pgTable, text, serial, integer, real, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { analysesTable } from "./analyses";

export const testCasesTable = pgTable("test_cases", {
  id: serial("id").primaryKey(),
  analysisId: integer("analysis_id").references(() => analysesTable.id).notNull(),
  type: text("type", { enum: ["functional", "edge_case", "negative"] }).notNull(),
  priority: text("priority", { enum: ["HIGH", "MEDIUM", "LOW"] }).notNull().default("MEDIUM"),
  priorityReason: text("priority_reason"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  steps: jsonb("steps").$type<string[]>().notNull().default([]),
  expectedResult: text("expected_result").notNull(),
  derivedFromRequirement: text("derived_from_requirement"),
  derivedFromCode: text("derived_from_code"),
  linkedIssue: text("linked_issue"),
  relevanceScore: real("relevance_score"),
  feedback: text("feedback", { enum: ["useful", "not_useful"] }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTestCaseSchema = createInsertSchema(testCasesTable).omit({ id: true, createdAt: true });
export type InsertTestCase = z.infer<typeof insertTestCaseSchema>;
export type TestCase = typeof testCasesTable.$inferSelect;
