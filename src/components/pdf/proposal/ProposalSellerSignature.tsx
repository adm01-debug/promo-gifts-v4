import type { ProposalTemplateData } from '../ProposalHtmlTemplate';

interface Props {
  data: ProposalTemplateData;
}

export function ProposalSellerSignature({ data }: Props) {
  const { seller } = data;
  if (!seller?.name) return null;

  const printDate = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      style={{
        padding: '0 36px',
        marginBottom: '10px',
        display: 'flex',
        justifyContent: 'flex-start',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          minWidth: '220px',
          maxWidth: '280px',
        }}
      >
        {/* Signature: PNG image or Sacramento font fallback */}
        <div
          style={{
            minHeight: '36px',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            marginBottom: '2px',
          }}
        >
          <div
            style={{
              fontFamily: "'Sacramento', cursive",
              fontSize: '32px',
              color: '#1a1a1a',
              lineHeight: 1,
              whiteSpace: 'nowrap',
            }}
          >
            {seller.name}
          </div>
        </div>

        {/* Signature line */}
        <div
          style={{
            width: '100%',
            height: '1px',
            backgroundColor: '#999',
            margin: '0 auto 6px auto',
          }}
        />

        {/* Seller name */}
        <div
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 700,
            fontSize: '11px',
            color: '#333',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          {seller.name}
        </div>

        {/* Seller email */}
        {seller.email && (
          <div
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontSize: '12px',
              color: '#777',
              marginTop: '2px',
            }}
          >
            {seller.email}
          </div>
        )}

        {/* Electronic signature disclaimer */}
        <div
          style={{
            fontSize: '8px',
            color: '#333',
            marginTop: '6px',
            lineHeight: '1.3',
            fontWeight: 600,
          }}
        >
          Documento gerado eletronicamente por {seller.name} em {printDate}
        </div>
      </div>
    </div>
  );
}
