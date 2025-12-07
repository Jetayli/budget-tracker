import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { type Expense, type Budget, expenseCategories } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  AlertTriangle,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import { format, isWithinInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO } from "date-fns";

const BUDGET_THRESHOLDS = [
  { percent: 50, title: "Budget Alert: 50% Used", severity: "warning" as const },
  { percent: 75, title: "Budget Alert: 75% Used", severity: "warning" as const },
  { percent: 90, title: "Budget Alert: 90% Used", severity: "destructive" as const },
] as const;

const budgetFormSchema = z.object({
  totalAmount: z.coerce.number().min(0.01, "Budget must be greater than 0"),
});

const expenseFormSchema = z.object({
  name: z.string().min(1, "Expense name is required"),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  category: z.string().min(1, "Category is required"),
  date: z.string().min(1, "Date is required"),
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

type BudgetFormValues = z.infer<typeof budgetFormSchema>;
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

function BudgetOverview({ 
  budget, 
  totalSpent, 
  isLoading 
}: { 
  budget: Budget | null; 
  totalSpent: number;
  isLoading: boolean;
}) {
  const remaining = budget ? budget.totalAmount - totalSpent : 0;
  const percentUsed = budget && budget.totalAmount > 0 
    ? (totalSpent / budget.totalAmount) * 100 
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

  if (!budget) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <Wallet className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Budget Set</h3>
            <p className="text-muted-foreground text-sm">
              Set your total marketing budget to get started
            </p>
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
              <span>Total Budget</span>
            </div>
            <p className="text-2xl font-bold tabular-nums">
              {formatCurrency(budget.totalAmount)}
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

function SetBudgetForm({ 
  currentBudget, 
  onSuccess 
}: { 
  currentBudget: Budget | null;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  
  const form = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: {
      totalAmount: 0,
    },
  });

  useEffect(() => {
    if (open && currentBudget) {
      form.reset({
        totalAmount: currentBudget.totalAmount,
      });
    }
  }, [open, currentBudget, form]);

  const mutation = useMutation({
    mutationFn: async (data: BudgetFormValues) => {
      const res = await apiRequest("POST", "/api/budget", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budget"] });
      toast({
        title: "Budget Updated",
        description: "Your marketing budget has been set successfully.",
      });
      setOpen(false);
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

  const onSubmit = (data: BudgetFormValues) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="button-set-budget">
          <DollarSign className="h-4 w-4 mr-2" />
          {currentBudget ? "Update Budget" : "Set Budget"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {currentBudget ? "Update Marketing Budget" : "Set Marketing Budget"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="totalAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total Budget Amount ($)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="10000.00"
                        className="pl-9 tabular-nums"
                        data-testid="input-budget-amount"
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
                data-testid="button-save-budget"
              >
                {mutation.isPending ? "Saving..." : "Save Budget"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function AddExpenseForm({ 
  onSuccess, 
  onCheckBudgetThresholds 
}: { 
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
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: ExpenseFormValues) => {
      const res = await apiRequest("POST", "/api/expenses", data);
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
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
  open,
  onOpenChange,
  onSuccess,
  onCheckBudgetThresholds,
}: {
  expense: Expense | null;
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
    },
  });

  useEffect(() => {
    if (expense && open) {
      form.reset({
        name: expense.name,
        amount: expense.amount,
        category: expense.category,
        date: expense.date,
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
      toast({
        title: "Expense Updated",
        description: "Your expense has been updated successfully.",
      });
      const amountDifference = variables.amount - (expense?.amount || 0);
      if (amountDifference > 0) {
        onCheckBudgetThresholds(amountDifference);
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
  expenses, 
  isLoading,
  totalSpent,
  onCheckBudgetThresholds,
}: { 
  expenses: Expense[];
  isLoading: boolean;
  totalSpent: number;
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

  const getSortLabel = (field: SortField): string => {
    const labels: Record<SortField, string> = {
      date: "Date",
      amount: "Amount",
      category: "Category",
      name: "Name",
    };
    return labels[field];
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
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
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={() => setEditingExpense(null)}
        onCheckBudgetThresholds={onCheckBudgetThresholds}
      />
    </>
  );
}

export default function Home() {
  const { toast } = useToast();
  const { data: budget, isLoading: budgetLoading } = useQuery<Budget | null>({
    queryKey: ["/api/budget"],
  });

  const { data: expenses = [], isLoading: expensesLoading } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  const totalSpent = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  
  const [shownThresholds, setShownThresholds] = useState<Record<string, Set<number>>>({});
  const prevTotalSpentRef = useRef<number>(totalSpent);
  const budgetIdRef = useRef<string | undefined>(budget?.id);

  useEffect(() => {
    if (budget?.id !== budgetIdRef.current) {
      budgetIdRef.current = budget?.id;
      if (budget?.id) {
        setShownThresholds(prev => {
          if (!prev[budget.id]) {
            const currentPercent = budget.totalAmount > 0 ? (totalSpent / budget.totalAmount) * 100 : 0;
            const passedThresholds = new Set<number>();
            for (const threshold of BUDGET_THRESHOLDS) {
              if (currentPercent >= threshold.percent) {
                passedThresholds.add(threshold.percent);
              }
            }
            return { ...prev, [budget.id]: passedThresholds };
          }
          return prev;
        });
      }
    }
  }, [budget?.id, budget?.totalAmount, totalSpent]);

  useEffect(() => {
    if (!budget || budget.totalAmount <= 0) {
      prevTotalSpentRef.current = totalSpent;
      return;
    }
    
    const budgetId = budget.id;
    const currentThresholds = shownThresholds[budgetId] || new Set<number>();
    const prevTotal = prevTotalSpentRef.current;
    const prevPercent = (prevTotal / budget.totalAmount) * 100;
    const newPercent = (totalSpent / budget.totalAmount) * 100;
    
    if (totalSpent > prevTotal) {
      const newlyPassedThresholds: number[] = [];
      
      for (const threshold of BUDGET_THRESHOLDS) {
        if (newPercent >= threshold.percent && 
            prevPercent < threshold.percent && 
            !currentThresholds.has(threshold.percent)) {
          newlyPassedThresholds.push(threshold.percent);
          
          const remaining = budget.totalAmount - totalSpent;
          const remainingPercent = Math.round(100 - newPercent);
          
          toast({
            title: threshold.title,
            description: `You've used ${threshold.percent}% of your marketing budget. ${formatCurrency(Math.max(0, remaining))} (${remainingPercent}%) remaining.`,
            variant: threshold.severity === "destructive" ? "destructive" : "default",
          });
        }
      }
      
      if (newlyPassedThresholds.length > 0) {
        setShownThresholds(prev => {
          const updated = new Set(prev[budgetId] || []);
          for (const t of newlyPassedThresholds) {
            updated.add(t);
          }
          return { ...prev, [budgetId]: updated };
        });
      }
    }
    
    prevTotalSpentRef.current = totalSpent;
  }, [totalSpent, budget, shownThresholds, toast]);

  const checkBudgetThresholds = useCallback((_addedAmount: number) => {
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <header className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Marketing Budget Tracker</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Manage and track your marketing expenses
              </p>
            </div>
            <SetBudgetForm 
              currentBudget={budget || null} 
              onSuccess={() => {}} 
            />
          </div>
        </header>

        <main className="space-y-6">
          <BudgetOverview 
            budget={budget || null} 
            totalSpent={totalSpent}
            isLoading={budgetLoading}
          />
          
          <AddExpenseForm 
            onSuccess={() => {}} 
            onCheckBudgetThresholds={checkBudgetThresholds}
          />
          
          <ExpensesList 
            expenses={expenses}
            isLoading={expensesLoading}
            totalSpent={totalSpent}
            onCheckBudgetThresholds={checkBudgetThresholds}
          />
        </main>
      </div>
    </div>
  );
}
