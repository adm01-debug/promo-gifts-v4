// Totals block — label "Total:" (sem "Valor"). Largura vem do SSOT
// `TOTALS_BLOCK_WIDTH_PX` em `../ProposalStyles` para manter paridade
// com `TotalsSection` do PDF interno.
// Cores dos badges vêm de `@/lib/pdf/totalsColorScheme` (flag A/B).
import { type ProposalTemplateData, formatShipping } from '../ProposalHtmlTemplate';
import { TOTALS_BLOCK_WIDTH_PX } from '../ProposalStyles';
import { getTotalsColorTokens } from '@/lib/pdf/totalsColorScheme';

function fmt(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function ProposalTotals({ data }: { data: ProposalTemplateData }) {
  const tokens = getTotalsColorTokens();
  const shippingLabel = data.shippingType
    ? formatShipping(data.shippingType, data.shippingCost)
    : data.shippingCost
      ? fmt(data.shippingCost)
      : 'Cortesia';

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }} data-totals-scheme={tokens.scheme}>
      <div style={{ width: `${TOTALS_BLOCK_WIDTH_PX}px` }}>
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
              ...(tokens.discount.border ? { border: `1px solid ${tokens.discount.border}` } : {}),
            }}
          >
            <table
              style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: tokens.discount.bg }}
            >
              <tbody>
                <tr>
                  <td style={{ padding: '7px 16px' }}>
                    <span style={{ fontWeight: 700, fontSize: '13px', color: tokens.discount.fg }}>
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
                    <span style={{ fontWeight: 800, fontSize: '15px', color: tokens.discount.fg }}>
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
        <div
          style={{
            borderRadius: '8px',
            overflow: 'hidden',
            marginTop: '10px',
            ...(tokens.total.border ? { border: `1px solid ${tokens.total.border}` } : {}),
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: tokens.total.bg }}>
            <tbody>
              <tr>
                {/* verticalAlign: middle garante alinhamento do rótulo "Total:" (13px)
                    com o valor (19px) — sem isso o baseline default deixa o label
                    ~2px acima da linha central após a redução de largura. */}
                <td style={{ padding: '6.5px 18px', verticalAlign: 'middle' }}>
                  <span
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      fontSize: '13px',
                      color: tokens.total.fg,
                      letterSpacing: '0.5px',
                    }}
                  >
                    Total:
                  </span>
                </td>
                <td style={{ padding: '6.5px 18px', textAlign: 'right', verticalAlign: 'middle' }}>
                  <strong
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 800,
                      fontSize: '19px',
                      color: tokens.total.fg,
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
