# Política de estabilidade de testes (Smoke, Regressão e Integração)

## Objetivo
Definir SLOs operacionais para execução de testes automatizados e reduzir ruído de pipeline com uma política explícita para testes instáveis (flakes).

## 1) Tempo-alvo por suíte

| Suíte | Escopo | Tempo-alvo (P50) | Limite aceitável (P95) | Gatilho de ação |
|---|---|---:|---:|---|
| **Smoke** | Rotas e fluxos críticos de negócio | **até 8 min** | **até 12 min** | Acima de 12 min por 3 execuções seguidas |
| **Regressão completa** | E2E + unit + integração previstos no CI completo | **até 45 min** | **até 70 min** | Acima de 70 min em 2 de 5 execuções |
| **Integração** | Testes de integração (front + edge functions + contratos) | **até 20 min** | **até 30 min** | Acima de 30 min por 3 execuções seguidas |

### Regras de medição
- Medir por janela móvel das últimas **20 execuções** por tipo de pipeline.
- Usar mediana para P50 e percentil para P95.
- Para decisões de capacidade, considerar apenas execuções com infraestrutura saudável (sem incidentes de runner/provedor).

## 2) Meta de taxa de flake máxima

### Definição de flake
Teste que falha e passa em re-run sem alteração de código relevante no teste/SUT.

### Meta
- **Meta global máxima de flake: 2,0%** por semana (falhas flaky / total de execuções de testes).
- **Meta por suíte crítica (smoke): 1,0%** por semana.
- Qualquer teste individual com flake **> 5%** na janela de 7 dias é elegível para quarentena imediata.

### Alertas
- **Alerta amarelo:** flake global > 1,5% na semana.
- **Alerta vermelho:** flake global > 2,0% na semana ou smoke > 1,0%.

## 3) Política de quarantine (quarentena)

## Quando colocar em quarentena
Um teste entra em quarentena quando cumprir **qualquer** critério:
1. Flake > 5% em 7 dias, com no mínimo 20 execuções.
2. Falhou em 2 pipelines consecutivos e passou em re-run sem mudança de código.
3. Evidência de dependência externa não determinística (rede, tempo, terceiros) sem controle adequado.
4. Timeout intermitente recorrente (3+ ocorrências em 5 dias).

## Como aplicar quarentena
- Marcar o teste com tag/annotação de quarentena (ex.: `@quarantine`) e removê-lo do gate bloqueante.
- O teste continua executando em job não bloqueante para telemetria.
- Abrir issue obrigatória com:
  - hipótese de causa raiz,
  - owner,
  - prazo de correção (SLA padrão: **até 5 dias úteis**),
  - evidências (logs, vídeos, traces).

## Critérios de retorno da quarentena
Um teste só retorna ao gate bloqueante quando cumprir **todos**:
1. Correção aplicada e revisada.
2. **30 execuções consecutivas sem flake** no job não bloqueante.
3. Tempo de execução dentro do envelope esperado da suíte.
4. Aprovação do owner da área + QA.

## Limites de permanência
- Nenhum teste pode permanecer em quarentena por mais de **15 dias corridos** sem plano aprovado.
- Ao atingir 15 dias, escalar para engenharia/gestão com decisão: corrigir imediatamente, reescrever ou remover.

## 4) Governança e cadência
- Revisão semanal de métricas de duração e flake.
- Revisão quinzenal da lista de quarentena.
- Publicar painel com:
  - flake global e por suíte,
  - tempo P50/P95 por suíte,
  - testes em quarentena e idade.

## 5) Exceções
Exceções temporárias (por incidentes externos) precisam de registro em issue e expiram em no máximo 14 dias.
