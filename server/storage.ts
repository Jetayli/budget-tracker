import { 
  type Budget, 
  type InsertBudget, 
  type Expense, 
  type InsertExpense 
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getBudget(): Promise<Budget | null>;
  setBudget(budget: InsertBudget): Promise<Budget>;
  
  getExpenses(): Promise<Expense[]>;
  getExpense(id: string): Promise<Expense | undefined>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  updateExpense(id: string, expense: InsertExpense): Promise<Expense | undefined>;
  deleteExpense(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private budget: Budget | null;
  private expenses: Map<string, Expense>;

  constructor() {
    this.budget = null;
    this.expenses = new Map();
  }

  async getBudget(): Promise<Budget | null> {
    return this.budget;
  }

  async setBudget(insertBudget: InsertBudget): Promise<Budget> {
    const id = this.budget?.id || randomUUID();
    const budget: Budget = { id, ...insertBudget };
    this.budget = budget;
    return budget;
  }

  async getExpenses(): Promise<Expense[]> {
    return [...Array.from(this.expenses.values())].reverse();
  }

  async getExpense(id: string): Promise<Expense | undefined> {
    return this.expenses.get(id);
  }

  async createExpense(insertExpense: InsertExpense): Promise<Expense> {
    const id = randomUUID();
    const expense: Expense = { id, ...insertExpense };
    this.expenses.set(id, expense);
    return expense;
  }

  async updateExpense(id: string, insertExpense: InsertExpense): Promise<Expense | undefined> {
    const existing = this.expenses.get(id);
    if (!existing) return undefined;
    
    const updated: Expense = { id, ...insertExpense };
    this.expenses.set(id, updated);
    return updated;
  }

  async deleteExpense(id: string): Promise<boolean> {
    return this.expenses.delete(id);
  }
}

export const storage = new MemStorage();
