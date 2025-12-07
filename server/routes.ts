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
  
  // Project (Budget) routes
  app.get("/api/projects", async (_req, res) => {
    try {
      const projects = await storage.getAllBudgets();
      const projectsWithSpent = await Promise.all(
        projects.map(async (project) => {
          const totalSpent = await storage.getTotalSpent(project.id);
          return { ...project, totalSpent };
        })
      );
      res.json(projectsWithSpent);
    } catch (error) {
      res.status(500).json({ error: "Failed to get projects" });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.getBudget(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      const totalSpent = await storage.getTotalSpent(project.id);
      res.json({ ...project, totalSpent });
    } catch (error) {
      res.status(500).json({ error: "Failed to get project" });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const parsed = insertBudgetSchema.safeParse(req.body);
      if (!parsed.success) {
        const error = fromZodError(parsed.error);
        return res.status(400).json({ error: error.message });
      }
      
      const project = await storage.createBudget(parsed.data);
      res.status(201).json({ ...project, totalSpent: 0 });
    } catch (error) {
      res.status(500).json({ error: "Failed to create project" });
    }
  });

  app.patch("/api/projects/:id", async (req, res) => {
    try {
      const existing = await storage.getBudget(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Project not found" });
      }

      const parsed = insertBudgetSchema.safeParse(req.body);
      if (!parsed.success) {
        const error = fromZodError(parsed.error);
        return res.status(400).json({ error: error.message });
      }
      
      const project = await storage.updateBudget(req.params.id, parsed.data);
      const totalSpent = await storage.getTotalSpent(req.params.id);
      res.json({ ...project, totalSpent });
    } catch (error) {
      res.status(500).json({ error: "Failed to update project" });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteBudget(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  // Category routes - now require projectId
  app.get("/api/projects/:projectId/categories", async (req, res) => {
    try {
      const project = await storage.getBudget(req.params.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      const categories = await storage.getCategories(project.id);
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

  app.post("/api/projects/:projectId/categories", async (req, res) => {
    try {
      const project = await storage.getBudget(req.params.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const parsed = insertCategorySchema.safeParse({
        ...req.body,
        budgetId: project.id
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

  app.post("/api/categories/:categoryId/subcategories", async (req, res) => {
    try {
      const category = await storage.getCategory(req.params.categoryId);
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }

      const parsed = insertSubcategorySchema.safeParse({
        ...req.body,
        categoryId: req.params.categoryId
      });
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
  app.get("/api/projects/:projectId/spend-entries", async (req, res) => {
    try {
      const project = await storage.getBudget(req.params.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      const entries = await storage.getSpendEntriesByBudget(project.id);
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: "Failed to get spend entries" });
    }
  });

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
