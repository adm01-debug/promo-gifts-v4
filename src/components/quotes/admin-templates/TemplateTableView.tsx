import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Star, UserPlus, Edit, Trash2, Download, User } from 'lucide-react';
import { type QuoteTemplate } from '@/hooks/quotes';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { exportSingleTemplate } from '@/utils/templateExport';

interface TemplateTableViewProps {
  templates: QuoteTemplate[];
  getSellerName: (sellerId: string) => string;
  formatCurrency: (value: number) => string;
  calculateTotal: (template: QuoteTemplate) => number;
  onEdit?: (template: QuoteTemplate) => void;
  onClone: (templateId: string) => void;
  onDelete: (templateId: string) => void;
}

export function TemplateTableView({
  templates,
  getSellerName,
  formatCurrency,
  calculateTotal,
  onEdit,
  onClone,
  onDelete,
}: TemplateTableViewProps) {
  return (
    <Card>
      <ScrollArea className="h-[600px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead className="text-center">Itens</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Atualizado</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((template) => (
              <TableRow key={template.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{template.name}</div>
                    {template.description && (
                      <div className="max-w-[200px] truncate text-sm text-muted-foreground">
                        {template.description}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{getSellerName(template.seller_id)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary">{template.items.length}</Badge>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(calculateTotal(template))}
                </TableCell>
                <TableCell className="text-center">
                  {template.is_default && (
                    <Badge variant="outline" className="gap-1">
                      <Star className="h-3 w-3 fill-current" />
                      Padrão
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {format(new Date(template.updated_at), 'dd/MM/yy', { locale: ptBR })}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </Card>
  );
}
