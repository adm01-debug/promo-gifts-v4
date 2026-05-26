import { MockupPromptManager } from '@/components/admin/MockupPromptManager';
import { Brain } from 'lucide-react';
import { PageSEO } from '@/components/seo/PageSEO';

export default function AdminPromptsIAPage() {
  return (
    <>
      <PageSEO
        title="Prompts de IA"
        description="Configure e gerencie prompts de inteligência artificial."
        path="/admin/prompts-ia"
        noIndex
      />
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-3">
            <Brain className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1
              data-testid="page-title-prompts-ia"
              className="font-display text-3xl font-bold tracking-tight"
            >
              Prompts IA
            </h1>
            <p className="text-muted-foreground">
              Gerencie prompts do gerador de mockups e modelos de IA
            </p>
          </div>
        </div>

        <MockupPromptManager />
      </div>
    </>
  );
}
