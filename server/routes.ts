import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertBudgetSchema, insertExpenseSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Budget routes
  app.get("/api/budget", async (_req, res) => {
    try {
      const budget = await storage.getBudget();
      res.json(budget);
    } catch (error) {
      res.status(500).json({ error: "Failed to get budget" });
    }
  });

  app.post("/api/budget", async (req, res) => {
    try {
      const parsed = insertBudgetSchema.safeParse(req.body);
      if (!parsed.success) {
        const error = fromZodError(parsed.error);
        return res.status(400).json({ error: error.message });
      }
      
      const budget = await storage.setBudget(parsed.data);
      res.json(budget);
    } catch (error) {
      res.status(500).json({ error: "Failed to set budget" });
    }
  });

  // Expense routes
  app.get("/api/expenses", async (_req, res) => {
    try {
      const expenses = await storage.getExpenses();
      res.json(expenses);
    } catch (error) {
      res.status(500).json({ error: "Failed to get expenses" });
    }
  });

  app.get("/api/expenses/:id", async (req, res) => {
    try {
      const expense = await storage.getExpense(req.params.id);
      if (!expense) {
        return res.status(404).json({ error: "Expense not found" });
      }
      res.json(expense);
    } catch (error) {
      res.status(500).json({ error: "Failed to get expense" });
    }
  });

  app.post("/api/expenses", async (req, res) => {
    try {
      const parsed = insertExpenseSchema.safeParse(req.body);
      if (!parsed.success) {
        const error = fromZodError(parsed.error);
        return res.status(400).json({ error: error.message });
      }
      
      const expense = await storage.createExpense(parsed.data);
      res.status(201).json(expense);
    } catch (error) {
      res.status(500).json({ error: "Failed to create expense" });
    }
  });

  app.patch("/api/expenses/:id", async (req, res) => {
    try {
      const parsed = insertExpenseSchema.safeParse(req.body);
      if (!parsed.success) {
        const error = fromZodError(parsed.error);
        return res.status(400).json({ error: error.message });
      }
      
      const expense = await storage.updateExpense(req.params.id, parsed.data);
      if (!expense) {
        return res.status(404).json({ error: "Expense not found" });
      }
      res.json(expense);
    } catch (error) {
      res.status(500).json({ error: "Failed to update expense" });
    }
  });

  app.delete("/api/expenses/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteExpense(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Expense not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete expense" });
    }
  });

  return httpServer;
}
