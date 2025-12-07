import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
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
import { 
  DollarSign, 
  Trash2, 
  TrendingDown,
  Wallet,
  FolderOpen,
  FolderPlus
} from "lucide-react";

type ProjectWithSpent = Budget & { totalSpent: number };

const projectFormSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  totalBudget: z.coerce.number().min(0.01, "Budget must be greater than 0"),
});

type ProjectFormValues = z.infer<typeof projectFormSchema>;

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-SA", {
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

function getStatusBadge(percentUsed: number) {
  if (percentUsed >= 80) {
    return <Badge variant="destructive" className="text-xs">Over 80%</Badge>;
  }
  if (percentUsed >= 50) {
    return <Badge className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30 text-xs">50-80%</Badge>;
  }
  return <Badge className="bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30 text-xs">Under 50%</Badge>;
}

function CreateProjectDialog() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  
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
      toast({ title: "Project Created", description: "Your new project has been created." });
      setOpen(false);
      form.reset();
      navigate(`/projects/${data.id}`);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-create-project">
          <FolderPlus className="h-4 w-4 mr-2" />
          New Project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Q1 Marketing Campaign" data-testid="input-project-name" {...field} />
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
                  <FormLabel>Total Budget (SAR)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">SAR</span>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        placeholder="6000"
                        className="pl-12 tabular-nums"
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
                <Button type="button" variant="ghost">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={mutation.isPending} data-testid="button-save-project">
                {mutation.isPending ? "Creating..." : "Create Project"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function ProjectCard({ project }: { project: ProjectWithSpent }) {
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
      toast({ title: "Project Deleted", description: "Project and all its data have been removed." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
            <span className="truncate">{project.name || "Untitled Project"}</span>
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
                <AlertDialogTitle>Delete Project</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{project.name}"? This will permanently delete all categories, subcategories, and spend entries associated with this project.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteMutation.mutate();
                  }}
                  data-testid={`button-confirm-delete-project-${project.id}`}
                >
                  Delete
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
                Budget
              </p>
              <p className="font-semibold tabular-nums">{formatCurrency(project.totalBudget)}</p>
            </div>
            <div>
              <p className="text-muted-foreground flex items-center gap-1 mb-1">
                <TrendingDown className="h-3 w-3" />
                Spent
              </p>
              <p className="font-semibold tabular-nums">{formatCurrency(project.totalSpent)}</p>
            </div>
            <div>
              <p className="text-muted-foreground flex items-center gap-1 mb-1">
                <DollarSign className="h-3 w-3" />
                Remaining
              </p>
              <p className={`font-semibold tabular-nums ${getStatusColor(percentUsed)}`}>
                {formatCurrency(remaining)}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Budget Used</span>
              <div className="flex items-center gap-2">
                <span className="font-medium tabular-nums">{Math.round(percentUsed)}%</span>
                {getStatusBadge(percentUsed)}
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
          <h3 className="text-lg font-medium mb-2">No projects yet</h3>
          <p className="text-muted-foreground mb-6">Create your first project to start tracking your marketing budget.</p>
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
  const { data: projects = [], isLoading } = useQuery<ProjectWithSpent[]>({
    queryKey: ["/api/projects"],
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold mb-2">Marketing Budget Tracker</h1>
            <p className="text-muted-foreground">Track your marketing budgets and expenses across multiple projects.</p>
          </div>
          {projects.length > 0 && <CreateProjectDialog />}
        </div>

        <ProjectsGrid projects={projects} isLoading={isLoading} />
      </div>
    </div>
  );
}
