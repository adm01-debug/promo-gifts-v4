import {
  type ProposalTemplateData,
  formatPaymentTerms,
  formatDeliveryTime,
  formatShipping,
} from '../ProposalHtmlTemplate';

export function ProposalNotes({ data }: { data: ProposalTemplateData }) {
  const paymentLabel = formatPaymentTerms(data.paymentTerms);
  const deliveryLabel = formatDeliveryTime(data.deliveryTime);
  const shippingLabel = formatShipping(data.shippingType, data.shippingCost);

  return (
    <div style={{ marginTop: '14px' }}>
      {/* Bloco de Condições Comerciais */}
      <div
        style={{
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          padding: '12px 16px',
          backgroundColor: '#fafafa',
        }}
      >
        <div
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 700,
            fontSize: '10px',
            color: '#00c853',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '8px',
            borderBottom: '2px solid #e8f5e9',
            paddingBottom: '4px',
          }}
        >
          Condições Comerciais
        </div>

        {/* TABLE LAYOUT instead of CSS grid — html2canvas does not support grid */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px' }}>
          <tbody>
            <tr>
              <td style={{ width: '25%', padding: '0 8px 0 0', verticalAlign: 'top' }}>
                <div
                  style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    color: '#888',
                    textTransform: 'uppercase',
                    marginBottom: '2px',
                  }}
                >
                  💳 Prazo de Pagamento
                </div>
                <div
                  style={{ fontSize: '10px', color: '#333', fontWeight: 600, lineHeight: '1.4' }}
                >
                  {paymentLabel || 'À vista / Boleto / Pix'}
                </div>
              </td>
              <td style={{ width: '25%', padding: '0 8px', verticalAlign: 'top' }}>
                <div
                  style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    color: '#888',
                    textTransform: 'uppercase',
                    marginBottom: '2px',
                  }}
                >
                  📦 Prazo de Entrega
                </div>
                <div
                  style={{ fontSize: '10px', color: '#333', fontWeight: 600, lineHeight: '1.4' }}
                >
                  {deliveryLabel || 'A combinar'}
                </div>
              </td>
              <td style={{ width: '25%', padding: '0 8px', verticalAlign: 'top' }}>
                <div
                  style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    color: '#888',
                    textTransform: 'uppercase',
                    marginBottom: '2px',
                  }}
                >
                  🚚 Frete
                </div>
                <div
                  style={{ fontSize: '10px', color: '#333', fontWeight: 600, lineHeight: '1.4' }}
                >
                  {shippingLabel}
                </div>
              </td>
              <td style={{ width: '25%', padding: '0 0 0 8px', verticalAlign: 'top' }}>
                <div
                  style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    color: '#888',
                    textTransform: 'uppercase',
                    marginBottom: '2px',
                  }}
                >
                  📅 Validade da Proposta
                </div>
                <div
                  style={{ fontSize: '10px', color: '#333', fontWeight: 600, lineHeight: '1.4' }}
                >
                  {data.validUntil || '15 dias'}
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div
          style={{
            fontSize: '9px',
            color: '#777',
            lineHeight: '1.5',
            paddingTop: '6px',
            marginBottom: '8px',
          }}
        >
          <div>- Todos os valores incluem personalização conforme descrição.</div>
          <div>- Todos os produtos passam por controle de qualidade.</div>
          {data.notes && <div>- {data.notes}</div>}
        </div>

        {/* Termos de Aceite */}
        <div style={{ paddingTop: '8px' }}>
          <div
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 700,
              fontSize: '9px',
              color: '#00c853',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '6px',
            }}
          >
            Termos de Aceite e Contratação
          </div>
          <div style={{ fontSize: '9px', color: '#555', lineHeight: '1.38' }}>
            <div style={{ marginBottom: '4px' }}>
              <span style={{ fontWeight: 700, color: '#333' }}>1. ACEITE — </span>A presente
              proposta constitui oferta formal (art. 427, Código Civil). A resposta do destinatário
              com expressões de concordância ("aprovado", "aceito", "de acordo" ou equivalentes),
              por e-mail ou aplicativo de mensagens, configura aceitação plena de todos os termos,
              valores, prazos e especificações aqui descritos, formando contrato válido e vinculante
              (arts. 104, 107 e 427 a 435 do Código Civil).
            </div>
            <div>
              <span style={{ fontWeight: 700, color: '#333' }}>2. REPRESENTAÇÃO — </span>
              Ao aprovar esta proposta, o respondente declara que possui poderes suficientes para
              vincular a empresa identificada no campo "EMPRESA" à presente contratação, estando
              autorizado a firmar compromissos comerciais nas condições aqui estipuladas.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
