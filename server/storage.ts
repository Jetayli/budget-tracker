import { 
  type Project, 
  type InsertProject, 
  type Expense, 
  type InsertExpense 
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, project: InsertProject): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;
  
  getExpenses(): Promise<Expense[]>;
  getExpensesByProject(projectId: string): Promise<Expense[]>;
  getExpense(id: string): Promise<Expense | undefined>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  updateExpense(id: string, expense: InsertExpense): Promise<Expense | undefined>;
  deleteExpense(id: string): Promise<boolean>;
  deleteExpensesByProject(projectId: string): Promise<number>;
}

export class MemStorage implements IStorage {
  private projects: Map<string, Project>;
  private expenses: Map<string, Expense>;

  constructor() {
    this.projects = new Map();
    this.expenses = new Map();
  }

  async getProjects(): Promise<Project[]> {
    return [...Array.from(this.projects.values())];
  }

  async getProject(id: string): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const id = randomUUID();
    const project: Project = { id, ...insertProject };
    this.projects.set(id, project);
    return project;
  }

  async updateProject(id: string, insertProject: InsertProject): Promise<Project | undefined> {
    const existing = this.projects.get(id);
    if (!existing) return undefined;
    
    const updated: Project = { id, ...insertProject };
    this.projects.set(id, updated);
    return updated;
  }

  async deleteProject(id: string): Promise<boolean> {
    return this.projects.delete(id);
  }

  async getExpenses(): Promise<Expense[]> {
    return [...Array.from(this.expenses.values())].reverse();
  }

  async getExpensesByProject(projectId: string): Promise<Expense[]> {
    return [...Array.from(this.expenses.values())]
      .filter(expense => expense.projectId === projectId)
      .reverse();
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

  async deleteExpensesByProject(projectId: string): Promise<number> {
    let count = 0;
    const entries = Array.from(this.expenses.entries());
    for (const [id, expense] of entries) {
      if (expense.projectId === projectId) {
        this.expenses.delete(id);
        count++;
      }
    }
    return count;
  }
}

export const storage = new MemStorage();
