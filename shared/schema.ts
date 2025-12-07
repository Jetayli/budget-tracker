import { pgTable, text, varchar, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const budgets = pgTable("budgets", {
  id: varchar("id", { length: 36 }).primaryKey(),
  totalAmount: real("total_amount").notNull(),
});

export const expenses = pgTable("expenses", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: text("name").notNull(),
  amount: real("amount").notNull(),
  category: text("category").notNull(),
  date: text("date").notNull(),
});

export const insertBudgetSchema = createInsertSchema(budgets).omit({ id: true });
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true });

export type InsertBudget = z.infer<typeof insertBudgetSchema>;
export type Budget = typeof budgets.$inferSelect;
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
