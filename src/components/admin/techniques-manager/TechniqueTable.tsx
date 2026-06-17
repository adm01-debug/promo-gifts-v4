import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Trash2, Loader2, Palette, Droplets, Ruler, Hash } from 'lucide-react';
import { InlineEditField } from '../InlineEditField';
import { buildTecnicaUpdatePayload } from '@/lib/personalization/adapters';

interface TecnicaRow {
  id: string;
  codigo: string | null;
  nome: string;
  categoria: string | null;
  custoSetup: number | null;
  custoManuseio: number | null;
  minCores: number | null;
  maxCores: number | null;
  quantidadeMinima: number | null;
  prazoEstimado: number | null;
  precoPorCor: boolean;
  precoPorArea: boolean;
  precoPorPontos: boolean;
  ativo: boolean;
}

interface TechniqueTableProps {
  tecnicas: TecnicaRow[];
  isLoading: boolean;
  isRemoving: boolean;
  onToggleStatus: (params: { id: string; ativo: boolean }) => void;
  onUpdate: (params: Record<string, unknown>) => void;
  onRemove: (id: string) => void;
}

function getPricingBadges(tecnica: TecnicaRow) {
  const badges = [];
  if (tecnica.precoPorCor)
    badges.push({ label: 'Cor', icon: Droplets, color: 'bg-info/10 text-info' });
  if (tecnica.precoPorArea)
    badges.push({ label: 'Área', icon: Ruler, color: 'bg-success/10 text-success' });
  if (tecnica.precoPorPontos)
    badges.push({ label: 'Pontos', icon: Hash, color: 'bg-primary/10 text-primary' });
  return badges;
}

export function TechniqueTable({
  tecnicas,
  isLoading,
  isRemoving,
  onToggleStatus,
  onUpdate,
  onRemove,
}: TechniqueTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!tecnicas?.length) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <Palette className="mx-auto mb-4 h-12 w-12 opacity-50" />
        <p>Nenhuma técnica cadastrada no BD externo</p>
      </div>
    );
  }

  return (
    <Table data-testid="admin-table">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[80px]">Código</TableHead>
          <TableHead>Nome</TableHead>
          <TableHead>Categoria</TableHead>
          <TableHead>Tipo Preço</TableHead>
          <TableHead>Setup</TableHead>
          <TableHead>Manuseio</TableHead>
          <TableHead>Cores</TableHead>
          <TableHead>Qtd. Mín.</TableHead>
          <TableHead>Prazo</TableHead>
          <TableHead className="text-center">Status</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tecnicas.map((tecnica) => (
          <TableRow key={tecnica.id} data-testid={`admin-row-${tecnica.id}`}>
            <TableCell>
              <InlineEditField
                value={tecnica.codigo || ''}
                onSave={(value) =>
                  onUpdate(buildTecnicaUpdatePayload({ id: tecnica.id, code: value.toUpperCase() }))
                }
                placeholder="—"
                className="font-mono text-xs"
              />
            </TableCell>
            <TableCell>
              <InlineEditField
                value={tecnica.nome}
                onSave={(value) =>
                  onUpdate(buildTecnicaUpdatePayload({ id: tecnica.id, name: value }))
                }
              />
            </TableCell>
            <TableCell>
              <Badge variant="outline">{tecnica.categoria || '—'}</Badge>
            </TableCell>
            <TableCell>
              <div className="flex gap-1">
                {getPricingBadges(tecnica).map((badge) => (
                  <Badge key={badge.label} className={badge.color}>
                    <badge.icon className="mr-1 h-3 w-3" />
                    {badge.label}
                  </Badge>
                ))}
                {getPricingBadges(tecnica).length === 0 && (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>
            </TableCell>
            <TableCell>
              <InlineEditField
                value={tecnica.custoSetup?.toString() || ''}
                onSave={(value) =>
                  onUpdate(
                    buildTecnicaUpdatePayload({
                      id: tecnica.id,
                      setup_price: value ? parseFloat(value) : null,
                    }),
                  )
                }
                type="number"
                placeholder="—"
              />
            </TableCell>
            <TableCell>
              <InlineEditField
                value={tecnica.custoManuseio?.toString() || ''}
                onSave={(value) =>
                  onUpdate(
                    buildTecnicaUpdatePayload({
                      id: tecnica.id,
                      handling_price: value ? parseFloat(value) : null,
                    }),
                  )
                }
                type="number"
                placeholder="—"
              />
            </TableCell>
            <TableCell>
              {tecnica.maxCores ? (
                <span className="text-sm">
                  {tecnica.minCores || 1} - {tecnica.maxCores}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell>
              <InlineEditField
                value={tecnica.quantidadeMinima?.toString() || ''}
                onSave={(value) =>
                  onUpdate(
                    buildTecnicaUpdatePayload({
                      id: tecnica.id,
                      min_quantity: value ? parseInt(value, 10) : null,
                    }),
                  )
                }
                type="number"
                placeholder="—"
              />
            </TableCell>
            <TableCell>
              <InlineEditField
                value={tecnica.prazoEstimado?.toString() || ''}
                onSave={(value) =>
                  onUpdate(
                    buildTecnicaUpdatePayload({
                      id: tecnica.id,
                      estimated_days: value ? parseInt(value, 10) : null,
                    }),
                  )
                }
                type="number"
                placeholder="—"
              />
            </TableCell>
            <TableCell className="text-center">
              <Switch
                checked={tecnica.ativo}
                onCheckedChange={(checked) => onToggleStatus({ id: tecnica.id, ativo: checked })}
              />
            </TableCell>
            <TableCell>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                data-testid="admin-delete-btn"
                onClick={() => onRemove(tecnica.id)}
                disabled={isRemoving}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
