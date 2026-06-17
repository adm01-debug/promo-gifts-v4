import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  FileText,
  MoreVertical,
  Star,
  StarOff,
  Copy,
  Trash2,
  Edit,
  Search,
  Plus,
  Package,
  Users,
  UserPlus,
  Download,
} from 'lucide-react';
import { type QuoteTemplate, useQuoteTemplates } from '@/hooks/quotes';
import { exportTemplatesToJson, exportSingleTemplate } from '@/utils/templateExport';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface QuoteTemplatesListProps {
  onApplyTemplate?: (template: QuoteTemplate) => void;
  onEditTemplate?: (template: QuoteTemplate) => void;
  onCreateTemplate?: () => void;
  selectionMode?: boolean;
}

export function QuoteTemplatesList({
  onApplyTemplate,
  onEditTemplate,
  onCreateTemplate,
  selectionMode = false,
}: QuoteTemplatesListProps) {
  const {
    templates,
    allTemplates: _allTemplates,
    sellers,
    loading,
    deleteTemplate,
    setDefaultTemplate,
    duplicateTemplate,
    cloneTemplateToSeller,
    isAdmin,
  } = useQuoteTemplates();
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [cloneTemplateId, setCloneTemplateId] = useState<string | null>(null);
  const [targetSellerId, setTargetSellerId] = useState<string>('');

  const filteredTemplates = templates.filter(
    (template) =>
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const calculateTemplateTotal = (template: QuoteTemplate) => {
    const itemsTotal = template.items.reduce((sum, item) => {
      const itemBase = item.quantity * item.unitPrice;
      const personalizationCost =
        item.personalizations?.reduce((pSum, p) => {
          return pSum + (p.unitCost || 0) * item.quantity + (p.setupCost || 0);
        }, 0) || 0;
      return sum + itemBase + personalizationCost;
    }, 0);

    const discountValue =
      template.discount_percent > 0
        ? itemsTotal * (template.discount_percent / 100)
        : template.discount_amount;

    return itemsTotal - discountValue;
  };

  const handleDelete = async () => {
    if (deleteConfirmId) {
      await deleteTemplate(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const handleClone = async () => {
    if (cloneTemplateId && targetSellerId) {
      await cloneTemplateToSeller(cloneTemplateId, targetSellerId);
      setCloneDialogOpen(false);
      setCloneTemplateId(null);
      setTargetSellerId('');
    }
  };

  const openCloneDialog = (templateId: string) => {
    setCloneTemplateId(templateId);
    setCloneDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-32" />
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        {templates.length > 0 && (
          <Button variant="outline" onClick={() => exportTemplatesToJson(templates)}>
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        )}
        {onCreateTemplate && (
          <Button onClick={onCreateTemplate}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Template
          </Button>
        )}
      </div>

      {filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 font-display text-lg font-medium">Nenhum template encontrado</h3>
            <p className="mb-4 text-muted-foreground">
              {searchTerm
                ? 'Tente buscar com outros termos'
                : 'Crie seu primeiro template para agilizar orçamentos'}
            </p>
            {onCreateTemplate && !searchTerm && (
              <Button onClick={onCreateTemplate}>
                <Plus className="mr-2 h-4 w-4" />
                Criar Template
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <Card
              key={template.id}
              className={cn(
                'group transition-shadow hover:shadow-md',
                selectionMode ? 'cursor-pointer hover:border-primary' : '',
              )}
              onClick={() => selectionMode && onApplyTemplate?.(template)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="truncate text-base">{template.name}</CardTitle>
                      {template.is_default && (
                        <Badge variant="secondary" className="shrink-0">
                          <Star className="mr-1 h-3 w-3 fill-current" />
                          Padrão
                        </Badge>
                      )}
                    </div>
                    {template.description && (
                      <CardDescription className="mt-1 line-clamp-2">
                        {template.description}
                      </CardDescription>
                    )}
                  </div>
                  {!selectionMode && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Mais opções"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {onApplyTemplate && (
                          <DropdownMenuItem onClick={() => onApplyTemplate(template)}>
                            <FileText className="mr-2 h-4 w-4" />
                            Usar Template
                          </DropdownMenuItem>
                        )}
                        {onEditTemplate && (
                          <DropdownMenuItem onClick={() => onEditTemplate(template)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => duplicateTemplate(template.id)}>
                          <Copy className="mr-2 h-4 w-4" />
                          Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDefaultTemplate(template.id)}
                          disabled={template.is_default}
                        >
                          {template.is_default ? (
                            <>
                              <StarOff className="mr-2 h-4 w-4" />
                              Já é padrão
                            </>
                          ) : (
                            <>
                              <Star className="mr-2 h-4 w-4" />
                              Definir como Padrão
                            </>
                          )}
                        </DropdownMenuItem>
                        {isAdmin && sellers.length > 0 && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openCloneDialog(template.id)}>
                              <UserPlus className="mr-2 h-4 w-4" />
                              Clonar para Vendedor
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => exportSingleTemplate(template)}>
                          <Download className="mr-2 h-4 w-4" />
                          Exportar JSON
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleteConfirmId(template.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Package className="h-3.5 w-3.5" />
                      {template.items.length} {template.items.length === 1 ? 'item' : 'itens'}
                    </span>
                    <span className="font-medium text-foreground">
                      {formatCurrency(calculateTemplateTotal(template))}
                    </span>
                  </div>

                  {(template.discount_percent > 0 || template.discount_amount > 0) && (
                    <Badge variant="outline" className="text-xs">
                      Desconto:{' '}
                      {template.discount_percent > 0
                        ? `${template.discount_percent}%`
                        : formatCurrency(template.discount_amount)}
                    </Badge>
                  )}

                  <div className="border-t pt-2 text-xs text-muted-foreground">
                    Atualizado em{' '}
                    {format(new Date(template.updated_at), 'dd/MM/yyyy', { locale: ptBR })}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O template será permanentemente excluído.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clone Template Dialog */}
      <Dialog open={cloneDialogOpen} onOpenChange={setCloneDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Clonar Template para Vendedor
            </DialogTitle>
            <DialogDescription>
              Selecione o vendedor que receberá uma cópia deste template.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <label className="mb-2 block text-sm font-medium">Vendedor Destino</label>
            <Select value={targetSellerId} onValueChange={setTargetSellerId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um vendedor..." />
              </SelectTrigger>
              <SelectContent>
                {sellers.map((seller) => (
                  <SelectItem key={seller.id} value={seller.id}>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{seller.full_name || seller.email}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {sellers.length === 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                Nenhum vendedor disponível para clonagem.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCloneDialogOpen(false);
                setCloneTemplateId(null);
                setTargetSellerId('');
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleClone} disabled={!targetSellerId}>
              <Copy className="mr-2 h-4 w-4" />
              Clonar Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
