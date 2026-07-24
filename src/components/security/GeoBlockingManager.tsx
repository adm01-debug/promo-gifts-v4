import { useState } from 'react';
import {
  Globe,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Loader2,
  AlertCircle,
  MapPin,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { useGeoBlocking } from '@/hooks/admin';

// Lista de países comuns
const COMMON_COUNTRIES = [
  { code: 'BR', name: 'Brasil' },
  { code: 'PT', name: 'Portugal' },
  { code: 'US', name: 'Estados Unidos' },
  { code: 'CA', name: 'Canadá' },
  { code: 'MX', name: 'México' },
  { code: 'AR', name: 'Argentina' },
  { code: 'CL', name: 'Chile' },
  { code: 'CO', name: 'Colômbia' },
  { code: 'PE', name: 'Peru' },
  { code: 'UY', name: 'Uruguai' },
  { code: 'PY', name: 'Paraguai' },
  { code: 'ES', name: 'Espanha' },
  { code: 'FR', name: 'França' },
  { code: 'DE', name: 'Alemanha' },
  { code: 'IT', name: 'Itália' },
  { code: 'GB', name: 'Reino Unido' },
  { code: 'JP', name: 'Japão' },
  { code: 'CN', name: 'China' },
];

export function GeoBlockingManager() {
  const { toast } = useToast();
  const {
    countries,
    isLoading,
    currentCountry,
    isEnabled,
    toggleEnabled,
    addCountry,
    removeCountry,
    toggleCountry,
  } = useGeoBlocking();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [customName, setCustomName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTogglingEnabled, setIsTogglingEnabled] = useState(false);

  const handleToggleEnabled = async (enabled: boolean) => {
    setIsTogglingEnabled(true);
    const result = await toggleEnabled(enabled);
    setIsTogglingEnabled(false);

    if (result.success) {
      toast({
        title: enabled ? 'Bloqueio Geográfico Ativado' : 'Bloqueio Geográfico Desativado',
        description: enabled
          ? 'Apenas países permitidos poderão acessar o sistema.'
          : 'O acesso está liberado de qualquer país.',
      });
    } else {
      toast({
        title: 'Erro',
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  const handleAddCountry = async () => {
    let code: string;
    let name: string;

    if (selectedCountry) {
      const country = COMMON_COUNTRIES.find((c) => c.code === selectedCountry);
      if (!country) return;
      code = country.code;
      name = country.name;
    } else if (customCode && customName) {
      code = customCode.toUpperCase();
      name = customName;
    } else {
      toast({
        title: 'Erro',
        description: 'Selecione um país ou preencha os campos personalizados.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    const result = await addCountry(code, name);
    setIsSubmitting(false);

    if (result.success) {
      toast({
        title: 'País Adicionado',
        description: `${name} foi adicionado à lista de países permitidos.`,
      });
      setIsDialogOpen(false);
      setSelectedCountry('');
      setCustomCode('');
      setCustomName('');
    } else {
      toast({
        title: 'Erro',
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  const handleRemoveCountry = async (id: string, name: string) => {
    const result = await removeCountry(id);

    if (result.success) {
      toast({
        title: 'País Removido',
        description: `${name} foi removido da lista.`,
      });
    } else {
      toast({
        title: 'Erro',
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  const handleToggleCountry = async (id: string, currentStatus: boolean) => {
    const result = await toggleCountry(id, !currentStatus);

    if (!result.success) {
      toast({
        title: 'Erro',
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  const availableCountries = COMMON_COUNTRIES.filter(
    (c) => !countries.some((existing) => existing.country_code === c.code),
  );

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
            <CardTitle>Bloqueio Geográfico</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {isEnabled && (
              <Badge variant="secondary" className="bg-warning/10 text-warning">
                Ativo
              </Badge>
            )}
            <Switch
              checked={isEnabled}
              onCheckedChange={handleToggleEnabled}
              disabled={isTogglingEnabled}
            />
          </div>
        </div>
        <CardDescription>
          Restrinja o acesso ao sistema apenas para países específicos (whitelist global).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {currentCountry && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            Sua localização atual:{' '}
            <span className="font-medium">
              {currentCountry.name} ({currentCountry.code})
            </span>
          </div>
        )}

        {isEnabled && (
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              O bloqueio geográfico está ativo. Apenas usuários dos países listados abaixo podem
              acessar o sistema.
            </AlertDescription>
          </Alert>
        )}

        {countries.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>País</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {countries.map((country) => (
                <TableRow key={country.id}>
                  <TableCell className="font-medium">{country.country_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{country.country_code}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={country.is_active ? 'default' : 'secondary'}>
                      {country.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="ToggleRight"
                        onClick={() => handleToggleCountry(country.id, country.is_active ?? false)}
                      >
                        {country.is_active ? (
                          <ToggleRight className="h-4 w-4 text-success" />
                        ) : (
                          <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Excluir"
                        onClick={() => handleRemoveCountry(country.id, country.country_name)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="py-4 text-center text-sm text-muted-foreground">
            Nenhum país configurado. Adicione países à lista de permitidos.
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Adicionar País
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar País Permitido</DialogTitle>
              <DialogDescription>
                Adicione um país à lista de países que podem acessar o sistema.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Selecione um País</Label>
                <Select
                  value={selectedCountry}
                  onValueChange={(v) => {
                    setSelectedCountry(v);
                    setCustomCode('');
                    setCustomName('');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha um país..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCountries.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.name} ({country.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Ou adicione manualmente
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Código (ISO 2)</Label>
                  <Input
                    placeholder="BR"
                    value={customCode}
                    onChange={(e) => {
                      setCustomCode(e.target.value.toUpperCase().slice(0, 2));
                      setSelectedCountry('');
                    }}
                    maxLength={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nome do País</Label>
                  <Input
                    placeholder="Brasil"
                    value={customName}
                    onChange={(e) => {
                      setCustomName(e.target.value);
                      setSelectedCountry('');
                    }}
                  />
                </div>
              </div>

              {currentCountry && !countries.some((c) => c.country_code === currentCountry.code) && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setCustomCode(currentCountry.code);
                    setCustomName(currentCountry.name);
                    setSelectedCountry('');
                  }}
                >
                  <MapPin className="mr-2 h-4 w-4" />
                  Usar minha localização ({currentCountry.name})
                </Button>
              )}

              <Button
                onClick={handleAddCountry}
                disabled={(!selectedCountry && (!customCode || !customName)) || isSubmitting}
                className="w-full"
              >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Adicionar País
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {!isEnabled && countries.length > 0 && (
          <Alert variant="default">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              O bloqueio geográfico está desativado. Ative-o para restringir o acesso aos países
              listados.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
