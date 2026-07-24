/**
 * Orquestra a tela de chaves MCP: filtros, criação, listagem, rotação,
 * revogação e detalhes em drawer.
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, KeyRound } from 'lucide-react';
import { useMcpKeys, type McpKeyRow as McpKeyRowType } from './useMcpKeys';
import { McpKeysFilters } from './McpKeysFilters';
import { McpKeyRow } from './McpKeyRow';
import { RotateMcpKeyDialog } from './RotateMcpKeyDialog';
import { UpdateMcpKeyDialog } from './UpdateMcpKeyDialog';
import { McpKeyDetailsDrawer } from './McpKeyDetailsDrawer';
import { IssueMcpKeyForm } from '@/components/admin/connections/IssueMcpKeyForm';

export function McpKeysList() {
  const { rows, loading, filters, setFilters, counts, creators, reload, revoke } = useMcpKeys();
  const [issueOpen, setIssueOpen] = useState(false);
  const [rotateTarget, setRotateTarget] = useState<McpKeyRowType | null>(null);
  const [editTarget, setEditTarget] = useState<McpKeyRowType | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<McpKeyRowType | null>(null);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Chaves MCP</CardTitle>
              <CardDescription>
                Gerencie as chaves de API que dão acesso ao MCP server. Toda emissão, rotação e
                revogação é auditada.
              </CardDescription>
            </div>
          </div>
          <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" /> Nova chave
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Gerar nova chave MCP</DialogTitle>
                <DialogDescription>
                  A chave será exibida apenas uma vez. Geração 100% server-side com validação de
                  admin e fricção extra para escopo <code className="font-mono">*</code>.
                </DialogDescription>
              </DialogHeader>
              <IssueMcpKeyForm onIssued={reload} />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <McpKeysFilters
          search={filters.search}
          status={filters.status}
          onlyFull={filters.onlyFull}
          sort={filters.sort}
          creator={filters.creator}
          createdFrom={filters.createdFrom}
          createdTo={filters.createdTo}
          creators={creators}
          counts={counts}
          onChange={(patch) => setFilters((cur) => ({ ...cur, ...patch }))}
        />

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <KeyRound className="mx-auto mb-2 h-8 w-8 opacity-40" />
            <p className="text-sm">Nenhuma chave encontrada com os filtros atuais.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <McpKeyRow
                key={r.id}
                row={r}
                onRotate={setRotateTarget}
                onRevoke={(row) => {
                  revoke(row.id);
                }}
                onDetails={setDetailsTarget}
                onEdit={setEditTarget}
              />
            ))}
          </div>
        )}
      </CardContent>

      <RotateMcpKeyDialog
        source={rotateTarget}
        open={rotateTarget !== null}
        onOpenChange={(v) => {
          if (!v) setRotateTarget(null);
        }}
        onRotated={reload}
      />

      <UpdateMcpKeyDialog
        source={editTarget}
        open={editTarget !== null}
        onOpenChange={(v) => {
          if (!v) setEditTarget(null);
        }}
        onUpdated={reload}
      />

      <McpKeyDetailsDrawer
        source={detailsTarget}
        open={detailsTarget !== null}
        onOpenChange={(v) => {
          if (!v) setDetailsTarget(null);
        }}
      />
    </Card>
  );
}
