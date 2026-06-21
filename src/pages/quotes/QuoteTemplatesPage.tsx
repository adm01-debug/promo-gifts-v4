import { useState } from 'react';
import { PageSEO } from '@/components/seo/PageSEO';
import { QuoteTemplatesList } from '@/components/quotes/QuoteTemplatesList';
import { QuoteTemplateForm } from '@/components/quotes/QuoteTemplateForm';
import { AdminTemplatesManager } from '@/components/quotes/AdminTemplatesManager';
import { type QuoteTemplate, useQuoteTemplates } from '@/hooks/quotes';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, FileText, Users } from 'lucide-react';

type ViewMode = 'create' | 'edit' | 'list';

export default function QuoteTemplatesPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingTemplate, setEditingTemplate] = useState<QuoteTemplate | null>(null);
  const [activeTab, setActiveTab] = useState<'all-templates' | 'my-templates'>('my-templates');
  const { isAdmin } = useQuoteTemplates();

  const handleCreateTemplate = () => {
    setEditingTemplate(null);
    setViewMode('create');
  };

  const handleEditTemplate = (template: QuoteTemplate) => {
    setEditingTemplate(template);
    setViewMode('edit');
  };

  const handleSaveComplete = () => {
    setViewMode('list');
    setEditingTemplate(null);
  };

  const handleCancel = () => {
    setViewMode('list');
    setEditingTemplate(null);
  };

  return (
    <>
      <PageSEO
        title="Modelos de Orçamento"
        description="Gerencie modelos para criar orçamentos rapidamente."
        path="/orcamentos/modelos"
        noIndex
      />
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
        <div className="flex items-center gap-4">
          {viewMode !== 'list' && (
            <Button variant="ghost" size="icon" onClick={handleCancel} aria-label="Voltar">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div>
            <h1
              data-testid="page-title-orcamentos-templates"
              className="font-display text-2xl font-bold tracking-tight"
            >
              {viewMode === 'list' && 'Templates de Orçamento'}
              {viewMode === 'create' && 'Novo Template'}
              {viewMode === 'edit' && 'Editar Template'}
            </h1>
            <p className="text-muted-foreground">
              {viewMode === 'list' && 'Gerencie seus templates reutilizáveis para orçamentos'}
              {viewMode === 'create' && 'Crie um novo template de orçamento'}
              {viewMode === 'edit' && `Editando: ${editingTemplate?.name}`}
            </p>
          </div>
        </div>

        {viewMode === 'list' && isAdmin ? (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList>
              <TabsTrigger value="my-templates" className="gap-2">
                <FileText className="h-4 w-4" />
                Meus Templates
              </TabsTrigger>
              <TabsTrigger value="all-templates" className="gap-2">
                <Users className="h-4 w-4" />
                Todos os Templates
              </TabsTrigger>
            </TabsList>

            <TabsContent value="my-templates" className="mt-4">
              <QuoteTemplatesList
                onCreateTemplate={handleCreateTemplate}
                onEditTemplate={handleEditTemplate}
              />
            </TabsContent>

            <TabsContent value="all-templates" className="mt-4">
              <AdminTemplatesManager onEditTemplate={handleEditTemplate} />
            </TabsContent>
          </Tabs>
        ) : viewMode === 'list' ? (
          <QuoteTemplatesList
            onCreateTemplate={handleCreateTemplate}
            onEditTemplate={handleEditTemplate}
          />
        ) : null}

        {(viewMode === 'create' || viewMode === 'edit') && (
          <QuoteTemplateForm
            template={editingTemplate}
            onSave={handleSaveComplete}
            onCancel={handleCancel}
          />
        )}
      </div>
    </>
  );
}
