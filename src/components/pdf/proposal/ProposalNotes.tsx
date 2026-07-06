/**
 * ProposalNotes — Termos de Aceite e observações livres.
 *
 * As 4 badges (Prazo Pagamento, Entrega, Frete, Validade) foram movidas
 * para `ProposalConditionsBadges` e são renderizadas ao lado do bloco de
 * totais, para aproveitamento de espaço horizontal na última página.
 */
import { type ProposalTemplateData } from '../ProposalHtmlTemplate';

export function ProposalNotes({ data }: { data: ProposalTemplateData }) {
  return (
    <div style={{ marginTop: '14px' }}>
      <div
        style={{
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          padding: '12px 16px',
          backgroundColor: '#fafafa',
        }}
      >
        {data.notes && (
          <div
            style={{
              fontSize: '9px',
              color: '#777',
              lineHeight: '1.5',
              marginBottom: '8px',
            }}
          >
            <div>- {data.notes}</div>
          </div>
        )}

        {/* Termos de Aceite */}
        <div>
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
