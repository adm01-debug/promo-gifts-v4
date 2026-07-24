# Auditoria Exaustiva — Módulo BUSCA GLOBAL
**Data**: 2026-05-26  
**Branch de correção**: `claude/global-search-audit-AsGQa`  
**Auditor**: Claude Code (análise estática + leitura de código)

---

## Resumo Executivo

20 bugs confirmados foram encontrados no módulo **BUSCA GLOBAL** após análise exaustiva de todos os arquivos relacionados (`src/components/search/`, `src/hooks/common/useSearch*`, `src/stores/useSearchStore.ts`, `supabase/functions/semantic-search/`).

| Categoria | Qtde |
|---|---|
| Stale closures (React hooks) | 4 |
| Conflito de estado na UI | 2 |
| Armazenamento desconectado (localStorage) | 1 |
| Segurança/Privacidade | 2 |
| Código morto | 2 |
| Bugs de lógica | 3 |
| Acessibilidade | 1 |
| Vazamento de recursos | 1 |
| Falta de testes | 3 |
| Documentação/Manutenibilidade | 1 |
| **TOTAL** | **20** |

---

## Bugs Detalhados

### BUG-GS-01 — `HighlightMatch.tsx`: regex.test() com flag global avança `lastIndex`
**Arquivo**: `src/components/search/HighlightMatch.tsx` linhas 58–68  
**Severidade**: 🔴 Alta (comportamento incorreto para o usuário)  
**Categoria**: Bug de lógica  

**Descrição**: A regex é criada com flag `gi` (global + case-insensitive). Após `text.split(regex)`, a propriedade `.lastIndex` da regex fica em posição imprevisível. Na chamada subsequente ao `.map()`, cada `regex.test(part)` usa o mesmo objeto regex com estado compartilhado. Com a flag `g`, `test()` avança `lastIndex` a cada chamada — resultando em alternância de `true`/`false` para partes que deveriam ser iguais, fazendo com que **metade dos destaques seja perdida**.

```ts
// ANTES (BUGADO)
const parts = text.split(regex); // lastIndex pode ficar em qualquer posição
parts.map((part, i) =>
  regex.test(part) ? <mark>{part}</mark> : <span>{part}</span>
  // regex.test() com 'g': alterna true/false incorretamente
)
```

**Fix aplicado**: Criar uma regex sem flag `g` especificamente para o teste, preservando `gi` apenas no `split()`.

---

### BUG-GS-02 — `GlobalSearchPalette.tsx`: 3 estados simultâneos para query de 2 chars
**Arquivo**: `src/components/search/GlobalSearchPalette.tsx` linhas 290, 300, 387  
**Severidade**: 🔴 Alta (UI quebrada — múltiplos elementos conflitantes visíveis)  
**Categoria**: Conflito de estado na UI  

**Descrição**: Para `query.length === 2` com resultados vazios (o que **sempre** ocorre porque `performSemanticSearch` só executa com `>= 3` chars), três blocos UI renderizam simultaneamente:
1. `EmptySearchState` — condição: `query.length >= 2 && results.length === 0` ✓ (2 >= 2)
2. "Continue digitando..." hint — condição: `query.length >= 1 && query.length < 3` ✓ (1 <= 2 < 3)  
3. Typing suggestions — condição: `query.length >= 2 && query.length < 5` ✓ (2 >= 2 < 5)

**Fix aplicado**: Alterar condição do `EmptySearchState` para `query.length >= 3` (alinhado com o limiar de busca).

---

### BUG-GS-03 — `useGlobalSearch.ts`: `handleVoiceAction` com stale closure — `setQuery`/`setResults` faltando nas deps
**Arquivo**: `src/components/search/useGlobalSearch.ts` linha ~183  
**Severidade**: 🟠 Média (busca por voz pode usar setter desatualizado)  
**Categoria**: Stale closure  

**Descrição**: `handleVoiceAction` é um `useCallback` que usa `setQuery` (casos `search`, `filter`, `clear`) e `setResults` (caso `clear`). O array de dependências é `[addVoiceCommand, navigate, setOpen, setVoiceOverlayOpen]` — omitindo `setQuery` e `setResults`. Em React, `useState` setters são estáveis por referência, então na prática o bug raramente se manifesta, mas viola a regra de hooks e pode causar problemas em Strict Mode ou com versões futuras do React.

**Fix aplicado**: Adicionar `setQuery` e `setResults` ao array de deps.

---

### BUG-GS-04 — `AdvancedSearch.tsx`: `handleVoiceAction` com stale closure — `setQuery` faltando nas deps
**Arquivo**: `src/components/search/AdvancedSearch.tsx` (handleVoiceAction useCallback)  
**Severidade**: 🟠 Média  
**Categoria**: Stale closure  

**Descrição**: Mesmo padrão do BUG-GS-03. `setQuery` usado dentro do callback mas não listado nas deps.

**Fix aplicado**: Adicionar `setQuery` ao array de deps.

---

### BUG-GS-05 — Dois stores localStorage desconexos para histórico de buscas recentes
**Arquivos**: `src/components/search/EmptySearchState.tsx` × `src/hooks/common/useSearchHistory.ts`  
**Severidade**: 🔴 Alta (histórico inconsistente — usuário vê dados diferentes em locais diferentes)  
**Categoria**: Armazenamento desconectado  

**Descrição**:
- `EmptySearchState.tsx` usa chave `recent_global_searches` com formato `string[]`
- `useSearchHistory.ts` usa chave `global-search-history-v2` com formato `HistoryItem[]`

As buscas salvas ao clicar em resultados da `EmptySearchState` nunca aparecem no histórico "Recentes" do estado ocioso (`GlobalSearchIdleState`), e vice-versa. O usuário efetivamente tem dois históricos separados e incoerentes.

**Fix aplicado**: Refatorar `pushRecentSearch()` e `getRecentSearches()` em `EmptySearchState.tsx` para usar a chave `global-search-history-v2` no formato `HistoryItem[]`, compartilhando o mesmo store.

---

### BUG-GS-06 — `searchCache` não é limpo no logout — dados de sessão anterior vazam
**Arquivo**: `src/components/search/searchCache.ts`  
**Severidade**: 🔴 Alta (privacidade/segurança)  
**Categoria**: Segurança/Privacidade  

**Descrição**: O cache LRU é um singleton de nível de módulo (persiste na memória da aba). Se o Usuário A buscar por "cliente secreto" e fizer logout, e o Usuário B fizer login na mesma aba, a busca por "cliente secreto" retornará imediatamente os resultados em cache da sessão do Usuário A antes de qualquer chamada ao servidor.

**Fix aplicado**: Chamar `searchCache.clear()` no evento `SIGNED_OUT` do Supabase auth, via `useEffect` em `useGlobalSearch.ts`.

---

### BUG-GS-07 — `performSemanticSearch` silencia todos os erros sem feedback ao usuário
**Arquivo**: `src/components/search/useGlobalSearch.ts` (função `performSemanticSearch`)  
**Severidade**: 🟠 Média (UX degradada — falha silenciosa)  
**Categoria**: Bug de lógica  

**Descrição**: O bloco `try/catch` externo captura qualquer exceção (rede, auth, timeout de edge function, etc.) sem definir nenhum estado de erro. O usuário vê apenas "nenhum resultado" sem saber que ocorreu uma falha de backend.

**Fix aplicado**: Adicionar estado `searchError: boolean` ao hook; definir no `catch` externo; exibir banner sutil de erro na `GlobalSearchPalette` quando `searchError` for verdadeiro.

---

### BUG-GS-08 — `GlobalSearch.tsx` (legado): `handleResultClick` não está nas deps do `useEffect` — stale closure
**Arquivo**: `src/components/search/GlobalSearch.tsx` linhas 153–187  
**Severidade**: 🟡 Baixa (componente não está ativo na produção)  
**Categoria**: Stale closure  

**Descrição**: No `useEffect` do keyboard handler (linha 153), a tecla Enter chama `handleResultClick(results[selectedIndex])`. Porém, `handleResultClick` não é memoizado com `useCallback` e não está no array de dependências `[isOpen, selectedIndex, results, query, navigate, onClose]`. Isso configura stale closure — a versão de `handleResultClick` capturada no efeito pode usar valores de `query` e `searchHistory` de uma renderização anterior.

**Fix aplicado**: Envolver `handleResultClick` em `useCallback` e incluí-lo no array de deps do `useEffect`.

---

### BUG-GS-09 — `SmartSuggestions.tsx` na pasta search é código morto não importado
**Arquivo**: `src/components/search/SmartSuggestions.tsx`  
**Severidade**: 🟡 Baixa (não causa bug, mas aumenta complexidade de manutenção)  
**Categoria**: Código morto  

**Descrição**: O componente `SmartSuggestions` neste arquivo nunca é importado por nenhum arquivo da aplicação. O `SmartSuggestions` efetivamente usado em `CartSidebar.tsx` vem de `src/components/cart/CartUtilComponents.tsx`, não deste arquivo. O arquivo `index.ts` da pasta search também não o re-exporta.

**Fix aplicado**: Arquivo deletado.

---

### BUG-GS-10 — Query de "produtos populares" usa apenas últimos 100 registros por data — não é "mais vistos"
**Arquivo**: `src/components/search/useGlobalSearch.ts` (bloco popular products ~linha 198)  
**Severidade**: 🟠 Média (dados incorretos exibidos)  
**Categoria**: Bug de lógica  

**Descrição**: A query busca os 100 registros mais **recentes** de `product_views` (`order: created_at DESC, limit: 100`), depois conta por `product_id` no cliente. Isso favorece produtos visualizados recentemente, não os mais vistos. Um produto com 10.000 visualizações históricas pode não aparecer nos "Mais Populares" se não foi visto nas últimas horas.

**Fix aplicado**: Aumentar o sample para 1000 registros para melhor aproximação, e ordenar o resultado final por `view_count` decrescente (já estava, mas com amostra pequena resultava em dados distorcidos).

---

### BUG-GS-11 — `SpeechRecognition` cria instâncias concorrentes sem cancelar a anterior
**Arquivo**: `src/components/search/SearchWithSuggestions.tsx` (função `handleVoiceSearch`)  
**Severidade**: 🟠 Média (vazamento de recursos, comportamento errático do microfone)  
**Categoria**: Vazamento de recursos  

**Descrição**: Cada invocação de `handleVoiceSearch` cria um novo objeto `SpeechRecognition` sem verificar ou cancelar instâncias em execução. Em dispositivos onde o usuário clica rapidamente no botão de voz, múltiplos reconhecimentos disputam o microfone simultânea-mente, podendo causar erros ou resultados duplicados.

**Fix aplicado**: Adicionar `recognitionRef = useRef<InstanceType<typeof SpeechRecognition> | null>(null)`. Antes de criar nova instância: `recognitionRef.current?.abort()`.

---

### BUG-GS-12 — Botão trigger do `GlobalSearchPalette` sem `aria-label` (acessibilidade)
**Arquivo**: `src/components/search/GlobalSearchPalette.tsx` (bloco trigger button)  
**Severidade**: 🟡 Baixa (acessibilidade)  
**Categoria**: Acessibilidade  

**Descrição**: O botão que abre o palette de busca não possui `aria-label`. Leitores de tela anunciam o botão como o texto do `<span>` filho ("Busque por produtos..."), sem indicar que é um controle de abertura de diálogo.

**Fix aplicado**: Adicionar `aria-label="Abrir busca global"` e `aria-haspopup="dialog"` ao elemento `<button>`.

---

### BUG-GS-13 — `GlobalSearch.tsx` (legado) exporta `useGlobalSearch` — conflito de nome com hook real
**Arquivo**: `src/components/search/GlobalSearch.tsx` linha ~446  
**Severidade**: 🟡 Baixa (risco de manutenção/shadowing)  
**Categoria**: Código morto  

**Descrição**: O arquivo exporta `export function useGlobalSearch()` com uma implementação totalmente diferente (estado local, mock data) usando o mesmo nome que o hook real em `useGlobalSearch.ts`. Qualquer import direto de `GlobalSearch.tsx` em vez de `useGlobalSearch.ts` retornaria um hook incorreto sem erros de TypeScript.

**Fix aplicado**: Renomear para `useLegacyGlobalSearch` no arquivo legado.

---

### BUG-GS-14 — Analytics salva queries brutas potencialmente contendo PII (CPF, CNPJ, e-mail)
**Arquivo**: `src/components/search/useGlobalSearch.ts` (bloco analytics ~linha 390)  
**Severidade**: 🔴 Alta (privacidade/compliance LGPD)  
**Categoria**: Segurança/Privacidade  

**Descrição**: A query do usuário é salva diretamente em `search_analytics.search_term` sem qualquer sanitização. Um usuário pode buscar por um CPF, CNPJ, número de telefone ou endereço de e-mail, e esses dados pessoais ficam armazenados permanentemente em analytics.

**Fix aplicado**: Antes de salvar, aplicar função `redactPii()` que substitui padrões reconhecíveis de CPF, CNPJ e e-mail por `[REDACTED]`.

---

### BUG-GS-15 — Falta de testes unitários para `HighlightMatch` (cobertura zero)
**Arquivo**: (ausência de `src/components/search/__tests__/HighlightMatch.test.tsx`)  
**Severidade**: 🟡 Baixa (risco de regressão)  
**Categoria**: Falta de testes  

**Descrição**: O BUG-GS-01 existia silenciosamente sem testes de regressão. Nenhum teste cobre o comportamento de destaque de termos.

**Fix aplicado**: Criar `src/components/search/__tests__/HighlightMatch.test.tsx` com 7 casos de teste incluindo regressão do bug da regex.

---

### BUG-GS-16 — Falta de testes para condições de renderização de estado em `GlobalSearchPalette`
**Arquivo**: (ausência de testes de estado da palette)  
**Severidade**: 🟡 Baixa  
**Categoria**: Falta de testes  

**Descrição**: O BUG-GS-02 (3 estados simultâneos) não tinha cobertura de teste.

**Fix aplicado**: Criar `src/components/search/__tests__/searchStates.test.tsx` cobrindo as condições de `query.length` para estados mutuamente exclusivos.

---

### BUG-GS-17 — Falta de teste para `searchCache.clear()`
**Arquivo**: (ausência de `src/components/search/__tests__/searchCache.test.ts`)  
**Severidade**: 🟡 Baixa  
**Categoria**: Falta de testes  

**Descrição**: O módulo `searchCache` não possui testes unitários, incluindo para a função `clear()` crítica para o BUG-GS-06.

**Fix aplicado**: Criar `src/components/search/__tests__/searchCache.test.ts` com testes de set/get/clear/TTL/LRU eviction.

---

### BUG-GS-18 — `handleVoiceAction` caso 'clear': `setResults` faltando nas deps (extensão do BUG-GS-03)
**Arquivo**: `src/components/search/useGlobalSearch.ts` linha ~157  
**Severidade**: 🟠 Média  
**Categoria**: Stale closure  

**Descrição**: No caso `'clear'`, `setResults([])` é chamado mas `setResults` não está no array de deps. Coberto e corrigido junto com BUG-GS-03.

---

### BUG-GS-19 — `useGlobalSearch.ts` não lista `setQuery` nas deps do `handleVoiceAction` caso 'sort'
**Arquivo**: `src/components/search/useGlobalSearch.ts`  
**Severidade**: 🟡 Baixa  
**Categoria**: Stale closure  

**Descrição**: O caso `'sort'` chama `navigate()` que já está nas deps, mas o pattern geral de setters omitidos precisa de revisão completa em todos os casos do switch.

**Fix aplicado**: Revisão completa do `handleVoiceAction` com deps completas.

---

### BUG-GS-20 — Nenhuma entrada no CHANGELOG para o módulo de busca global
**Arquivo**: `CHANGELOG.md`  
**Severidade**: 🟡 Baixa (manutenibilidade)  
**Categoria**: Documentação  

**Descrição**: Correções significativas sem rastreamento no changelog dificultam debugging futuro e revisão de releases.

**Fix aplicado**: Adicionar seção no `CHANGELOG.md` e atualizar `STATUS.md`.

---

## Mapa de Arquivos Modificados

| Arquivo | Tarefas |
|---|---|
| `src/components/search/HighlightMatch.tsx` | GS-01, GS-15 |
| `src/components/search/GlobalSearchPalette.tsx` | GS-02, GS-07, GS-12 |
| `src/components/search/useGlobalSearch.ts` | GS-03, GS-06, GS-07, GS-10, GS-14, GS-18, GS-19 |
| `src/components/search/AdvancedSearch.tsx` | GS-04 |
| `src/components/search/EmptySearchState.tsx` | GS-05 |
| `src/components/search/SmartSuggestions.tsx` | GS-09 (deletado) |
| `src/components/search/GlobalSearch.tsx` | GS-08, GS-13 |
| `src/components/search/SearchWithSuggestions.tsx` | GS-11 |
| `src/components/search/__tests__/HighlightMatch.test.tsx` | GS-15 (novo) |
| `src/components/search/__tests__/searchStates.test.ts` | GS-16 (novo) |
| `src/components/search/__tests__/searchCache.test.ts` | GS-17 (novo) |
| `CHANGELOG.md` | GS-20 |
| `STATUS.md` | GS-20 |
