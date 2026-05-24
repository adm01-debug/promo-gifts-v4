import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Building2, Pencil, Trash2, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import type { Supplier } from "./types";

interface SupplierTableProps {
  suppliers: Supplier[];
  loading: boolean;
  search: string;
  deleting: string | null;
  onEdit: (s: Supplier) => void;
  onDelete: (s: Supplier) => void;
}

export function SupplierTable({ suppliers, loading, search, deleting, onEdit, onDelete }: SupplierTableProps) {
  return (
    <Card className="overflow-hidden">
      <ScrollArea className="max-h-[600px]">
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
              <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : suppliers.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{search ? 'Nenhum fornecedor encontrado' : 'Nenhum fornecedor cadastrado'}</TableCell></TableRow>
            ) : (
              suppliers.map(supplier => (
                <TableRow key={supplier.id} className="group cursor-pointer hover:bg-accent/50" onClick={() => onEdit(supplier)}>
                  <TableCell>{supplier.active ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      {supplier.logo_url ? (
                        
<img src={supplier.logo_url} alt="Logo do fornecedor" className="w-8 h-8 rounded object-contain border border-border bg-muted shrink-0"  loading="lazy" />
                      ) : (
                        <div className="w-8 h-8 rounded border border-border bg-muted flex items-center justify-center shrink-0"><Building2 className="h-4 w-4 text-muted-foreground" /></div>
                      )}
                      <div>
                        <p className="font-medium text-sm">{supplier.name}</p>
                        {supplier.trading_name && <p className="text-xs text-muted-foreground">{supplier.trading_name}</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{supplier.code}</code></TableCell>
                  <TableCell>
                    <div className="text-xs space-y-0.5">
                      {supplier.email && <p>{supplier.email}</p>}
                      {supplier.phone && <p className="text-muted-foreground">{supplier.phone}</p>}
                      {!supplier.email && !supplier.phone && <p className="text-muted-foreground">—</p>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{supplier.default_markup_percent !== null ? <span className="text-sm font-mono">{supplier.default_markup_percent}%</span> : '—'}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex gap-1 justify-center">
                      {supplier.is_product_supplier && <Badge variant="outline" className="text-[10px] px-1.5">Produtos</Badge>}
                      {supplier.is_engraving_supplier && <Badge variant="outline" className="text-[10px] px-1.5">Gravação</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right"><span className="text-sm font-mono">{supplier.priority ?? '—'}</span></TableCell>
                  <TableCell>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" aria-label="Editar" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onEdit(supplier); }}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" aria-label="Carregando" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(supplier); }} disabled={deleting === supplier.id}>
                        {deleting === supplier.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
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
