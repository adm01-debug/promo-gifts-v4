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
  color: '#fff',
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
              const allInUnitPrice = item.unitPrice + persUnitCost;
              const itemDiscount = item.discount || 0;
              // FIX #6: total da linha = (preço unitário all-in × qtd) − desconto da linha
              const lineTotal = allInUnitPrice * item.quantity - itemDiscount;
              const isEven = globalIdx % 2 === 0;

              const gravacao = item.personalizations
                ?.map((p) => {
                  let s = p.technique_name;
                  let widthCm = p.width_cm;
                  let heightCm = p.height_cm;
                  if ((!widthCm || !heightCm) && p.notes) {
                    const dimMatch = /\|\s*([\d.]+)×([\d.]+)cm/.exec(p.notes);
                    if (dimMatch) {
                      widthCm = parseFloat(dimMatch[1]);
                      heightCm = parseFloat(dimMatch[2]);
                    }
                  }
                  if (widthCm && heightCm) s += ` ${widthCm}×${heightCm}cm`;
                  if (p.colors_count)
                    s += ` | ${p.colors_count} cor${p.colors_count > 1 ? 'es' : ''}`;
                  if (p.material) s += ` | ${p.material}`;
                  return s;
                })
                .join(' · ');

              return (
                <tr
                  key={item.sku || globalIdx}
                  style={{
                    backgroundColor: isEven ? '#ffffff' : '#f9fafb',
                    borderBottom: '1px solid #eef0f2',
                  }}
                >
                  {hasAnyImage && (
                    <td style={{ padding: '1px', textAlign: 'center', verticalAlign: 'middle' }}>
                      {item.imageUrl ? (
                        <ProductImageTransparent src={item.imageUrl} alt={item.name} />
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
                    {(item.composedCode || item.sku) &&
                      (() => {
                        const bgColor = item.colorHex || '#2e7d32';
                        const hex = bgColor.replace('#', '');
                        const r = parseInt(hex.substring(0, 2), 16);
                        const g = parseInt(hex.substring(2, 4), 16);
                        const b = parseInt(hex.substring(4, 6), 16);
                        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                        const textColor = luminance > 0.5 ? '#1a1a1a' : '#ffffff';
                        return (
                          <div style={{ display: 'block', marginBottom: '4px' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                background: bgColor,
                                color: textColor,
                                fontSize: '9px',
                                padding: '2px 7px',
                                borderRadius: '3px',
                                fontWeight: 700,
                                fontFamily: "'Roboto', sans-serif",
                                whiteSpace: 'nowrap',
                                border:
                                  luminance > 0.85 ? '1px solid #ccc' : '1px solid transparent',
                              }}
                            >
                              {item.composedCode || item.sku}
                            </span>
                          </div>
                        );
                      })()}
                    <div
                      style={{
                        fontWeight: 800,
                        color: '#111',
                        fontSize: '13px',
                        lineHeight: '1.3',
                        marginBottom: '2px',
                      }}
                    >
                      {item.name}
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
                        }}
                      >
                        {item.description}
                      </span>
                    )}
                    {gravacao && (
                      <table style={{ borderCollapse: 'collapse', marginTop: '2px' }}>
                        <tbody>
                          <tr>
                            <td style={{ width: '3px', backgroundColor: '#00796b', padding: 0 }} />
                            <td
                              style={{
                                backgroundColor: '#e0f2f1',
                                padding: '3px 7px',
                                borderRadius: '0 4px 4px 0',
                              }}
                            >
                              <span style={{ fontSize: '10px', color: '#00796b', fontWeight: 700 }}>
                                ✦ Gravação:{' '}
                              </span>
                              <span style={{ fontSize: '10px', color: '#00796b', fontWeight: 500 }}>
                                {gravacao}
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    )}
                    {!gravacao && item.color && (
                      <span
                        style={{
                          display: 'block',
                          fontSize: '10px',
                          color: '#666',
                          marginTop: '2px',
                        }}
                      >
                        Cor: {item.color}
                      </span>
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
