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
      <div style={{ width: '288px' }}>
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
        {/* Economia (desconto global) — enquadrada como GANHO, não perda. */}
        {/* @fix_version proposal-discount-positive-2026-06 */}
        {data.discount && data.discount > 0 && (
          <div
            style={{
              borderRadius: '6px',
              overflow: 'hidden',
              margin: '6px 0',
              border: '1px solid #c8e6c9',
            }}
          >
            <table
              style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#f1f8e9' }}
            >
              <tbody>
                <tr>
                  <td style={{ width: '4px', backgroundColor: '#00c853', padding: 0 }} />
                  <td style={{ padding: '7px 16px' }}>
                    <span style={{ fontWeight: 700, fontSize: '13px', color: '#2e7d32' }}>
                      Você economiza
                    </span>
                  </td>
                  <td
                    style={{
                      padding: '7px 16px',
                      textAlign: 'right',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span style={{ fontWeight: 800, fontSize: '15px', color: '#2e7d32' }}>
                      − {fmt(data.discount)}
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
                      color: '#555',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Total:
                  </span>
                </td>
                <td style={{ padding: '10px 18px', textAlign: 'right' }}>
                  <strong
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 800,
                      fontSize: '19px',
                      color: '#555',
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
