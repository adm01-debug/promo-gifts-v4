import { WorkflowCanvas } from '@/components/workflows/WorkflowCanvas';
import { Workflow } from 'lucide-react';
import { PageSEO } from '@/components/seo/PageSEO';

export default function AdminWorkflowsPage() {
  return (
    <>
      <PageSEO
        title="Workflows"
        description="Configure automações e fluxos de trabalho."
        path="/admin/workflows"
        noIndex
      />
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-3">
            <Workflow className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1
              data-testid="page-title-workflows"
              className="font-display text-3xl font-bold tracking-tight"
            >
              Workflows IA
            </h1>
            <p className="text-muted-foreground">
              Canvas visual para orquestração multiagente com etapas arrastáveis
            </p>
          </div>
        </div>

        <WorkflowCanvas />
      </div>
    </>
  );
}
