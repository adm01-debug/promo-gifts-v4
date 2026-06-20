/**
 * Utilitário compartilhado para geração de hashes de segurança ofuscadas.
 * Utilizado para identificar erros de acesso (401/403) sem expor caminhos reais.
 */

/**
 * Gera uma hash curta e não reversível (baseada em algorithm de 32 bits)
 * para ofuscar caminhos de rota ou identificadores técnicos.
 */
export function generateSecurityHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash &= hash; // Converte para inteiro de 32 bits
  }
  // Retorna hash curta em base36 (alfanumérico) e maiúsculas
  return Math.abs(hash).toString(36).substring(0, 6).toUpperCase();
}

/**
 * Gera um identificador completo com prefixo para exibição na UI.
 */
export function generateSecurityId(prefix: 'REQ' | 'AUTH', path: string): string {
  return `${prefix}-${generateSecurityHash(path)}`;
}
