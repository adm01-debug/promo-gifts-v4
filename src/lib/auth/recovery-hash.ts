/**
 * Captura — no boot da aplicação, de forma SÍNCRONA e o mais cedo possível —
 * se a URL trazia um token de recuperação de senha no hash
 * (`#access_token=...&type=recovery`).
 *
 * Por quê aqui (e não na página): o cliente Supabase é criado com
 * `detectSessionInUrl: true`, que processa e LIMPA o hash de forma assíncrona
 * logo no início. A página `/reset-password` é lazy-loaded, então seu módulo
 * pode ser avaliado DEPOIS de o Supabase já ter removido o hash — perdendo o
 * token e exibindo "link inválido" mesmo para um acesso legítimo.
 *
 * Este módulo é importado de forma eager no topo de `main.tsx`, fazendo a
 * leitura síncrona durante o grafo de import inicial — antes de qualquer tick
 * assíncrono em que o Supabase faria a limpeza. Determinístico.
 */
function detectRecoveryHash(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.hash.substring(1));
    return !!params.get('access_token') && params.get('type') === 'recovery';
  } catch {
    return false;
  }
}

export const HAD_RECOVERY_HASH_AT_BOOT = detectRecoveryHash();
