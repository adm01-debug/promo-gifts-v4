import { type ProposalTemplateData, formatShipping } from '../ProposalHtmlTemplate';

function fmt(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function ProposalTotals({ data }: { data: ProposalTemplateData }) {
  const shippingLabel = data.shippingType
    ? formatShipping(data.shippingType, data.shippingCost)
    : data.shippingCost
      ? fmt(data.shippingCost)
      : 'Cortesia';

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
      <div style={{ width: '360px' }}>
        {/* Subtotal row */}
        <table
          style={{ width: '100%', borderCollapse: 'collapse', borderBottom: '1px solid #f0f0f0' }}
        >
          <tbody>
            <tr>
              <td style={{ padding: '7px 16px', fontSize: '12px', color: '#555' }}>Subtotal:</td>
              <td
                style={{
                  padding: '7px 16px',
                  fontSize: '12px',
                  color: '#555',
                  textAlign: 'right',
                  fontWeight: 600,
                }}
              >
                {fmt(data.subtotal)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Desconto Global row — antes do frete */}
        {data.discount && data.discount > 0 && (
          <div
            style={{
              borderRadius: '6px',
              overflow: 'hidden',
              margin: '6px 0',
              border: '1px solid #ffcdd2',
            }}
          >
            <table
              style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff5f5' }}
            >
              <tbody>
                <tr>
                  <td style={{ width: '4px', backgroundColor: '#e53935', padding: 0 }} />
                  <td style={{ padding: '7px 16px' }}>
                    <span style={{ fontWeight: 700, fontSize: '13px', color: '#c62828' }}>
                      Desconto Global:
                    </span>
                  </td>
                  <td style={{ padding: '7px 16px', textAlign: 'right' }}>
                    <span style={{ fontWeight: 800, fontSize: '15px', color: '#c62828' }}>
                      - {fmt(data.discount)}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Frete row — após desconto, entra no total */}
        <table
          style={{ width: '100%', borderCollapse: 'collapse', borderBottom: '1px solid #f0f0f0' }}
        >
          <tbody>
            <tr>
              <td style={{ padding: '7px 24px 7px 24px', fontSize: '12px', color: '#555' }}>
                Frete:
              </td>
              <td
                style={{
                  padding: '7px 16px',
                  fontSize: '12px',
                  color: '#555',
                  textAlign: 'right',
                  fontWeight: 600,
                }}
              >
                {shippingLabel}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Valor Total */}
        <div style={{ borderRadius: '8px', overflow: 'hidden', marginTop: '10px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#00c853' }}>
            <tbody>
              <tr>
                <td style={{ padding: '10px 18px' }}>
                  <span
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      fontSize: '13px',
                      color: '#ffffff',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Valor Total:
                  </span>
                </td>
                <td style={{ padding: '10px 18px', textAlign: 'right' }}>
                  <strong
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 800,
                      fontSize: '19px',
                      color: '#ffffff',
                    }}
                  >
                    {fmt(data.total)}
                  </strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
