import { useState } from 'react';
import { Globe, Plus, Trash2, ToggleLeft, ToggleRight, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/ui';
import { useAllowedIPs } from '@/hooks/admin';

interface IPRestrictionManagerProps {
  targetUserId?: string;
  readOnly?: boolean;
}

export function IPRestrictionManager({
  targetUserId,
  readOnly = false,
}: IPRestrictionManagerProps) {
  const { toast } = useToast();
  const { allowedIPs, isLoading, currentIP, hasIPRestriction, addIP, removeIP, toggleIP } =
    useAllowedIPs(targetUserId);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newIP, setNewIP] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddCurrentIP = () => {
    if (currentIP) {
      setNewIP(currentIP);
      setNewLabel('Meu IP atual');
    }
  };

  const handleAddIP = async () => {
    if (!newIP.trim()) return;

    // Validação básica de IP
    const ipRegex =
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(newIP.trim())) {
      toast({
        title: 'IP Inválido',
        description: 'Por favor, digite um endereço IP válido.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    const result = await addIP(newIP.trim(), newLabel.trim());
    setIsSubmitting(false);

    if (result.success) {
      toast({
        title: 'IP Adicionado',
        description: 'O endereço IP foi adicionado à lista de permitidos.',
      });
      setIsDialogOpen(false);
      setNewIP('');
      setNewLabel('');
    } else {
      toast({
        title: 'Erro',
        description: result.error || 'Não foi possível adicionar o IP.',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveIP = async (ipId: string) => {
    const result = await removeIP(ipId);

    if (result.success) {
      toast({
        title: 'IP Removido',
        description: 'O endereço IP foi removido da lista.',
      });
    } else {
      toast({
        title: 'Erro',
        description: result.error || 'Não foi possível remover o IP.',
        variant: 'destructive',
      });
    }
  };

  const handleToggleIP = async (ipId: string, currentStatus: boolean) => {
    const result = await toggleIP(ipId, !currentStatus);

    if (!result.success) {
      toast({
        title: 'Erro',
        description: result.error || 'Não foi possível alterar o status.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Restrição por IP</CardTitle>
          </div>
          {hasIPRestriction && (
            <Badge variant="secondary" className="bg-warning/10 text-warning">
              Ativo
            </Badge>
          )}
        </div>
        <CardDescription>
          Limite o acesso à sua conta apenas de endereços IP específicos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {currentIP && (
          <div className="text-sm text-muted-foreground">
            Seu IP atual: <span className="font-mono font-medium">{currentIP}</span>
          </div>
        )}

        {hasIPRestriction && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              A restrição por IP está ativa. Apenas os IPs listados abaixo podem acessar esta conta.
            </AlertDescription>
          </Alert>
        )}

        {allowedIPs.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Endereço IP</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Status</TableHead>
                {!readOnly && <TableHead className="w-[100px]">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {allowedIPs.map((ip) => (
                <TableRow key={ip.id}>
                  <TableCell className="font-mono">{ip.ip_address}</TableCell>
                  <TableCell>{ip.label || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={ip.is_active ? 'default' : 'secondary'}>
                      {ip.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  {!readOnly && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="ToggleRight"
                          onClick={() => handleToggleIP(ip.id, ip.is_active)}
                        >
                          {ip.is_active ? (
                            <ToggleRight className="h-4 w-4 text-success" />
                          ) : (
                            <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Excluir"
                          onClick={() => handleRemoveIP(ip.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="py-4 text-center text-sm text-muted-foreground">
            Nenhum IP configurado. O acesso está liberado de qualquer endereço.
          </div>
        )}

        {!readOnly && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Adicionar IP
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar IP Permitido</DialogTitle>
                <DialogDescription>
                  Adicione um endereço IP que terá permissão para acessar a conta.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Endereço IP</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="192.168.1.1"
                      value={newIP}
                      onChange={(e) => setNewIP(e.target.value)}
                    />
                    <Button variant="outline" onClick={handleAddCurrentIP} disabled={!currentIP}>
                      Usar Meu IP
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Descrição (opcional)</Label>
                  <Input
                    placeholder="Ex: Escritório, Casa, etc."
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                  />
                </div>

                <Button
                  onClick={handleAddIP}
                  disabled={!newIP.trim() || isSubmitting}
                  className="w-full"
                >
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Adicionar IP
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}
