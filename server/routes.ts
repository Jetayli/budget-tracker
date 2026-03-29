import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertBudgetSchema,
  insertCategorySchema,
  insertSubcategorySchema,
  insertSpendEntrySchema,
  insertTaskSchema,
} from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import * as XLSX from "xlsx";
import { authMiddleware } from "./auth";

function formatTaskDate(
  value: Date | string | null | undefined,
): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.toISOString();
}

function formatTaskDateOnly(
  value: Date | string | null | undefined,
): string | null {
  const iso = formatTaskDate(value);
  return iso ? iso.slice(0, 10) : null;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  // Public config endpoint (no auth required) - provides frontend configuration
  app.get("/api/config", (_req, res) => {
    res.json({
      supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "",
    });
  });

  // Apply auth middleware to all other /api routes
  app.use("/api", authMiddleware);

  // Project (Budget) routes
  app.get("/api/projects", async (req, res) => {
    try {
      const userId = req.userId!;
      const projects = await storage.getAllBudgets(userId);
      const projectsWithSpent = await Promise.all(
        projects.map(async (project) => {
          const totalSpent = await storage.getTotalSpent(project.id);
          return { ...project, totalSpent };
        }),
      );
      res.json(projectsWithSpent);
    } catch (error) {
      res.status(500).json({ error: "Failed to get projects" });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const userId = req.userId!;
      const project = await storage.getBudget(req.params.id, userId);
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
      const userId = req.userId!;
      const parsed = insertBudgetSchema.safeParse(req.body);
      if (!parsed.success) {
        const error = fromZodError(parsed.error);
        return res.status(400).json({ error: error.message });
      }

      const project = await storage.createBudget(parsed.data, userId);
      res.status(201).json({ ...project, totalSpent: 0 });
    } catch (error) {
      res.status(500).json({ error: "Failed to create project" });
    }
  });

  app.patch("/api/projects/:id", async (req, res) => {
    try {
      const userId = req.userId!;
      const existing = await storage.getBudget(req.params.id, userId);
      if (!existing) {
        return res.status(404).json({ error: "Project not found" });
      }

      const parsed = insertBudgetSchema.safeParse(req.body);
      if (!parsed.success) {
        const error = fromZodError(parsed.error);
        return res.status(400).json({ error: error.message });
      }

      const project = await storage.updateBudget(req.params.id, parsed.data, userId);
      const totalSpent = await storage.getTotalSpent(req.params.id);
      res.json({ ...project, totalSpent });
    } catch (error) {
      res.status(500).json({ error: "Failed to update project" });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const userId = req.userId!;
      const deleted = await storage.deleteBudget(req.params.id, userId);
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
      const userId = req.userId!;
      const project = await storage.getBudget(req.params.projectId, userId);
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
      const userId = req.userId!;
      const project = await storage.getBudget(req.params.projectId, userId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const parsed = insertCategorySchema.safeParse({
        ...req.body,
        budgetId: project.id,
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
        budgetId: existing.budgetId,
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
      const subcategories = await storage.getSubcategories(
        req.params.categoryId,
      );
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
        categoryId: req.params.categoryId,
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
        categoryId: existing.categoryId,
      });
      if (!parsed.success) {
        const error = fromZodError(parsed.error);
        return res.status(400).json({ error: error.message });
      }

      const subcategory = await storage.updateSubcategory(
        req.params.id,
        parsed.data,
      );
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
      const userId = req.userId!;
      const project = await storage.getBudget(req.params.projectId, userId);
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
        subcategoryId as string | undefined,
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
        const subcategory = await storage.getSubcategory(
          req.body.subcategoryId,
        );
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
        const subcategory = await storage.getSubcategory(
          req.body.subcategoryId,
        );
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

  // Task routes
  app.get("/api/projects/:projectId/tasks", async (req, res) => {
    try {
      const userId = req.userId!;
      const project = await storage.getBudget(req.params.projectId, userId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      const categories = await storage.getCategories(project.id);
      const categoryMap = new Map<string, string>();
      const subcategoryMap = new Map<string, string>();

      for (const category of categories) {
        categoryMap.set(category.id, category.name);
        const subs = await storage.getSubcategories(category.id);
        subs.forEach((sub) => subcategoryMap.set(sub.id, sub.name));
      }

      const result = await storage.getTasks(project.id);
      const enriched = result.map((task) => ({
        ...task,
        deadline: formatTaskDateOnly(task.deadline ?? null),
        createdAt: formatTaskDate(task.createdAt ?? null),
        updatedAt: formatTaskDate(task.updatedAt ?? null),
        categoryName: task.categoryId
          ? (categoryMap.get(task.categoryId) ?? null)
          : null,
        subcategoryName: task.subcategoryId
          ? (subcategoryMap.get(task.subcategoryId) ?? null)
          : null,
      }));
      res.json(enriched);
    } catch (error) {
      res.status(500).json({ error: "Failed to get tasks" });
    }
  });

  app.post("/api/projects/:projectId/tasks", async (req, res) => {
    try {
      const userId = req.userId!;
      const project = await storage.getBudget(req.params.projectId, userId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      let categoryId = req.body.categoryId ?? null;
      let subcategoryId = req.body.subcategoryId ?? null;

      if (categoryId) {
        const category = await storage.getCategory(categoryId);
        if (!category || category.budgetId !== project.id) {
          return res
            .status(400)
            .json({ error: "Category not found for this project" });
        }
      }

      if (subcategoryId) {
        const subcategory = await storage.getSubcategory(subcategoryId);
        if (!subcategory) {
          return res.status(400).json({ error: "Subcategory not found" });
        }
        if (categoryId && subcategory.categoryId !== categoryId) {
          return res.status(400).json({
            error: "Subcategory does not belong to the selected category",
          });
        }
        if (!categoryId) {
          const parentCategory = await storage.getCategory(
            subcategory.categoryId,
          );
          if (!parentCategory || parentCategory.budgetId !== project.id) {
            return res
              .status(400)
              .json({ error: "Subcategory not found for this project" });
          }
          categoryId = parentCategory.id;
        }
      }

      const normalizedDeadline =
        typeof req.body.deadline === "string" && req.body.deadline.trim() !== ""
          ? req.body.deadline
          : null;

      const parsed = insertTaskSchema.safeParse({
        ...req.body,
        deadline: normalizedDeadline,
        categoryId,
        subcategoryId,
        projectId: project.id,
      });
      if (!parsed.success) {
        const error = fromZodError(parsed.error);
        return res.status(400).json({ error: error.message });
      }

      const task = await storage.createTask(parsed.data);
      res.status(201).json(task);
    } catch (error) {
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  app.patch("/api/tasks/:id", async (req, res) => {
    try {
      const existing = await storage.getTask(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Task not found" });
      }

      let categoryId = req.body.categoryId ?? existing.categoryId ?? null;
      let subcategoryId =
        req.body.subcategoryId ?? existing.subcategoryId ?? null;

      if (categoryId) {
        const category = await storage.getCategory(categoryId);
        if (!category || category.budgetId !== existing.projectId) {
          return res
            .status(400)
            .json({ error: "Category not found for this project" });
        }
      }

      if (subcategoryId) {
        const subcategory = await storage.getSubcategory(subcategoryId);
        if (!subcategory) {
          return res.status(400).json({ error: "Subcategory not found" });
        }
        if (categoryId && subcategory.categoryId !== categoryId) {
          return res.status(400).json({
            error: "Subcategory does not belong to the selected category",
          });
        }
        if (!categoryId) {
          const parentCategory = await storage.getCategory(
            subcategory.categoryId,
          );
          if (
            !parentCategory ||
            parentCategory.budgetId !== existing.projectId
          ) {
            return res
              .status(400)
              .json({ error: "Subcategory not found for this project" });
          }
          categoryId = parentCategory.id;
        }
      }

      const taskPayload = {
        title: req.body.title ?? existing.title,
        description: req.body.description ?? existing.description ?? "",
        status: req.body.status ?? existing.status,
        priority: req.body.priority ?? existing.priority,
        deadline:
          req.body.deadline === undefined
            ? (existing.deadline ?? null)
            : req.body.deadline && req.body.deadline.trim() !== ""
              ? req.body.deadline
              : null,
        categoryId,
        subcategoryId,
        projectId: existing.projectId,
      };

      const parsed = insertTaskSchema.safeParse(taskPayload);
      if (!parsed.success) {
        const error = fromZodError(parsed.error);
        return res.status(400).json({ error: error.message });
      }

      const task = await storage.updateTask(req.params.id, parsed.data);
      res.json(task);
    } catch (error) {
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  app.delete("/api/tasks/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteTask(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete task" });
    }
  });

  app.get("/api/projects/:projectId/tasks/export/excel", async (req, res) => {
    try {
      const userId = req.userId!;
      const project = await storage.getBudget(req.params.projectId, userId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const categories = await storage.getCategories(project.id);
      const categoryMap = new Map<string, string>();
      const subcategoryMap = new Map<string, string>();

      for (const category of categories) {
        categoryMap.set(category.id, category.name);
        const subs = await storage.getSubcategories(category.id);
        subs.forEach((sub) => subcategoryMap.set(sub.id, sub.name));
      }

      const tasks = await storage.getTasks(project.id);

      const taskRows = tasks.map((task) => [
        task.title,
        task.description || "",
        task.status,
        task.priority,
        formatTaskDateOnly(task.deadline ?? null),
        task.categoryId ? categoryMap.get(task.categoryId) || "" : "",
        task.subcategoryId ? subcategoryMap.get(task.subcategoryId) || "" : "",
        formatTaskDateOnly(task.createdAt ?? null) || "",
        formatTaskDateOnly(task.updatedAt ?? null) || "",
      ]);

      const workbook = XLSX.utils.book_new();
      const headers = [
        "Title",
        "Description",
        "Status",
        "Priority",
        "Deadline",
        "Category",
        "Subcategory",
        "Created",
        "Updated",
      ];
      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...taskRows]);
      worksheet["!cols"] = [
        { wch: 30 },
        { wch: 40 },
        { wch: 15 },
        { wch: 12 },
        { wch: 15 },
        { wch: 20 },
        { wch: 20 },
        { wch: 18 },
        { wch: 18 },
      ];
      XLSX.utils.book_append_sheet(workbook, worksheet, "Tasks");

      const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
      const fileName = `${(project.name || "project").replace(/[^a-zA-Z0-9]/g, "_")}_tasks_report.xlsx`;
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"`,
      );
      res.send(buffer);
    } catch (error) {
      console.error("Task export error:", error);
      res.status(500).json({ error: "Failed to export tasks" });
    }
  });

  // Excel Export endpoint
  app.get("/api/projects/:id/export/excel", async (req, res) => {
    try {
      const userId = req.userId!;
      const project = await storage.getBudget(req.params.id, userId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const totalSpent = await storage.getTotalSpent(project.id);
      const categories = await storage.getCategories(project.id);
      const spendEntries = await storage.getSpendEntriesByBudget(project.id);

      // Get all subcategories for each category
      const categoriesWithSubcategories = await Promise.all(
        categories.map(async (category) => {
          const subcategories = await storage.getSubcategories(category.id);
          const spent = await storage.getCategorySpent(category.id);
          return { ...category, spent, subcategories };
        }),
      );

      // Create workbook
      const workbook = XLSX.utils.book_new();

      // Summary Sheet
      const budgetUsedPercent =
        project.totalBudget > 0
          ? Math.round((totalSpent / project.totalBudget) * 100)
          : 0;
      const summaryData = [
        ["Marketing Budget Report"],
        [],
        ["Project Name", project.name || "Untitled Project"],
        ["Total Budget (SAR)", project.totalBudget],
        ["Total Spent (SAR)", totalSpent],
        ["Remaining (SAR)", project.totalBudget - totalSpent],
        ["Budget Used (%)", budgetUsedPercent],
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      summarySheet["!cols"] = [{ wch: 20 }, { wch: 25 }];
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

      // Categories Sheet
      const categoryHeaders = [
        "Category Name",
        "Allocated Budget (SAR)",
        "Spent (SAR)",
        "Remaining (SAR)",
        "Usage (%)",
      ];
      const categoryData = [
        categoryHeaders,
        ...categoriesWithSubcategories.map((cat) => [
          cat.name,
          cat.allocatedBudget,
          cat.spent,
          cat.allocatedBudget - cat.spent,
          cat.allocatedBudget > 0
            ? Math.round((cat.spent / cat.allocatedBudget) * 100)
            : 0,
        ]),
      ];
      const categorySheet = XLSX.utils.aoa_to_sheet(categoryData);
      categorySheet["!cols"] = [
        { wch: 25 },
        { wch: 20 },
        { wch: 15 },
        { wch: 15 },
        { wch: 12 },
      ];
      XLSX.utils.book_append_sheet(workbook, categorySheet, "Categories");

      // Subcategories (Platforms) Sheet - batch fetch all subcategory spent values
      const subcategoryHeaders = [
        "Platform Name",
        "Category",
        "Allocated Budget (SAR)",
        "Spent (SAR)",
        "Remaining (SAR)",
      ];
      const subcategoryRows: (string | number)[][] = [subcategoryHeaders];
      const allSubcategoryIds: string[] = [];
      for (const category of categoriesWithSubcategories) {
        for (const sub of category.subcategories) {
          allSubcategoryIds.push(sub.id);
        }
      }
      const subcategorySpentMap = new Map<string, number>();
      await Promise.all(
        allSubcategoryIds.map(async (id) => {
          const spent = await storage.getSubcategorySpent(id);
          subcategorySpentMap.set(id, spent);
        }),
      );
      for (const category of categoriesWithSubcategories) {
        for (const sub of category.subcategories) {
          const subSpent = subcategorySpentMap.get(sub.id) || 0;
          subcategoryRows.push([
            sub.name,
            category.name,
            sub.allocatedBudget,
            subSpent,
            sub.allocatedBudget - subSpent,
          ]);
        }
      }
      const subcategorySheet = XLSX.utils.aoa_to_sheet(subcategoryRows);
      subcategorySheet["!cols"] = [
        { wch: 25 },
        { wch: 20 },
        { wch: 20 },
        { wch: 15 },
        { wch: 15 },
      ];
      XLSX.utils.book_append_sheet(workbook, subcategorySheet, "Platforms");

      // Spend Entries Sheet
      const spendHeaders = [
        "Date",
        "Description",
        "Amount (SAR)",
        "Category",
        "Platform",
      ];
      const categoryMap = new Map(
        categoriesWithSubcategories.map((c) => [c.id, c.name]),
      );
      const subcategoryMap = new Map<string, string>();
      for (const cat of categoriesWithSubcategories) {
        for (const sub of cat.subcategories) {
          subcategoryMap.set(sub.id, sub.name);
        }
      }
      const spendData = [
        spendHeaders,
        ...spendEntries.map((entry) => [
          entry.date,
          entry.description || "",
          entry.amount,
          categoryMap.get(entry.categoryId) || "",
          entry.subcategoryId
            ? subcategoryMap.get(entry.subcategoryId) || ""
            : "",
        ]),
      ];
      const spendSheet = XLSX.utils.aoa_to_sheet(spendData);
      spendSheet["!cols"] = [
        { wch: 12 },
        { wch: 40 },
        { wch: 15 },
        { wch: 20 },
        { wch: 20 },
      ];
      XLSX.utils.book_append_sheet(workbook, spendSheet, "Spend Entries");

      // Generate buffer
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

      // Set headers and send file
      const fileName = `${(project.name || "project").replace(/[^a-zA-Z0-9]/g, "_")}_budget_report.xlsx`;
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"`,
      );
      res.send(buffer);
    } catch (error) {
      console.error("Excel export error:", error);
      res.status(500).json({ error: "Failed to export project to Excel" });
    }
  });

  return httpServer;
}
