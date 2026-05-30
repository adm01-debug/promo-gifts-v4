/**
 * Módulo de sanitização de inputs — promo-gifts-v4
 *
 * Fornece funções reutilizáveis para validação e sanitização de dados
 * antes de enviá-los para APIs, banco de dados ou renderização no DOM.
 *
 * 🔴 5 PIORES CASOS DE INPUTS NÃO SANITIZADOS ENCONTRADOS NO CÓDIGO:
 *
 * CASE 1: src/services/productService.ts — fetchProducts()
 *   `filters?.search` (string do usuário) passado direto para `fetchPromobrindProducts()`
 *   sem trim, sem validação de comprimento máximo, sem escape.
 *   RISCO: Injection em query parameters da edge function.
 *
 * CASE 2: src/hooks/auth/usePasswordResetRequests.ts — createRequest(email)
 *   `email` usado sem trim/lowercase/validação de formato antes do Supabase.
 *   RISCO: Emails malformados ou maliciosos inseridos no banco.
 *
 * CASE 3: src/services/materialService.ts — search(searchTerm)
 *   `searchTerm` do usuário passado direto para edge function sem sanitização.
 *   RISCO: Caracteres especiais podem quebrar queries SQL na edge function.
 *
 * CASE 4: src/services/ramoAtividadeService.ts — múltiplos métodos
 *   `id`, `produtoId`, `segmentoId` passados como strings sem validar formato UUID.
 *   RISCO: SQL injection se a edge function não sanitizar corretamente.
 *
 * CASE 5: src/components/search/ — busca global
 *   Query string do usuário enviada sem length limit, sem trim.
 *   RISCO: Denial of service com queries extremamente longas.
 */

// ============================================================================
// HTML Sanitization
// ============================================================================

/**
 * Remove todas as tags HTML de uma string.
 * Usa regex simples — para casos complexos (rich text), use DOMPurify.
 */
export function sanitizeHtml(input: string): string {
  if (!input) return '';
  return input.replace(/<[^>]*>/g, '');
}

// ============================================================================
// SQL Identifier Sanitization
// ============================================================================

/**
 * Remove caracteres perigosos para identificadores SQL.
 * NÃO torna o input seguro para SQL — apenas reduz risco de injection básico.
 * Use parâmetros prepared statements no backend sempre que possível.
 */
export function sanitizeSqlIdentifier(input: string): string {
  if (!input) return '';
  return input
    .replace(/'/g, '')    // single quotes
    .replace(/"/g, '')    // double quotes
    .replace(/;/g, '')    // semicolons (statement terminators)
    .replace(/\\/g, '')   // backslashes (escape sequences)
    .replace(/--/g, '')   // SQL line comments
    .replace(/\/\*/g, '') // block comment open
    .replace(/\*\//g, ''); // block comment close
}

// ============================================================================
// Email Validation
// ============================================================================

/**
 * Valida formato de email (RFC 5322 simplificado).
 * Retorna true se o formato é válido.
 */
export function isValidEmail(email: string): boolean {
  if (!email) return false;
  // RFC 5322 simplified: local@domain.tld
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  return emailRegex.test(email.trim());
}

/**
 * Sanitiza um email: trim + lowercase + valida formato.
 * Retorna o email sanitizado ou null se inválido.
 */
export function sanitizeEmail(email: string): string | null {
  if (!email) return null;
  const sanitized = email.trim().toLowerCase();
  return isValidEmail(sanitized) ? sanitized : null;
}

// ============================================================================
// URL Validation
// ============================================================================

/**
 * Valida se uma string é uma URL HTTP(S) válida.
 */
export function isValidUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// ============================================================================
// General String Sanitization
// ============================================================================

/**
 * Trunca uma string a um comprimento máximo e remove whitespace extra.
 * Útil para prevenir DoS com inputs extremamente longos.
 */
export function sanitizeString(input: string, maxLength = 500): string {
  if (!input) return '';
  return input.trim().slice(0, maxLength);
}

/**
 * Verifica se uma string parece um UUID v4 válido.
 */
export function looksLikeUuid(input: string): boolean {
  if (!input) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(input);
}