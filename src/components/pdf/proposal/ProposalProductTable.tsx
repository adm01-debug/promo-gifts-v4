/**
 * ProposalProductTable — Tabela de produtos na proposta PDF
 *
 * FIXES (2026-05):
 *  Bug #3a — loading="lazy" removido → imagens carregam mesmo em offscreen (-10000px)
 *  Bug #3b — useState("") → useState(src) → img.complete não dispara falso positivo
 *  Bug #6  — Coluna "Total" (Qtd × Unitário − Desconto) adicionada
 */
import React, { useEffect, useState } from 'react';
import type { ProposalItem } from '../ProposalHtmlTemplate';
import { processLogoTransparent } from './LogoWithTransparentBg';
import { formatPersonalizationSummary } from '@/lib/quotes/personalizationSummary';
import { getProposalImageUrl } from '@/utils/image-utils';
import { PDF_TOKENS } from '../ProposalStyles';

function ProductImageTransparent({ src, alt }: { src: string; alt: string }) {
  // FIX #3b: inicializar com src (não "") para que img.complete só retorne true
  // quando a imagem original já tiver carregado — evita captura em branco pelo
  // html2canvas (que checa img.complete antes de adicionar listeners).
  const [dataUrl, setDataUrl] = useState<string>(src);
  useEffect(() => {
    processLogoTransparent(src).then(setDataUrl);
  }, [src]);
  return (
    <div
      style={{
        width: '92px',
        height: '92px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto',
        padding: '0px',
        boxSizing: 'border-box',
      }}
    >
      <img
        src={dataUrl}
        alt={alt}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block',
        }}
        // FIX #3a: loading="eager" — o browser DEVE carregar mesmo em offscreen.
        // "lazy" só carrega quando a imagem entra no viewport; como o template
        // é renderizado a -10000px, imagens lazy nunca carregariam → PDF em branco.
        loading="eager"
      />
    </div>
  );
}

function fmt(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const thBase: React.CSSProperties = {
  backgroundColor: '#00c853',
  color: '#111',
  padding: '10px 10px',
  fontSize: '11px',
  fontFamily: "'Montserrat', sans-serif",
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.3px',
};

interface Props {
  items: ProposalItem[];
  showHeader?: boolean;
  startIndex?: number;
}

export function ProposalProductTable({ items, showHeader = true, startIndex = 0 }: Props) {
  const hasAnyImage = items.some((item) => !!item.imageUrl);

  // FIX #6: colSpan agora inclui a nova coluna Total
  const colSpan = hasAnyImage ? 5 : 4;

  // Group items by kit_group_id
  const groups: { kitName: string | null; items: { item: ProposalItem; globalIdx: number }[] }[] =
    [];
  let currentGroupId: string | null | undefined;

  items.forEach((item, idx) => {
    const gid = item.kit_group_id || null;
    if (gid !== currentGroupId || gid === null) {
      groups.push({ kitName: gid ? item.kit_name || 'Kit' : null, items: [] });
      currentGroupId = gid;
    }
    groups[groups.length - 1].items.push({ item, globalIdx: startIndex + idx });
  });

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
      {showHeader && (
        <thead>
          <tr>
            {hasAnyImage && (
              <th
                style={{
                  ...thBase,
                  textAlign: 'center',
                  width: '100px',
                  borderRadius: '6px 0 0 0',
                }}
              >
                Foto
              </th>
            )}
            <th
              style={{
                ...thBase,
                textAlign: 'left',
                borderRadius: hasAnyImage ? '0' : '6px 0 0 0',
              }}
            >
              Descrição do Produto
            </th>
            <th style={{ ...thBase, textAlign: 'center', width: '48px' }}>Qtd.</th>
            <th style={{ ...thBase, textAlign: 'right', width: '84px' }}>Unitário</th>
            {/* FIX #6: nova coluna Total — cliente pode verificar sub-totais por linha */}
            <th style={{ ...thBase, textAlign: 'right', width: '92px', borderRadius: '0 6px 0 0' }}>
              Total
            </th>
          </tr>
        </thead>
      )}
      <tbody>
        {groups.map((group, gIdx) => (
          <React.Fragment key={gIdx}>
            {group.kitName && (
              <tr>
                <td
                  colSpan={colSpan}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#e8f5e9',
                    borderBottom: '2px solid #00c853',
                    fontSize: '12px',
                    fontWeight: 800,
                    color: '#2e7d32',
                    fontFamily: "'Montserrat', sans-serif",
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  📦 Kit: {group.kitName}
                  <span
                    style={{ fontWeight: 400, fontSize: '10px', marginLeft: '8px', color: '#666' }}
                  >
                    ({group.items.length} {group.items.length === 1 ? 'item' : 'itens'})
                  </span>
                </td>
              </tr>
            )}
            {group.items.map(({ item, globalIdx }, _idx) => {
              const persUnitCost =
                item.personalizations?.reduce((sum, p) => {
                  const pTotal = p.total_cost || 0;
                  return (
                    sum + (item.quantity > 0 ? Math.round((pTotal / item.quantity) * 100) / 100 : 0)
                  );
                }, 0) || 0;
              const allInUnitPrice = item.unitPrice + persUnitCost; // display only (rounded per-unit)
              const itemDiscount = item.discount || 0;
              // BUG-048c: use p.total_cost directly to avoid double-rounding
              const persTotal =
                item.personalizations?.reduce((s, p) => s + (p.total_cost || 0), 0) || 0;
              const lineTotal = item.quantity * item.unitPrice + persTotal - itemDiscount;
              const isEven = globalIdx % 2 === 0;

              const personalizations = item.personalizations ?? [];
              const gravacaoBadges = personalizations
                .map((p) => formatPersonalizationSummary(p))
                .filter((s): s is string => Boolean(s && s.trim().length > 0));

              return (
                <tr
                  key={item.sku || globalIdx}
                  style={{
                    backgroundColor: isEven ? PDF_TOKENS.rowEven : PDF_TOKENS.rowOdd,
                    borderBottom: '1px solid #eef0f2',
                  }}
                >
                  {hasAnyImage && (
                    <td style={{ padding: '1px', textAlign: 'center', verticalAlign: 'middle' }}>
                      {item.imageUrl ? (
                        <ProductImageTransparent src={getProposalImageUrl(item.imageUrl)} alt={item.name} />
                      ) : (
                        <div
                          style={{
                            width: '92px',
                            height: '92px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto',
                            boxSizing: 'border-box',
                          }}
                        >
                          <span style={{ fontSize: '9px', color: '#ccc' }}>—</span>
                        </div>
                      )}
                    </td>
                  )}
                  <td style={{ padding: '8px 10px', verticalAlign: 'middle' }}>
                    <div
                      style={{
                        fontWeight: 800,
                        color: '#111',
                        fontSize: '13px',
                        lineHeight: '1.3',
                        marginBottom: '2px',
                      }}
                    >
                      {/* FIX gap-C (QA adversarial): clampa nome a ~2 linhas para não estourar ROW_H. */}
                      {/* @fix_version proposal-truncate-name-2026-06 */}
                      {item.name.length > 90 ? `${item.name.slice(0, 90).trimEnd()}…` : item.name}
                    </div>
                    {item.description && (
                      <span
                        style={{
                          display: 'block',
                          fontSize: '11px',
                          color: '#666',
                          marginBottom: '4px',
                          lineHeight: '1.4',
                          maxWidth: '340px',
                          wordBreak: 'break-word',
                        }}
                      >
                        {/* FIX P1 #7: trunca descrições longas (~2 linhas) para blindar
                            a altura da linha e evitar clipping no html2canvas.
                            @fix_version proposal-truncate-desc-2026-06 */}
                        {item.description.length > 120
                          ? `${item.description.slice(0, 120).trimEnd()}…`
                          : item.description}
                      </span>
                    )}
                    {/* Rediagramação 2026-07: SKU + Cor na MESMA linha, abaixo do nome/descrição.
                        Ordem: [badge SKU] · Cor: LARANJA
                        @fix_version proposal-sku-color-inline-2026-07 */}
                    {((item.composedCode || item.sku) || item.color) && (
                      <div
                        style={{
                          display: 'block',
                          marginTop: '2px',
                          marginBottom: '2px',
                          lineHeight: '1.4',
                        }}
                      >
                        {(item.composedCode || item.sku) && (
                          <span
                            style={{
                              display: 'inline-block',
                              color: '#111',
                              fontSize: '10px',
                              fontWeight: 700,
                              fontFamily: "'Roboto', sans-serif",
                              whiteSpace: 'nowrap',
                              verticalAlign: 'middle',
                            }}
                          >
                            {item.composedCode || item.sku}
                          </span>
                        )}
                        {(item.composedCode || item.sku) && item.color && (
                          <span
                            style={{
                              display: 'inline-block',
                              margin: '0 6px',
                              color: '#999',
                              fontSize: '10px',
                              verticalAlign: 'middle',
                            }}
                          >
                            ·
                          </span>
                        )}
                        {item.color && (
                          <span
                            style={{
                              display: 'inline-block',
                              fontSize: '10px',
                              color: '#555',
                              fontWeight: 600,
                              verticalAlign: 'middle',
                            }}
                          >
                            Cor:{' '}
                            <span
                              style={{
                                display: 'inline-block',
                                width: '10px',
                                height: '10px',
                                borderRadius: '2px',
                                background: item.colorHex || PDF_TOKENS.swatchFallback,
                                border: `1px solid ${PDF_TOKENS.swatchBorder}`,
                                verticalAlign: 'middle',
                                marginRight: '4px',
                                marginBottom: '1px',
                              }}
                            />
                            <span style={{ fontWeight: 500, color: '#333', verticalAlign: 'middle' }}>
                              {item.color}
                            </span>
                          </span>
                        )}
                      </div>
                    )}
                    {gravacaoBadges.length > 0 && (
                      <div style={{ marginTop: '3px', display: 'block' }}>
                        {gravacaoBadges.map((g, i) => (
                          <table
                            key={i}
                            style={{
                              borderCollapse: 'collapse',
                              marginTop: i === 0 ? 0 : '2px',
                            }}
                          >
                            <tbody>
                              <tr>
                                <td style={{ width: '3px', backgroundColor: '#00796b', padding: 0 }} />
                                <td
                                  style={{
                                    backgroundColor: '#e0f2f1',
                                    padding: '1px 7px',
                                    borderRadius: '0 4px 4px 0',
                                    lineHeight: 1.2,
                                  }}
                                >
                                  <span style={{ fontSize: '9px', color: '#00796b', fontWeight: 600, lineHeight: 1.2 }}>
                                    {g}
                                  </span>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        ))}
                      </div>
                    )}
                  </td>
                  <td
                    style={{
                      padding: '8px 6px',
                      textAlign: 'center',
                      verticalAlign: 'middle',
                      fontWeight: 800,
                      fontSize: '14px',
                      color: '#222',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {item.quantity}
                  </td>
                  <td
                    style={{
                      padding: '8px 8px',
                      textAlign: 'right',
                      verticalAlign: 'middle',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#333' }}>
                      {fmt(allInUnitPrice)}
                    </span>
                    {itemDiscount > 0 && (
                      <span
                        style={{
                          display: 'block',
                          fontSize: '10px',
                          color: '#e53935',
                          marginTop: '2px',
                          fontWeight: 600,
                        }}
                      >
                        -{fmt(itemDiscount)}
                      </span>
                    )}
                  </td>
                  {/* FIX #6: célula de total da linha */}
                  <td
                    style={{
                      padding: '8px 10px',
                      textAlign: 'right',
                      verticalAlign: 'middle',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#111' }}>
                      {fmt(lineTotal)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </React.Fragment>
        ))}
      </tbody>
    </table>
  );
}
