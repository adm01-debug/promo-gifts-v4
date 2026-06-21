/**
 * PropostaComercialTailwind — Template principal da proposta PDF (multi-página)
 *
 * FIX (2026-05):
 *  Bug #7 — itemIndex mutável em render substituído por startIndices[] pré-computado.
 *  Em React 18 StrictMode o componente renderiza 2x em desenvolvimento;
 *  a variável `let itemIndex` acumulava o dobro dos índices na segunda passagem,
 *  causando numeração errada das linhas na tabela do PDF.
 */
import { forwardRef } from 'react';
import type { ProposalTemplateData, ProposalItem } from './ProposalHtmlTemplate';
import { ProposalHeader } from './proposal/ProposalHeader';
import { ProposalClientBar } from './proposal/ProposalClientBar';
import { ProposalProductTable } from './proposal/ProposalProductTable';
import { ProposalTotals } from './proposal/ProposalTotals';
import { ProposalNotes } from './proposal/ProposalNotes';
import { ProposalSellerSignature } from './proposal/ProposalSellerSignature';
import { ProposalFooter } from './proposal/ProposalFooter';

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
        {data.client.cnpj ? ` — CNPJ: ${data.client.cnpj}` : ''}
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
const FIRST_HEADER_H = 128;
const CONT_HEADER_H = 60;
const CONT_CLIENT_H = 60; // compact client bar on continuation pages
const SIMPLE_FOOTER_H = 30; // page number + green bar only
const NOTES_FOOTER_H = 230; // notes block (conditions + terms) on every page
const CONTENT_PAD = 36;
const CLIENT_BAR_H = 90;
const TOTALS_H = 180;
const NOTES_H = 310; // condições comerciais + aceite do cliente + assinatura vendedor
const TABLE_HEADER_H = 38;
const ROW_H = 76; // estimated row height

function paginateItems(items: ProposalItem[]) {
  // Every page now has notes in footer, so we always reserve NOTES_FOOTER_H
  // Single page: header + client + table + totals + signature + notes + footer bar
  const singlePageAvailable =
    PAGE_H -
    FIRST_HEADER_H -
    CLIENT_BAR_H -
    TABLE_HEADER_H -
    TOTALS_H -
    NOTES_H -
    NOTES_FOOTER_H -
    SIMPLE_FOOTER_H -
    40;
  const singlePageRows = Math.max(0, Math.floor(singlePageAvailable / ROW_H));

  if (items.length <= singlePageRows && singlePageRows > 0) {
    return [items];
  }

  // Multi-page — every page reserves space for notes footer
  const pages: ProposalItem[][] = [];
  let remaining = [...items];

  // First page: products + notes footer + page bar (no totals/signature)
  const firstPageAvailable =
    PAGE_H - FIRST_HEADER_H - CLIENT_BAR_H - TABLE_HEADER_H - NOTES_FOOTER_H - SIMPLE_FOOTER_H - 30;
  const firstPageRows = Math.max(1, Math.floor(firstPageAvailable / ROW_H));

  const fpRows = Math.min(firstPageRows, remaining.length);
  pages.push(remaining.slice(0, fpRows));
  remaining = remaining.slice(fpRows);

  if (remaining.length === 0) {
    pages.push([]);
  }

  while (remaining.length > 0) {
    // Continuation pages: compact header + compact client + table + notes footer + page bar
    const contPageAvailable =
      PAGE_H -
      CONT_HEADER_H -
      CONT_CLIENT_H -
      TABLE_HEADER_H -
      NOTES_FOOTER_H -
      SIMPLE_FOOTER_H -
      30;
    const contPageRows = Math.floor(contPageAvailable / ROW_H);

    if (remaining.length <= contPageRows) {
      // Check if last page can also fit totals + signature
      const spaceNeeded =
        remaining.length * ROW_H +
        TABLE_HEADER_H +
        TOTALS_H +
        NOTES_H +
        NOTES_FOOTER_H +
        SIMPLE_FOOTER_H +
        CONT_HEADER_H +
        CONT_CLIENT_H +
        40;
      if (spaceNeeded <= PAGE_H) {
        pages.push(remaining);
        remaining = [];
      } else {
        const fitRows = Math.max(1, Math.floor(contPageAvailable / ROW_H));
        pages.push(remaining.slice(0, fitRows));
        remaining = remaining.slice(fitRows);
        if (remaining.length === 0) {
          pages.push([]);
        }
      }
    } else {
      pages.push(remaining.slice(0, contPageRows));
      remaining = remaining.slice(contPageRows);
    }
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
            {/* Watermark for drafts */}
            {isDraft && (
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%) rotate(-35deg)',
                  fontSize: '80px',
                  fontWeight: 900,
                  color: 'rgba(200, 0, 0, 0.07)',
                  letterSpacing: '0.3em',
                  textTransform: 'uppercase',
                  pointerEvents: 'none',
                  zIndex: 5,
                  userSelect: 'none',
                }}
              >
                RASCUNHO
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
                <>
                  <ProposalTotals data={data} />
                  <ProposalSellerSignature data={data} />
                </>
              )}

              {/* Commercial conditions on EVERY page */}
              <div style={{ marginTop: 'auto' }}>
                <ProposalNotes data={data} />
              </div>
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
          @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&family=Roboto:wght@300;400;500;700&family=Sacramento&display=swap');
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
