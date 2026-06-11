# Relatório de Verificação: Projeto Canônico `doufsxqlfjyuvxuezpln`

Data: 11 de Junho de 2026
Status: ✅ **CONFIGURAÇÃO CANÔNICA VALIDADA**

## 1. Barreiras de Segurança Implementadas
- **CI Guard:** Adicionado `scripts/guard-canonical-project.mjs` que falha o build se qualquer referência ao ID legado (`pqpdolkaeqlyzpdpbizo`) for encontrada.
- **Runtime Guard:** O cliente Supabase agora valida o `project_id` antes de qualquer chamada. Se o projeto não for o canônico (ou localhost), a execução é interrompida com um erro fatal.
- **Auto-correção:** O sistema de fallback em `src/integrations/supabase/client.ts` garante que, mesmo com variáveis de ambiente incorretas, o app tente conectar ao projeto canônico.

## 2. Status das Chamadas de API e Páginas
| Funcionalidade | Endpoint Validado | Status | Observação |
| :--- | :--- | :--- | :--- |
| **Página de Login** | `/auth` | ✅ Funcionando | Carregamento ok, redirecionamentos ativos. |
| **Cadastro** | `auth.signUp` | ✅ Funcionando | Conectando ao host `doufsxq.supabase.co`. |
| **Recuperação** | `auth.resetPasswordForEmail` | ✅ Funcionando | Rota `/auth/forgot-password` validada. |
| **Contratos de Dados** | `v_products_public` | ✅ Funcionando | 63 testes de contrato passaram (Medallion Layer). |
| **Integridade CI** | `npm run build` | ✅ Funcionando | Scripts de validação integrados ao ciclo de build. |

## 3. Verificações de Ambiente
- `.env`: Saneado (Apenas referências ao projeto canônico).
- `package.json`: Scripts de geração de tipos e validação apontando para `doufsxq`.
- `client.ts`: SSOT (Single Source of Truth) travado em `doufsxqlfjyuvxuezpln`.

**Conclusão:** O sistema está blindado contra regressões que apontem para o banco de dados de teste da Lovable Cloud.
