/**
 * Tabela de badges com preview, classificação, posicionamento, prioridade,
 * alternância de status (is_enabled) e ações (editar / excluir).
 * Badges de sistema (is_system) não podem ser excluídas — apenas desabilitadas.
 */
import { Lock, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BadgePreview } from './BadgePreview';
import {
  CATEGORY_LABELS,
  PLACEMENT_LABELS,
  SOURCE_KIND_LABELS,
  type BadgeDefinition,
} from './types';

interface BadgeTableProps {
  badges: BadgeDefinition[];
  onEdit: (badge: BadgeDefinition) => void;
  onToggle: (badge: BadgeDefinition, enabled: boolean) => void;
  onDelete: (badge: BadgeDefinition) => void;
  busy?: boolean;
}

export function BadgeTable({ badges, onEdit, onToggle, onDelete, busy = false }: BadgeTableProps) {
  if (badges.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
        Nenhuma badge encontrada com os filtros atuais.
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[180px]">Badge</TableHead>
              <TableHead>Chave</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Posicionamento</TableHead>
              <TableHead className="text-center">Prio.</TableHead>
              <TableHead className="text-center">Ativa</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {badges.map((badge) => (
              <TableRow key={badge.id}>
                <TableCell>
                  <BadgePreview badge={badge} />
                </TableCell>
                <TableCell>
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {badge.badge_key}
                  </code>
                </TableCell>
                <TableCell className="text-sm">
                  {CATEGORY_LABELS[badge.category] ?? badge.category}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {SOURCE_KIND_LABELS[badge.source_kind] ?? badge.source_kind}
                </TableCell>
                <TableCell>
                  <div className="flex max-w-[220px] flex-wrap gap-1">
                    {badge.placements.slice(0, 2).map((p) => (
                      <Badge key={p} variant="outline" className="text-[10px] font-normal">
                        {PLACEMENT_LABELS[p] ?? p}
                      </Badge>
                    ))}
                    {badge.placements.length > 2 ? (
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        +{badge.placements.length - 2}
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-center text-sm tabular-nums">{badge.priority}</TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={badge.is_enabled}
                    disabled={busy}
                    onCheckedChange={(v) => onToggle(badge, v)}
                    aria-label={`Alternar ${badge.name}`}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onEdit(badge)}
                      aria-label={`Editar ${badge.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {badge.is_system ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex h-8 w-8 items-center justify-center text-muted-foreground/50">
                            <Lock className="h-4 w-4" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>Badge de sistema: não pode ser excluída.</TooltipContent>
                      </Tooltip>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        disabled={busy}
                        onClick={() => onDelete(badge)}
                        aria-label={`Excluir ${badge.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}
