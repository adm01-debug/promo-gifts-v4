import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Star, UserPlus, Edit, Trash2, Download, User, Package } from 'lucide-react';
import type { QuoteTemplate } from '@/hooks/quotes';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { exportSingleTemplate } from '@/utils/templateExport';

interface TemplateGridViewProps {
  templatesBySeller: Record<string, QuoteTemplate[]>;
  getSellerName: (sellerId: string) => string;
  formatCurrency: (value: number) => string;
  calculateTotal: (template: QuoteTemplate) => number;
  onEdit?: (template: QuoteTemplate) => void;
  onClone: (templateId: string) => void;
  onDelete: (templateId: string) => void;
}

export function TemplateGridView({
  templatesBySeller,
  getSellerName,
  formatCurrency,
  calculateTotal,
  onEdit,
  onClone,
  onDelete,
}: TemplateGridViewProps) {
  return (
    <div className="space-y-6">
      {Object.entries(templatesBySeller).map(([sellerId, templates]) => (
        <div key={sellerId}>
          <div className="mb-3 flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-display font-medium">{getSellerName(sellerId)}</h3>
            <Badge variant="secondary" className="ml-auto">
              {templates.length} templates
            </Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <Card key={template.id} className="group transition-shadow hover:shadow-md">
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100"
                          aria-label="Mais opções"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {onEdit && (
                          <DropdownMenuItem onClick={() => onEdit(template)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => onClone(template.id)}>
                          <UserPlus className="mr-2 h-4 w-4" />
                          Clonar para Vendedor
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => exportSingleTemplate(template)}>
                          <Download className="mr-2 h-4 w-4" />
                          Exportar JSON
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => onDelete(template.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
                        {formatCurrency(calculateTotal(template))}
                      </span>
                    </div>
                    <div className="border-t pt-2 text-xs text-muted-foreground">
                      Atualizado em{' '}
                      {format(new Date(template.updated_at), 'dd/MM/yyyy', { locale: ptBR })}
                    </div>
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
