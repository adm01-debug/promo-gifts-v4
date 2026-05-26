# Estratégia de Dados de Teste Determinísticos

## Objetivo
Padronizar a criação de dados de teste para que:
- os resultados sejam reproduzíveis em qualquer execução;
- o estado seja sempre resetado entre testes/suítes;
- não exista interferência entre workers em execuções paralelas;
- a suíte de **smoke** rode com dataset mínimo, e a suíte completa rode com dataset extensivo.

---

## 1) Princípios obrigatórios

1. **Determinismo por padrão**
   - Proibido usar `Math.random()`, timestamps “soltos” (`Date.now()`) ou UUID sem seed em fixtures principais.
   - Todo dado variável deve vir de gerador determinístico com seed explícita.

2. **Isolamento por execução e por worker**
   - Cada execução recebe um `RUN_ID`.
   - Cada worker recebe namespace próprio: `tenant_<RUN_ID>_w<WORKER_ID>`.
   - Nenhum teste deve ler/escrever fora do namespace do worker.

3. **Reset forte e verificável**
   - Antes de cada suíte: `reset` do namespace do worker.
   - Após a suíte: limpeza idempotente (não falha se já estiver limpo).
   - O reset deve ter assert de sanidade (ex.: contagem de registros esperada = 0).

4. **Dados mínimos vs. extensos (separação física)**
   - Smoke: dataset pequeno e estável, com poucos cenários críticos.
   - Completa: dataset amplo, cobrindo variações, bordas e carga funcional.

---

## 2) Estrutura sugerida

```txt
tests/
  fixtures/
    core/
      smoke.seed.ts
      full.seed.ts
      deterministic-factory.ts
    scenarios/
      smoke/
      full/
  helpers/
    run-context.ts
    namespace.ts
    reset-state.ts
    seed-runner.ts
```

### Convenções
- `smoke.seed.ts`: apenas entidades essenciais para happy-path crítico.
- `full.seed.ts`: compõe `smoke.seed.ts` + cenários extras.
- `deterministic-factory.ts`: fábrica única de IDs, datas e strings determinísticas.

---

## 3) Gerador determinístico (exemplo)

```ts
// tests/fixtures/core/deterministic-factory.ts
export function createDeterministicFactory(seed: string) {
  let i = 0;
  return {
    nextId(prefix: string) {
      i += 1;
      return `${prefix}_${seed}_${String(i).padStart(4, '0')}`;
    },
    fixedDate(offsetDays = 0) {
      const base = new Date('2026-01-01T00:00:00.000Z');
      base.setUTCDate(base.getUTCDate() + offsetDays);
      return base.toISOString();
    },
  };
}
```

Regra: seed = `"${RUN_ID}_${WORKER_ID}_${SUITE}"`.

---

## 4) Reset de estado (workflow)

1. Calcular `namespace` do worker.
2. Executar `truncate/delete` apenas no namespace.
3. Recriar dados-base mínimos necessários para autenticação/contexto.
4. Validar reset com checks objetivos:
   - tabelas de domínio com `0` registros;
   - tabelas base com contagem esperada mínima;
   - ausência de jobs pendentes/eventos assíncronos órfãos.

### Requisitos de implementação
- `reset-state.ts` deve ser **idempotente**.
- Não depender da ordem global dos testes.
- Proibido compartilhar usuário/admin global entre workers.

---

## 5) Anti-flakiness para paralelismo

1. **Sem recursos globais mutáveis**
   - Evitar chaves únicas fixas (ex.: email `test@...` igual para todos).
   - Sempre incluir namespace em identificadores únicos.

2. **Sincronização por condição, nunca por sleep fixo**
   - Evitar `waitForTimeout` em E2E.
   - Esperar estado observável (`toHaveText`, polling de status, evento concluído).

3. **Controle de relógio quando necessário**
   - Em unit/integration, usar fake timers para regras temporais.
   - Em E2E, usar datas fixas de fixture em vez de “agora”.

4. **Retries com classificação**
   - Retry não corrige flaky: apenas classifica.
   - Teste que falha e passa no retry deve ser marcado para correção estrutural.

---

## 6) Separação de datasets: smoke vs bateria completa

## Smoke (mínimo)
Deve conter somente:
- 1 organização;
- 1 usuário admin + 1 usuário vendedor;
- 3–5 produtos representativos;
- 1 fluxo ponta-a-ponta crítico por área (login, listagem, detalhe, ação principal).

Características:
- Execução rápida;
- Zero dependência externa opcional;
- Sem cenários de borda complexos.

## Bateria completa (extenso)
Deve adicionar:
- variações de perfis/permissões;
- volumes maiores de produtos/cotações;
- cenários de borda (dados faltantes, limites, conflitos);
- fluxos alternativos e regressões históricas.

Características:
- Cobertura funcional ampla;
- Pode ser particionada por domínio para paralelismo;
- Mantém o mesmo padrão determinístico de seed.

---

## 7) Contrato de execução no CI

Variáveis obrigatórias:
- `TEST_RUN_ID`: identificador único da execução CI;
- `TEST_WORKER_ID`: id do worker (fornecido pelo runner);
- `TEST_DATASET`: `smoke` | `full`.

Pipeline recomendado:
1. `seed:smoke` + suíte smoke (gates rápidos).
2. `seed:full` + suíte completa (gates abrangentes).
3. Publicar métricas de flakiness por arquivo/teste.

---

## 8) Checklist de adoção

- [ ] Existe fábrica determinística única para IDs/datas.
- [ ] Todo teste usa namespace por `RUN_ID + WORKER_ID`.
- [ ] Reset é idempotente e validado por asserts.
- [ ] Smoke usa dataset mínimo isolado.
- [ ] Full usa dataset extensivo separado do smoke.
- [ ] Não há `waitForTimeout` para sincronização funcional.
- [ ] Flakes em retry geram ticket automático de estabilização.

---

## 9) Resultado esperado
Com esse padrão, o time reduz falsos negativos/positivos, acelera feedback do smoke e mantém confiabilidade alta na bateria completa, mesmo com paralelismo elevado.
