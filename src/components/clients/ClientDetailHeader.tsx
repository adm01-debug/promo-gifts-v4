/**
 * ClientDetailHeader — cabeçalho da página 360° do cliente.
 */
import { Building2, Globe, MapPin, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { getCompanyDisplayName, type CrmCompany } from "@/types/crm";

interface ClientDetailHeaderProps {
  client: CrmCompany;
}

export function ClientDetailHeader({ client }: ClientDetailHeaderProps) {
  const navigate = useNavigate();
  const name = getCompanyDisplayName(client);
  const location = [client.cidade, client.estado].filter(Boolean).join(" / ");

  return (
    <div className="space-y-3">
      <Button variant="ghost" size="sm" onClick={() => navigate("/clientes")} className="-ml-2">
        <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
      </Button>
      <div className="flex items-start gap-4">
        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {client.logo_url ? (
            <img src={client.logo_url} alt={name} className="h-full w-full object-cover" />
          ) : (
            <Building2 className="h-7 w-7 text-primary" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 
            data-testid="page-title-clientes-detalhe"
            className="text-2xl font-bold font-display text-foreground truncate"
          >
            {name}
          </h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1 flex-wrap">
            {client.cnpj && <span className="font-mono">{client.cnpj}</span>}
            {location && (<span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{location}</span>)}
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
          <div className="flex flex-wrap gap-1 mt-2">
            {client.is_customer && <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">Cliente</Badge>}
            {client.is_supplier && <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">Fornecedor</Badge>}
            {client.ramo_atividade && <Badge variant="outline">{client.ramo_atividade}</Badge>}
          </div>
        </div>
      </div>
    </div>
  );
}
