/**
 * safeReturn — Parser seguro do parâmetro `?returnTo` da galeria de templates.
 *
 * Objetivo: aceitar EXCLUSIVAMENTE URLs internas no formato `/magazine/:id`
 * (com id que pareça UUID/slug razoável) e rejeitar tudo que possa levar
 * a open-redirect (`//evil.com`, `https://…`, `javascript:`, `\\evil`, etc.).
 *
 * Retorna `null` para qualquer entrada inválida — o consumidor deve
 * tratar isso como "sem returnTo" e seguir o fluxo default.
 */

export interface ParsedReturn {
  path: string; // sempre no formato `/magazine/<magazineId>`
  magazineId: string;
}

// Ids aceitos: UUID v4 completo OU slug alfanumérico com hífen/underscore
// entre 6 e 64 chars. Cobre os ids reais do módulo Magazine.
const ID_RE = /^[A-Za-z0-9_-]{6,64}$/;

/**
 * Rejeita qualquer input que possa escapar do path interno.
 * Regras cumulativas — se qualquer uma bater, retorna null.
 */
export function parseReturnTo(raw: string | null | undefined): ParsedReturn | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 200) return null;

  // Blacklist explícita: nada de scheme, protocol-relative, backslash, ou controle.
  if (
    trimmed.startsWith('//') ||
    trimmed.startsWith('\\') ||
    trimmed.includes('://') ||
    trimmed.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(trimmed) || // eslint-disable-line no-control-regex
    /^[a-z][a-z0-9+.-]*:/i.test(trimmed) // scheme:...
  ) {
    return null;
  }

  // Só aceita path absoluto começando com /magazine/
  if (!trimmed.startsWith('/magazine/')) return null;

  // Separa path do querystring/hash (descarta ambos por segurança)
  const pathOnly = trimmed.split(/[?#]/, 1)[0];

  // Estrutura estrita: exatamente `/magazine/<id>` (sem barras extras)
  const parts = pathOnly.split('/');
  // ["", "magazine", "<id>"]
  if (parts.length !== 3) return null;
  if (parts[0] !== '' || parts[1] !== 'magazine') return null;

  const magazineId = parts[2];
  if (!ID_RE.test(magazineId)) return null;

  return { path: `/magazine/${magazineId}`, magazineId };
}
