import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  Download
} from "lucide-react";
import { type QuoteTemplate, useQuoteTemplates } from "@/hooks/quotes";
import { exportTemplatesToJson, exportSingleTemplate } from "@/utils/templateExport";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const { templates, allTemplates, sellers, loading, deleteTemplate, setDefaultTemplate, duplicateTemplate, cloneTemplateToSeller, isAdmin } = useQuoteTemplates();
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [cloneTemplateId, setCloneTemplateId] = useState<string | null>(null);
  const [targetSellerId, setTargetSellerId] = useState<string>("");

  const filteredTemplates = templates.filter((template) =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const calculateTemplateTotal = (template: QuoteTemplate) => {
    const itemsTotal = template.items_data.reduce((sum, item) => {
      const itemBase = item.quantity * item.unitPrice;
      const personalizationCost = item.personalizations?.reduce((pSum, p) => {
        return pSum + (p.unitCost || 0) * item.quantity + (p.setupCost || 0);
      }, 0) || 0;
      return sum + itemBase + personalizationCost;
    }, 0);

    const discountValue = template.discount_percent > 0 
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
      setTargetSellerId("");
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        {templates.length > 0 && (
          <Button 
            variant="outline" 
            onClick={() => exportTemplatesToJson(templates)}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        )}
        {onCreateTemplate && (
          <Button onClick={onCreateTemplate}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Template
          </Button>
        )}
      </div>

      {filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-display font-medium text-lg mb-2">Nenhum template encontrado</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm 
                ? "Tente buscar com outros termos" 
                : "Crie seu primeiro template para agilizar orçamentos"}
            </p>
            {onCreateTemplate && !searchTerm && (
              <Button onClick={onCreateTemplate}>
                <Plus className="h-4 w-4 mr-2" />
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
              className={`group hover:shadow-md transition-shadow ${
                selectionMode ? "cursor-pointer hover:border-primary" : ""
              }`}
              onClick={() => selectionMode && onApplyTemplate?.(template)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base truncate">{template.name}</CardTitle>
                      {template.is_default && (
                        <Badge variant="secondary" className="shrink-0">
                          <Star className="h-3 w-3 mr-1 fill-current" />
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
                          size="icon" aria-label="Mais opções" 
                          className="h-8 w-8 opacity-0 group-hover:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {onApplyTemplate && (
                          <DropdownMenuItem onClick={() => onApplyTemplate(template)}>
                            <FileText className="h-4 w-4 mr-2" />
                            Usar Template
                          </DropdownMenuItem>
                        )}
                        {onEditTemplate && (
                          <DropdownMenuItem onClick={() => onEditTemplate(template)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => duplicateTemplate(template.id)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => setDefaultTemplate(template.id)}
                          disabled={template.is_default}
                        >
                          {template.is_default ? (
                            <>
                              <StarOff className="h-4 w-4 mr-2" />
                              Já é padrão
                            </>
                          ) : (
                            <>
                              <Star className="h-4 w-4 mr-2" />
                              Definir como Padrão
                            </>
                          )}
                        </DropdownMenuItem>
                        {isAdmin && sellers.length > 0 && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openCloneDialog(template.id)}>
                              <UserPlus className="h-4 w-4 mr-2" />
                              Clonar para Vendedor
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => exportSingleTemplate(template)}>
                          <Download className="h-4 w-4 mr-2" />
                          Exportar JSON
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => setDeleteConfirmId(template.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
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
                      {template.items_data.length} {template.items_data.length === 1 ? "item" : "itens"}
                    </span>
                    <span className="font-medium text-foreground">
                      {formatCurrency(calculateTemplateTotal(template))}
                    </span>
                  </div>
                  
                  {(template.discount_percent > 0 || template.discount_amount > 0) && (
                    <Badge variant="outline" className="text-xs">
                      Desconto: {template.discount_percent > 0 
                        ? `${template.discount_percent}%` 
                        : formatCurrency(template.discount_amount)}
                    </Badge>
                  )}

                  <div className="pt-2 border-t text-xs text-muted-foreground">
                    Atualizado em {format(new Date(template.updated_at), "dd/MM/yyyy", { locale: ptBR })}
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
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
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
            <label className="text-sm font-medium mb-2 block">
              Vendedor Destino
            </label>
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
              <p className="text-sm text-muted-foreground mt-2">
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
                setTargetSellerId("");
              }}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleClone}
              disabled={!targetSellerId}
            >
              <Copy className="h-4 w-4 mr-2" />
              Clonar Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
