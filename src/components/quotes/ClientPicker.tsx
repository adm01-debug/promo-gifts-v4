/**
 * ClientPicker — campo de seleção/busca de cliente para orçamentos.
 * Implementação minimalista (entrada manual). Pode ser estendida para autocompletar via CRM.
 */
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User } from 'lucide-react';

export interface ClientData {
  client_name: string;
  client_email: string;
  client_phone: string;
  client_company: string;
  client_cnpj: string;
}

interface ClientPickerProps {
  value: Partial<ClientData>;
  onChange: (next: Partial<ClientData>) => void;
}

export function ClientPicker({ value, onChange }: ClientPickerProps) {
  const set = (k: keyof ClientData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [k]: e.target.value });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="h-4 w-4 text-primary" /> Cliente
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Nome</Label>
          <Input value={value.client_name ?? ''} onChange={set('client_name')} />
        </div>
        <div className="space-y-1">
          <Label>Empresa</Label>
          <Input value={value.client_company ?? ''} onChange={set('client_company')} />
        </div>
        <div className="space-y-1">
          <Label>E-mail</Label>
          <Input type="email" value={value.client_email ?? ''} onChange={set('client_email')} />
        </div>
        <div className="space-y-1">
          <Label>Telefone</Label>
          <Input value={value.client_phone ?? ''} onChange={set('client_phone')} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>CNPJ</Label>
          <Input value={value.client_cnpj ?? ''} onChange={set('client_cnpj')} />
        </div>
      </CardContent>
    </Card>
  );
}
