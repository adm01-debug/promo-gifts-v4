/**
 * QuoteClientInfo — Cabeçalho editorial (empresa + contato) do QuoteViewPage.
 * Banda full-width com eyebrows discretos, hierarquia clara e divisor sutil.
 */
import { Building2, Mail, MapPin, Phone, User, UserPlus } from 'lucide-react';

interface QuoteClientInfoProps {
  clientCompany?: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientCnpj?: string;
}

function Eyebrow({ icon: Icon, children }: { icon: typeof Building2; children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/80">
      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
      <span>{children}</span>
    </div>
  );
}

export function QuoteClientInfo({
  clientCompany,
  clientName,
  clientEmail,
  clientPhone,
  clientCnpj,
}: QuoteClientInfoProps) {
  const company = (clientCompany || '').split(' | ');
  const companyName = company[0] || clientCompany || null;
  const cityState = company[1] || null;

  return (
    <section className="grid gap-8 py-1 md:grid-cols-2 md:divide-x md:divide-border/60">
      <div className="md:pr-8">
        <Eyebrow icon={Building2}>Empresa</Eyebrow>
        {companyName ? (
          <div className="space-y-2">
            <h2 className="font-display text-[22px] font-semibold leading-tight tracking-tight text-foreground">
              {companyName}
            </h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-muted-foreground">
              {cityState && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {cityState}
                </span>
              )}
              {clientCnpj && (
                <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                    CNPJ
                  </span>
                  {clientCnpj}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-border/60 p-3 print:hidden">
            <UserPlus className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Nenhum cliente vinculado</p>
              <p className="text-xs text-muted-foreground/70">
                Edite o orçamento para vincular um cliente
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="md:pl-8">
        <Eyebrow icon={User}>Contato</Eyebrow>
        {clientName ? (
          <div className="space-y-2">
            <p className="font-display text-[18px] font-semibold leading-tight text-foreground">
              {clientName}
            </p>
            <div className="flex flex-col gap-1.5 text-[13px] text-muted-foreground">
              {clientEmail && (
                <span className="inline-flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5" strokeWidth={1.75} />
                  <span className="truncate">{clientEmail}</span>
                </span>
              )}
              {clientPhone && (
                <span className="inline-flex items-center gap-2 tabular-nums">
                  <Phone className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {clientPhone}
                </span>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm italic text-muted-foreground">Nenhum contato vinculado</p>
        )}
      </div>
    </section>
  );
}
