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
import { Globe, Loader2, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CountryEntry {
  id: string;
  country_code: string;
  country_name: string;
  is_active: boolean | null;
  created_at: string | null;
}

interface CityWhitelistTabProps {
  cities: CountryEntry[];
  onAdd: (country_code: string, state?: string) => Promise<boolean>;
  onRemove: (id: string) => void;
  onToggle: (id: string, active: boolean) => void;
}

export function CityWhitelistTab({ cities, onAdd, onRemove, onToggle }: CityWhitelistTabProps) {
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!newCode.trim() || !newName.trim()) return;
    setAdding(true);
    const ok = await onAdd(newCode.trim().toUpperCase(), newName.trim());
    if (ok) {
      setNewCode('');
      setNewName('');
    }
    setAdding(false);
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-base">Países na Whitelist</CardTitle>
        <CardDescription>
          Adicione países de onde é permitido acessar o sistema. A localização é detectada pelo IP
          do usuário.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-2">
          <div className="w-28 space-y-1">
            <Label className="text-xs">Código (ISO)</Label>
            <Input
              placeholder="BR"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              maxLength={2}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Nome do País</Label>
            <Input
              placeholder="Ex: Brasil"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <Button
            onClick={handleAdd}
            disabled={adding || !newCode.trim() || !newName.trim()}
            className="gap-1"
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Adicionar
          </Button>
        </div>
        {cities.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Globe className="mx-auto mb-2 h-8 w-8 opacity-40" />
            Nenhum país cadastrado
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>País</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Adicionado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cities.map((country) => (
                <TableRow key={country.id}>
                  <TableCell className="font-mono font-medium">{country.country_code}</TableCell>
                  <TableCell>{country.country_name}</TableCell>
                  <TableCell>
                    <Switch
                      checked={country.is_active ?? true}
                      onCheckedChange={(checked) => onToggle(country.id, checked)}
                    />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {country.created_at
                      ? format(new Date(country.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                      : '—'}
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
                      <AlertDialogContent className="!max-w-[358px] w-[92vw] gap-0 overflow-hidden rounded-xl border border-border/60 bg-card/95 p-0 shadow-xl backdrop-blur-xl" data-testid="city-whitelist-remove-dialog">
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
                                  Remover país?
                                </AlertDialogTitle>
                                <AlertDialogDescription className="text-xs leading-relaxed text-muted-foreground">
                                  <span className="font-bold text-foreground">{country.country_name}</span> será removido da whitelist.
                                </AlertDialogDescription>
                              </div>
                            </div>
                          </AlertDialogHeader>
                        </div>
                        <div className="mt-3 border-t border-border/50 bg-muted/20 px-4 py-2.5">
                          <AlertDialogFooter className="gap-1.5 sm:gap-1.5">
                            <AlertDialogCancel className="mt-0 h-[26px] min-h-[26px] rounded-md border-border/70 bg-transparent px-3 py-0 text-xs">Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => onRemove(country.id)}
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
