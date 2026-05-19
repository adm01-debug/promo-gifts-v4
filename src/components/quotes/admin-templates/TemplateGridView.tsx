import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Star, UserPlus, Edit, Trash2, Download, User, Package } from "lucide-react";
import { type QuoteTemplate } from "@/hooks/quotes";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { exportSingleTemplate } from "@/utils/templateExport";

interface TemplateGridViewProps {
  templatesBySeller: Record<string, QuoteTemplate[]>;
  getSellerName: (sellerId: string) => string;
  formatCurrency: (value: number) => string;
  calculateTotal: (template: QuoteTemplate) => number;
  onEdit?: (template: QuoteTemplate) => void;
  onClone: (templateId: string) => void;
  onDelete: (templateId: string) => void;
}

export function TemplateGridView({ templatesBySeller, getSellerName, formatCurrency, calculateTotal, onEdit, onClone, onDelete }: TemplateGridViewProps) {
  return (
    <div className="space-y-6">
      {Object.entries(templatesBySeller).map(([sellerId, templates]) => (
        <div key={sellerId}>
          <div className="flex items-center gap-2 mb-3">
            <User className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-display font-medium">{getSellerName(sellerId)}</h3>
            <Badge variant="secondary" className="ml-auto">{templates.length} templates</Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <Card key={template.id} className="group hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base truncate">{template.name}</CardTitle>
                        {template.is_default && <Badge variant="secondary" className="shrink-0"><Star className="h-3 w-3 mr-1 fill-current" />Padrão</Badge>}
                      </div>
                      {template.description && <CardDescription className="mt-1 line-clamp-2">{template.description}</CardDescription>}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100" aria-label="Mais opções"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {onEdit && <DropdownMenuItem onClick={() => onEdit(template)}><Edit className="h-4 w-4 mr-2" />Editar</DropdownMenuItem>}
                        <DropdownMenuItem onClick={() => onClone(template.id)}><UserPlus className="h-4 w-4 mr-2" />Clonar para Vendedor</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => exportSingleTemplate(template)}><Download className="h-4 w-4 mr-2" />Exportar JSON</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onDelete(template.id)} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4 mr-2" />Excluir</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="flex items-center gap-1"><Package className="h-3.5 w-3.5" />{template.items_data.length} {template.items_data.length === 1 ? "item" : "itens"}</span>
                      <span className="font-medium text-foreground">{formatCurrency(calculateTotal(template))}</span>
                    </div>
                    <div className="pt-2 border-t text-xs text-muted-foreground">Atualizado em {format(new Date(template.updated_at), "dd/MM/yyyy", { locale: ptBR })}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
