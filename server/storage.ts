import { 
  type Budget, 
  type InsertBudget,
  type Category,
  type InsertCategory,
  type Subcategory,
  type InsertSubcategory,
  type SpendEntry,
  type InsertSpendEntry,
  type CategoryWithSpent,
  type SubcategoryWithSpent,
  budgets,
  categories,
  subcategories,
  spendEntries
} from "@shared/schema";
import { db } from "./db";
import { eq, sql, desc } from "drizzle-orm";

export interface IStorage {
  getBudget(): Promise<Budget | undefined>;
  createBudget(budget: InsertBudget): Promise<Budget>;
  updateBudget(id: string, budget: InsertBudget): Promise<Budget | undefined>;
  
  getCategories(budgetId: string): Promise<CategoryWithSpent[]>;
  getCategory(id: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: string, category: InsertCategory): Promise<Category | undefined>;
  deleteCategory(id: string): Promise<boolean>;
  
  getSubcategories(categoryId: string): Promise<SubcategoryWithSpent[]>;
  getSubcategory(id: string): Promise<Subcategory | undefined>;
  createSubcategory(subcategory: InsertSubcategory): Promise<Subcategory>;
  updateSubcategory(id: string, subcategory: InsertSubcategory): Promise<Subcategory | undefined>;
  deleteSubcategory(id: string): Promise<boolean>;
  
  getSpendEntries(categoryId?: string, subcategoryId?: string): Promise<SpendEntry[]>;
  getSpendEntry(id: string): Promise<SpendEntry | undefined>;
  createSpendEntry(entry: InsertSpendEntry): Promise<SpendEntry>;
  updateSpendEntry(id: string, entry: InsertSpendEntry): Promise<SpendEntry | undefined>;
  deleteSpendEntry(id: string): Promise<boolean>;
  
  getTotalSpent(budgetId: string): Promise<number>;
  getCategorySpent(categoryId: string): Promise<number>;
  getSubcategorySpent(subcategoryId: string): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  async getBudget(): Promise<Budget | undefined> {
    const [budget] = await db.select().from(budgets).limit(1);
    return budget || undefined;
  }

  async createBudget(insertBudget: InsertBudget): Promise<Budget> {
    const [budget] = await db.insert(budgets).values(insertBudget).returning();
    return budget;
  }

  async updateBudget(id: string, insertBudget: InsertBudget): Promise<Budget | undefined> {
    const [budget] = await db
      .update(budgets)
      .set(insertBudget)
      .where(eq(budgets.id, id))
      .returning();
    return budget || undefined;
  }

  async getCategories(budgetId: string): Promise<CategoryWithSpent[]> {
    const cats = await db
      .select()
      .from(categories)
      .where(eq(categories.budgetId, budgetId));
    
    const result: CategoryWithSpent[] = [];
    for (const cat of cats) {
      const spent = await this.getCategorySpent(cat.id);
      result.push({ ...cat, spent });
    }
    return result;
  }

  async getCategory(id: string): Promise<Category | undefined> {
    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, id));
    return category || undefined;
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const [category] = await db
      .insert(categories)
      .values(insertCategory)
      .returning();
    return category;
  }

  async updateCategory(id: string, insertCategory: InsertCategory): Promise<Category | undefined> {
    const [category] = await db
      .update(categories)
      .set(insertCategory)
      .where(eq(categories.id, id))
      .returning();
    return category || undefined;
  }

  async deleteCategory(id: string): Promise<boolean> {
    await db.delete(subcategories).where(eq(subcategories.categoryId, id));
    await db.delete(spendEntries).where(eq(spendEntries.categoryId, id));
    const result = await db.delete(categories).where(eq(categories.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getSubcategories(categoryId: string): Promise<SubcategoryWithSpent[]> {
    const subs = await db
      .select()
      .from(subcategories)
      .where(eq(subcategories.categoryId, categoryId));
    
    const result: SubcategoryWithSpent[] = [];
    for (const sub of subs) {
      const spent = await this.getSubcategorySpent(sub.id);
      result.push({ ...sub, spent });
    }
    return result;
  }

  async getSubcategory(id: string): Promise<Subcategory | undefined> {
    const [subcategory] = await db
      .select()
      .from(subcategories)
      .where(eq(subcategories.id, id));
    return subcategory || undefined;
  }

  async createSubcategory(insertSubcategory: InsertSubcategory): Promise<Subcategory> {
    const [subcategory] = await db
      .insert(subcategories)
      .values(insertSubcategory)
      .returning();
    return subcategory;
  }

  async updateSubcategory(id: string, insertSubcategory: InsertSubcategory): Promise<Subcategory | undefined> {
    const [subcategory] = await db
      .update(subcategories)
      .set(insertSubcategory)
      .where(eq(subcategories.id, id))
      .returning();
    return subcategory || undefined;
  }

  async deleteSubcategory(id: string): Promise<boolean> {
    await db.delete(spendEntries).where(eq(spendEntries.subcategoryId, id));
    const result = await db.delete(subcategories).where(eq(subcategories.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getSpendEntries(categoryId?: string, subcategoryId?: string): Promise<SpendEntry[]> {
    if (subcategoryId) {
      return db
        .select()
        .from(spendEntries)
        .where(eq(spendEntries.subcategoryId, subcategoryId))
        .orderBy(desc(spendEntries.date));
    }
    if (categoryId) {
      return db
        .select()
        .from(spendEntries)
        .where(eq(spendEntries.categoryId, categoryId))
        .orderBy(desc(spendEntries.date));
    }
    return db.select().from(spendEntries).orderBy(desc(spendEntries.date));
  }

  async getSpendEntry(id: string): Promise<SpendEntry | undefined> {
    const [entry] = await db
      .select()
      .from(spendEntries)
      .where(eq(spendEntries.id, id));
    return entry || undefined;
  }

  async createSpendEntry(insertEntry: InsertSpendEntry): Promise<SpendEntry> {
    const [entry] = await db
      .insert(spendEntries)
      .values(insertEntry)
      .returning();
    return entry;
  }

  async updateSpendEntry(id: string, insertEntry: InsertSpendEntry): Promise<SpendEntry | undefined> {
    const [entry] = await db
      .update(spendEntries)
      .set(insertEntry)
      .where(eq(spendEntries.id, id))
      .returning();
    return entry || undefined;
  }

  async deleteSpendEntry(id: string): Promise<boolean> {
    const result = await db.delete(spendEntries).where(eq(spendEntries.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getTotalSpent(budgetId: string): Promise<number> {
    const cats = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.budgetId, budgetId));
    
    let total = 0;
    for (const cat of cats) {
      total += await this.getCategorySpent(cat.id);
    }
    return total;
  }

  async getCategorySpent(categoryId: string): Promise<number> {
    const result = await db
      .select({ total: sql<number>`COALESCE(SUM(${spendEntries.amount}), 0)` })
      .from(spendEntries)
      .where(eq(spendEntries.categoryId, categoryId));
    return Number(result[0]?.total || 0);
  }

  async getSubcategorySpent(subcategoryId: string): Promise<number> {
    const result = await db
      .select({ total: sql<number>`COALESCE(SUM(${spendEntries.amount}), 0)` })
      .from(spendEntries)
      .where(eq(spendEntries.subcategoryId, subcategoryId));
    return Number(result[0]?.total || 0);
  }
}

export const storage = new DatabaseStorage();
