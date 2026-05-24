# Post-Mortem: `crm-db-bridge` retornando HTTP 500 por URL malformada

**Data**: 2026-05-22
**Duração**: ~25 min (16:47 UTC criação dos secrets → 17:11 UTC primeiro POST 200 do app)
**Severidade**: Alta — qualquer ação do app que dependesse do CRM externo (busca de empresas, clientes, contatos, fornecedores, transportadoras) falhava com HTTP 500
**Status**: Resolvido

---

## TL;DR

A edge function `crm-db-bridge` retornava `500 "CRM database credentials not configured"` em toda chamada real do app. Causa-raiz: o secret `EXTERNAL_CRM_URL` foi cadastrado com a **URL do painel administrativo do Supabase Dashboard** (`https://supabase.com/dashboard/project/<ref>`) ao invés da **URL da API REST** (`https://<ref>.supabase.co`). O erro foi diagnosticado sem expor o valor do secret, via comparação de digests SHA256.

---

## Cronologia

| Horário (UTC) | Evento |
|---|---|
| 16:47:50 | 3 secrets `EXTERNAL_CRM_URL`, `EXTERNAL_CRM_SERVICE_ROLE_KEY`, `EXTERNAL_CRM_ANON_KEY` criados via Edge Functions → Secrets no Dashboard. Função redeployada automaticamente para version 52 |
| 16:49:13 | Primeiro POST do app → `500 "CRM database credentials not configured"` |
| 16:49:34 | Segundo POST do app → 500 (warm) |
| 16:51:04 | Terceiro POST do app → 500 |
| ~16:55 | Início da investigação forense |
| ~17:00 | Causa-raiz identificada por SHA256 matching — secret continha `https://supabase.com/dashboard/project/<ref>` (URL admin) ao invés de `https://<ref>.supabase.co` (URL da API) |
| ~17:00 | Operador corrige o valor do secret. Função redeployada para version 53 |
| 17:01–17:06 | Validações intermediárias: ping bypass OK, URL canônica responde, POST sem auth chega ao `403 bot-protection`, POST com anon JWT chega ao `401 token inválido` (etapa após auth, antes do erro de creds) |
| 17:11:47–55 | Primeiros 5 POSTs reais do app na v53 → todos **200 OK** (cold start de 8.5s no primeiro, depois 378–493ms) |

---

## Causa-raiz

O secret `EXTERNAL_CRM_URL` foi colado a partir da **barra de endereço do navegador** enquanto o operador estava com o projeto CRM aberto no Supabase Dashboard. O valor digerido foi:

```
https://supabase.com/dashboard/project/pgxfvjmuubtbowutlide
```

O valor esperado pela edge function é a URL canônica do PostgREST da API:

```
https://pgxfvjmuubtbowutlide.supabase.co
```

A função `resolveCredential()` em `supabase/functions/_shared/credentials.ts` carregava o valor com sucesso (Deno.env tem o secret → não-nulo). A linha do `crm-db-bridge`:

```ts
const CRM_KEY = CRM_SERVICE_KEY || CRM_ANON_VAL;
if (!CRM_URL || !CRM_KEY) {
  return jsonResponse({ error: "CRM database credentials not configured" }, 500);
}
```

passava na validação superficial (`!!CRM_URL === true`) porque o valor não era vazio — mas qualquer fetch subsequente em `${CRM_URL}/rest/v1/...` resolvia para `https://supabase.com/dashboard/project/<ref>/rest/v1/...`, que retornava **404 HTML** do site supabase.com, propagando como erro genérico que o app não conseguia interpretar.

---

## Como foi diagnosticado sem expor o secret

O Supabase Dashboard exibe um **digest SHA256 truncado** de cada secret na lista "Edge Functions → Secrets". Com isso e o anon_key real do projeto CRM (obtido via `get_publishable_keys` do MCP — que só retorna chaves públicas), foi possível:

1. Calcular `sha256("https://pgxfvjmuubtbowutlide.supabase.co")` = `0dc7595b1ffd...` (esperado)
2. Comparar com o digest mostrado pelo Dashboard = `72cc5e46f416...` (não bate)
3. Calcular `sha256("https://pgxfvjmuubtbowutlide.atomicabr.com.br")`, `sha256(url+"\n")`, `sha256(url+" ")`, 16 outras variantes — nenhuma bate
4. Hipótese: `sha256("https://supabase.com/dashboard/project/pgxfvjmuubtbowutlide")` = `72cc5e46f416...` ✅ **MATCH**

Para confirmar a metodologia, calculei também o digest do `EXTERNAL_PROMOBRIND_URL` (que estava funcionando) e bateu exatamente com `sha256("https://doufsxqlfjyuvxuezpln.supabase.co")` = `22ca90f85ea4...`. Mesmo procedimento confirmou que `EXTERNAL_CRM_ANON_KEY` estava correto (digest bateu com o JWT real do projeto).

Após a correção, validei a URL canônica diretamente:

```bash
curl "https://pgxfvjmuubtbowutlide.supabase.co/rest/v1/companies?limit=1" \
  -H "apikey: <anon>"
# → HTTP 400 com JSON do PostgREST (erro de coluna, mas o serviço respondeu)
```

Versus a URL malformada anterior:

```bash
curl "https://supabase.com/dashboard/project/.../rest/v1/companies?limit=1"
# → HTTP 404 (só uma página HTML do dashboard, sem PostgREST)
```

---

## Por que o ping passava mesmo com a URL errada

O endpoint `?op=ping` da função tem **bypass total** antes de qualquer resolução de credenciais:

```ts
const diagOp = await detectDiagOp(req);
if (diagOp === "ping") {
  return jsonResponse({ ok: true, ts: Date.now() });
}
```

Isso é útil para verificar se o isolate está vivo, mas **não testa o caminho real** de uso. Qualquer monitoramento que dependa só do `?op=ping` teria reportado green durante todo o incidente.

---

## Lições

1. **Cadastro manual de URLs sem validação é frágil**. Um copy-paste do navegador é o suficiente para introduzir um valor que parece certo mas é totalmente disfuncional. A correção em si levou 30 segundos; o diagnóstico levou 25 minutos.

2. **Digest SHA256 público é poderoso para auditoria sem violar segredo**. O fato de o Supabase Dashboard expor o digest truncado permitiu diagnóstico forense sem nunca pedir o valor ao operador. Esse padrão pode ser reaproveitado para futuras auditorias.

3. **Monitoramento via ping é insuficiente**. Precisamos de health-checks que façam *um teste real* (ainda que rate-limitado) contra cada dependência externa, não apenas verificar se o isolate boot.

4. **`integration_credentials` (DB-first) seria mais robusto**. A função `resolveCredential()` já implementa DB-first com fallback para env — mas os secrets EXTERNAL_CRM_* foram cadastrados só no env (Edge Functions Secrets). Migrá-los para DB permitiria correção em SQL puro via MCP, com auditoria + histórico, sem precisar entrar no Dashboard.

---

## Próximos passos (ver issues vinculadas)

- **Issue #?** — docs: POP de cadastro de secrets externos no Supabase
- **Issue #?** — feat(observability): `connections-health-check` valida formato de URLs externas
- **Issue #?** — refactor(security): migrar `EXTERNAL_CRM_*` para `integration_credentials` (DB-first)
