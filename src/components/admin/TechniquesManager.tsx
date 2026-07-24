/**
 * TechniquesManager — Orchestrator (refactored)
 * Dialog + Table extracted to sub-components.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Palette, Database } from 'lucide-react';
import { useTecnicasUnificadas, useCategoriasTecnicas } from '@/hooks/simulation';
import { TechniqueFormDialog } from './techniques-manager/TechniqueFormDialog';
import { TechniqueTable } from './techniques-manager/TechniqueTable';

export function TechniquesManager() {
  const { tecnicas, isLoading, toggleStatus, create, isCreating, update, remove, isRemoving } =
    useTecnicasUnificadas();
  const categorias = useCategoriasTecnicas();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Técnicas de Personalização
              <Badge variant="outline" className="ml-2 gap-1">
                <Database className="h-3 w-3" />
                BD Externo
              </Badge>
            </CardTitle>
            <CardDescription>
              Gerencie as técnicas disponíveis no catálogo Promobrind
            </CardDescription>
          </div>
          <TechniqueFormDialog
            categorias={categorias}
            isCreating={isCreating}
            onCreate={create}
            data-testid="admin-create-btn"
          />
        </div>
      </CardHeader>
      <CardContent>
        <TechniqueTable
          tecnicas={tecnicas}
          isLoading={isLoading}
          isRemoving={isRemoving}
          onToggleStatus={toggleStatus}
          onUpdate={update as (params: Record<string, unknown>) => void}
          onRemove={remove}
        />
        <div className="mt-4 flex items-center gap-2 border-t pt-4 text-xs text-muted-foreground">
          <Database className="h-3 w-3" />
          Dados do BD Externo (Promobrind) • {tecnicas.length} técnicas
        </div>
      </CardContent>
    </Card>
  );
}
