import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { slugify } from "@/lib/slug";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useParams, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import {
  type Budget,
  type CategoryWithSpent,
  type SubcategoryWithSpent,
  type SpendEntry,
  type Task,
} from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { LanguageToggle } from "@/components/language-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DollarSign,
  Plus,
  Pencil,
  Trash2,
  TrendingDown,
  Wallet,
  ChevronDown,
  ChevronRight,
  Layers,
  Receipt,
  CheckSquare,
  Target,
  ArrowLeft,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import { format, parseISO } from "date-fns";

type ProjectWithSpent = Budget & { totalSpent: number };
type TaskWithMeta = Omit<Task, "createdAt" | "updatedAt" | "deadline"> & {
  deadline: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  categoryName: string | null;
  subcategoryName: string | null;
};

export const createSpendEntryFormSchema = (t: (key: string) => string) =>
  z.object({
    amount: z.coerce.number().min(0.01, t("projectForm.budgetRequired")),
    description: z.string().min(1, t("spend.descriptionPlaceholder")),
    note: z.string().optional().nullable(),
    date: z.string().min(1, t("spend.date")),
    startDate: z.string().optional().nullable(),
    endDate: z.string().optional().nullable(),
    categoryId: z.string().min(1, t("spend.selectCategory")),
    subcategoryId: z.string().optional().nullable(),
  });

export type SpendEntryFormValues = z.infer<
  ReturnType<typeof createSpendEntryFormSchema>
>;

const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
type TaskStatus = (typeof TASK_STATUSES)[number];
const TASK_PRIORITIES = ["high", "medium", "low"] as const;
type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const createTaskFormSchema = (t: (key: string) => string) =>
  z.object({
    title: z.string().min(1, t("tasks.validationTitle")),
    description: z.string().optional().nullable(),
    status: z.enum(TASK_STATUSES, {
      errorMap: () => ({ message: t("tasks.validationStatus") }),
    }),
    priority: z.enum(TASK_PRIORITIES, {
      errorMap: () => ({ message: t("tasks.validationPriority") }),
    }),
    deadline: z.string().optional().nullable(),
    categoryId: z.string().optional().nullable(),
    subcategoryId: z.string().optional().nullable(),
  });

export type TaskFormValues = z.infer<ReturnType<typeof createTaskFormSchema>>;

export const TASK_STATUS_OPTIONS = TASK_STATUSES.map((value) => ({
  value,
  labelKey:
    value === "todo"
      ? "tasks.statusTodo"
      : value === "in_progress"
        ? "tasks.statusInProgress"
        : "tasks.statusDone",
}));

export const TASK_PRIORITY_OPTIONS = TASK_PRIORITIES.map((value) => ({
  value,
  labelKey:
    value === "high"
      ? "tasks.priorityHigh"
      : value === "medium"
        ? "tasks.priorityMedium"
        : "tasks.priorityLow",
}));

const PRIORITY_BADGE_STYLES: Record<TaskPriority, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-emerald-100 text-emerald-700",
};

function getTodayDateString(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function formatDisplayDate(dateString: string): string {
  try {
    return format(parseISO(dateString), "MMM d, yyyy");
  } catch {
    return dateString;
  }
}

function formatCurrency(amount: number, language: string = "en"): string {
  const locale = language === "ar" ? "ar-SA" : "en-SA";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "SAR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getStatusColor(percentUsed: number): string {
  if (percentUsed >= 80) return "text-red-600 dark:text-red-400";
  if (percentUsed >= 50) return "text-yellow-600 dark:text-yellow-400";
  return "text-green-600 dark:text-green-400";
}

function getProgressColor(percentUsed: number): string {
  if (percentUsed >= 80) return "bg-red-500";
  if (percentUsed >= 50) return "bg-yellow-500";
  return "bg-green-500";
}

function StatusBadge({ percentUsed }: { percentUsed: number }) {
  const { t } = useTranslation();

  if (percentUsed >= 80) {
    return (
      <Badge variant="destructive" className="text-xs">
        {t("status.over80")}
      </Badge>
    );
  }
  if (percentUsed >= 50) {
    return (
      <Badge className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30 text-xs">
        {t("status.between50and80")}
      </Badge>
    );
  }
  return (
    <Badge className="bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30 text-xs">
      {t("status.under50")}
    </Badge>
  );
}

function EditProjectDialog({
  project,
  open,
  onOpenChange,
}: {
  project: ProjectWithSpent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();

  const projectFormSchema = z.object({
    name: z.string().min(1, t("projectForm.projectNameRequired")),
    totalBudget: z.coerce.number().min(0.01, t("projectForm.budgetRequired")),
  });

  type ProjectFormValues = z.infer<typeof projectFormSchema>;

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: project.name || "",
      totalBudget: project.totalBudget,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: project.name || "",
        totalBudget: project.totalBudget,
      });
    }
  }, [project, open, form]);

  const mutation = useMutation({
    mutationFn: async (data: ProjectFormValues) => {
      const res = await apiRequest(
        "PATCH",
        `/api/projects/${project.id}`,
        data,
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", project.id],
      });
      toast({
        title: t("toast.projectUpdated"),
        description: t("toast.projectUpdatedDesc"),
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const isRTL = i18n.language === "ar";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("projectForm.editTitle")}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("projectForm.projectName")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("projectForm.projectNamePlaceholder")}
                      data-testid="input-edit-project-name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="totalBudget"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("projectForm.totalBudget")}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span
                        className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 text-muted-foreground text-sm`}
                      >
                        {t("currency.sar")}
                      </span>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        className={`${isRTL ? "pr-12" : "pl-12"} tabular-nums`}
                        data-testid="input-edit-project-budget"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  {t("common.cancel")}
                </Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={mutation.isPending}
                data-testid="button-update-project"
              >
                {mutation.isPending
                  ? t("common.saving")
                  : t("projectForm.updateButton")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function ProjectOverview({
  project,
  isLoading,
}: {
  project: ProjectWithSpent | null;
  isLoading: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [editOpen, setEditOpen] = useState(false);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-16 w-64" />
            <Skeleton className="h-4 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!project) {
    return null;
  }

  const remaining = project.totalBudget - project.totalSpent;
  const percentUsed =
    project.totalBudget > 0
      ? (project.totalSpent / project.totalBudget) * 100
      : 0;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            {project.name || t("project.projectBudget")}
          </CardTitle>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setEditOpen(true)}
            data-testid="button-edit-project"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Wallet className="h-4 w-4" />
                {t("project.totalBudget")}
              </p>
              <p
                className="text-2xl font-bold tabular-nums"
                data-testid="text-total-budget"
              >
                {formatCurrency(project.totalBudget, i18n.language)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <TrendingDown className="h-4 w-4" />
                {t("project.totalSpent")}
              </p>
              <p
                className="text-2xl font-bold tabular-nums"
                data-testid="text-total-spent"
              >
                {formatCurrency(project.totalSpent, i18n.language)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-4 w-4" />
                {t("project.remaining")}
              </p>
              <p
                className={`text-2xl font-bold tabular-nums ${getStatusColor(percentUsed)}`}
                data-testid="text-remaining"
              >
                {formatCurrency(remaining, i18n.language)}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">
                {t("project.budgetUsed")}
              </span>
              <div className="flex items-center gap-2">
                <span className="font-medium tabular-nums">
                  {Math.round(percentUsed)}%
                </span>
                <StatusBadge percentUsed={percentUsed} />
              </div>
            </div>
            <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full transition-all duration-500 ease-out ${getProgressColor(percentUsed)}`}
                style={{ width: `${Math.min(percentUsed, 100)}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
      <EditProjectDialog
        project={project}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  );
}

function AddCategoryDialog({
  projectId,
  onSuccess,
}: {
  projectId: string;
  onSuccess: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const categoryFormSchema = z.object({
    name: z.string().min(1, t("category.categoryNamePlaceholder")),
    allocatedBudget: z.coerce
      .number()
      .min(0.01, t("projectForm.budgetRequired")),
  });

  type CategoryFormValues = z.infer<typeof categoryFormSchema>;

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: "",
      allocatedBudget: undefined as unknown as number,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: CategoryFormValues) => {
      const res = await apiRequest(
        "POST",
        `/api/projects/${projectId}/categories`,
        data,
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", projectId, "categories"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: t("toast.categoryAdded"),
        description: t("toast.categoryAddedDesc"),
      });
      setOpen(false);
      form.reset();
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const isRTL = i18n.language === "ar";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="button-add-category">
          <Plus className={`h-4 w-4 ${isRTL ? "ml-2" : "mr-2"}`} />
          {t("category.addCategory")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("category.addCategory")}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("category.categoryName")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("category.categoryNamePlaceholder")}
                      data-testid="input-category-name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="allocatedBudget"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("category.allocatedBudget")}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span
                        className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 text-muted-foreground text-sm`}
                      >
                        {t("currency.sar")}
                      </span>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        placeholder={t("category.budgetPlaceholder")}
                        className={`${isRTL ? "pr-12" : "pl-12"} tabular-nums`}
                        data-testid="input-category-budget"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  {t("common.cancel")}
                </Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={mutation.isPending}
                data-testid="button-save-category"
              >
                {mutation.isPending
                  ? t("common.adding")
                  : t("category.addCategory")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function EditCategoryDialog({
  category,
  open,
  onOpenChange,
  projectId,
}: {
  category: CategoryWithSpent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();

  const categoryFormSchema = z.object({
    name: z.string().min(1, t("category.categoryNamePlaceholder")),
    allocatedBudget: z.coerce
      .number()
      .min(0.01, t("projectForm.budgetRequired")),
  });

  type CategoryFormValues = z.infer<typeof categoryFormSchema>;

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: category?.name || "",
      allocatedBudget: category?.allocatedBudget || 0,
    },
  });

  useEffect(() => {
    if (category && open) {
      form.reset({
        name: category.name,
        allocatedBudget: category.allocatedBudget,
      });
    }
  }, [category, open, form]);

  const mutation = useMutation({
    mutationFn: async (data: CategoryFormValues) => {
      if (!category) return;
      const res = await apiRequest(
        "PATCH",
        `/api/categories/${category.id}`,
        data,
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", projectId, "categories"],
      });
      toast({
        title: t("toast.categoryUpdated"),
        description: t("toast.categoryUpdatedDesc"),
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const isRTL = i18n.language === "ar";

  if (!category) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("category.editCategory")}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("category.categoryName")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("category.categoryName")}
                      data-testid="input-edit-category-name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="allocatedBudget"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("category.allocatedBudget")}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span
                        className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 text-muted-foreground text-sm`}
                      >
                        {t("currency.sar")}
                      </span>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        className={`${isRTL ? "pr-12" : "pl-12"} tabular-nums`}
                        data-testid="input-edit-category-budget"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  {t("common.cancel")}
                </Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={mutation.isPending}
                data-testid="button-update-category"
              >
                {mutation.isPending
                  ? t("common.saving")
                  : t("category.editCategory")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function AddSubcategoryDialog({
  categoryId,
  categoryName,
  projectId,
  onSuccess,
}: {
  categoryId: string;
  categoryName: string;
  projectId: string;
  onSuccess: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const subcategoryFormSchema = z.object({
    name: z.string().min(1, t("platform.platformNamePlaceholder")),
    allocatedBudget: z.coerce
      .number()
      .min(0.01, t("projectForm.budgetRequired")),
    categoryId: z.string().min(1),
  });

  type SubcategoryFormValues = z.infer<typeof subcategoryFormSchema>;

  const form = useForm<SubcategoryFormValues>({
    resolver: zodResolver(subcategoryFormSchema),
    defaultValues: {
      name: "",
      allocatedBudget: undefined as unknown as number,
      categoryId: categoryId,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: SubcategoryFormValues) => {
      const res = await apiRequest(
        "POST",
        `/api/categories/${categoryId}/subcategories`,
        data,
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/categories", categoryId, "subcategories"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", projectId, "categories"],
      });
      toast({
        title: t("toast.platformAdded"),
        description: t("toast.platformAddedDesc"),
      });
      setOpen(false);
      form.reset({
        name: "",
        allocatedBudget: undefined as unknown as number,
        categoryId,
      });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const isRTL = i18n.language === "ar";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          data-testid={`button-add-subcategory-${categoryId}`}
        >
          <Plus className={`h-3 w-3 ${isRTL ? "ml-1" : "mr-1"}`} />
          {t("common.add")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("platform.addPlatformTo", { name: categoryName })}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("platform.platformName")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("platform.platformNamePlaceholder")}
                      data-testid="input-subcategory-name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="allocatedBudget"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("platform.allocatedBudget")}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span
                        className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 text-muted-foreground text-sm`}
                      >
                        {t("currency.sar")}
                      </span>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        placeholder={t("platform.budgetPlaceholder")}
                        className={`${isRTL ? "pr-12" : "pl-12"} tabular-nums`}
                        data-testid="input-subcategory-budget"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  {t("common.cancel")}
                </Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={mutation.isPending}
                data-testid="button-save-subcategory"
              >
                {mutation.isPending
                  ? t("common.adding")
                  : t("platform.addPlatform")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function EditSubcategoryDialog({
  subcategory,
  categoryId,
  projectId,
  open,
  onOpenChange,
}: {
  subcategory: SubcategoryWithSpent;
  categoryId: string;
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();

  const subcategoryFormSchema = z.object({
    name: z.string().min(1, t("platform.platformNamePlaceholder")),
    allocatedBudget: z.coerce
      .number()
      .min(0.01, t("projectForm.budgetRequired")),
    categoryId: z.string().min(1),
  });

  type SubcategoryFormValues = z.infer<typeof subcategoryFormSchema>;

  const form = useForm<SubcategoryFormValues>({
    resolver: zodResolver(subcategoryFormSchema),
    defaultValues: {
      name: subcategory.name,
      allocatedBudget: subcategory.allocatedBudget,
      categoryId: categoryId,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: subcategory.name,
        allocatedBudget: subcategory.allocatedBudget,
        categoryId: categoryId,
      });
    }
  }, [subcategory, categoryId, open, form]);

  const mutation = useMutation({
    mutationFn: async (data: SubcategoryFormValues) => {
      const res = await apiRequest(
        "PATCH",
        `/api/subcategories/${subcategory.id}`,
        data,
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/categories", categoryId, "subcategories"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", projectId, "categories"],
      });
      toast({
        title: t("toast.platformUpdated"),
        description: t("toast.platformUpdatedDesc"),
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const isRTL = i18n.language === "ar";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("platform.editPlatform")}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("platform.platformName")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("platform.platformName")}
                      data-testid="input-edit-subcategory-name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="allocatedBudget"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("platform.allocatedBudget")}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span
                        className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 text-muted-foreground text-sm`}
                      >
                        {t("currency.sar")}
                      </span>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        className={`${isRTL ? "pr-12" : "pl-12"} tabular-nums`}
                        data-testid="input-edit-subcategory-budget"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  {t("common.cancel")}
                </Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={mutation.isPending}
                data-testid="button-update-subcategory"
              >
                {mutation.isPending
                  ? t("common.saving")
                  : t("platform.editPlatform")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function SubcategoryRow({
  subcategory,
  categoryId,
  projectId,
  onDelete,
}: {
  subcategory: SubcategoryWithSpent;
  categoryId: string;
  projectId: string;
  onDelete: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);

  const percentUsed =
    subcategory.allocatedBudget > 0
      ? (subcategory.spent / subcategory.allocatedBudget) * 100
      : 0;

  const { data: spendEntries = [], isLoading: spendEntriesLoading } = useQuery<
    SpendEntry[]
  >({
    queryKey: [`/api/spend-entries?subcategoryId=${subcategory.id}`],
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/subcategories/${subcategory.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/categories", categoryId, "subcategories"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", projectId, "categories"],
      });
      toast({
        title: t("toast.platformDeleted"),
        description: t("toast.platformDeletedDesc"),
      });
      onDelete();
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <>
      <div
        className="flex items-center justify-between py-2 px-3 bg-muted/20 rounded-md"
        data-testid={`row-subcategory-${subcategory.id}`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium truncate">
              {subcategory.name}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="tabular-nums">
              {formatCurrency(subcategory.spent, i18n.language)} /{" "}
              {formatCurrency(subcategory.allocatedBudget, i18n.language)}
            </span>
            <div className="flex items-center gap-2">
              <span
                className={`font-medium tabular-nums ${getStatusColor(percentUsed)}`}
              >
                {Math.round(percentUsed)}%
              </span>
            </div>
          </div>
          <div className="relative mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full transition-all duration-300 ease-out ${getProgressColor(percentUsed)}`}
              style={{ width: `${Math.min(percentUsed, 100)}%` }}
            />
          </div>
          <div className="mt-3 space-y-2 text-xs">
            {spendEntriesLoading ? (
              <Skeleton className="h-4 w-full" />
            ) : spendEntries.length === 0 ? (
              <p className="text-muted-foreground">
                {t("spend.noSpendEntries")}
              </p>
            ) : (
              spendEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-md bg-background/60 px-2 py-1 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(entry.amount, i18n.language)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatDisplayDate(entry.date)}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {entry.description}
                    {entry.note ? ` • ${entry.note}` : ""}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setEditOpen(true)}
            data-testid={`button-edit-subcategory-${subcategory.id}`}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                data-testid={`button-delete-subcategory-${subcategory.id}`}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t("platform.deletePlatform")}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t("platform.deleteConfirm", { name: subcategory.name })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteMutation.mutate()}>
                  {t("common.delete")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      <EditSubcategoryDialog
        subcategory={subcategory}
        categoryId={categoryId}
        projectId={projectId}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  );
}

function CategoryCard({
  category,
  projectId,
}: {
  category: CategoryWithSpent;
  projectId: string;
}) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const percentUsed =
    category.allocatedBudget > 0
      ? (category.spent / category.allocatedBudget) * 100
      : 0;
  const remaining = Math.max(category.allocatedBudget - category.spent, 0);

  const { data: subcategories = [], isLoading: subcategoriesLoading } =
    useQuery<SubcategoryWithSpent[]>({
      queryKey: ["/api/categories", category.id, "subcategories"],
    });

  const sumSubAllocated = subcategories.reduce(
    (sum, sub) => sum + sub.allocatedBudget,
    0,
  );
  const subAllocatedPercent =
    category.allocatedBudget > 0
      ? (sumSubAllocated / category.allocatedBudget) * 100
      : 0;
  const remainingAfterSub = Math.max(
    category.allocatedBudget - sumSubAllocated,
    0,
  );

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/categories/${category.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", projectId, "categories"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: t("toast.categoryDeleted"),
        description: t("toast.categoryDeletedDesc"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <>
      <Card data-testid={`card-category-${category.id}`}>
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="p-0 h-auto hover:bg-transparent justify-start flex-1 min-w-0"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0" />
                    )}
                    <CardTitle className="text-base truncate">
                      {category.name}
                    </CardTitle>
                  </div>
                </Button>
              </CollapsibleTrigger>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setEditOpen(true)}
                  data-testid={`button-edit-category-${category.id}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      data-testid={`button-delete-category-${category.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {t("category.deleteCategory")}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("category.deleteConfirm", { name: category.name })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>
                        {t("common.cancel")}
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate()}
                      >
                        {t("common.delete")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">الميزانية</span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(category.allocatedBudget, i18n.language)}
                </span>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">
                  إجمالي الفئات الفرعية
                </span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(sumSubAllocated, i18n.language)}
                </span>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">
                  نسبة إجمالي الفئات الفرعية
                </span>
                <span
                  className={`font-medium tabular-nums ${getStatusColor(subAllocatedPercent)}`}
                >
                  {Math.round(subAllocatedPercent)}%
                </span>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">
                  المتبقي من الميزانية بعد اضافة الفئات الفرعية
                </span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(remainingAfterSub, i18n.language)}
                </span>
              </div>

              <Separator className="my-3" />

              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">إجمالي المصروف</span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(category.spent, i18n.language)}
                </span>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">
                  نسبة إجمالي المصروف
                </span>
                <span
                  className={`font-medium tabular-nums ${getStatusColor(percentUsed)}`}
                >
                  {Math.round(percentUsed)}%
                </span>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">
                  المتبقي من الميزانية
                </span>
                <span
                  className={`font-medium tabular-nums ${getStatusColor(percentUsed)}`}
                >
                  {formatCurrency(remaining, i18n.language)}
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">
                    {t("project.budgetUsed")}
                  </span>
                  <span className="font-medium tabular-nums">
                    {Math.round(percentUsed)}%
                  </span>
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full transition-all duration-300 ease-out ${getProgressColor(percentUsed)}`}
                    style={{ width: `${Math.min(percentUsed, 100)}%` }}
                  />
                </div>
              </div>

              <CollapsibleContent>
                <div className="pt-3 space-y-3 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      {t("platform.platforms")}
                    </span>
                    <AddSubcategoryDialog
                      categoryId={category.id}
                      categoryName={category.name}
                      projectId={projectId}
                      onSuccess={() => {}}
                    />
                  </div>

                  {subcategoriesLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ) : subcategories.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {t("platform.platformNamePlaceholder")}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {subcategories.map((sub) => (
                        <SubcategoryRow
                          key={sub.id}
                          subcategory={sub}
                          categoryId={category.id}
                          projectId={projectId}
                          onDelete={() => {}}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </CardContent>
        </Collapsible>
      </Card>
      <EditCategoryDialog
        category={category}
        open={editOpen}
        onOpenChange={setEditOpen}
        projectId={projectId}
      />
    </>
  );
}

function AddSpendEntryDialog({
  categories,
  projectId,
  onSuccess,
}: {
  categories: CategoryWithSpent[];
  projectId: string;
  onSuccess: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const spendEntryFormSchema = useMemo(
    () => createSpendEntryFormSchema(t),
    [t],
  );

  const form = useForm<SpendEntryFormValues>({
    resolver: zodResolver(spendEntryFormSchema),
    defaultValues: {
      amount: undefined as unknown as number,
      description: "",
      note: "",
      date: getTodayDateString(),
      startDate: null,
      endDate: null,
      categoryId: "",
      subcategoryId: null,
    },
  });

  const { data: subcategories = [] } = useQuery<SubcategoryWithSpent[]>({
    queryKey: ["/api/categories", selectedCategoryId, "subcategories"],
    enabled: !!selectedCategoryId,
  });

  const mutation = useMutation({
    mutationFn: async (data: SpendEntryFormValues) => {
      const payload = {
        ...data,
        note: data.note && data.note.trim() !== "" ? data.note.trim() : null,
        subcategoryId:
          data.subcategoryId === "" || data.subcategoryId === "none"
            ? null
            : data.subcategoryId,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
      };
      const res = await apiRequest("POST", "/api/spend-entries", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", projectId, "spend-entries"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", projectId, "categories"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: t("toast.spendAdded"),
        description: t("toast.spendAddedDesc"),
      });
      setOpen(false);
      form.reset({
        amount: undefined as unknown as number,
        description: "",
        date: getTodayDateString(),
        startDate: null,
        endDate: null,
        categoryId: "",
        subcategoryId: null,
      });
      setSelectedCategoryId("");
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCategoryChange = (value: string) => {
    setSelectedCategoryId(value);
    form.setValue("categoryId", value);
    form.setValue("subcategoryId", null);
  };

  const isRTL = i18n.language === "ar";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-add-spend">
          <Receipt className={`h-4 w-4 ${isRTL ? "ml-2" : "mr-2"}`} />
          {t("spend.addSpend")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("spend.addSpend")}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("spend.amount")}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span
                        className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 text-muted-foreground text-sm`}
                      >
                        {t("currency.sar")}
                      </span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder={t("spend.amountPlaceholder")}
                        className={`${isRTL ? "pr-12" : "pl-12"} tabular-nums`}
                        data-testid="input-spend-amount"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("spend.description")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("spend.descriptionPlaceholder")}
                      data-testid="input-spend-description"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("spend.note")}</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder={t("spend.notePlaceholder")}
                      data-testid="input-spend-note"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("spend.date")}</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      data-testid="input-spend-date"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("spend.startDate")}</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        data-testid="input-spend-start-date"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("spend.endDate")}</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        data-testid="input-spend-end-date"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("sections.categories")}</FormLabel>
                  <Select
                    onValueChange={handleCategoryChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-spend-category">
                        <SelectValue placeholder={t("spend.selectCategory")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {subcategories.length > 0 && (
              <FormField
                control={form.control}
                name="subcategoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("platform.platforms")}</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || "none"}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-spend-subcategory">
                          <SelectValue
                            placeholder={t("spend.selectPlatform")}
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">
                          {t("spend.noPlatform")}
                        </SelectItem>
                        {subcategories.map((sub) => (
                          <SelectItem key={sub.id} value={sub.id}>
                            {sub.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  {t("common.cancel")}
                </Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={mutation.isPending}
                data-testid="button-save-spend"
              >
                {mutation.isPending ? t("common.adding") : t("spend.addSpend")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function EditSpendEntryDialog({
  entry,
  categories,
  projectId,
}: {
  entry: SpendEntry;
  categories: CategoryWithSpent[];
  projectId: string;
}) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    entry.categoryId,
  );

  const spendEntryFormSchema = useMemo(
    () => createSpendEntryFormSchema(t),
    [t],
  );

  const form = useForm<SpendEntryFormValues>({
    resolver: zodResolver(spendEntryFormSchema),
    defaultValues: {
      amount: entry.amount,
      description: entry.description,
      note: entry.note || "",
      date: entry.date,
      startDate: entry.startDate || null,
      endDate: entry.endDate || null,
      categoryId: entry.categoryId,
      subcategoryId: entry.subcategoryId ?? null,
    },
  });

  useEffect(() => {
    form.reset({
      amount: entry.amount,
      description: entry.description,
      note: entry.note || "",
      date: entry.date,
      startDate: entry.startDate || null,
      endDate: entry.endDate || null,
      categoryId: entry.categoryId,
      subcategoryId: entry.subcategoryId ?? null,
    });
    setSelectedCategoryId(entry.categoryId);
  }, [entry, form]);

  const { data: subcategories = [] } = useQuery<SubcategoryWithSpent[]>({
    queryKey: ["/api/categories", selectedCategoryId, "subcategories"],
    enabled: !!selectedCategoryId,
  });

  const mutation = useMutation({
    mutationFn: async (data: SpendEntryFormValues) => {
      const payload = {
        ...data,
        subcategoryId:
          data.subcategoryId === "" || data.subcategoryId === "none"
            ? null
            : data.subcategoryId,
        note: data.note && data.note.trim() !== "" ? data.note.trim() : null,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
      };
      const res = await apiRequest(
        "PATCH",
        `/api/spend-entries/${entry.id}`,
        payload,
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", projectId, "spend-entries"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", projectId, "categories"],
      });
      toast({
        title: t("toast.spendUpdated"),
        description: t("toast.spendUpdatedDesc"),
      });
      setOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCategoryChange = (value: string) => {
    setSelectedCategoryId(value);
    form.setValue("categoryId", value);
    form.setValue("subcategoryId", null);
  };

  const isRTL = i18n.language === "ar";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          data-testid={`button-edit-spend-${entry.id}`}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("spend.editSpend")}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("spend.amount")}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span
                        className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 text-muted-foreground text-sm`}
                      >
                        {t("currency.sar")}
                      </span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className={`${isRTL ? "pr-12" : "pl-12"} tabular-nums`}
                        data-testid={`input-edit-spend-amount-${entry.id}`}
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("spend.description")}</FormLabel>
                  <FormControl>
                    <Input
                      data-testid={`input-edit-spend-description-${entry.id}`}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("spend.note")}</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      data-testid={`input-edit-spend-note-${entry.id}`}
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("spend.date")}</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      data-testid={`input-edit-spend-date-${entry.id}`}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("spend.startDate")}</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        data-testid={`input-edit-spend-start-date-${entry.id}`}
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("spend.endDate")}</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        data-testid={`input-edit-spend-end-date-${entry.id}`}
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("sections.categories")}</FormLabel>
                  <Select
                    onValueChange={handleCategoryChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger
                        data-testid={`select-edit-spend-category-${entry.id}`}
                      >
                        <SelectValue placeholder={t("spend.selectCategory")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {subcategories.length > 0 && (
              <FormField
                control={form.control}
                name="subcategoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("platform.platforms")}</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || "none"}
                    >
                      <FormControl>
                        <SelectTrigger
                          data-testid={`select-edit-spend-subcategory-${entry.id}`}
                        >
                          <SelectValue
                            placeholder={t("spend.selectPlatform")}
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">
                          {t("spend.noPlatform")}
                        </SelectItem>
                        {subcategories.map((sub) => (
                          <SelectItem key={sub.id} value={sub.id}>
                            {sub.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  {t("common.cancel")}
                </Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={mutation.isPending}
                data-testid={`button-save-edit-spend-${entry.id}`}
              >
                {mutation.isPending ? t("common.saving") : t("spend.editSpend")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function TasksPanel({
  projectId,
  categories,
}: {
  projectId: string;
  categories: CategoryWithSpent[];
}) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [detailTask, setDetailTask] = useState<TaskWithMeta | null>(null);

  const taskFormSchema = useMemo(() => createTaskFormSchema(t), [t]);

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: "",
      description: "",
      status: "todo",
      priority: "medium",
      categoryId: null,
      subcategoryId: null,
      deadline: null,
    },
  });

  useEffect(() => {
    if (dialogOpen) {
      if (editingTask) {
        form.reset({
          title: editingTask.title,
          description: editingTask.description || "",
          status: editingTask.status as TaskStatus,
          priority: editingTask.priority as TaskPriority,
          categoryId: editingTask.categoryId || null,
          subcategoryId: editingTask.subcategoryId || null,
          deadline: editingTask.deadline || null,
        });
      } else {
        form.reset({
          title: "",
          description: "",
          status: "todo",
          priority: "medium",
          categoryId: null,
          subcategoryId: null,
          deadline: null,
        });
      }
    } else {
      setEditingTask(null);
    }
  }, [dialogOpen, editingTask, form]);

  const watchedCategoryId = form.watch("categoryId");
  const activeTaskCategoryId =
    watchedCategoryId && watchedCategoryId !== "none"
      ? watchedCategoryId
      : null;

  const {
    data: subcategoriesForCategory = [],
    isLoading: taskSubcategoriesLoading,
  } = useQuery<SubcategoryWithSpent[]>({
    queryKey: ["/api/categories", activeTaskCategoryId, "subcategories"],
    enabled: !!activeTaskCategoryId,
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<
    TaskWithMeta[]
  >({
    queryKey: ["/api/projects", projectId, "tasks"],
  });

  const categoryLookup = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((cat) => map.set(cat.id, cat.name));
    return map;
  }, [categories]);

  const upsertMutation = useMutation({
    mutationFn: async (values: TaskFormValues) => {
      const payload = {
        ...values,
        description: values.description?.trim() || "",
        categoryId:
          values.categoryId && values.categoryId !== "none"
            ? values.categoryId
            : null,
        deadline:
          values.deadline && values.deadline !== "" ? values.deadline : null,
        subcategoryId:
          values.subcategoryId && values.subcategoryId !== "none"
            ? values.subcategoryId
            : null,
      };
      const endpoint = editingTask
        ? `/api/tasks/${editingTask.id}`
        : `/api/projects/${projectId}/tasks`;
      const method = editingTask ? "PATCH" : "POST";
      const res = await apiRequest(method, endpoint, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", projectId, "tasks"],
      });
      toast({
        title: editingTask ? t("toast.taskUpdated") : t("toast.taskAdded"),
        description: editingTask
          ? t("toast.taskUpdatedDesc")
          : t("toast.taskAddedDesc"),
      });
      setDialogOpen(false);
      setEditingTask(null);
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (taskId: string) => {
      await apiRequest("DELETE", `/api/tasks/${taskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", projectId, "tasks"],
      });
      toast({
        title: t("toast.taskDeleted"),
        description: t("toast.taskDeletedDesc"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleTaskSubmit = (values: TaskFormValues) => {
    upsertMutation.mutate(values);
  };

  const handleDeleteTask = (taskId: string) => {
    deleteMutation.mutate(taskId);
  };

  const completedCount = tasks.filter((task) => task.status === "done").length;
  const totalTasks = tasks.length;
  const progressPercent =
    totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
  const progressSummary = t("tasks.progressSummary", {
    done: completedCount,
    total: totalTasks,
  });

  const tasksByStatus = useMemo(
    () =>
      TASK_STATUS_OPTIONS.map((option) => ({
        ...option,
        entries: tasks.filter((task) => task.status === option.value),
      })),
    [tasks],
  );

  const getStatusLabel = (value: string) =>
    t(
      TASK_STATUS_OPTIONS.find((option) => option.value === value)?.labelKey ??
        "",
    );

  const getPriorityLabel = (value: string) =>
    t(
      TASK_PRIORITY_OPTIONS.find((option) => option.value === value)
        ?.labelKey ?? "",
    );

  const formatTaskTimestamp = (value: Date | string | null | undefined) => {
    if (!value) return "--";
    return formatDisplayDate(
      typeof value === "string" ? value : value.toISOString(),
    );
  };

  const isRTL = i18n.language === "ar";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <CheckSquare className="h-5 w-5" />
          {t("tasks.title")}
        </CardTitle>
        <Button
          size="sm"
          onClick={() => {
            setEditingTask(null);
            setDialogOpen(true);
          }}
        >
          <Plus className={`h-4 w-4 ${isRTL ? "ml-2" : "mr-2"}`} />
          {t("tasks.addTask")}
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{progressSummary}</span>
            <span className="font-medium tabular-nums">{progressPercent}%</span>
          </div>
          <div
            className="relative mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"
            aria-label={t("tasks.progressBarLabel")}
          >
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
        {tasksLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {tasksByStatus.map((status) => (
              <div
                key={status.value}
                className="rounded-lg border bg-card shadow-sm"
              >
                <div className="flex items-center justify-between border-b px-3 py-2">
                  <span className="font-medium">{t(status.labelKey)}</span>
                  <Badge variant="secondary">{status.entries.length}</Badge>
                </div>
                <div className="divide-y">
                  {status.entries.length === 0 ? (
                    <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                      {t("tasks.noTasks")}
                    </p>
                  ) : (
                    status.entries.map((task) => (
                      <button
                        type="button"
                        key={task.id}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/70"
                        onClick={() => setDetailTask(task)}
                      >
                        <div className="w-full">
                          <p className="font-medium text-sm">{task.title}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {task.categoryId
                              ? (task.categoryName ??
                                categoryLookup.get(task.categoryId) ??
                                t("tasks.noCategory"))
                              : t("tasks.noCategory")}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                            <Badge variant="secondary" className="font-normal">
                              {getStatusLabel(task.status)}
                            </Badge>
                            <Badge
                              className={
                                PRIORITY_BADGE_STYLES[
                                  task.priority as TaskPriority
                                ]
                              }
                            >
                              {getPriorityLabel(task.priority)}
                            </Badge>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <Dialog
        open={!!detailTask}
        onOpenChange={(open) => {
          if (!open) {
            setDetailTask(null);
          }
        }}
      >
        <DialogContent>
          {detailTask && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle>{detailTask.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">
                    {t("tasks.fieldStatus")}:
                  </span>{" "}
                  {getStatusLabel(detailTask.status)}
                </div>
                <div>
                  <span className="text-muted-foreground">
                    {t("tasks.fieldPriority")}:
                  </span>{" "}
                  {getPriorityLabel(detailTask.priority)}
                </div>
                <div>
                  <span className="text-muted-foreground">
                    {t("tasks.fieldDeadline")}:
                  </span>{" "}
                  {detailTask.deadline
                    ? formatTaskTimestamp(detailTask.deadline)
                    : "--"}
                </div>
                <div>
                  <span className="text-muted-foreground">
                    {t("tasks.fieldCategory")}:
                  </span>{" "}
                  {detailTask.categoryId
                    ? (detailTask.categoryName ??
                      categoryLookup.get(detailTask.categoryId) ??
                      t("tasks.noCategory"))
                    : t("tasks.noCategory")}
                </div>
                {detailTask.subcategoryId && (
                  <div>
                    <span className="text-muted-foreground">
                      {t("platform.platforms")}:
                    </span>{" "}
                    {detailTask.subcategoryName ?? t("tasks.noSubcategory")}
                  </div>
                )}
                {detailTask.description && (
                  <div>
                    <span className="text-muted-foreground">
                      {t("tasks.fieldDescription")}:
                    </span>
                    <p>{detailTask.description}</p>
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  <div>
                    {t("tasks.createdAt")}:{" "}
                    {formatTaskTimestamp(detailTask.createdAt)}
                  </div>
                  <div>
                    {t("tasks.updatedAt")}:{" "}
                    {formatTaskTimestamp(detailTask.updatedAt)}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingTask(detailTask);
                    setDetailTask(null);
                    setDialogOpen(true);
                  }}
                >
                  <Pencil className={`h-4 w-4 ${isRTL ? "ml-2" : "mr-2"}`} />
                  {t("tasks.editTask")}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">
                      <Trash2
                        className={`h-4 w-4 ${isRTL ? "ml-2" : "mr-2"}`}
                      />
                      {t("tasks.deleteTask")}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {t("tasks.deleteTask")}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("tasks.confirmDelete")}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>
                        {t("common.cancel")}
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() =>
                          detailTask && handleDeleteTask(detailTask.id)
                        }
                      >
                        {t("common.delete")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingTask(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTask ? t("tasks.editTask") : t("tasks.addTask")}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values) => handleTaskSubmit(values))}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("tasks.fieldTitle")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("tasks.fieldDescription")}</FormLabel>
                    <FormControl>
                      <Textarea rows={3} {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("tasks.fieldStatus")}</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TASK_STATUS_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {t(option.labelKey)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("tasks.fieldPriority")}</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TASK_PRIORITY_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {t(option.labelKey)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="deadline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("tasks.fieldDeadline")}</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value || ""}
                        data-testid="input-task-deadline"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("tasks.fieldCategory")}</FormLabel>
                    <Select
                      value={field.value ?? "none"}
                      onValueChange={(value) => {
                        const normalized = value === "none" ? null : value;
                        field.onChange(normalized);
                        form.setValue("subcategoryId", null);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t("tasks.assignCategory")}
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">
                          {t("tasks.noCategory")}
                        </SelectItem>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {activeTaskCategoryId && (
                <FormField
                  control={form.control}
                  name="subcategoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("platform.platforms")}</FormLabel>
                      {taskSubcategoriesLoading ? (
                        <Skeleton className="h-10 w-full" />
                      ) : (
                        <Select
                          value={field.value ?? "none"}
                          onValueChange={(value) =>
                            field.onChange(value === "none" ? null : value)
                          }
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue
                                placeholder={t("tasks.noSubcategory")}
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">
                              {t("tasks.noSubcategory")}
                            </SelectItem>
                            {subcategoriesForCategory.map((sub) => (
                              <SelectItem key={sub.id} value={sub.id}>
                                {sub.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="ghost">
                    {t("tasks.cancel")}
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={upsertMutation.isPending}>
                  {upsertMutation.isPending
                    ? t("common.saving")
                    : t("tasks.save")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function SpendEntriesList({
  categories,
  projectId,
}: {
  categories: CategoryWithSpent[];
  projectId: string;
}) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();

  const { data: entries = [], isLoading } = useQuery<SpendEntry[]>({
    queryKey: ["/api/projects", projectId, "spend-entries"],
  });

  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState("all");

  const { data: filterSubcategories = [] } = useQuery<SubcategoryWithSpent[]>({
    queryKey: ["/api/categories", selectedCategoryId, "subcategories"],
    enabled: selectedCategoryId !== "all",
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/spend-entries/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", projectId, "spend-entries"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", projectId, "categories"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: t("toast.spendDeleted"),
        description: t("toast.spendDeletedDesc"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const availableSubcategories =
    selectedCategoryId === "all" ? [] : filterSubcategories;

  const sortedEntries = useMemo(() => {
    return [...entries].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [entries]);

  const filteredEntries = useMemo(() => {
    return sortedEntries.filter((entry) => {
      if (
        selectedCategoryId !== "all" &&
        entry.categoryId !== selectedCategoryId
      ) {
        return false;
      }

      if (selectedSubcategoryId !== "all") {
        if (
          selectedSubcategoryId === "none"
            ? entry.subcategoryId !== null
            : entry.subcategoryId !== selectedSubcategoryId
        ) {
          return false;
        }
      }

      return true;
    });
  }, [sortedEntries, selectedCategoryId, selectedSubcategoryId]);

  const totalEntries = sortedEntries.length;
  const hasActiveFilters =
    selectedCategoryId !== "all" || selectedSubcategoryId !== "all";

  const handleClearFilters = () => {
    setSelectedCategoryId("all");
    setSelectedSubcategoryId("all");
  };

  const filterCategoryLabel = t("spendFilters.category");
  const filterSubcategoryLabel = t("spendFilters.subcategory");
  const allCategoriesLabel = t("spendFilters.allCategories");
  const allSubcategoriesLabel = t("spendFilters.allSubcategories");
  const filtersHeading = t("spendFilters.heading");
  const clearFiltersText = t("spendFilters.clearAll");
  const noFilteredResultsText = t("spendFilters.noResults");
  const resultsCountText = t("spendFilters.resultsCount", {
    count: filteredEntries.length,
    total: totalEntries,
  });

  const getCategoryName = (categoryId: string) => {
    return categories.find((c) => c.id === categoryId)?.name || "Unknown";
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("spend.recentSpendEntries")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          {t("spend.recentSpendEntries")}
        </CardTitle>
        <AddSpendEntryDialog
          categories={categories}
          projectId={projectId}
          onSuccess={() => {}}
        />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm font-semibold text-muted-foreground">
            {filtersHeading}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-muted-foreground">
                {filterCategoryLabel}
              </span>
              <Select
                value={selectedCategoryId}
                onValueChange={(value) => {
                  setSelectedCategoryId(value);
                  setSelectedSubcategoryId("all");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={filterCategoryLabel} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{allCategoriesLabel}</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-muted-foreground">
                {filterSubcategoryLabel}
              </span>
              <Select
                value={selectedSubcategoryId}
                onValueChange={setSelectedSubcategoryId}
                disabled={selectedCategoryId === "all"}
              >
                <SelectTrigger disabled={selectedCategoryId === "all"}>
                  <SelectValue placeholder={filterSubcategoryLabel} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{allSubcategoriesLabel}</SelectItem>
                  <SelectItem value="none">{t("spend.noPlatform")}</SelectItem>
                  {availableSubcategories.map((subcategory) => (
                    <SelectItem key={subcategory.id} value={subcategory.id}>
                      {subcategory.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-muted-foreground">{resultsCountText}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearFilters}
              disabled={!hasActiveFilters}
            >
              {clearFiltersText}
            </Button>
          </div>

          {totalEntries === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {t("spend.noSpendEntries")}. {t("spend.addFirstSpend")}
            </p>
          ) : filteredEntries.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {noFilteredResultsText}
            </p>
          ) : (
            <div className="space-y-3">
              {filteredEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between py-3 px-4 bg-muted/30 rounded-md"
                  data-testid={`row-spend-entry-${entry.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium truncate">
                        {entry.description}
                      </span>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {getCategoryName(entry.categoryId)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDisplayDate(entry.date)}
                      {entry.startDate && entry.endDate && (
                        <span className="ml-2">
                          ({t("spend.campaignPeriod")}:{" "}
                          {formatDisplayDate(entry.startDate)} -{" "}
                          {formatDisplayDate(entry.endDate)})
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(entry.amount, i18n.language)}
                    </span>
                    <EditSpendEntryDialog
                      entry={entry}
                      categories={categories}
                      projectId={projectId}
                    />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          data-testid={`button-delete-spend-${entry.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {t("spend.deleteSpend")}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {t("spend.deleteConfirm")}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>
                            {t("common.cancel")}
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(entry.id)}
                          >
                            {t("common.delete")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProjectDetail() {
  const { t, i18n } = useTranslation();
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const rawRouteParam = params.id?.trim() ?? "";
  const decodedRouteParam = rawRouteParam
    ? decodeURIComponent(rawRouteParam)
    : "";
  const uuidLikePattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isRouteParamUuid = uuidLikePattern.test(decodedRouteParam);

  const { data: projects = [], isLoading: projectsLoading } = useQuery<
    ProjectWithSpent[]
  >({
    queryKey: ["/api/projects"],
  });

  const projectId = useMemo(() => {
    if (!decodedRouteParam) {
      return "";
    }

    if (isRouteParamUuid) {
      return decodedRouteParam;
    }

    const directIdMatch = projects.find(
      (project) => project.id.toLowerCase() === decodedRouteParam.toLowerCase(),
    );
    if (directIdMatch) {
      return directIdMatch.id;
    }

    const routeSlug = slugify(decodedRouteParam);
    const matchedProject = projects.find(
      (project) =>
        slugify(project.name || "project") === routeSlug ||
        slugify(project.id) === routeSlug,
    );

    return matchedProject?.id ?? "";
  }, [decodedRouteParam, projects]);

  const { data: project, isLoading: projectLoading } =
    useQuery<ProjectWithSpent>({
      queryKey: ["/api/projects", projectId],
      enabled: !!projectId,
    });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<
    CategoryWithSpent[]
  >({
    queryKey: ["/api/projects", projectId, "categories"],
    enabled: !!projectId,
  });

  const isRTL = i18n.language === "ar";
  const shouldWaitForSlug =
    !isRouteParamUuid && !!decodedRouteParam && !projectId && projectsLoading;

  if (shouldWaitForSlug) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  if (!projectId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    );
  }

  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const handleExportExcel = async () => {
    if (!project) return;
    setIsExporting(true);
    let anchor: HTMLAnchorElement | null = null;
    let url: string | null = null;
    try {
      const response = await fetch(`/api/projects/${projectId}/export/excel`);
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      url = window.URL.createObjectURL(blob);
      anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${(project.name || "project").replace(/[^a-zA-Z0-9]/g, "_")}_budget_report.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      toast({ title: t("export.exportSuccess") });
    } catch (error) {
      toast({ title: t("export.exportError"), variant: "destructive" });
    } finally {
      if (url) window.URL.revokeObjectURL(url);
      if (anchor && anchor.parentNode) document.body.removeChild(anchor);
      setIsExporting(false);
    }
  };

  const handleExportTasks = async () => {
    if (!project || !projectId) return;
    setIsExporting(true);
    let anchor: HTMLAnchorElement | null = null;
    let url: string | null = null;
    try {
      const response = await fetch(
        `/api/projects/${projectId}/tasks/export/excel`,
      );
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      url = window.URL.createObjectURL(blob);
      anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${(project.name || "project").replace(/[^a-zA-Z0-9]/g, "_")}_tasks_report.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      toast({ title: t("export.exportSuccess") });
    } catch (error) {
      toast({ title: t("export.exportError"), variant: "destructive" });
    } finally {
      if (url) window.URL.revokeObjectURL(url);
      if (anchor && anchor.parentNode) document.body.removeChild(anchor);
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-between gap-4 mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            data-testid="button-back-to-projects"
          >
            <ArrowLeft className={`h-4 w-4 ${isRTL ? "ml-2" : "mr-2"}`} />
            {t("navigation.backToProjects")}
          </Button>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  disabled={isExporting || !project}
                  data-testid="button-export-dropdown"
                >
                  <Download className={`h-4 w-4 ${isRTL ? "ml-2" : "mr-2"}`} />
                  {isExporting ? t("export.exporting") : t("export.title")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={handleExportExcel}
                  data-testid="button-export-excel"
                >
                  <FileSpreadsheet
                    className={`h-4 w-4 ${isRTL ? "ml-2" : "mr-2"}`}
                  />
                  {t("export.exportExcel")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleExportTasks}
                  data-testid="button-export-tasks"
                >
                  <CheckSquare
                    className={`h-4 w-4 ${isRTL ? "ml-2" : "mr-2"}`}
                  />
                  {t("export.exportTasks")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <LanguageToggle />
          </div>
        </div>

        <div className="space-y-6">
          <ProjectOverview
            project={project || null}
            isLoading={projectLoading}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Layers className="h-5 w-5" />
                  {t("sections.categories")}
                </h2>
                <AddCategoryDialog projectId={projectId} onSuccess={() => {}} />
              </div>

              {categoriesLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-32" />
                  <Skeleton className="h-32" />
                </div>
              ) : categories.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <Layers className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                    <h3 className="font-medium mb-1">
                      {t("category.noCategories")}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {t("category.createFirstCategory")}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {categories.map((category) => (
                    <CategoryCard
                      key={category.id}
                      category={category}
                      projectId={projectId}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <TasksPanel categories={categories} projectId={projectId} />
              <SpendEntriesList categories={categories} projectId={projectId} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
