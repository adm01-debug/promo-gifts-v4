# Runbook — Aposentadoria da Edge Function `external-db-bridge` (Plano A / PR#4)

> **Status: BLOQUEADO.** Este é o passo final da série CORREÇÃO-07. Ele só pode ser
> executado **depois** que o Plano A estiver verde em produção:
> - PR#2 (#525 — escrita REST nativa) **mergeado**;
> - PR#3 (#527 — RLS de escrita) **mergeado e aplicado**;
> - **soak de produção** confirmando escrita/leitura saudáveis (ver "Critérios de soak").
>
> Enquanto isso não acontecer, **NÃO** delete a função nem mexa no kill-switch.
> Este documento é a única alteração do PR#4 — é proposital: ele prepara a operação
> sem disparar nada destrutivo fora de ordem.

## Por que não é só "deletar a função e o kill-switch"

### Armadilha #1 — o kill-switch tem fail-open
`getKillSwitchState` (em `src/lib/external-db/kill-switch-client.ts`) retorna
`{ enabled: true }` quando a consulta falha **ou quando a linha não existe**
(`if (!data) return { enabled: true, source: 'fail-open' }`).

Consequência contra-intuitiva: **deletar a linha** `edge_external_db_bridge` da
tabela `system_kill_switches` **RELIGA a bridge** (fail-open → `enabled=true`).
O estado atual desejado é exatamente o oposto: `enabled=false, rollout=100`
(bridge OFF, 100% REST nativo). Portanto:

- **NÃO** rode `DELETE FROM system_kill_switches WHERE switch_name = 'edge_external_db_bridge'`
  enquanto o cliente ainda ler o kill-switch.
- A linha é também o **mecanismo de rollback** do PR#2: virar `enabled=true`
  restaura a bridge instantaneamente se a escrita REST nativa der problema.

### Armadilha #2 — `main` ainda depende da bridge como fallback
Até o PR#2 mergear, `invokeExternalDb` / `invokeBatchBridge` / `invokeExternalDbDelete`
ainda caem na bridge para qualquer tabela/op fora da whitelist REST nativa. Deletar a
função v156 antes disso quebra produção para esses caminhos.

## Ordem correta de aposentadoria (executar só quando DESBLOQUEADO)

1. **Confirmar A verde** (ver critérios de soak abaixo).
2. **Remover o fallback de bridge do cliente** (PR de código dedicado), nesta ordem:
   - `invokeExternalDb`: remover o bloco "Bridge path" (try/`invokeBridge`); manter
     apenas REST nativo (read + write) e o `WriteUnavailableError` para tabela/op não
     coberta.
   - `invokeBatchBridge`: trocar a chamada à bridge por `decomposeBatchToIndividual`
     direto (já é o fallback hoje).
     `invokeExternalDbDelete`: remover o ramo `invokeBridge`; manter REST nativo + LOUD.
   - Remover `invokeBridge` e helpers exclusivos da bridge (`buildBridgeError`,
     retry/cold-start) quando ficarem sem uso.
   - Manter `getKillSwitchState` **temporariamente** (passo 4 decide o destino).
3. **Deploy do cliente sem bridge** e novo soak curto (catálogo + escrita admin).
4. **Desativar a função** `external-db-bridge` (v156 ainda ACTIVE):
   - `supabase functions delete external-db-bridge --project-ref doufsxqlfjyuvxuezpln`
   - (ou desabilitar no painel). Verificar que nenhuma origem ainda a invoca
     (logs da função zerados por ≥ 24h).
5. **Só então** lidar com o kill-switch:
   - Como o cliente não lê mais o kill-switch (passo 2 removeu o último leitor),
     a linha vira config morta. Pode-se deixá-la como registro histórico **ou**
     remover via migration. Se remover, fazer no MESMO PR que remove o último
     leitor — nunca antes (fail-open).

## Critérios de soak (gate para desbloquear)

- Escrita admin (produto, fornecedor, categoria, variante, técnica, coleção)
  persistindo via REST nativo, confirmada no banco — sem `WriteUnavailableError`
  espúrio e sem "salvo com sucesso" falso.
- `print_area_techniques` e `supplier_branches` aceitando escrita do admin (depende
  do PR#3 aplicado).
- Telemetria `reportSilentEmpty('write_bridge_off')` **zerada** no período.
- Leitura de catálogo estável (sem regressão de banners de indisponibilidade).
- Logs de invocação da Edge Function `external-db-bridge` tendendo a zero.

## Rollback (a qualquer momento antes do passo 4)
`UPDATE public.system_kill_switches SET enabled = true WHERE switch_name = 'edge_external_db_bridge';`
→ bridge volta a atender em segundos. (Após o passo 2/4 o rollback deixa de existir;
por isso o soak é obrigatório antes de remover o fallback e a função.)
