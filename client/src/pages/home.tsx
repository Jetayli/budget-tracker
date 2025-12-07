import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { type Budget } from "@shared/schema";
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
import { LanguageToggle } from "@/components/language-toggle";
import { 
  DollarSign, 
  Trash2, 
  TrendingDown,
  Wallet,
  FolderOpen,
  FolderPlus
} from "lucide-react";

type ProjectWithSpent = Budget & { totalSpent: number };

function formatCurrency(amount: number, language: string): string {
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

function CreateProjectDialog() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  
  const projectFormSchema = z.object({
    name: z.string().min(1, t('projectForm.projectNameRequired')),
    totalBudget: z.coerce.number().min(0.01, t('projectForm.budgetRequired')),
  });

  type ProjectFormValues = z.infer<typeof projectFormSchema>;
  
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: "",
      totalBudget: undefined as unknown as number,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: ProjectFormValues) => {
      const res = await apiRequest("POST", "/api/projects", data);
      return res.json();
    },
    onSuccess: (data: ProjectWithSpent) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: t('toast.projectCreated'), description: t('toast.projectCreatedDesc') });
      setOpen(false);
      form.reset();
      navigate(`/projects/${data.id}`);
    },
    onError: (error: Error) => {
      toast({ title: t('common.error'), description: error.message, variant: "destructive" });
    },
  });

  const isRTL = i18n.language === 'ar';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-create-project">
          <FolderPlus className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
          {t('home.newProject')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('projectForm.createTitle')}</DialogTitle>
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
                    <Input placeholder={t('projectForm.projectNamePlaceholder')} data-testid="input-project-name" {...field} />
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
                        placeholder={t('projectForm.budgetPlaceholder')}
                        className={`${isRTL ? 'pr-12' : 'pl-12'} tabular-nums`}
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
                <Button type="button" variant="ghost">{t('common.cancel')}</Button>
              </DialogClose>
              <Button type="submit" disabled={mutation.isPending} data-testid="button-save-project">
                {mutation.isPending ? t('common.creating') : t('projectForm.createButton')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function ProjectCard({ project }: { project: ProjectWithSpent }) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  const percentUsed = project.totalBudget > 0 ? (project.totalSpent / project.totalBudget) * 100 : 0;
  const remaining = project.totalBudget - project.totalSpent;

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/projects/${project.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: t('toast.projectDeleted'), description: t('toast.projectDeletedDesc') });
    },
    onError: (error: Error) => {
      toast({ title: t('common.error'), description: error.message, variant: "destructive" });
    },
  });

  const handleCardClick = () => {
    navigate(`/projects/${project.id}`);
  };

  return (
    <Card 
      className="cursor-pointer hover-elevate transition-all"
      onClick={handleCardClick}
      data-testid={`card-project-${project.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg truncate">
            <FolderOpen className="h-5 w-5 shrink-0 text-muted-foreground" />
            <span className="truncate">{project.name || t('project.untitled')}</span>
          </CardTitle>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                size="icon" 
                variant="ghost" 
                className="shrink-0"
                onClick={(e) => e.stopPropagation()}
                data-testid={`button-delete-project-${project.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('projectDelete.title')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('projectDelete.description', { name: project.name })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteMutation.mutate();
                  }}
                  data-testid={`button-confirm-delete-project-${project.id}`}
                >
                  {t('common.delete')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground flex items-center gap-1 mb-1">
                <Wallet className="h-3 w-3" />
                {t('project.budget')}
              </p>
              <p className="font-semibold tabular-nums">{formatCurrency(project.totalBudget, i18n.language)}</p>
            </div>
            <div>
              <p className="text-muted-foreground flex items-center gap-1 mb-1">
                <TrendingDown className="h-3 w-3" />
                {t('project.spent')}
              </p>
              <p className="font-semibold tabular-nums">{formatCurrency(project.totalSpent, i18n.language)}</p>
            </div>
            <div>
              <p className="text-muted-foreground flex items-center gap-1 mb-1">
                <DollarSign className="h-3 w-3" />
                {t('project.remaining')}
              </p>
              <p className={`font-semibold tabular-nums ${getStatusColor(percentUsed)}`}>
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
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full transition-all duration-300 ease-out ${getProgressColor(percentUsed)}`}
                style={{ width: `${Math.min(percentUsed, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProjectsGrid({ projects, isLoading }: { projects: ProjectWithSpent[]; isLoading: boolean }) {
  const { t } = useTranslation();
  
  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">{t('home.noProjects')}</h3>
          <p className="text-muted-foreground mb-6">{t('home.createFirst')}</p>
          <CreateProjectDialog />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}

export default function Home() {
  const { t } = useTranslation();
  const { data: projects = [], isLoading } = useQuery<ProjectWithSpent[]>({
    queryKey: ["/api/projects"],
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-3xl font-bold">{t('home.title')}</h1>
              <LanguageToggle />
            </div>
            <p className="text-muted-foreground">{t('home.subtitle')}</p>
          </div>
          {projects.length > 0 && <CreateProjectDialog />}
        </div>

        <ProjectsGrid projects={projects} isLoading={isLoading} />
      </div>
    </div>
  );
}
