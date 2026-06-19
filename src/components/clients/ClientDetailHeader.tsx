/**
 * ClientDetailHeader — cabeçalho da página 360° do cliente.
 */
import { Building2, Globe, MapPin, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { getCompanyDisplayName, type CrmCompany } from '@/types/crm';
import { OptimizedImage } from '@/components/ui/OptimizedImage';

interface ClientDetailHeaderProps {
  client: CrmCompany;
}

export function ClientDetailHeader({ client }: ClientDetailHeaderProps) {
  const navigate = useNavigate();
  const name = getCompanyDisplayName(client);
  const location = [client.cidade, client.estado].filter(Boolean).join(' / ');

  return (
    <div className="space-y-3">
      <Button variant="ghost" size="sm" onClick={() => navigate('/clientes')} className="-ml-2">
        <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
      </Button>
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10">
          {client.logo_url ? (
            <OptimizedImage
              src={client.logo_url}
              alt={name}
              className="object-cover"
              containerClassName="h-full w-full"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <Building2 className="h-7 w-7 text-primary" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1
            data-testid="page-title-clientes-detalhe"
            className="truncate font-display text-2xl font-bold text-foreground"
          >
            {name}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {client.cnpj && <span className="font-mono">{client.cnpj}</span>}
            {location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {location}
              </span>
            )}
            {client.website && (
              <a
                href={client.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline"
              >
                <Globe className="h-3.5 w-3.5" /> Website
              </a>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
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
            {client.ramo_atividade && <Badge variant="outline">{client.ramo_atividade}</Badge>}
          </div>
        </div>
      </div>
    </div>
  );
}
