/**
 * ProposalConditionsBadges — 4 badges (2x2) com Prazo Pagamento,
 * Prazo Entrega, Frete e Validade. Renderiza ao lado do bloco de totais
 * para aproveitamento de espaço horizontal na última página.
 *
 * Layout via <table> (html2canvas não suporta CSS grid).
 */
import {
  type ProposalTemplateData,
  formatPaymentTerms,
  formatDeliveryTime,
  formatShipping,
} from '../ProposalHtmlTemplate';

interface BadgeProps {
  label: string;
  value: string;
}

function Badge({ label, value }: BadgeProps) {
  return (
    <div
      style={{
        border: '1px solid #e0e0e0',
        borderRadius: '6px',
        backgroundColor: '#fafafa',
        padding: '8px 10px',
        height: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          fontSize: '9px',
          fontWeight: 700,
          color: '#888',
          textTransform: 'uppercase',
          letterSpacing: '0.3px',
          marginBottom: '3px',
          lineHeight: 1.2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: '11px',
          color: '#333',
          fontWeight: 600,
          lineHeight: 1.3,
        }}
      >
        {value}
      </div>
    </div>
  );
}

export function ProposalConditionsBadges({ data }: { data: ProposalTemplateData }) {
  const paymentLabel = formatPaymentTerms(data.paymentTerms) || 'À vista / Boleto / Pix';
  const deliveryLabel = formatDeliveryTime(data.deliveryTime) || 'A combinar';
  const shippingLabel = formatShipping(data.shippingType, data.shippingCost);
  const validityLabel = data.validUntil || '15 dias';

  return (
    <table
      style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '6px' }}
      data-block="conditions-badges"
    >
      <tbody>
        <tr>
          <td style={{ width: '50%', verticalAlign: 'top' }}>
            <Badge label="💳 Prazo de Pagamento" value={paymentLabel} />
          </td>
          <td style={{ width: '50%', verticalAlign: 'top' }}>
            <Badge label="📦 Prazo de Entrega" value={deliveryLabel} />
          </td>
        </tr>
        <tr>
          <td style={{ width: '50%', verticalAlign: 'top' }}>
            <Badge label="🚚 Frete" value={shippingLabel} />
          </td>
          <td style={{ width: '50%', verticalAlign: 'top' }}>
            <Badge label="📅 Validade da Proposta" value={validityLabel} />
          </td>
        </tr>
      </tbody>
    </table>
  );
}
