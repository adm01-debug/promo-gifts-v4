/**
 * QuoteClientInfo — Client & contact info cards for QuoteViewPage
 *
 * Tipografia/espaçamento via SSOT `quote-view-typography`. Cores
 * estritamente em tokens semânticos para preservar contraste AA.
 */
import { Building2, CreditCard, Mail, MapPin, Phone, User, UserPlus } from 'lucide-react';
import { qvType, qvSpacing } from './quote-view-typography';

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
    <section
      aria-label="Informações do cliente"
      className={`grid grid-cols-1 md:grid-cols-2 ${qvSpacing.clientGrid}`}
    >
      <div>
        <div className={`${qvSpacing.eyebrowGap} flex items-center gap-1.5`}>
          <Building2 className="h-3 w-3 text-primary" aria-hidden="true" />
          <h3 className={qvType.eyebrow}>Empresa</h3>
        </div>
        {clientCompany || clientName ? (
          (() => {
            const company = clientCompany || 'Não especificado';
            const parts = company.split(' | ');
            const companyName = parts[0];
            const cityState = parts[1];
            return (
              <div className="space-y-1">
                <p className={qvType.blockTitle}>{companyName}</p>
                {cityState && (
                  <div className={`flex items-center gap-1.5 ${qvType.meta}`}>
                    <MapPin className="h-3 w-3" aria-hidden="true" />
                    <span>{cityState}</span>
                  </div>
                )}
                {clientCnpj && (
                  <div className={`flex items-center gap-1.5 ${qvType.meta}`}>
                    <CreditCard className="h-3 w-3" aria-hidden="true" />
                    <span>CNPJ: {clientCnpj}</span>
                  </div>
                )}
              </div>
            );
          })()
        ) : (
          <div className="flex items-center gap-2.5 rounded-lg border border-dashed border-muted-foreground/40 p-2.5 print:hidden">
            <UserPlus className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="text-xs font-medium text-foreground">Nenhum cliente vinculado</p>
              <p className="text-[11px] text-muted-foreground">
                Edite o orçamento para vincular um cliente
              </p>
            </div>
          </div>
        )}
      </div>
      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <User className="h-3 w-3 text-primary" aria-hidden="true" />
          <h3 className={qvType.eyebrow}>Contato</h3>
        </div>
        {clientName ? (
          <div className="space-y-1">
            <p className={qvType.blockTitle}>{clientName}</p>
            {clientEmail && (
              <div className={`flex items-center gap-1.5 ${qvType.meta}`}>
                <Mail className="h-3 w-3" aria-hidden="true" />
                <span className="break-all">{clientEmail}</span>
              </div>
            )}
            {clientPhone && (
              <div className={`flex items-center gap-1.5 ${qvType.meta}`}>
                <Phone className="h-3 w-3" aria-hidden="true" />
                <span>{clientPhone}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs italic text-muted-foreground">Nenhum contato vinculado</p>
        )}
      </div>
    </section>
  );
}

