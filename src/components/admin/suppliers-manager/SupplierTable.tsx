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
import { Building2, Pencil, Trash2, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import type { Supplier } from './types';

interface SupplierTableProps {
  suppliers: Supplier[];
  loading: boolean;
  search: string;
  deleting: string | null;
  onEdit: (s: Supplier) => void;
  onDelete: (s: Supplier) => void;
}

export function SupplierTable({
  suppliers,
  loading,
  search,
  deleting,
  onEdit,
  onDelete,
}: SupplierTableProps) {
  return (
    <Card className="overflow-hidden">
      <ScrollArea data-testid="admin-table" className="max-h-[600px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">Status</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead className="text-right">Markup</TableHead>
              <TableHead className="text-center">Tipo</TableHead>
              <TableHead className="text-right">Prioridade</TableHead>
              <TableHead className="w-[100px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : suppliers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  {search ? 'Nenhum fornecedor encontrado' : 'Nenhum fornecedor cadastrado'}
                </TableCell>
              </TableRow>
            ) : (
              suppliers.map((supplier) => (
                <TableRow
                  key={supplier.id}
                  data-testid={`admin-row-${supplier.id}`}
                  className="group cursor-pointer hover:bg-accent/50"
                  onClick={() => onEdit(supplier)}
                >
                  <TableCell>
                    {supplier.active ? (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      {supplier.logo_url ? (
                        <img
                          src={supplier.logo_url}
                          alt="Logo do fornecedor"
                          className="h-8 w-8 shrink-0 rounded border border-border bg-muted object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-border bg-muted">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium">{supplier.name}</p>
                        {supplier.trading_name && (
                          <p className="text-xs text-muted-foreground">{supplier.trading_name}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{supplier.code}</code>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5 text-xs">
                      {supplier.email && <p>{supplier.email}</p>}
                      {supplier.phone && <p className="text-muted-foreground">{supplier.phone}</p>}
                      {!supplier.email && !supplier.phone && (
                        <p className="text-muted-foreground">—</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {supplier.default_markup_percent !== null ? (
                      <span className="font-mono text-sm">{supplier.default_markup_percent}%</span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center gap-1">
                      {supplier.is_product_supplier && (
                        <Badge variant="outline" className="px-1.5 text-[10px]">
                          Produtos
                        </Badge>
                      )}
                      {supplier.is_engraving_supplier && (
                        <Badge variant="outline" className="px-1.5 text-[10px]">
                          Gravação
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-mono text-sm">{supplier.priority ?? '—'}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Editar"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(supplier);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Excluir fornecedor"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        data-testid="admin-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(supplier);
                        }}
                        disabled={deleting === supplier.id}
                      >
                        {deleting === supplier.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ScrollArea>
    </Card>
  );
}
