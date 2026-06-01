/**
 * Normaliza um sufixo mascarado para EXATAMENTE 4 caracteres.
 *
 * Regras:
 * - `null` / `undefined` / vazio → "????" (placeholder neutro)
 * - <4 chars → preenche à esquerda com "•" (ex: "ab" → "••ab")
 * - >4 chars → mantém apenas os últimos 4 (ex: "abcdef" → "cdef")
 * - exatamente 4 → retorna como está
 *
 * Use sempre que renderizar `••••${suffix}` para garantir alinhamento
 * visual e evitar colisões com sufixos curtos vindos de credenciais
 * pequenas ou registros legados.
 */
export function normalizeMaskedSuffix(raw: string | null | undefined): string {
  if (!raw) return '????';
  const trimmed = raw.trim();
  if (trimmed.length === 4) return trimmed;
  if (trimmed.length > 4) return trimmed.slice(-4);
  return trimmed.padStart(4, '•');
}

/** Retorna o sufixo já formatado com o prefixo "••••" pronto para exibição. */
export function formatMaskedSuffix(raw: string | null | undefined): string {
  return `••••${normalizeMaskedSuffix(raw)}`;
}

/**
 * Diagnóstico do sufixo para a UI: indica se está válido, ausente ou curto,
 * e fornece uma mensagem orientando o que o usuário deve fazer.
 *
 * - `valid`: sufixo presente com >=4 caracteres significativos.
 * - `missing`: sufixo nulo/vazio — provável credencial vinda do .env (legado)
 *   ou registro corrompido; precisa ser re-salvo via "Atualizar credencial".
 * - `short`: sufixo presente mas com <4 chars — credencial muito curta ou
 *   truncada; recomenda-se re-salvar com um valor mais robusto.
 */
export type MaskedSuffixStatus = 'valid' | 'missing' | 'short';

export interface MaskedSuffixDiagnosis {
  status: MaskedSuffixStatus;
  /** Comprimento real do sufixo (sem padding de •) */
  realLength: number;
  /** Mensagem curta (chip/badge) */
  label: string;
  /** Mensagem detalhada (tooltip/aria-description) com ação sugerida */
  message: string;
}

export function diagnoseMaskedSuffix(
  raw: string | null | undefined,
  opts: { secretName?: string } = {},
): MaskedSuffixDiagnosis {
  const trimmed = (raw ?? '').trim();
  const realLength = trimmed.length;
  const who = opts.secretName ? ` "${opts.secretName}"` : '';
  if (realLength === 0) {
    return {
      status: 'missing',
      realLength: 0,
      label: 'Sufixo ausente',
      message:
        `O sufixo da credencial${who} não foi registrado. ` +
        `Isso costuma acontecer com credenciais antigas vindas do .env. ` +
        `Clique em "Atualizar credencial" e cole o valor novamente para regenerar o sufixo.`,
    };
  }
  if (realLength < 4) {
    const noun = realLength === 1 ? 'caractere' : 'caracteres';
    return {
      status: 'short',
      realLength,
      label: `Sufixo curto (${realLength}/4)`,
      message:
        `O sufixo registrado para${who} tem apenas ${realLength} ${noun} — ` +
        `o esperado é 4. Provavelmente a credencial é muito curta ou foi truncada. ` +
        `Re-salve a credencial com um valor mais robusto para evitar colisões na auditoria.`,
    };
  }
  return {
    status: 'valid',
    realLength,
    label: 'Sufixo OK',
    message: `Sufixo de 4 caracteres registrado corretamente.`,
  };
}

/**
 * Resolve um sufixo "exibível" mesmo quando o `masked_suffix` está inválido.
 *
 * Estratégia em camadas (primeira que satisfizer vence):
 *   1. Se o sufixo cru tem 4 chars válidos → usa-o.
 *   2. Se o sufixo cru tem 1-3 chars → padding com "•" à esquerda (preserva
 *      a informação real disponível, ex: "ab" → "••ab").
 *   3. Se há `length` conhecido (>0) → mostra um placeholder informativo
 *      com a contagem (ex: "L=12" indicando "credencial de 12 chars, sufixo
 *      desconhecido"). Garante que NUNCA quebra o layout (sempre 4 chars
 *      visíveis no espaço reservado para o sufixo).
 *   4. Caso contrário → "????" (sem nenhuma informação derivável).
 *
 * Retorna sempre uma string com EXATAMENTE 4 caracteres.
 */
export function resolveDisplaySuffix(
  raw: string | null | undefined,
  opts: { length?: number | null } = {},
): string {
  const trimmed = (raw ?? '').trim();
  if (trimmed.length >= 4) return trimmed.slice(-4);
  if (trimmed.length > 0) return trimmed.padStart(4, '•');
  // Fallback derivado: tenta refletir a presença da credencial via length.
  const len = opts.length ?? 0;
  if (len > 0) {
    // Formata como "L=NN" mantendo 4 chars: "L=NN" (4) ou "L=N " (4) com
    // espaço/zero-pad. Para tamanhos >=100, abrevia: "L99+".
    if (len < 10) return `L=0${len}`;
    if (len < 100) return `L=${len}`;
    return 'L99+';
  }
  return '????';
}

/**
 * Versão "rica" do `formatMaskedSuffix` que usa fallback derivado quando o
 * sufixo está ausente/curto. Sempre devolve `••••XXXX` (8 chars) para preservar
 * o layout do componente que renderiza o badge.
 */
export function formatDisplaySuffix(
  raw: string | null | undefined,
  opts: { length?: number | null } = {},
): string {
  return `••••${resolveDisplaySuffix(raw, opts)}`;
}
