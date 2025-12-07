import { pgTable, text, varchar, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const projects = pgTable("projects", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: text("name").notNull(),
  budgetAmount: real("budget_amount").notNull(),
});

export const expenses = pgTable("expenses", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: text("name").notNull(),
  amount: real("amount").notNull(),
  category: text("category").notNull(),
  date: text("date").notNull(),
  projectId: varchar("project_id", { length: 36 }).notNull(),
});

export const insertProjectSchema = createInsertSchema(projects).omit({ id: true });
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true });

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;

export const expenseCategories = [
  "Advertising",
  "Social Media",
  "Content",
  "Events",
  "Email Marketing",
  "SEO",
  "Other"
] as const;

export type ExpenseCategory = typeof expenseCategories[number];
