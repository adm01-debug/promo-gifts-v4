import { WorkflowCanvas } from "@/components/workflows/WorkflowCanvas";
import { Workflow } from "lucide-react";
import { PageSEO } from "@/components/seo/PageSEO";

export default function AdminWorkflowsPage() {
  return (
      <PageSEO title="Workflows" description="Configure automações e fluxos de trabalho." path="/admin/workflows" noIndex />
      <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-4 space-y-3 sm:space-y-4 pb-24 md:pb-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10">
            <Workflow className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Workflows IA</h1>
            <p className="text-muted-foreground">
              Canvas visual para orquestração multiagente com etapas arrastáveis
            </p>
          </div>
        </div>

        <WorkflowCanvas />
      </div>
  );
}
