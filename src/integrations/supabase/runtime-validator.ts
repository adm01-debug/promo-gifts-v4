import { SUPABASE_URL } from './client';

const CANONICAL_PROJECT_ID = 'doufsxqlfjyuvxuezpln';

/**
 * Valida em runtime se a configuração do Supabase aponta para o projeto correto.
 * Lança um erro fatal se houver inconsistência para evitar vazamento de dados 
 * ou erros de autenticação silenciosos entre ambientes.
 */
export const validateSupabaseConfig = () => {
  const currentUrl = SUPABASE_URL;
  const isLocal = currentUrl.includes('localhost') || currentUrl.includes('127.0.0.1');
  const isPlaceholder = currentUrl.includes('placeholder');
  
  if (isLocal || isPlaceholder) return;

  if (!currentUrl.includes(CANONICAL_PROJECT_ID)) {
    const errorMsg = `CRITICAL CONFIG ERROR: Supabase URL points to an unauthorized project. 
    Current: ${currentUrl}
    Expected project: ${CANONICAL_PROJECT_ID}`;
    
    console.error(errorMsg);
    
    // Em produção, queremos que o app falhe visivelmente se a config estiver errada
    if (import.meta.env.PROD) {
      throw new Error(errorMsg);
    }
  }
};
