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
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover país?</AlertDialogTitle>
                          <AlertDialogDescription>
                            <span className="font-bold">{country.country_name}</span> será removido
                            da whitelist.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onRemove(country.id)}
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
