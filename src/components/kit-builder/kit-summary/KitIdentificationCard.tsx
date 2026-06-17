import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText } from 'lucide-react';

interface KitIdentificationCardProps {
  kitName: string;
  kitQuantity: number;
  onKitNameChange: (name: string) => void;
  onKitQuantityChange: (quantity: number) => void;
}

export function KitIdentificationCard({
  kitName,
  kitQuantity,
  onKitNameChange,
  onKitQuantityChange,
}: KitIdentificationCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5" />
          Identificação do Kit
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="kit-name">Nome do Kit</Label>
            <Input
              id="kit-name"
              placeholder="Ex: Kit Boas-Vindas Premium"
              value={kitName}
              onChange={(e) => onKitNameChange(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kit-qty">Quantidade de Kits</Label>
            <Input
              id="kit-qty"
              type="number"
              min={1}
              value={kitQuantity}
              onChange={(e) => onKitQuantityChange(Math.max(1, parseInt(e.target.value, 10) || 1))}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
