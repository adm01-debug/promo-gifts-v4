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

interface CityEntry {
  id: string;
  city_name: string;
  state: string | null;
  country_code: string;
  is_active: boolean;
  created_at: string;
}

interface CityWhitelistTabProps {
  cities: CityEntry[];
  onAdd: (city: string, state?: string) => Promise<boolean>;
  onRemove: (id: string) => void;
  onToggle: (id: string, active: boolean) => void;
}

export function CityWhitelistTab({ cities, onAdd, onRemove, onToggle }: CityWhitelistTabProps) {
  const [newCity, setNewCity] = useState('');
  const [newState, setNewState] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!newCity.trim()) return;
    setAdding(true);
    const ok = await onAdd(newCity.trim(), newState.trim() || undefined);
    if (ok) {
      setNewCity('');
      setNewState('');
    }
    setAdding(false);
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-base">Cidades na Whitelist</CardTitle>
        <CardDescription>
          Adicione cidades de onde é permitido acessar o sistema. A localização é detectada pelo IP
          do usuário.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Cidade</Label>
            <Input
              placeholder="Ex: São Paulo"
              value={newCity}
              onChange={(e) => setNewCity(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <div className="w-24 space-y-1">
            <Label className="text-xs">Estado</Label>
            <Input
              placeholder="SP"
              value={newState}
              onChange={(e) => setNewState(e.target.value)}
              maxLength={2}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <Button onClick={handleAdd} disabled={adding || !newCity.trim()} className="gap-1">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Adicionar
          </Button>
        </div>
        {cities.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Globe className="mx-auto mb-2 h-8 w-8 opacity-40" />
            Nenhuma cidade cadastrada
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cidade</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>País</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Adicionado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cities.map((city) => (
                <TableRow key={city.id}>
                  <TableCell className="font-medium">{city.city_name}</TableCell>
                  <TableCell>{city.state || '—'}</TableCell>
                  <TableCell>{city.country_code}</TableCell>
                  <TableCell>
                    <Switch
                      checked={city.is_active}
                      onCheckedChange={(checked) => onToggle(city.id, checked)}
                    />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(city.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
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
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover cidade?</AlertDialogTitle>
                          <AlertDialogDescription>
                            <span className="font-bold">{city.city_name}</span> será removida da
                            whitelist.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onRemove(city.id)}
                            className="bg-destructive text-destructive-foreground"
                          >
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
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
