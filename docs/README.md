# 📚 Documentação do Gifts Store

> Sistema de Catálogo de Brindes Promocionais  
> **Idioma:** Português do Brasil 🇧🇷  
> **Última atualização:** 27/12/2025

---

## 📋 Índice de Documentação

### 🎯 **Documentação Essencial**

1. **[POLITICA_IDIOMA_PT_BR.md](./POLITICA_IDIOMA_PT_BR.md)** 🔴  
   **Política definitiva de idioma** - LEITURA OBRIGATÓRIA  
   - Sistema é **exclusivamente pt-BR**
   - Proibições absolutas (i18n, multi-idioma)
   - Regras obrigatórias de desenvolvimento
   - Justificativa técnica e de negócio

2. **[ANALISE_EXAUSTIVA_GIFTS_STORE.md](./ANALISE_EXAUSTIVA_GIFTS_STORE.md)** 📊  
   **Análise completa do projeto** (67 KB)
   - Arquitetura técnica detalhada
   - Stack tecnológico
   - Estrutura de pastas e componentes
   - Roadmap 2025-2027 (Q1-Q4)
   - Melhorias priorizadas
   - Métricas de qualidade

3. **[MELHORIAS_PENDENTES_PLANO_IMPLEMENTACAO.md](./MELHORIAS_PENDENTES_PLANO_IMPLEMENTACAO.md)** 🚀 **NOVO!**  
   **Plano de implementação de melhorias** (15 KB)
   - 38 melhorias identificadas e categorizadas
   - Alta prioridade: 12 melhorias críticas
   - Média prioridade: 15 melhorias importantes
   - Baixa prioridade: 11 nice-to-have
   - Cronograma sugerido de 8 semanas
   - Dependências entre melhorias
   - Métricas de sucesso

4. **[DIAGRAMAS_PROCESSOS_GIFTS_STORE.md](./DIAGRAMAS_PROCESSOS_GIFTS_STORE.md)** 🔄  
   **Processos de negócio** (36 KB)
   - Fluxos de orçamento
   - Processos de venda
   - Gestão de clientes
   - Integrações (Bitrix24, n8n)
   - Diagramas BPMN textuais

5. **[CONFIGURACAO_LOCALE_PT_BR.md](./CONFIGURACAO_LOCALE_PT_BR.md)** ⚙️  
   **Guia de implementação técnica** (14 KB)
   - Configuração date-fns pt-BR
   - Utilitários de formatação
   - Checklist de implementação
   - Exemplos de código
   - Testes e validação

6. **[ARQUITETURA_BRIDGE_REST_NATIVE.md](./ARQUITETURA_BRIDGE_REST_NATIVE.md)** 🌉 **NOVO!**  
   **Como o catálogo lê o banco hoje** — LEITURA DE ONBOARDING (devs e IAs)
   - Migração da Edge Function `external-db-bridge` → **PostgREST nativo**
   - Mapa de arquivos em `src/lib/external-db/`
   - Kill-switch com rollout A/B + rollback de emergência
   - VIEWs de segurança, whitelist e aliases de tabela/coluna
   - Camada de compatibilidade (shim + interceptor global)
   - ⚠️ Lacuna de escrita (CRUD admin) e passos de aposentadoria
   - Doc de apoio: [REST_NATIVE_MIGRATION.md](./REST_NATIVE_MIGRATION.md) (histórico/métricas)

---

## 🚀 Quick Start

### Para Desenvolvedores Novos:

1. ✅ **Leia primeiro:** [POLITICA_IDIOMA_PT_BR.md](./POLITICA_IDIOMA_PT_BR.md)
2. 📊 **Entenda o projeto:** [ANALISE_EXAUSTIVA_GIFTS_STORE.md](./ANALISE_EXAUSTIVA_GIFTS_STORE.md)
3. 🌉 **Entenda como o catálogo acessa o banco:** [ARQUITETURA_BRIDGE_REST_NATIVE.md](./ARQUITETURA_BRIDGE_REST_NATIVE.md)
4. 🚀 **Veja o que implementar:** [MELHORIAS_PENDENTES_PLANO_IMPLEMENTACAO.md](./MELHORIAS_PENDENTES_PLANO_IMPLEMENTACAO.md)
5. ⚙️ **Configure o ambiente:** [CONFIGURACAO_LOCALE_PT_BR.md](./CONFIGURACAO_LOCALE_PT_BR.md)
6. 🔄 **Entenda os processos:** [DIAGRAMAS_PROCESSOS_GIFTS_STORE.md](./DIAGRAMAS_PROCESSOS_GIFTS_STORE.md)

### Para Gestores/PMs:

1. 📊 **Visão geral:** [ANALISE_EXAUSTIVA_GIFTS_STORE.md](./ANALISE_EXAUSTIVA_GIFTS_STORE.md) (seções de Roadmap e Priorização)
2. 🚀 **Backlog priorizado:** [MELHORIAS_PENDENTES_PLANO_IMPLEMENTACAO.md](./MELHORIAS_PENDENTES_PLANO_IMPLEMENTACAO.md)
3. 🔄 **Processos de negócio:** [DIAGRAMAS_PROCESSOS_GIFTS_STORE.md](./DIAGRAMAS_PROCESSOS_GIFTS_STORE.md)
4. 🔴 **Decisões de produto:** [POLITICA_IDIOMA_PT_BR.md](./POLITICA_IDIOMA_PT_BR.md)

---

## 🇧🇷 Política de Idioma

**⚠️ IMPORTANTE:** Este sistema é **EXCLUSIVAMENTE em Português do Brasil**.

- ❌ **SEM** suporte a multi-idioma (i18n)
- ❌ **SEM** internacionalização
- ✅ **Locale fixo:** pt-BR
- ✅ **Timezone:** America/Sao_Paulo
- ✅ **Moeda:** Real (R$)

**Detalhes:** Ver [POLITICA_IDIOMA_PT_BR.md](./POLITICA_IDIOMA_PT_BR.md)

---

## 📊 Estatísticas da Documentação

| Documento | Tamanho | Seções | Última Atualização |
|-----------|---------|--------|---------------------|
| POLITICA_IDIOMA_PT_BR.md | 5.6 KB | 9 | 27/12/2025 |
| ANALISE_EXAUSTIVA_GIFTS_STORE.md | 67 KB | 15 | 27/12/2025 |
| MELHORIAS_PENDENTES_PLANO_IMPLEMENTACAO.md | 15 KB | 5 | 27/12/2025 |
| DIAGRAMAS_PROCESSOS_GIFTS_STORE.md | 36 KB | 8 | 27/12/2025 |
| CONFIGURACAO_LOCALE_PT_BR.md | 14 KB | 7 | 27/12/2025 |
| ARQUITETURA_BRIDGE_REST_NATIVE.md | 15 KB | 13 | 30/05/2026 |
| **TOTAL** | **153 KB** | **57 seções** | - |

---

## 🔗 Links Úteis

- **Repositório:** https://github.com/adm01-debug/gifts-store
- **Stack:** React + TypeScript + Vite + Supabase + shadcn/ui
- **date-fns:** https://date-fns.org/
- **Bitrix24 API:** https://dev.1c-bitrix.ru/rest_help/

---

## 📝 Convenções de Documentação

- **🔴 Vermelho:** Política/regra obrigatória
- **⚠️ Amarelo:** Atenção/cuidado
- **✅ Verde:** Já implementado/OK
- **⏳ Relógio:** Em desenvolvimento/pendente
- **📊 Gráfico:** Análise/dados
- **🔄 Ciclo:** Processo/fluxo
- **⚙️ Engrenagem:** Configuração técnica
- **🚀 Foguete:** Melhorias/roadmap

---

**Mantido por:** Pink e Cerébro (adm01-debug)  
**Última revisão completa:** 27/12/2025  
**Status:** ✅ Documentação atualizada e completa
