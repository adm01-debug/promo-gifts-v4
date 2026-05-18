import { MockupPromptManager } from "@/components/admin/MockupPromptManager";
import { Brain } from "lucide-react";
import { PageSEO } from "@/components/seo/PageSEO";

export default function AdminPromptsIAPage() {
  return (
      <PageSEO title="Prompts de IA" description="Configure e gerencie prompts de inteligência artificial." path="/admin/prompts-ia" noIndex />
      <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-4 space-y-3 sm:space-y-4 pb-24 md:pb-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10">
            <Brain className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Prompts IA</h1>
            <p className="text-muted-foreground">Gerencie prompts do gerador de mockups e modelos de IA</p>
          </div>
        </div>

        <MockupPromptManager />
      </div>
  );
}
