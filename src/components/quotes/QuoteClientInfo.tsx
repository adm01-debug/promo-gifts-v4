/**
 * QuoteClientInfo — Client & contact info cards for QuoteViewPage
 */
import { Building2, CreditCard, Mail, MapPin, Phone, User, UserPlus } from 'lucide-react';

interface QuoteClientInfoProps {
  clientCompany?: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientCnpj?: string;
}

export function QuoteClientInfo({
  clientCompany,
  clientName,
  clientEmail,
  clientPhone,
  clientCnpj,
}: QuoteClientInfoProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Empresa
          </h3>
        </div>
        {clientCompany || clientName ? (
          (() => {
            const company = clientCompany || 'Não especificado';
            const parts = company.split(' | ');
            const companyName = parts[0];
            const cityState = parts[1];
            return (
              <div className="space-y-1">
                <p className="text-lg font-bold text-foreground">{companyName}</p>
                {cityState && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{cityState}</span>
                  </div>
                )}
                {clientCnpj && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <CreditCard className="h-3.5 w-3.5" />
                    <span>CNPJ: {clientCnpj}</span>
                  </div>
                )}
              </div>
            );
          })()
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-muted-foreground/30 p-3 print:hidden">
            <UserPlus className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Nenhum cliente vinculado</p>
              <p className="text-xs text-muted-foreground/70">
                Edite o orçamento para vincular um cliente
              </p>
            </div>
          </div>
        )}
      </div>
      <div>
        <div className="mb-3 flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Contato
          </h3>
        </div>
        {clientName ? (
          <div className="space-y-1.5">
            <p className="font-medium text-foreground">{clientName}</p>
            {clientEmail && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                <span>{clientEmail}</span>
              </div>
            )}
            {clientPhone && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Phone className="h-3.5 w-3.5" />
                <span>{clientPhone}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm italic text-muted-foreground">Nenhum contato vinculado</p>
        )}
      </div>
    </div>
  );
}
