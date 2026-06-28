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
    <div className="grid gap-5 md:grid-cols-2">
      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <Building2 className="h-3 w-3 text-primary" />
          <h3 className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
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
                <p className="text-sm font-semibold text-foreground">{companyName}</p>
                {cityState && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>{cityState}</span>
                  </div>
                )}
                {clientCnpj && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CreditCard className="h-3 w-3" />
                    <span>CNPJ: {clientCnpj}</span>
                  </div>
                )}
              </div>
            );
          })()
        ) : (
          <div className="flex items-center gap-2.5 rounded-lg border border-dashed border-muted-foreground/30 p-2.5 print:hidden">
            <UserPlus className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs font-medium text-muted-foreground">Nenhum cliente vinculado</p>
              <p className="text-[11px] text-muted-foreground/70">
                Edite o orçamento para vincular um cliente
              </p>
            </div>
          </div>
        )}
      </div>
      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <User className="h-3 w-3 text-primary" />
          <h3 className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Contato
          </h3>
        </div>
        {clientName ? (
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{clientName}</p>
            {clientEmail && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Mail className="h-3 w-3" />
                <span>{clientEmail}</span>
              </div>
            )}
            {clientPhone && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Phone className="h-3 w-3" />
                <span>{clientPhone}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs italic text-muted-foreground">Nenhum contato vinculado</p>
        )}
      </div>
    </div>
  );
}
