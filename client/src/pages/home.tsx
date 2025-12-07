import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { type Expense, type Project, expenseCategories } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Skeleton } from "@/components/ui/skeleton";
import { 
  DollarSign, 
  Plus, 
  Pencil, 
  Trash2, 
  TrendingDown,
  Wallet,
  Receipt,
  Calendar,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  FolderOpen,
  ChevronLeft
} from "lucide-react";
import { format, isWithinInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO } from "date-fns";

const BUDGET_THRESHOLDS = [
  { percent: 50, title: "Budget Alert: 50% Used", severity: "warning" as const },
  { percent: 75, title: "Budget Alert: 75% Used", severity: "warning" as const },
  { percent: 90, title: "Budget Alert: 90% Used", severity: "destructive" as const },
] as const;

const projectFormSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  budgetAmount: z.coerce.number().min(0.01, "Budget must be greater than 0"),
});

const expenseFormSchema = z.object({
  name: z.string().min(1, "Expense name is required"),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  category: z.string().min(1, "Category is required"),
  date: z.string().min(1, "Date is required"),
  projectId: z.string().min(1, "Project is required"),
});

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

type DateFilter = "all" | "week" | "month";
type SortField = "date" | "amount" | "category" | "name";
type SortDirection = "asc" | "desc";

function filterExpensesByDate(expenses: Expense[], filter: DateFilter): Expense[] {
  if (filter === "all") return expenses;
  
  const today = new Date();
  
  if (filter === "week") {
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
    return expenses.filter(expense => {
      try {
        const expenseDate = parseISO(expense.date);
        return isWithinInterval(expenseDate, { start: weekStart, end: weekEnd });
      } catch {
        return false;
      }
    });
  }
  
  if (filter === "month") {
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);
    return expenses.filter(expense => {
      try {
        const expenseDate = parseISO(expense.date);
        return isWithinInterval(expenseDate, { start: monthStart, end: monthEnd });
      } catch {
        return false;
      }
    });
  }
  
  return expenses;
}

function sortExpenses(expenses: Expense[], field: SortField, direction: SortDirection): Expense[] {
  return [...expenses].sort((a, b) => {
    let comparison = 0;
    
    switch (field) {
      case "date":
        try {
          const dateA = parseISO(a.date);
          const dateB = parseISO(b.date);
          comparison = dateA.getTime() - dateB.getTime();
        } catch {
          comparison = a.date.localeCompare(b.date);
        }
        break;
      case "amount":
        comparison = a.amount - b.amount;
        break;
      case "category":
        comparison = a.category.localeCompare(b.category);
        break;
      case "name":
        comparison = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        break;
    }
    
    return direction === "asc" ? comparison : -comparison;
  });
}

function filterExpensesBySearch(expenses: Expense[], query: string): Expense[] {
  if (!query.trim()) return expenses;
  const lowerQuery = query.toLowerCase().trim();
  return expenses.filter(expense => 
    expense.name.toLowerCase().includes(lowerQuery)
  );
}

function exportToCSV(expenses: Expense[]): void {
  if (expenses.length === 0) return;
  
  const headers = ["Name", "Amount", "Category", "Date"];
  const csvRows = [
    headers.join(","),
    ...expenses.map(expense => {
      const escapedName = expense.name.includes(",") || expense.name.includes('"')
        ? `"${expense.name.replace(/"/g, '""')}"`
        : expense.name;
      return [
        escapedName,
        expense.amount.toFixed(2),
        expense.category,
        expense.date
      ].join(",");
    })
  ];
  
  const csvContent = csvRows.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `expenses_${format(new Date(), "yyyy-MM-dd")}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

type ProjectFormValues = z.infer<typeof projectFormSchema>;
type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    "Advertising": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    "Social Media": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    "Content": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    "Events": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    "Email Marketing": "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
    "SEO": "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
    "Other": "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  };
  return colors[category] || colors["Other"];
}

function ProjectCard({ 
  project, 
  totalSpent,
  onClick,
  onEdit,
  onDelete
}: { 
  project: Project;
  totalSpent: number;
  onClick: () => void;
  onEdit: (project: Project) => void;
  onDelete: (id: string) => void;
}) {
  const remaining = project.budgetAmount - totalSpent;
  const percentUsed = project.budgetAmount > 0 
    ? (totalSpent / project.budgetAmount) * 100 
    : 0;
  
  const getStatusColor = () => {
    if (percentUsed > 75) return "text-red-600 dark:text-red-400";
    if (percentUsed > 50) return "text-yellow-600 dark:text-yellow-400";
    return "text-green-600 dark:text-green-400";
  };

  const getProgressColor = () => {
    if (percentUsed > 75) return "bg-red-500";
    if (percentUsed > 50) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <Card className="hover-elevate cursor-pointer" onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <FolderOpen className="h-5 w-5 text-muted-foreground shrink-0" />
            <h3 className="font-semibold truncate" data-testid={`text-project-name-${project.id}`}>
              {project.name}
            </h3>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button 
              size="icon" 
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(project);
              }}
              data-testid={`button-edit-project-${project.id}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  size="icon" 
                  variant="ghost"
                  onClick={(e) => e.stopPropagation()}
                  data-testid={`button-delete-project-${project.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Project</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{project.name}"? This will also delete all expenses in this project. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(project.id)}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-2 text-sm mb-3">
          <div>
            <p className="text-muted-foreground text-xs">Budget</p>
            <p className="font-medium tabular-nums">{formatCurrency(project.budgetAmount)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Spent</p>
            <p className="font-medium tabular-nums">{formatCurrency(totalSpent)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Remaining</p>
            <p className={`font-medium tabular-nums ${getStatusColor()}`}>{formatCurrency(remaining)}</p>
          </div>
        </div>
        
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Budget Used</span>
            <span className="font-medium tabular-nums">{Math.round(percentUsed)}%</span>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full transition-all duration-500 ease-out ${getProgressColor()}`}
              style={{ width: `${Math.min(percentUsed, 100)}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateProjectDialog({ onSuccess }: { onSuccess: (project: Project) => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: "",
      budgetAmount: undefined as unknown as number,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: ProjectFormValues) => {
      const res = await apiRequest("POST", "/api/projects", data);
      return res.json() as Promise<Project>;
    },
    onSuccess: (newProject) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Project Created",
        description: "Your new project has been created successfully.",
      });
      setOpen(false);
      form.reset();
      onSuccess(newProject);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ProjectFormValues) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-create-project">
          <Plus className="h-4 w-4 mr-2" />
          New Project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Q1 Marketing Campaign"
                      data-testid="input-project-name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="budgetAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Budget Amount ($)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="10000.00"
                        className="pl-9 tabular-nums"
                        data-testid="input-project-budget"
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
                  Cancel
                </Button>
              </DialogClose>
              <Button 
                type="submit" 
                disabled={mutation.isPending}
                data-testid="button-save-project"
              >
                {mutation.isPending ? "Creating..." : "Create Project"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function EditProjectDialog({
  project,
  open,
  onOpenChange,
  onSuccess,
}: {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: "",
      budgetAmount: 0,
    },
  });

  useEffect(() => {
    if (project && open) {
      form.reset({
        name: project.name,
        budgetAmount: project.budgetAmount,
      });
    }
  }, [project, open, form]);

  const mutation = useMutation({
    mutationFn: async (data: ProjectFormValues) => {
      const res = await apiRequest("PATCH", `/api/projects/${project?.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Project Updated",
        description: "Your project has been updated successfully.",
      });
      onOpenChange(false);
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ProjectFormValues) => {
    mutation.mutate(data);
  };

  if (!project) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Q1 Marketing Campaign"
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
              name="budgetAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Budget Amount ($)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="10000.00"
                        className="pl-9 tabular-nums"
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
                  Cancel
                </Button>
              </DialogClose>
              <Button 
                type="submit" 
                disabled={mutation.isPending}
                data-testid="button-save-edit-project"
              >
                {mutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function BudgetOverview({ 
  project, 
  totalSpent, 
  isLoading 
}: { 
  project: Project; 
  totalSpent: number;
  isLoading: boolean;
}) {
  const remaining = project.budgetAmount - totalSpent;
  const percentUsed = project.budgetAmount > 0 
    ? (totalSpent / project.budgetAmount) * 100 
    : 0;
  
  const getStatusColor = () => {
    if (percentUsed > 75) return "text-red-600 dark:text-red-400";
    if (percentUsed > 50) return "text-yellow-600 dark:text-yellow-400";
    return "text-green-600 dark:text-green-400";
  };

  const getProgressColor = () => {
    if (percentUsed > 75) return "bg-red-500";
    if (percentUsed > 50) return "bg-yellow-500";
    return "bg-green-500";
  };

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

  return (
    <Card>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
              <Wallet className="h-4 w-4" />
              <span>Project Budget</span>
            </div>
            <p className="text-2xl font-bold tabular-nums">
              {formatCurrency(project.budgetAmount)}
            </p>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
              <TrendingDown className="h-4 w-4" />
              <span>Total Spent</span>
            </div>
            <p className="text-2xl font-bold tabular-nums text-foreground">
              {formatCurrency(totalSpent)}
            </p>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
              <DollarSign className="h-4 w-4" />
              <span>Remaining</span>
            </div>
            <p className={`text-2xl font-bold tabular-nums ${getStatusColor()}`}>
              {formatCurrency(remaining)}
            </p>
          </div>
        </div>
        
        <div className="mt-6 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Budget Used</span>
            <span className="font-medium tabular-nums">{Math.round(percentUsed)}%</span>
          </div>
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full transition-all duration-500 ease-out ${getProgressColor()}`}
              style={{ width: `${Math.min(percentUsed, 100)}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AddExpenseForm({ 
  projectId,
  onSuccess, 
  onCheckBudgetThresholds 
}: { 
  projectId: string;
  onSuccess: () => void;
  onCheckBudgetThresholds: (addedAmount: number) => void;
}) {
  const { toast } = useToast();
  
  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      name: "",
      amount: undefined as unknown as number,
      category: "",
      date: getTodayDateString(),
      projectId: projectId,
    },
  });

  useEffect(() => {
    form.setValue("projectId", projectId);
  }, [projectId, form]);

  const mutation = useMutation({
    mutationFn: async (data: ExpenseFormValues) => {
      const res = await apiRequest("POST", "/api/expenses", data);
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "expenses"] });
      toast({
        title: "Expense Added",
        description: "Your expense has been recorded successfully.",
      });
      onCheckBudgetThresholds(variables.amount);
      form.reset({
        name: "",
        amount: undefined as unknown as number,
        category: "",
        date: getTodayDateString(),
        projectId: projectId,
      });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ExpenseFormValues) => {
    mutation.mutate(data);
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Add Expense
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expense Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Facebook Ads Campaign"
                        data-testid="input-expense-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount ($)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="500.00"
                          className="pl-9 tabular-nums"
                          data-testid="input-expense-amount"
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
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-expense-category">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {expenseCategories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
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
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="date"
                          className="pl-9"
                          data-testid="input-expense-date"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="flex justify-end">
              <Button 
                type="submit" 
                disabled={mutation.isPending}
                data-testid="button-add-expense"
              >
                {mutation.isPending ? (
                  "Adding..."
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Expense
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function ExpenseItem({ 
  expense, 
  onEdit, 
  onDelete 
}: { 
  expense: Expense;
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 px-4 rounded-md hover-elevate">
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate" data-testid={`text-expense-name-${expense.id}`}>
            {expense.name}
          </p>
          <p className="text-sm text-muted-foreground" data-testid={`text-expense-date-${expense.id}`}>
            {formatDisplayDate(expense.date)}
          </p>
        </div>
        <Badge 
          variant="secondary" 
          className={`shrink-0 no-default-hover-elevate no-default-active-elevate ${getCategoryColor(expense.category)}`}
        >
          {expense.category}
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-semibold tabular-nums whitespace-nowrap" data-testid={`text-expense-amount-${expense.id}`}>
          {formatCurrency(expense.amount)}
        </span>
        <Button 
          size="icon" 
          variant="ghost"
          onClick={() => onEdit(expense)}
          data-testid={`button-edit-expense-${expense.id}`}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              size="icon" 
              variant="ghost"
              data-testid={`button-delete-expense-${expense.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Expense</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{expense.name}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => onDelete(expense.id)}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function EditExpenseDialog({
  expense,
  projectId,
  open,
  onOpenChange,
  onSuccess,
  onCheckBudgetThresholds,
}: {
  expense: Expense | null;
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  onCheckBudgetThresholds: (amountDifference: number) => void;
}) {
  const { toast } = useToast();
  
  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      name: "",
      amount: 0,
      category: "",
      date: getTodayDateString(),
      projectId: projectId,
    },
  });

  useEffect(() => {
    if (expense && open) {
      form.reset({
        name: expense.name,
        amount: expense.amount,
        category: expense.category,
        date: expense.date,
        projectId: expense.projectId,
      });
    }
  }, [expense, open, form]);

  const mutation = useMutation({
    mutationFn: async (data: ExpenseFormValues) => {
      const res = await apiRequest("PATCH", `/api/expenses/${expense?.id}`, data);
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "expenses"] });
      toast({
        title: "Expense Updated",
        description: "Your expense has been updated successfully.",
      });
      if (expense) {
        const amountDifference = variables.amount - expense.amount;
        if (amountDifference > 0) {
          onCheckBudgetThresholds(amountDifference);
        }
      }
      onOpenChange(false);
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ExpenseFormValues) => {
    mutation.mutate(data);
  };

  if (!expense) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Expense</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expense Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Facebook Ads Campaign"
                      data-testid="input-edit-expense-name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount ($)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="500.00"
                        className="pl-9 tabular-nums"
                        data-testid="input-edit-expense-amount"
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
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-edit-expense-category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {expenseCategories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
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
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="date"
                        className="pl-9"
                        data-testid="input-edit-expense-date"
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
                  Cancel
                </Button>
              </DialogClose>
              <Button 
                type="submit" 
                disabled={mutation.isPending}
                data-testid="button-save-edit-expense"
              >
                {mutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function ExpensesList({ 
  projectId,
  expenses, 
  isLoading,
  onCheckBudgetThresholds,
}: { 
  projectId: string;
  expenses: Expense[];
  isLoading: boolean;
  onCheckBudgetThresholds: (amountDifference: number) => void;
}) {
  const { toast } = useToast();
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const dateFilteredExpenses = filterExpensesByDate(expenses, dateFilter);
  const searchFilteredExpenses = filterExpensesBySearch(dateFilteredExpenses, searchQuery);
  const filteredExpenses = sortExpenses(searchFilteredExpenses, sortField, sortDirection);
  const filteredTotal = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);

  const handleSortChange = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "expenses"] });
      toast({
        title: "Expense Deleted",
        description: "The expense has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setEditDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Expenses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Expenses ({filteredExpenses.length})
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant={dateFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDateFilter("all")}
                  data-testid="button-filter-all"
                  className="toggle-elevate"
                >
                  All Time
                </Button>
                <Button
                  variant={dateFilter === "month" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDateFilter("month")}
                  data-testid="button-filter-month"
                  className="toggle-elevate"
                >
                  This Month
                </Button>
                <Button
                  variant={dateFilter === "week" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDateFilter("week")}
                  data-testid="button-filter-week"
                  className="toggle-elevate"
                >
                  This Week
                </Button>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search expenses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-expenses"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <Select value={sortField} onValueChange={(value) => handleSortChange(value as SortField)}>
                  <SelectTrigger className="w-[140px]" data-testid="select-sort-field">
                    <ArrowUpDown className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="amount">Amount</SelectItem>
                    <SelectItem value="category">Category</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSortDirection(prev => prev === "asc" ? "desc" : "asc")}
                  data-testid="button-toggle-sort-direction"
                >
                  {sortDirection === "asc" ? (
                    <ArrowUp className="h-4 w-4" />
                  ) : (
                    <ArrowDown className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportToCSV(filteredExpenses)}
                  disabled={filteredExpenses.length === 0}
                  data-testid="button-export-csv"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredExpenses.length === 0 ? (
            <div className="text-center py-8">
              <Receipt className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {expenses.length === 0 
                  ? "No Expenses Yet" 
                  : searchQuery.trim() 
                    ? "No Matching Expenses" 
                    : "No Expenses in This Period"}
              </h3>
              <p className="text-muted-foreground text-sm">
                {expenses.length === 0 
                  ? "Add your first expense to start tracking your marketing spend"
                  : searchQuery.trim()
                    ? "Try adjusting your search terms or filters"
                    : "Try selecting a different time period to view expenses"
                }
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredExpenses.map((expense) => (
                <ExpenseItem
                  key={expense.id}
                  expense={expense}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
              <div className="flex items-center justify-between py-3 px-4 mt-4 border-t">
                <span className="font-semibold">
                  {dateFilter === "all" ? "Total Spent" : "Period Total"}
                </span>
                <span className="font-bold text-lg tabular-nums" data-testid="text-total-spent">
                  {formatCurrency(filteredTotal)}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      <EditExpenseDialog
        expense={editingExpense}
        projectId={projectId}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={() => setEditingExpense(null)}
        onCheckBudgetThresholds={onCheckBudgetThresholds}
      />
    </>
  );
}

function ProjectView({
  project,
  onBack,
}: {
  project: Project;
  onBack: () => void;
}) {
  const { toast } = useToast();
  
  const { data: expenses = [], isLoading: expensesLoading } = useQuery<Expense[]>({
    queryKey: ["/api/projects", project.id, "expenses"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${project.id}/expenses`);
      if (!res.ok) throw new Error("Failed to fetch expenses");
      return res.json();
    },
  });

  const totalSpent = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  
  const [shownThresholds, setShownThresholds] = useState<Set<number>>(() => {
    const currentPercent = project.budgetAmount > 0 ? (totalSpent / project.budgetAmount) * 100 : 0;
    const passedThresholds = new Set<number>();
    for (const threshold of BUDGET_THRESHOLDS) {
      if (currentPercent >= threshold.percent) {
        passedThresholds.add(threshold.percent);
      }
    }
    return passedThresholds;
  });
  
  const prevTotalSpentRef = useRef<number>(totalSpent);

  useEffect(() => {
    if (project.budgetAmount <= 0) {
      prevTotalSpentRef.current = totalSpent;
      return;
    }
    
    const prevTotal = prevTotalSpentRef.current;
    const prevPercent = (prevTotal / project.budgetAmount) * 100;
    const newPercent = (totalSpent / project.budgetAmount) * 100;
    
    if (totalSpent > prevTotal) {
      const newlyPassedThresholds: number[] = [];
      
      for (const threshold of BUDGET_THRESHOLDS) {
        if (newPercent >= threshold.percent && 
            prevPercent < threshold.percent && 
            !shownThresholds.has(threshold.percent)) {
          newlyPassedThresholds.push(threshold.percent);
          
          const remaining = project.budgetAmount - totalSpent;
          const remainingPercent = Math.round(100 - newPercent);
          
          toast({
            title: threshold.title,
            description: `You've used ${threshold.percent}% of the "${project.name}" budget. ${formatCurrency(Math.max(0, remaining))} (${remainingPercent}%) remaining.`,
            variant: threshold.severity === "destructive" ? "destructive" : "default",
          });
        }
      }
      
      if (newlyPassedThresholds.length > 0) {
        setShownThresholds(prev => {
          const updated = new Set(prev);
          for (const t of newlyPassedThresholds) {
            updated.add(t);
          }
          return updated;
        });
      }
    }
    
    prevTotalSpentRef.current = totalSpent;
  }, [totalSpent, project.budgetAmount, project.name, shownThresholds, toast]);

  const checkBudgetThresholds = useCallback((_addedAmount: number) => {
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={onBack}
          data-testid="button-back-to-projects"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-xl font-semibold">{project.name}</h2>
          <p className="text-muted-foreground text-sm">Project Budget Tracker</p>
        </div>
      </div>
      
      <BudgetOverview 
        project={project} 
        totalSpent={totalSpent}
        isLoading={expensesLoading}
      />
      
      <AddExpenseForm 
        projectId={project.id}
        onSuccess={() => {}} 
        onCheckBudgetThresholds={checkBudgetThresholds}
      />
      
      <ExpensesList 
        projectId={project.id}
        expenses={expenses}
        isLoading={expensesLoading}
        onCheckBudgetThresholds={checkBudgetThresholds}
      />
    </div>
  );
}

function ProjectsList() {
  const { toast } = useToast();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: allExpenses = [] } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  useEffect(() => {
    if (selectedProject && projects.length > 0) {
      const updatedProject = projects.find(p => p.id === selectedProject.id);
      if (updatedProject) {
        setSelectedProject(updatedProject);
      } else {
        setSelectedProject(null);
      }
    }
  }, [projects, selectedProject?.id]);

  const getProjectTotalSpent = (projectId: string) => {
    return allExpenses
      .filter(expense => expense.projectId === projectId)
      .reduce((sum, expense) => sum + expense.amount, 0);
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/projects/${id}`);
    },
    onSuccess: (_data, deletedId) => {
      if (selectedProject?.id === deletedId) {
        setSelectedProject(null);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({
        title: "Project Deleted",
        description: "The project and all its expenses have been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setEditDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  if (selectedProject) {
    return (
      <ProjectView 
        project={selectedProject} 
        onBack={() => setSelectedProject(null)} 
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Projects</h2>
            <p className="text-muted-foreground text-sm">
              {projects.length === 0 
                ? "Create your first project to start tracking expenses"
                : `${projects.length} project${projects.length === 1 ? "" : "s"}`
              }
            </p>
          </div>
          <CreateProjectDialog onSuccess={(newProject) => setSelectedProject(newProject)} />
        </div>

        {projects.length === 0 ? (
          <Card>
            <CardContent className="p-8">
              <div className="text-center">
                <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Projects Yet</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Create a project to start tracking your marketing budgets and expenses
                </p>
                <CreateProjectDialog onSuccess={(newProject) => setSelectedProject(newProject)} />
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                totalSpent={getProjectTotalSpent(project.id)}
                onClick={() => setSelectedProject(project)}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      <EditProjectDialog
        project={editingProject}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={() => setEditingProject(null)}
      />
    </>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold">Marketing Budget Tracker</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage projects and track your marketing expenses
          </p>
        </header>

        <main>
          <ProjectsList />
        </main>
      </div>
    </div>
  );
}
