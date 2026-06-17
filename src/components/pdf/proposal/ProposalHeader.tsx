import type { ProposalTemplateData } from '../ProposalHtmlTemplate';
import { LogoWithTransparentBg } from './LogoWithTransparentBg';

interface Props {
  data: ProposalTemplateData;
  isContinuation?: boolean;
  // quoteNumber prop removido — sempre lido de data.quoteNumber (era dead prop)
}

export function ProposalHeader({ data, isContinuation }: Props) {
  const quoteNumber = (data.quoteNumber ?? '').replace(/\s+/g, '');
  if (isContinuation) {
    return (
      <div style={{ width: '794px', height: '64px', flexShrink: 0, position: 'relative' }}>
        <svg
          width="794"
          height="64"
          viewBox="0 0 794 64"
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          <rect x="0" y="0" width="794" height="64" fill="#000000" />
          <rect x="0" y="58" width="794" height="6" fill="#00c853" />
        </svg>
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0 36px',
            height: '64px',
          }}
        >
          <LogoWithTransparentBg
            src="/images/promo-brindes-logo-v2.png"
            alt="Promo Brindes"
            style={{ height: '30px', display: 'block' }}
          />
          <div
            style={{
              textAlign: 'right',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <span
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 600,
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                opacity: 0.6,
              }}
            >
              Continuação
            </span>
            <span
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 700,
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0px',
                whiteSpace: 'nowrap',
              }}
            >
              Proposta&nbsp;{quoteNumber}
            </span>
            <span style={{ fontSize: '11px', opacity: 0.6, whiteSpace: 'nowrap' }}>
              {data.date}
            </span>
          </div>
        </div>
      </div>
    );
  }

  const H = 128;
  const W = 794;
  const barH = 7;
  const darkStart = 380;
  const greenStart = 350;
  const darkEnd = 430;
  const greenEnd = 400;

  return (
    <div style={{ position: 'relative', width: `${W}px`, height: `${H}px`, flexShrink: 0 }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        <rect x="0" y="0" width={W} height={H} fill="#ffffff" />
        <polygon points={`${darkStart},0 ${W},0 ${W},${H} ${darkEnd},${H}`} fill="#000000" />
        <polygon
          points={`${greenStart},0 ${darkStart},0 ${darkEnd},${H} ${greenEnd},${H}`}
          fill="#00c853"
        />
        <rect x="0" y={H - barH} width={W} height={barH} fill="#00c853" />
      </svg>

      <div
        style={{
          position: 'absolute',
          zIndex: 10,
          top: '0',
          left: '50px',
          bottom: `${barH}px`,
          width: '234px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '10px 14px',
        }}
      >
        <LogoWithTransparentBg
          src="/images/promo-brindes-logo-v2.png"
          alt="Promo Brindes"
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          zIndex: 10,
          textAlign: 'right',
          color: '#ffffff',
          top: '0',
          bottom: '0',
          right: '32px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-end',
        }}
      >
        <p
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 900,
            fontSize: '20px',
            textTransform: 'uppercase',
            letterSpacing: '3px',
            margin: '0 0 6px 0',
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}
        >
          Proposta Comercial
        </p>
        <p
          style={{
            fontSize: '13px',
            opacity: 0.95,
            fontWeight: 400,
            lineHeight: '1.7',
            margin: 0,
            fontVariantNumeric: 'tabular-nums',
            fontFamily: "'Montserrat', sans-serif",
            whiteSpace: 'nowrap',
            letterSpacing: '0px',
          }}
        >
          Proposta&nbsp;{quoteNumber}
        </p>
        <p
          style={{
            fontSize: '13px',
            opacity: 0.85,
            margin: '0 0 6px 0',
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 400,
          }}
        >
          {data.date}
        </p>
        <p
          style={{
            fontSize: '12px',
            opacity: 0.7,
            margin: 0,
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 400,
            whiteSpace: 'nowrap',
          }}
        >
          (11) 4637-5517 &nbsp;|&nbsp; www.promobrindes.com.br
        </p>
      </div>
    </div>
  );
}
