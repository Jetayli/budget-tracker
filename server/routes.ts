import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertBudgetSchema, 
  insertCategorySchema, 
  insertSubcategorySchema, 
  insertSpendEntrySchema 
} from "@shared/schema";
import { fromZodError } from "zod-validation-error";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Budget routes
  app.get("/api/budget", async (_req, res) => {
    try {
      const budget = await storage.getBudget();
      if (!budget) {
        return res.json(null);
      }
      const totalSpent = await storage.getTotalSpent(budget.id);
      res.json({ ...budget, totalSpent });
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
      
      const existingBudget = await storage.getBudget();
      if (existingBudget) {
        const updated = await storage.updateBudget(existingBudget.id, parsed.data);
        const totalSpent = await storage.getTotalSpent(existingBudget.id);
        return res.json({ ...updated, totalSpent });
      }
      
      const budget = await storage.createBudget(parsed.data);
      res.status(201).json({ ...budget, totalSpent: 0 });
    } catch (error) {
      res.status(500).json({ error: "Failed to create/update budget" });
    }
  });

  // Category routes
  app.get("/api/categories", async (_req, res) => {
    try {
      const budget = await storage.getBudget();
      if (!budget) {
        return res.json([]);
      }
      const categories = await storage.getCategories(budget.id);
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: "Failed to get categories" });
    }
  });

  app.get("/api/categories/:id", async (req, res) => {
    try {
      const category = await storage.getCategory(req.params.id);
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      const spent = await storage.getCategorySpent(category.id);
      res.json({ ...category, spent });
    } catch (error) {
      res.status(500).json({ error: "Failed to get category" });
    }
  });

  app.post("/api/categories", async (req, res) => {
    try {
      const budget = await storage.getBudget();
      if (!budget) {
        return res.status(400).json({ error: "No budget set. Please set a budget first." });
      }

      const parsed = insertCategorySchema.safeParse({
        ...req.body,
        budgetId: budget.id
      });
      if (!parsed.success) {
        const error = fromZodError(parsed.error);
        return res.status(400).json({ error: error.message });
      }
      
      const category = await storage.createCategory(parsed.data);
      res.status(201).json({ ...category, spent: 0 });
    } catch (error) {
      res.status(500).json({ error: "Failed to create category" });
    }
  });

  app.patch("/api/categories/:id", async (req, res) => {
    try {
      const existing = await storage.getCategory(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Category not found" });
      }

      const parsed = insertCategorySchema.safeParse({
        ...req.body,
        budgetId: existing.budgetId
      });
      if (!parsed.success) {
        const error = fromZodError(parsed.error);
        return res.status(400).json({ error: error.message });
      }
      
      const category = await storage.updateCategory(req.params.id, parsed.data);
      const spent = await storage.getCategorySpent(req.params.id);
      res.json({ ...category, spent });
    } catch (error) {
      res.status(500).json({ error: "Failed to update category" });
    }
  });

  app.delete("/api/categories/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteCategory(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete category" });
    }
  });

  // Subcategory routes
  app.get("/api/categories/:categoryId/subcategories", async (req, res) => {
    try {
      const subcategories = await storage.getSubcategories(req.params.categoryId);
      res.json(subcategories);
    } catch (error) {
      res.status(500).json({ error: "Failed to get subcategories" });
    }
  });

  app.get("/api/subcategories/:id", async (req, res) => {
    try {
      const subcategory = await storage.getSubcategory(req.params.id);
      if (!subcategory) {
        return res.status(404).json({ error: "Subcategory not found" });
      }
      const spent = await storage.getSubcategorySpent(subcategory.id);
      res.json({ ...subcategory, spent });
    } catch (error) {
      res.status(500).json({ error: "Failed to get subcategory" });
    }
  });

  app.post("/api/subcategories", async (req, res) => {
    try {
      const category = await storage.getCategory(req.body.categoryId);
      if (!category) {
        return res.status(400).json({ error: "Category not found" });
      }

      const parsed = insertSubcategorySchema.safeParse(req.body);
      if (!parsed.success) {
        const error = fromZodError(parsed.error);
        return res.status(400).json({ error: error.message });
      }
      
      const subcategory = await storage.createSubcategory(parsed.data);
      res.status(201).json({ ...subcategory, spent: 0 });
    } catch (error) {
      res.status(500).json({ error: "Failed to create subcategory" });
    }
  });

  app.patch("/api/subcategories/:id", async (req, res) => {
    try {
      const existing = await storage.getSubcategory(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Subcategory not found" });
      }

      const parsed = insertSubcategorySchema.safeParse({
        ...req.body,
        categoryId: existing.categoryId
      });
      if (!parsed.success) {
        const error = fromZodError(parsed.error);
        return res.status(400).json({ error: error.message });
      }
      
      const subcategory = await storage.updateSubcategory(req.params.id, parsed.data);
      const spent = await storage.getSubcategorySpent(req.params.id);
      res.json({ ...subcategory, spent });
    } catch (error) {
      res.status(500).json({ error: "Failed to update subcategory" });
    }
  });

  app.delete("/api/subcategories/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteSubcategory(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Subcategory not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete subcategory" });
    }
  });

  // Spend Entry routes
  app.get("/api/spend-entries", async (req, res) => {
    try {
      const { categoryId, subcategoryId } = req.query;
      const entries = await storage.getSpendEntries(
        categoryId as string | undefined,
        subcategoryId as string | undefined
      );
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: "Failed to get spend entries" });
    }
  });

  app.get("/api/spend-entries/:id", async (req, res) => {
    try {
      const entry = await storage.getSpendEntry(req.params.id);
      if (!entry) {
        return res.status(404).json({ error: "Spend entry not found" });
      }
      res.json(entry);
    } catch (error) {
      res.status(500).json({ error: "Failed to get spend entry" });
    }
  });

  app.post("/api/spend-entries", async (req, res) => {
    try {
      const category = await storage.getCategory(req.body.categoryId);
      if (!category) {
        return res.status(400).json({ error: "Category not found" });
      }

      if (req.body.subcategoryId) {
        const subcategory = await storage.getSubcategory(req.body.subcategoryId);
        if (!subcategory) {
          return res.status(400).json({ error: "Subcategory not found" });
        }
      }

      const parsed = insertSpendEntrySchema.safeParse(req.body);
      if (!parsed.success) {
        const error = fromZodError(parsed.error);
        return res.status(400).json({ error: error.message });
      }
      
      const entry = await storage.createSpendEntry(parsed.data);
      res.status(201).json(entry);
    } catch (error) {
      res.status(500).json({ error: "Failed to create spend entry" });
    }
  });

  app.patch("/api/spend-entries/:id", async (req, res) => {
    try {
      const existing = await storage.getSpendEntry(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Spend entry not found" });
      }

      const category = await storage.getCategory(req.body.categoryId);
      if (!category) {
        return res.status(400).json({ error: "Category not found" });
      }

      if (req.body.subcategoryId) {
        const subcategory = await storage.getSubcategory(req.body.subcategoryId);
        if (!subcategory) {
          return res.status(400).json({ error: "Subcategory not found" });
        }
      }

      const parsed = insertSpendEntrySchema.safeParse(req.body);
      if (!parsed.success) {
        const error = fromZodError(parsed.error);
        return res.status(400).json({ error: error.message });
      }
      
      const entry = await storage.updateSpendEntry(req.params.id, parsed.data);
      res.json(entry);
    } catch (error) {
      res.status(500).json({ error: "Failed to update spend entry" });
    }
  });

  app.delete("/api/spend-entries/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteSpendEntry(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Spend entry not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete spend entry" });
    }
  });

  return httpServer;
}
