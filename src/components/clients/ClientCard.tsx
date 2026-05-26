/**
 * ClientCard — card de listagem de empresa/cliente CRM.
 */
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, MapPin } from 'lucide-react';
import { getCompanyDisplayName, type CrmCompany } from '@/types/crm';

interface ClientCardProps {
  client: CrmCompany;
  onClick?: () => void;
}

export function ClientCard({ client, onClick }: ClientCardProps) {
  const name = getCompanyDisplayName(client);
  const location = [client.cidade, client.estado].filter(Boolean).join(' / ');

  return (
    <Card
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      className="cursor-pointer transition-colors hover:border-primary/30 focus-visible:ring-2 focus-visible:ring-primary"
    >
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10">
          {client.logo_url ? (
            <img
              src={client.logo_url}
              alt={name}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <Building2 className="h-5 w-5 text-primary" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{name}</p>
          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            {location && (
              <>
                <MapPin className="h-3 w-3" />
                {location}
              </>
            )}
            {client.cnpj && <span className="ml-1 font-mono">· {client.cnpj}</span>}
          </p>
        </div>
        <div className="flex flex-shrink-0 flex-wrap justify-end gap-1">
          {client.is_customer && (
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              Cliente
            </Badge>
          )}
          {client.is_supplier && (
            <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
              Fornecedor
            </Badge>
          )}
          {client.is_carrier && (
            <Badge variant="outline" className="bg-muted text-muted-foreground">
              Transportadora
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
