import { pgTable, text, serial, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const requirementsTable = pgTable("requirements", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  entities: jsonb("entities").$type<string[]>().notNull().default([]),
  actions: jsonb("actions").$type<string[]>().notNull().default([]),
  constraints: jsonb("constraints").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRequirementSchema = createInsertSchema(requirementsTable).omit({ id: true, createdAt: true });
export type InsertRequirement = z.infer<typeof insertRequirementSchema>;
export type Requirement = typeof requirementsTable.$inferSelect;
