import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Loader2, Monitor, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface IpEntry {
  id: string;
  ip_address: string;
  reason: string | null;
  is_active: boolean;
  created_at: string;
}

interface IpWhitelistTabProps {
  ips: IpEntry[];
  onAdd: (ip: string, label?: string) => Promise<boolean>;
  onRemove: (id: string) => void;
  onToggle: (id: string, active: boolean) => void;
}

export function IpWhitelistTab({ ips, onAdd, onRemove, onToggle }: IpWhitelistTabProps) {
  const [newIp, setNewIp] = useState('');
  const [newIpLabel, setNewIpLabel] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!newIp.trim()) return;
    setAdding(true);
    const ok = await onAdd(newIp.trim(), newIpLabel.trim() || undefined);
    if (ok) {
      setNewIp('');
      setNewIpLabel('');
    }
    setAdding(false);
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-base">IPs na Whitelist</CardTitle>
        <CardDescription>
          Adicione endereços IP que podem acessar o sistema. Suporta IPs individuais e ranges CIDR
          (/24, /16).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Endereço IP</Label>
            <Input
              placeholder="192.168.1.100 ou 10.0.0.0/24"
              value={newIp}
              onChange={(e) => setNewIp(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Rótulo (opcional)</Label>
            <Input
              placeholder="Ex: Escritório SP"
              value={newIpLabel}
              onChange={(e) => setNewIpLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <Button onClick={handleAdd} disabled={adding || !newIp.trim()} className="gap-1">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Adicionar
          </Button>
        </div>
        {ips.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Monitor className="mx-auto mb-2 h-8 w-8 opacity-40" />
            Nenhum IP cadastrado
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>IP</TableHead>
                <TableHead>Rótulo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Adicionado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ips.map((ip) => (
                <TableRow key={ip.id}>
                  <TableCell className="font-mono text-sm">{ip.ip_address}</TableCell>
                  <TableCell>{ip.reason || '—'}</TableCell>
                  <TableCell>
                    <Switch
                      checked={ip.is_active}
                      onCheckedChange={(checked) => onToggle(ip.id, checked)}
                    />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(ip.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          aria-label="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="!max-w-[358px] w-[92vw] gap-0 overflow-hidden rounded-xl border border-border/60 bg-card/95 p-0 shadow-xl backdrop-blur-xl" data-testid="ip-whitelist-remove-dialog">
                        <div aria-hidden="true" className="h-[3px] w-full bg-gradient-to-r from-transparent via-destructive to-transparent" />
                        <div className="px-4 pb-1.5 pt-4">
                          <AlertDialogHeader>
                            <div className="flex items-start gap-3">
                              <div className="relative flex-shrink-0">
                                <span aria-hidden="true" className="absolute inset-0 -z-10 rounded-xl blur-lg opacity-60 bg-destructive/30" />
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/10 ring-1 ring-inset ring-destructive/20">
                                  <Trash2 className="h-[18px] w-[18px] text-destructive" strokeWidth={2.2} />
                                </div>
                              </div>
                              <div className="min-w-0 flex-1 space-y-1 pt-0.5">
                                <AlertDialogTitle className="text-sm font-semibold leading-tight tracking-tight text-foreground">
                                  Remover IP?
                                </AlertDialogTitle>
                                <AlertDialogDescription className="text-xs leading-relaxed text-muted-foreground">
                                  O IP <span className="font-mono font-bold text-foreground">{ip.ip_address}</span> será removido da whitelist.
                                </AlertDialogDescription>
                              </div>
                            </div>
                          </AlertDialogHeader>
                        </div>
                        <div className="mt-3 border-t border-border/50 bg-muted/20 px-4 py-2.5">
                          <AlertDialogFooter className="gap-1.5 sm:gap-1.5">
                            <AlertDialogCancel className="mt-0 h-[26px] min-h-[26px] rounded-md border-border/70 bg-transparent px-3 py-0 text-xs">Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => onRemove(ip.id)}
                              className="inline-flex h-[26px] min-h-[26px] items-center rounded-md bg-destructive px-3.5 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </div>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
