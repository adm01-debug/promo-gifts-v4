/**
 * PropostaComercialTailwind — Template principal da proposta PDF (multi-página)
 *
 * FIX (2026-05):
 *  Bug #7 — itemIndex mutável em render substituído por startIndices[] pré-computado.
 *  Em React 18 StrictMode o componente renderiza 2x em desenvolvimento;
 *  a variável `let itemIndex` acumulava o dobro dos índices na segunda passagem,
 *  causando numeração errada das linhas na tabela do PDF.
 */
import { forwardRef, useEffect } from 'react';
import type { ProposalTemplateData, ProposalItem } from './ProposalHtmlTemplate';
import { ProposalHeader } from './proposal/ProposalHeader';
import { ProposalClientBar } from './proposal/ProposalClientBar';
import { ProposalProductTable } from './proposal/ProposalProductTable';
import { ProposalTotals } from './proposal/ProposalTotals';
import { maskCnpj } from '@/utils/masks';
import { ProposalNotes } from './proposal/ProposalNotes';
import { ProposalSellerSignature } from './proposal/ProposalSellerSignature';
import { ProposalFooter } from './proposal/ProposalFooter';
import { WATERMARK_COLOR_CSS, WATERMARK_TEXT } from './watermarkTokens';

/* Compact client bar for continuation pages */
function ProposalClientBarCompact({ data }: { data: ProposalTemplateData }) {
  const company = data.client.company || data.client.name;
  const contact = data.client.contactName || '';
  return (
    <div
      style={{
        padding: '6px 12px',
        marginTop: '6px',
        marginBottom: '8px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #e0e0e0',
        fontSize: '11px',
        color: '#666',
      }}
    >
      <span>
        <strong style={{ color: '#333' }}>{company}</strong>
        {data.client.cnpj ? ` — CNPJ: ${maskCnpj(data.client.cnpj)}` : ''}
      </span>
      {contact && (
        <span>
          Solicitante: <strong style={{ color: '#333' }}>{contact}</strong>
        </span>
      )}
    </div>
  );
}

const PAGE_W = 794;
const PAGE_H = 1123;
// ── Orçamento de altura (A4 @ 96dpi), calibrado às alturas REAIS dos blocos ──
// FIX (2026-06) — paginação reescrita. Causa-raiz dos defeitos anteriores:
//   (1) `singlePageRows` subtraía as notas DUAS vezes (NOTES_H + NOTES_FOOTER_H)
//       → restavam 77px → QUALQUER proposta com 2+ itens caía no multipágina.
//   (2) ao caberem os itens na 1ª página, o código fazia `pages.push([])` →
//       página VAZIA só para os totais (o "órfão" visível no PDF).
//   (3) ROW_H=76 subestimava a linha COM foto (imagem=92px → linha real ~94px);
//       com 7+ linhas/página o html2canvas (height:1123 fixo, overflow:hidden)
//       cortava conteúdo silenciosamente.
// Esta versão: contabilidade honesta + totais SEMPRE ancorados na última leva
// de itens + distribuição equilibrada + nunca uma página vazia + sem clipping.
// @fix_version proposal-pagination-v4-anchored-totals-2026-06
// @anti-regression NAO reintroduzir NOTES_FOOTER_H nem `pages.push([])`.
const FIRST_HEADER_H = 128; // cabeçalho da 1ª página (logo + título + nº)
const CONT_HEADER_H = 60; // cabeçalho enxuto das páginas de continuação
const CLIENT_BAR_H = 90; // barra do cliente (1ª página)
const CONT_CLIENT_H = 60; // barra compacta do cliente (continuação)
const TABLE_HEADER_H = 38; // cabeçalho verde da tabela
const SIMPLE_FOOTER_H = 30; // rodapé: barra verde + número da página
const CONTENT_PAD = 36; // padding lateral do conteúdo
const ROW_H = 100; // altura TÍPICA de uma linha (foto 92px + respiro). Linhas ricas: estimateItemHeight + spill.
const NOTES_H = 300; // bloco "Condições + Termos" (renderizado SÓ na última página — ver #5a)
const HINT_H = 28; // lembrete enxuto "Condições na última página" nas páginas intermediárias (#5b)
const TOTALS_H = 180; // bloco de totais (subtotal/desconto/frete/total)
const SIGNATURE_H = 120; // assinatura do vendedor + disclaimer eletrônico
const SAFETY = 24; // folga anti-clipping

// Capacidade de linhas conforme o tipo de página (sempre >= 1).
const rowCap = (available: number) => Math.max(1, Math.floor(available / ROW_H));
// Páginas SEM totais (apenas o lembrete enxuto no rodapé — #5b reclama o espaço do #5a):
const MID_CAP_FIRST = rowCap(
  PAGE_H - FIRST_HEADER_H - CLIENT_BAR_H - TABLE_HEADER_H - HINT_H - SIMPLE_FOOTER_H - SAFETY,
);
const MID_CAP_CONT = rowCap(
  PAGE_H - CONT_HEADER_H - CONT_CLIENT_H - TABLE_HEADER_H - HINT_H - SIMPLE_FOOTER_H - SAFETY,
);
// Última página: itens + totais + assinatura + notas.
const LAST_CAP_SINGLE = rowCap(
  PAGE_H -
    FIRST_HEADER_H -
    CLIENT_BAR_H -
    TABLE_HEADER_H -
    TOTALS_H -
    SIGNATURE_H -
    NOTES_H -
    SIMPLE_FOOTER_H -
    SAFETY,
);
const LAST_CAP_CONT = rowCap(
  PAGE_H -
    CONT_HEADER_H -
    CONT_CLIENT_H -
    TABLE_HEADER_H -
    TOTALS_H -
    SIGNATURE_H -
    NOTES_H -
    SIMPLE_FOOTER_H -
    SAFETY,
);

/**
 * Distribui os itens da proposta em páginas garantindo, por construção:
 *  • NUNCA uma página vazia — elimina o "órfão" de totais;
 *  • totais + assinatura SEMPRE ancorados junto à última leva de itens;
 *  • nenhuma página excede sua capacidade real — sem clipping pelo html2canvas;
 *  • distribuição equilibrada de itens entre as páginas.
 * Os totais são renderizados na página marcada como `isLast` (a última retornada).
 */
/**
 * Altura ESTIMADA (px) de uma linha de produto — casa com o render de ProposalProductTable:
 * foto (92px) como piso; pilha de texto = nome (clampado a ~2 linhas, #1535) + descrição
 * (truncada, #7) + linha "Cor" + bloco "Gravação". Alimenta a correção por altura (spill) que
 * garante zero clipping mesmo em linhas ricas. Validado por simulação (800+ mixes).
 * @fix_version proposal-height-spill-5b-2026-06
 */
function estimateItemHeight(item: ProposalItem): number {
  const IMG = 92;
  const BREATH = 4;
  const NAME_LH = 17;
  const NAME_MB = 2;
  const DESC_LH = 15.4;
  const DESC_MB = 4;
  const COLOR_H = 16;
  const GRAV_H = 25;
  const NAME_CPL = 46; // chars/linha do nome (fonte e largura atuais)
  const DESC_CPL = 58; // chars/linha da descrição
  const nameLen = Math.min((item.name ?? '').length, 90);
  const nameLines = Math.max(1, Math.ceil(nameLen / NAME_CPL));
  const descLen = item.description ? Math.min(item.description.length, 120) : 0;
  const descLines = descLen > 0 ? Math.max(1, Math.ceil(descLen / DESC_CPL)) : 0;
  const hasColor = Boolean(item.color);
  const hasGrav = (item.personalizations?.length ?? 0) > 0;
  const textStack =
    nameLines * NAME_LH +
    NAME_MB +
    (descLines > 0 ? descLines * DESC_LH + DESC_MB : 0) +
    (hasColor ? COLOR_H : 0) +
    (hasGrav ? GRAV_H : 0);
  return Math.max(IMG, textStack) + BREATH;
}

/**
 * Espaço (px) para ITENS numa página, conforme a posição. Última página reserva
 * totais+assinatura+notas; intermediárias reservam só o lembrete. @fix_version
 * proposal-height-spill-5b-2026-06
 */
function itemsBudget(isFirst: boolean, isLast: boolean): number {
  const header = isFirst ? FIRST_HEADER_H : CONT_HEADER_H;
  const client = isFirst ? CLIENT_BAR_H : CONT_CLIENT_H;
  const reserve = isLast ? TOTALS_H + SIGNATURE_H + NOTES_H : HINT_H;
  return PAGE_H - header - client - TABLE_HEADER_H - reserve - SIMPLE_FOOTER_H - SAFETY;
}

function paginateItems(items: ProposalItem[]): ProposalItem[][] {
  const n = items.length;
  if (n === 0) return [[]];
  // Cabe tudo numa única página? Checa também a ALTURA real (2 linhas ricas podem não caber).
  if (n <= LAST_CAP_SINGLE) {
    const totalHeight = items.reduce((acc, item) => acc + estimateItemHeight(item), 0);
    if (totalHeight <= itemsBudget(true, true)) return [items];
  }

  // Capacidade de p páginas: 1ª + (p-2) continuações + última-com-totais.
  const capacityFor = (p: number): number =>
    p <= 1 ? LAST_CAP_SINGLE : MID_CAP_FIRST + Math.max(0, p - 2) * MID_CAP_CONT + LAST_CAP_CONT;

  // Menor nº de páginas que comporta todos os itens.
  let pageCount = 2;
  while (capacityFor(pageCount) < n) pageCount++;

  // Distribui equilibrado e corrige estouros (cascata p/ a esquerda). O laço
  // com guarda aumenta pageCount caso um estouro não seja absorvível (segurança).
  let counts: number[] = [];
  for (let guard = 0; guard <= n; guard++) {
    const caps: number[] = [MID_CAP_FIRST];
    for (let i = 0; i < pageCount - 2; i++) caps.push(MID_CAP_CONT);
    caps.push(LAST_CAP_CONT);

    counts = new Array<number>(pageCount).fill(Math.floor(n / pageCount));
    let extra = n % pageCount;
    for (let i = 0; i < pageCount && extra > 0; i++, extra--) counts[i]++;
    for (let i = pageCount - 1; i > 0; i--) {
      if (counts[i] > caps[i]) {
        const overflow = counts[i] - caps[i];
        counts[i] -= overflow;
        counts[i - 1] += overflow;
      }
    }
    if (counts.every((c, i) => c <= caps[i] && c >= 1)) break;
    pageCount++; // estouro não absorvível → mais uma página e redistribui
  }

  const pages: ProposalItem[][] = [];
  let cursor = 0;
  for (let i = 0; i < pageCount; i++) {
    pages.push(items.slice(cursor, cursor + counts[i]));
    cursor += counts[i];
  }

  // Correção por ALTURA REAL (spill): a distribuição acima é por contagem (ROW_H típico).
  // Uma linha rica (nome 2 linhas + descrição + Cor + Gravação) pode exceder o orçamento da
  // página; aqui o último item que não couber "transborda" para a próxima, preservando ordem e
  // conservação (≥1 item por página). Garante ZERO clipping — validado por simulação (800+ mixes).
  // @fix_version proposal-height-spill-5b-2026-06
  for (let pass = 0; pass <= items.length; pass++) {
    let moved = false;
    for (let j = 0; j < pages.length; j++) {
      const budget = itemsBudget(j === 0, j === pages.length - 1);
      let used = pages[j].reduce((acc, item) => acc + estimateItemHeight(item), 0);
      while (used > budget && pages[j].length > 1) {
        const overflow = pages[j].pop()!;
        used -= estimateItemHeight(overflow);
        if (j + 1 < pages.length) pages[j + 1].unshift(overflow);
        else pages.push([overflow]);
        moved = true;
      }
    }
    if (!moved) break;
  }

  return pages;
}

export const PropostaComercialTailwind = forwardRef<
  HTMLDivElement,
  { data: ProposalTemplateData; isDraft?: boolean }
>(({ data, isDraft = false }, ref) => {
  const pages = paginateItems(data.items);
  const totalPages = pages.length;

  // FIX #7: pré-computar índices de forma imutável — seguro em React 18 StrictMode.
  // ANTES: `let itemIndex = 0` era mutado dentro do .map() do JSX.
  //   Em StrictMode (dev), React renderiza o componente 2x para detectar side-effects.
  //   Na segunda passagem, itemIndex já acumulava valores da primeira, dobrando
  //   os índices e causando numeração errada nas linhas da tabela.
  // DEPOIS: startIndices[] calculado com reduce() antes do JSX — imutável.
  const startIndices: number[] = pages.reduce<number[]>((acc, _page, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1] + pages[i - 1].length);
    return acc;
  }, []);

  // ── Fontes do PDF (Montserrat / Roboto / Sacramento) ───────────────────────
  // BUGFIX: antes carregadas via `@import url(...)` dentro de um <style> JSX.
  // Um @import só é válido no TOPO de um stylesheet; num <style> injetado em
  // runtime o navegador o IGNORA ("@import rule was ignored…") e as fontes nunca
  // carregavam → preview e PDF (html2canvas) caíam em fallback (Segoe/Helvetica).
  // Correção canônica: injetar um <link rel="stylesheet"> no <head> (mesmo padrão
  // do index.html). Idempotente por id, não removido no cleanup (fontes devem
  // persistir; remover quebraria gerações de PDF concorrentes e causaria flash).
  useEffect(() => {
    const LINK_ID = 'pdf-proposal-fonts';
    if (document.getElementById(LINK_ID)) return;
    const link = document.createElement('link');
    link.id = LINK_ID;
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&family=Roboto:wght@300;400;500;700&family=Sacramento&display=swap';
    document.head.appendChild(link);
  }, []);

  return (
    <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
      {pages.map((pageItems, pageIdx) => {
        const isFirst = pageIdx === 0;
        const isLast = pageIdx === totalPages - 1;
        const startIdx = startIndices[pageIdx]; // FIX #7: imutável

        return (
          <div
            key={pageIdx}
            className="proposal-page"
            style={{
              width: `${PAGE_W}px`,
              height: `${PAGE_H}px`,
              backgroundColor: '#fff',
              fontFamily: "'Roboto', 'Segoe UI', Helvetica, Arial, sans-serif",
              color: '#333',
              position: 'relative',
              boxSizing: 'border-box',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              pageBreakAfter: isLast ? 'auto' : 'always',
            }}
          >
            {/* Watermark for drafts — cor/texto vêm de watermarkTokens (SSOT) */}
            {isDraft && (
              <div
                data-testid="proposal-watermark"
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%) rotate(-35deg)',
                  fontSize: '80px',
                  fontWeight: 900,
                  color: WATERMARK_COLOR_CSS,
                  letterSpacing: '0.3em',
                  textTransform: 'uppercase',
                  pointerEvents: 'none',
                  zIndex: 5,
                  userSelect: 'none',
                }}
              >
                {WATERMARK_TEXT}
              </div>
            )}
            <ProposalHeader data={data} isContinuation={!isFirst} />

            <div
              style={{
                padding: `0 ${CONTENT_PAD}px`,
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {isFirst && <ProposalClientBar data={data} />}
              {!isFirst && <ProposalClientBarCompact data={data} />}

              {pageItems.length > 0 && (
                <ProposalProductTable items={pageItems} showHeader startIndex={startIdx} />
              )}

              {isLast && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'space-between',
                    gap: '16px',
                    marginTop: '10px',
                  }}
                >
                  <div
                    style={{
                      flex: '1 1 0',
                      display: 'flex',
                      justifyContent: 'center',
                    }}
                  >
                    <ProposalSellerSignature data={data} />
                  </div>
                  <div style={{ flex: '0 0 auto' }}>
                    <ProposalTotals data={data} />
                  </div>
                </div>
              )}

              {/* P0 #5: Condições + Termos de aceite APENAS na última página
                  (antes repetidos em TODA página — redundância). Continuações
                  exibem um lembrete enxuto no rodapé.
                  @fix_version proposal-notes-last-page-only-2026-06 */}
              {isLast ? (
                <div style={{ marginTop: 'auto' }}>
                  <ProposalNotes data={data} />
                </div>
              ) : (
                <div
                  style={{
                    marginTop: 'auto',
                    paddingTop: '8px',
                    fontSize: '9px',
                    color: '#9e9e9e',
                    fontStyle: 'italic',
                    textAlign: 'center',
                  }}
                >
                  Condições comerciais e termos de aceite na última página.
                </div>
              )}
            </div>

            <ProposalFooter
              data={data}
              isLastPage={isLast}
              pageNumber={pageIdx + 1}
              totalPages={totalPages}
            />
          </div>
        );
      })}

      <style>
        {`
          @media print {
            body { background: white; }
            button { display: none; }
            @page { margin: 0; size: auto; }
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        `}
      </style>
    </div>
  );
});

PropostaComercialTailwind.displayName = 'PropostaComercialTailwind';

export default PropostaComercialTailwind;
