# Política de Segurança — Promo Gifts

> **Brasil Marcas Indústria e Comércio de Brindes Ltda**
> Sistema interno proprietário — uso restrito a colaboradores autorizados.
> Veja `LICENSE` para termos de uso.

## 🔐 Reportar Vulnerabilidades

**Não abra issue pública para vulnerabilidades.**

Use um destes canais:

1. **Preferido:** [GitHub Security Advisory](../../security/advisories/new) (canal privado)
2. **E-mail principal:** `ti@promobrindes.com.br`
3. **E-mail alternativo:** `adm01@promobrindes.com.br`

Para reportes sensíveis, criptografe a mensagem com nossa chave PGP
(disponível mediante solicitação ao mesmo e-mail).

### O que incluir no reporte

- Descrição clara da vulnerabilidade
- Passos para reproduzir (proof-of-concept)
- Versão/branch/commit afetado
- Impacto potencial (vazamento, escalação, DoS, etc.)
- Sugestão de mitigação (opcional)
- Como gostaria de ser creditado (opcional)

## ⏱️ SLA de resposta

| Severidade | Primeira resposta | Correção alvo |
|---|---|---|
| 🔴 Crítica (RCE, data leak, auth bypass) | 24h | 72h |
| 🟠 Alta (privilege escalation, XSS armado) | 48h | 7d |
| 🟡 Média (info disclosure limitado) | 5d | 30d |
| 🟢 Baixa (best practice, hardening) | 14d | conforme roadmap |

## 📅 Política de disclosure responsável

- **Não divulgue publicamente** a vulnerabilidade antes de termos aplicado a correção
- Conceda à equipe um prazo de **90 dias** a partir da data do reporte
  para corrigirmos antes de qualquer disclosure
- Após o prazo de 90 dias (ou antes, mediante acordo), você é livre para
  publicar o reporte com nosso reconhecimento

## 🛡️ Escopo

**Em escopo:**

- Aplicação principal: `https://www.promogifts.com.br`
- Código deste repositório
- Edge Functions Supabase do projeto `doufsxqlfjyuvxuezpln`
- Endpoints expostos publicamente
- Workflows GitHub Actions
- Secrets vazados em commits

**Fora de escopo:**

- Engenharia social contra colaboradores
- Ataques físicos a escritórios ou data centers
- DoS volumétrico
- Vulnerabilidades em dependências de terceiros já reportadas upstream
  (reporte ao mantenedor original)
- Subdomínios `*.lovable.app`, `*.vercel.app` (preview deployments)
- Bugs sem implicação direta de segurança (estética, UX, performance)

## 🚫 O que NÃO fazer

- Não realizar testes em produção sem coordenação prévia
- Não acessar dados de clientes ou colaboradores
- Não tornar a vulnerabilidade pública antes da correção
- Não tentar persistência, lateralização, exfiltração ou DoS no ambiente
  de produção

## 📦 Versões suportadas

| Versão | Suporte de segurança |
|---|---|
| `main` (produção) | ✅ Suporte ativo |
| Branches `claude/*`, `codex/*`, `etapa-*` | ❌ Não — são branches de trabalho |
| Forks externos | ❌ Não — uso não autorizado por LICENSE |

## 🏆 Reconhecimento

Pesquisadores responsáveis serão creditados (com permissão) no `CHANGELOG.md`
da versão que contém a correção. Não somos um programa de bug bounty pago —
não oferecemos recompensa financeira, mas reconhecemos publicamente cada
contribuição válida.
