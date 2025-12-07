import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
  type SpendEntry 
} from "@shared/schema";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { LanguageToggle } from "@/components/language-toggle";
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
  Target,
  ArrowLeft
} from "lucide-react";
import { format, parseISO } from "date-fns";

type ProjectWithSpent = Budget & { totalSpent: number };

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

function formatCurrency(amount: number, language: string = 'en'): string {
  const locale = language === 'ar' ? 'ar-SA' : 'en-SA';
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
    return <Badge variant="destructive" className="text-xs">{t('status.over80')}</Badge>;
  }
  if (percentUsed >= 50) {
    return <Badge className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30 text-xs">{t('status.between50and80')}</Badge>;
  }
  return <Badge className="bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30 text-xs">{t('status.under50')}</Badge>;
}

function EditProjectDialog({ 
  project, 
  open, 
  onOpenChange 
}: { 
  project: ProjectWithSpent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  
  const projectFormSchema = z.object({
    name: z.string().min(1, t('projectForm.projectNameRequired')),
    totalBudget: z.coerce.number().min(0.01, t('projectForm.budgetRequired')),
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
      const res = await apiRequest("PATCH", `/api/projects/${project.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id] });
      toast({ title: t('toast.projectUpdated'), description: t('toast.projectUpdatedDesc') });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: t('common.error'), description: error.message, variant: "destructive" });
    },
  });

  const isRTL = i18n.language === 'ar';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('projectForm.editTitle')}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('projectForm.projectName')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('projectForm.projectNamePlaceholder')} data-testid="input-edit-project-name" {...field} />
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
                  <FormLabel>{t('projectForm.totalBudget')}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-muted-foreground text-sm`}>{t('currency.sar')}</span>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        className={`${isRTL ? 'pr-12' : 'pl-12'} tabular-nums`}
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
                <Button type="button" variant="ghost">{t('common.cancel')}</Button>
              </DialogClose>
              <Button type="submit" disabled={mutation.isPending} data-testid="button-update-project">
                {mutation.isPending ? t('common.saving') : t('projectForm.updateButton')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function ProjectOverview({ project, isLoading }: { project: ProjectWithSpent | null; isLoading: boolean }) {
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
  const percentUsed = project.totalBudget > 0 ? (project.totalSpent / project.totalBudget) * 100 : 0;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            {project.name || t('project.projectBudget')}
          </CardTitle>
          <Button size="icon" variant="ghost" onClick={() => setEditOpen(true)} data-testid="button-edit-project">
            <Pencil className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Wallet className="h-4 w-4" />
                {t('project.totalBudget')}
              </p>
              <p className="text-2xl font-bold tabular-nums" data-testid="text-total-budget">
                {formatCurrency(project.totalBudget, i18n.language)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <TrendingDown className="h-4 w-4" />
                {t('project.totalSpent')}
              </p>
              <p className="text-2xl font-bold tabular-nums" data-testid="text-total-spent">
                {formatCurrency(project.totalSpent, i18n.language)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-4 w-4" />
                {t('project.remaining')}
              </p>
              <p className={`text-2xl font-bold tabular-nums ${getStatusColor(percentUsed)}`} data-testid="text-remaining">
                {formatCurrency(remaining, i18n.language)}
              </p>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">{t('project.budgetUsed')}</span>
              <div className="flex items-center gap-2">
                <span className="font-medium tabular-nums">{Math.round(percentUsed)}%</span>
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
      <EditProjectDialog project={project} open={editOpen} onOpenChange={setEditOpen} />
    </>
  );
}

function AddCategoryDialog({ projectId, onSuccess }: { projectId: string; onSuccess: () => void }) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  
  const categoryFormSchema = z.object({
    name: z.string().min(1, t('category.categoryNamePlaceholder')),
    allocatedBudget: z.coerce.number().min(0.01, t('projectForm.budgetRequired')),
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
      const res = await apiRequest("POST", `/api/projects/${projectId}/categories`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: t('toast.categoryAdded'), description: t('toast.categoryAddedDesc') });
      setOpen(false);
      form.reset();
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ title: t('common.error'), description: error.message, variant: "destructive" });
    },
  });

  const isRTL = i18n.language === 'ar';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="button-add-category">
          <Plus className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
          {t('category.addCategory')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('category.addCategory')}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('category.categoryName')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('category.categoryNamePlaceholder')} data-testid="input-category-name" {...field} />
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
                  <FormLabel>{t('category.allocatedBudget')}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-muted-foreground text-sm`}>{t('currency.sar')}</span>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        placeholder={t('category.budgetPlaceholder')}
                        className={`${isRTL ? 'pr-12' : 'pl-12'} tabular-nums`}
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
                <Button type="button" variant="ghost">{t('common.cancel')}</Button>
              </DialogClose>
              <Button type="submit" disabled={mutation.isPending} data-testid="button-save-category">
                {mutation.isPending ? t('common.adding') : t('category.addCategory')}
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
  projectId
}: { 
  category: CategoryWithSpent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  
  const categoryFormSchema = z.object({
    name: z.string().min(1, t('category.categoryNamePlaceholder')),
    allocatedBudget: z.coerce.number().min(0.01, t('projectForm.budgetRequired')),
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
      const res = await apiRequest("PATCH", `/api/categories/${category.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "categories"] });
      toast({ title: t('toast.categoryUpdated'), description: t('toast.categoryUpdatedDesc') });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: t('common.error'), description: error.message, variant: "destructive" });
    },
  });

  const isRTL = i18n.language === 'ar';

  if (!category) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('category.editCategory')}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('category.categoryName')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('category.categoryName')} data-testid="input-edit-category-name" {...field} />
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
                  <FormLabel>{t('category.allocatedBudget')}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-muted-foreground text-sm`}>{t('currency.sar')}</span>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        className={`${isRTL ? 'pr-12' : 'pl-12'} tabular-nums`}
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
                <Button type="button" variant="ghost">{t('common.cancel')}</Button>
              </DialogClose>
              <Button type="submit" disabled={mutation.isPending} data-testid="button-update-category">
                {mutation.isPending ? t('common.saving') : t('category.editCategory')}
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
  onSuccess 
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
    name: z.string().min(1, t('platform.platformNamePlaceholder')),
    allocatedBudget: z.coerce.number().min(0.01, t('projectForm.budgetRequired')),
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
      const res = await apiRequest("POST", `/api/categories/${categoryId}/subcategories`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories", categoryId, "subcategories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "categories"] });
      toast({ title: t('toast.platformAdded'), description: t('toast.platformAddedDesc') });
      setOpen(false);
      form.reset({ name: "", allocatedBudget: undefined as unknown as number, categoryId });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ title: t('common.error'), description: error.message, variant: "destructive" });
    },
  });

  const isRTL = i18n.language === 'ar';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" data-testid={`button-add-subcategory-${categoryId}`}>
          <Plus className={`h-3 w-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />
          {t('common.add')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('platform.addPlatformTo', { name: categoryName })}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('platform.platformName')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('platform.platformNamePlaceholder')} data-testid="input-subcategory-name" {...field} />
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
                  <FormLabel>{t('platform.allocatedBudget')}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-muted-foreground text-sm`}>{t('currency.sar')}</span>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        placeholder={t('platform.budgetPlaceholder')}
                        className={`${isRTL ? 'pr-12' : 'pl-12'} tabular-nums`}
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
                <Button type="button" variant="ghost">{t('common.cancel')}</Button>
              </DialogClose>
              <Button type="submit" disabled={mutation.isPending} data-testid="button-save-subcategory">
                {mutation.isPending ? t('common.adding') : t('platform.addPlatform')}
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
  onOpenChange 
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
    name: z.string().min(1, t('platform.platformNamePlaceholder')),
    allocatedBudget: z.coerce.number().min(0.01, t('projectForm.budgetRequired')),
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
      const res = await apiRequest("PATCH", `/api/subcategories/${subcategory.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories", categoryId, "subcategories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "categories"] });
      toast({ title: t('toast.platformUpdated'), description: t('toast.platformUpdatedDesc') });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: t('common.error'), description: error.message, variant: "destructive" });
    },
  });

  const isRTL = i18n.language === 'ar';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('platform.editPlatform')}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('platform.platformName')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('platform.platformName')} data-testid="input-edit-subcategory-name" {...field} />
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
                  <FormLabel>{t('platform.allocatedBudget')}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-muted-foreground text-sm`}>{t('currency.sar')}</span>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        className={`${isRTL ? 'pr-12' : 'pl-12'} tabular-nums`}
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
                <Button type="button" variant="ghost">{t('common.cancel')}</Button>
              </DialogClose>
              <Button type="submit" disabled={mutation.isPending} data-testid="button-update-subcategory">
                {mutation.isPending ? t('common.saving') : t('platform.editPlatform')}
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
  onDelete 
}: { 
  subcategory: SubcategoryWithSpent; 
  categoryId: string;
  projectId: string;
  onDelete: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  
  const percentUsed = subcategory.allocatedBudget > 0 
    ? (subcategory.spent / subcategory.allocatedBudget) * 100 
    : 0;

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/subcategories/${subcategory.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories", categoryId, "subcategories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "categories"] });
      toast({ title: t('toast.platformDeleted'), description: t('toast.platformDeletedDesc') });
      onDelete();
    },
    onError: (error: Error) => {
      toast({ title: t('common.error'), description: error.message, variant: "destructive" });
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
            <span className="text-sm font-medium truncate">{subcategory.name}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="tabular-nums">{formatCurrency(subcategory.spent, i18n.language)} / {formatCurrency(subcategory.allocatedBudget, i18n.language)}</span>
            <span className={`font-medium tabular-nums ${getStatusColor(percentUsed)}`}>({Math.round(percentUsed)}%)</span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="icon" variant="ghost" onClick={() => setEditOpen(true)} data-testid={`button-edit-subcategory-${subcategory.id}`}>
            <Pencil className="h-3 w-3" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="icon" variant="ghost" data-testid={`button-delete-subcategory-${subcategory.id}`}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('platform.deletePlatform')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('platform.deleteConfirm', { name: subcategory.name })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteMutation.mutate()}>{t('common.delete')}</AlertDialogAction>
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

function CategoryCard({ category, projectId }: { category: CategoryWithSpent; projectId: string }) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  
  const percentUsed = category.allocatedBudget > 0 
    ? (category.spent / category.allocatedBudget) * 100 
    : 0;

  const { data: subcategories = [], isLoading: subcategoriesLoading } = useQuery<SubcategoryWithSpent[]>({
    queryKey: ["/api/categories", category.id, "subcategories"],
    enabled: isExpanded,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/categories/${category.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: t('toast.categoryDeleted'), description: t('toast.categoryDeletedDesc') });
    },
    onError: (error: Error) => {
      toast({ title: t('common.error'), description: error.message, variant: "destructive" });
    },
  });

  return (
    <>
      <Card data-testid={`card-category-${category.id}`}>
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="p-0 h-auto hover:bg-transparent justify-start flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                    <CardTitle className="text-base truncate">{category.name}</CardTitle>
                  </div>
                </Button>
              </CollapsibleTrigger>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="icon" variant="ghost" onClick={() => setEditOpen(true)} data-testid={`button-edit-category-${category.id}`}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" data-testid={`button-delete-category-${category.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('category.deleteCategory')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('category.deleteConfirm', { name: category.name })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteMutation.mutate()}>{t('common.delete')}</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">{t('project.spent')} / {t('project.budget')}</span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(category.spent, i18n.language)} / {formatCurrency(category.allocatedBudget, i18n.language)}
                </span>
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">{t('project.budgetUsed')}</span>
                  <div className="flex items-center gap-2">
                    <span className={`font-medium tabular-nums ${getStatusColor(percentUsed)}`}>{Math.round(percentUsed)}%</span>
                    <StatusBadge percentUsed={percentUsed} />
                  </div>
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
                    <span className="text-sm font-medium text-muted-foreground">{t('platform.platforms')}</span>
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
                      {t('platform.platformNamePlaceholder')}
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
  onSuccess 
}: { 
  categories: CategoryWithSpent[];
  projectId: string;
  onSuccess: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  
  const spendEntryFormSchema = z.object({
    amount: z.coerce.number().min(0.01, t('projectForm.budgetRequired')),
    description: z.string().min(1, t('spend.descriptionPlaceholder')),
    date: z.string().min(1),
    categoryId: z.string().min(1, t('spend.selectCategory')),
    subcategoryId: z.string().optional().nullable(),
  });

  type SpendEntryFormValues = z.infer<typeof spendEntryFormSchema>;
  
  const form = useForm<SpendEntryFormValues>({
    resolver: zodResolver(spendEntryFormSchema),
    defaultValues: {
      amount: undefined as unknown as number,
      description: "",
      date: getTodayDateString(),
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
        subcategoryId: data.subcategoryId === "" || data.subcategoryId === "none" ? null : data.subcategoryId,
      };
      const res = await apiRequest("POST", "/api/spend-entries", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "spend-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: t('toast.spendAdded'), description: t('toast.spendAddedDesc') });
      setOpen(false);
      form.reset({ amount: undefined as unknown as number, description: "", date: getTodayDateString(), categoryId: "", subcategoryId: null });
      setSelectedCategoryId("");
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ title: t('common.error'), description: error.message, variant: "destructive" });
    },
  });

  const handleCategoryChange = (value: string) => {
    setSelectedCategoryId(value);
    form.setValue("categoryId", value);
    form.setValue("subcategoryId", null);
  };

  const isRTL = i18n.language === 'ar';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-add-spend">
          <Receipt className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
          {t('spend.addSpend')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('spend.addSpend')}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('spend.amount')}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-muted-foreground text-sm`}>{t('currency.sar')}</span>
                      <Input type="number" step="0.01" min="0" placeholder={t('spend.amountPlaceholder')} className={`${isRTL ? 'pr-12' : 'pl-12'} tabular-nums`} data-testid="input-spend-amount" {...field} />
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
                  <FormLabel>{t('spend.description')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('spend.descriptionPlaceholder')} data-testid="input-spend-description" {...field} />
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
                  <FormLabel>{t('spend.date')}</FormLabel>
                  <FormControl>
                    <Input type="date" data-testid="input-spend-date" {...field} />
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
                  <FormLabel>{t('sections.categories')}</FormLabel>
                  <Select onValueChange={handleCategoryChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-spend-category">
                        <SelectValue placeholder={t('spend.selectCategory')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
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
                    <FormLabel>{t('platform.platforms')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "none"}>
                      <FormControl>
                        <SelectTrigger data-testid="select-spend-subcategory">
                          <SelectValue placeholder={t('spend.selectPlatform')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">{t('spend.noPlatform')}</SelectItem>
                        {subcategories.map((sub) => (
                          <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
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
                <Button type="button" variant="ghost">{t('common.cancel')}</Button>
              </DialogClose>
              <Button type="submit" disabled={mutation.isPending} data-testid="button-save-spend">
                {mutation.isPending ? t('common.adding') : t('spend.addSpend')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function SpendEntriesList({ categories, projectId }: { categories: CategoryWithSpent[]; projectId: string }) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  
  const { data: entries = [], isLoading } = useQuery<SpendEntry[]>({
    queryKey: ["/api/projects", projectId, "spend-entries"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/spend-entries/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "spend-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: t('toast.spendDeleted'), description: t('toast.spendDeletedDesc') });
    },
    onError: (error: Error) => {
      toast({ title: t('common.error'), description: error.message, variant: "destructive" });
    },
  });

  const getCategoryName = (categoryId: string) => {
    return categories.find(c => c.id === categoryId)?.name || "Unknown";
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('spend.recentSpendEntries')}</CardTitle>
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
          {t('spend.recentSpendEntries')}
        </CardTitle>
        <AddSpendEntryDialog categories={categories} projectId={projectId} onSuccess={() => {}} />
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            {t('spend.noSpendEntries')}. {t('spend.addFirstSpend')}
          </p>
        ) : (
          <div className="space-y-3">
            {entries.slice(0, 10).map((entry) => (
              <div 
                key={entry.id} 
                className="flex items-center justify-between py-3 px-4 bg-muted/30 rounded-md"
                data-testid={`row-spend-entry-${entry.id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-medium truncate">{entry.description}</span>
                    <Badge variant="outline" className="text-xs shrink-0">{getCategoryName(entry.categoryId)}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{formatDisplayDate(entry.date)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-semibold tabular-nums">{formatCurrency(entry.amount, i18n.language)}</span>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" data-testid={`button-delete-spend-${entry.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('spend.deleteSpend')}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('spend.deleteConfirm')}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(entry.id)}>{t('common.delete')}</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ProjectDetail() {
  const { t, i18n } = useTranslation();
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const projectId = params.id || "";

  const { data: project, isLoading: projectLoading } = useQuery<ProjectWithSpent>({
    queryKey: ["/api/projects", projectId],
    enabled: !!projectId,
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<CategoryWithSpent[]>({
    queryKey: ["/api/projects", projectId, "categories"],
    enabled: !!projectId,
  });

  const isRTL = i18n.language === 'ar';

  if (!projectId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-between gap-4 mb-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/")}
            data-testid="button-back-to-projects"
          >
            <ArrowLeft className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
            {t('navigation.backToProjects')}
          </Button>
          <LanguageToggle />
        </div>

        <div className="space-y-6">
          <ProjectOverview project={project || null} isLoading={projectLoading} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Layers className="h-5 w-5" />
                  {t('sections.categories')}
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
                    <h3 className="font-medium mb-1">{t('category.noCategories')}</h3>
                    <p className="text-sm text-muted-foreground">{t('category.createFirstCategory')}</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {categories.map((category) => (
                    <CategoryCard key={category.id} category={category} projectId={projectId} />
                  ))}
                </div>
              )}
            </div>

            <div>
              <SpendEntriesList categories={categories} projectId={projectId} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
