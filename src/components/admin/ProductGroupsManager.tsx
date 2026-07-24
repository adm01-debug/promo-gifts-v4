/**
 * ProductGroupsManager — Refactored orchestrator
 * Hook + sub-components extracted to ./product-groups/
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion } from '@/components/ui/accordion';
import { FolderOpen, Loader2 } from 'lucide-react';
import { useProductGroups } from './product-groups/useProductGroups';
import { GroupFormDialog } from './product-groups/GroupFormDialog';
import { GroupAccordionItem } from './product-groups/GroupAccordionItem';

export function ProductGroupsManager() {
  const {
    groups,
    groupsLoading,
    addGroup,
    updateGroup,
    deleteGroup,
    addMember,
    removeMember,
    getMembersForGroup,
    getAvailableProducts,
    getProductInfo,
  } = useProductGroups();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Grupos de Produtos
            </CardTitle>
            <CardDescription>
              Crie grupos para aplicar regras de personalização em lote
            </CardDescription>
          </div>
          <GroupFormDialog
            isPending={addGroup.isPending}
            onCreate={(data) => addGroup.mutate(data)}
          />
        </div>
      </CardHeader>
      <CardContent>
        {groupsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !groups?.length ? (
          <div className="py-8 text-center text-muted-foreground">
            <FolderOpen className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>Nenhum grupo cadastrado</p>
            <p className="text-sm">Crie grupos para organizar produtos por tipo</p>
          </div>
        ) : (
          <Accordion type="multiple" className="space-y-2">
            {groups.map((group) => (
              <GroupAccordionItem
                key={group.id}
                group={group}
                members={getMembersForGroup(group.id)}
                availableProducts={getAvailableProducts(group.id)}
                getProductInfo={getProductInfo}
                onUpdate={(data) => updateGroup.mutate(data)}
                onDelete={(id) => deleteGroup.mutate(id)}
                onAddMember={(data) => addMember.mutate(data)}
                onRemoveMember={(id) => removeMember.mutate(id)}
              />
            ))}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}
