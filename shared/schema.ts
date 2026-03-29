import {
  pgTable,
  text,
  varchar,
  real,
  date,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const budgets = pgTable("budgets", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull().default("Marketing Budget"),
  totalBudget: real("total_budget").notNull(),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const categories = pgTable("categories", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  allocatedBudget: real("allocated_budget").notNull(),
  budgetId: varchar("budget_id", { length: 36 }).notNull(),
});

export const subcategories = pgTable("subcategories", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  allocatedBudget: real("allocated_budget").notNull(),
  categoryId: varchar("category_id", { length: 36 }).notNull(),
});

export const spendEntries = pgTable("spend_entries", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  amount: real("amount").notNull(),
  description: text("description").notNull(),
  note: text("note"),
  date: text("date").notNull(),
  startDate: text("start_date"),
  endDate: text("end_date"),
  categoryId: varchar("category_id", { length: 36 }).notNull(),
  subcategoryId: varchar("subcategory_id", { length: 36 }),
});

export const tasks = pgTable("tasks", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").default(""),
  status: text("status").notNull().default("todo"),
  priority: text("priority").notNull().default("medium"),
  deadline: date("deadline"),
  projectId: varchar("project_id", { length: 36 }).notNull(),
  categoryId: varchar("category_id", { length: 36 }),
  subcategoryId: varchar("subcategory_id", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const budgetsRelations = relations(budgets, ({ many }) => ({
  categories: many(categories),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  project: one(budgets, {
    fields: [tasks.projectId],
    references: [budgets.id],
  }),
  category: one(categories, {
    fields: [tasks.categoryId],
    references: [categories.id],
  }),
  subcategory: one(subcategories, {
    fields: [tasks.subcategoryId],
    references: [subcategories.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  budget: one(budgets, {
    fields: [categories.budgetId],
    references: [budgets.id],
  }),
  subcategories: many(subcategories),
  spendEntries: many(spendEntries),
}));

export const subcategoriesRelations = relations(
  subcategories,
  ({ one, many }) => ({
    category: one(categories, {
      fields: [subcategories.categoryId],
      references: [categories.id],
    }),
    spendEntries: many(spendEntries),
  }),
);

export const spendEntriesRelations = relations(spendEntries, ({ one }) => ({
  category: one(categories, {
    fields: [spendEntries.categoryId],
    references: [categories.id],
  }),
  subcategory: one(subcategories, {
    fields: [spendEntries.subcategoryId],
    references: [subcategories.id],
  }),
}));

export const insertBudgetSchema = createInsertSchema(budgets).omit({
  id: true,
  createdAt: true,
  userId: true, // userId is set by the server from the authenticated user
});
export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
});
export const insertSubcategorySchema = createInsertSchema(subcategories).omit({
  id: true,
});
export const insertSpendEntrySchema = createInsertSchema(spendEntries).omit({
  id: true,
});
export const insertTaskSchema = createInsertSchema(tasks)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    deadline: z.string().optional().nullable(),
    subcategoryId: z.string().optional().nullable(),
  });

export type InsertBudget = z.infer<typeof insertBudgetSchema>;
export type Budget = typeof budgets.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;
export type InsertSubcategory = z.infer<typeof insertSubcategorySchema>;
export type Subcategory = typeof subcategories.$inferSelect;
export type InsertSpendEntry = z.infer<typeof insertSpendEntrySchema>;
export type SpendEntry = typeof spendEntries.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

export type CategoryWithSpent = Category & { spent: number };
export type SubcategoryWithSpent = Subcategory & { spent: number };
