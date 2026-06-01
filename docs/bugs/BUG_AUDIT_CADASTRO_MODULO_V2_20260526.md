# Auditoria Exaustiva — Módulo Cadastro de Produtos & Fornecedores (v2)

**Data:** 26/05/2026  
**Branch:** `fix/cadastro-modulo-v2-audit-20260526`  
**Arquivos auditados:** 5  
**Total de bugs:** 30  

---

## Arquivos analisados

| Arquivo | SHA | Tamanho |
|---------|-----|---------|
| `src/components/admin/products/useProductsManager.ts` | `c9f4f075` | 16 KB |
| `src/components/admin/suppliers-manager/useSuppliersManager.ts` | `ca125623` | 25 KB |
| `src/components/admin/suppliers-manager/SuppliersManager.tsx` | `5374fa2e` | 3 KB |
| `src/components/admin/products/new-supplier/useNewSupplierForm.ts` | `479927fc` | 21 KB |
| `src/components/admin/products/sections/engraving/useEngravingWizard.ts` | `507b6240` | 11 KB |

---

## 🔴 CRÍTICOS (5)

### BUG-01 · `useNewSupplierForm.ts` — Serialização legada em `notes` inconsistente com `useSuppliersManager`
**Problema:** `buildNotesField()` em `useNewSupplierForm` ainda serializa `foneFixo1/2`, `inscricaoEstadual`, `regimeTributario`, `estadoFaturamento` como blocos `[Fones Fixos: ...]`, `[Fiscal: IE: ...]` dentro de `notes`. Porém `useSuppliersManager.buildNotesPayload()` já NÃO serializa mais esses campos (usam colunas dedicadas: `phone`, `phone2`, `inscricao_estadual`, `tax_regime`, `state_uf`).  
**Impacto:** Fornecedores criados pelo `NewSupplierDialog` (form inline na página de Produto) têm schema de `notes` divergente. Ao editar no `SuppliersManager`, os campos fiscais/telefone não são carregados porque as colunas dedicadas estão vazias.  
**Fix:** Remover esses blocos de `buildNotesField()`; salvar nos campos dedicados (`handleCreate` payload).

### BUG-02 · `useEngravingWizard.ts` — Nome de tabela errado para técnicas
**Problema:** `table: 'tecnica_gravacao'` (singular, sem 's'). O schema real usa `tecnicas_gravacao` (plural).  
**Impacto:** Todas as queries de técnicas de gravação retornam erro. O wizard fica com lista vazia permanentemente.  
**Fix:** `table: 'tecnicas_gravacao'`

### BUG-03 · `useEngravingWizard.ts` — `localAreas` não são persistidas ao criar novo produto
**Problema:** Quando `!isEdit`, áreas são adicionadas em `localAreas` com `product_id: 'pending'`. Mas não existe nenhum mecanismo para flush dessas áreas para o DB quando o produto é criado e recebe um ID real.  
**Impacto:** Todo o trabalho de configurar gravações em um produto NOVO é silenciosamente descartado.  
**Fix (parcial):** Expor `localAreas` e `flushLocalAreas(productId)` via ref/callback para o `AdminProductFormPage` chamar após criação bem-sucedida.

### BUG-04 · `useSuppliersManager.ts` — `handleDelete` usa `confirm()` nativo
**Problema:** `if (!confirm('Deseja realmente excluir...')) return;` — bloqueia a thread, falha em iframes modernos, anti-pattern.  
**Fix:** Estado `deleteConfirmSupplier` + funções `confirmDelete` / `cancelDelete` + AlertDialog em `SuppliersManager.tsx`.

### BUG-05 · `useEngravingWizard.ts` — `handleDeleteArea` usa `confirm()` nativo
**Problema:** Mesmo anti-pattern que BUG-04.  
**Fix:** Estado `deleteAreaConfirm` + funções `confirmDeleteArea` / `cancelDeleteArea`.

---

## 🟠 ALTOS (8)

### BUG-06 · `useNewSupplierForm.ts` — Colunas dedicadas não escritas no payload de criação
**Problema:** `handleCreate` não inclui `inscricao_estadual`, `tax_regime`, `state_uf`, `phone2` no payload, mesmo capturando esses valores em state.  
**Fix:** Adicionar ao `data` payload.

### BUG-07 · `useSuppliersManager.ts` — Social media não salvo no payload
**Problema:** `instagram`, `facebook`, `linkedin`, `youtube`, `tiktok` existem na interface `Supplier` e são capturados em `handleEdit`, mas o `handleSave` não os inclui no payload.  
**Fix:** Adicionar ao payload de save.

### BUG-08 · `useProductsManager.ts` — Galeria de imagens sobrescrita pela imagem primária
**Problema:** `images: imageUrl ? [imageUrl] : Array.isArray(p.images) ? p.images : []` — quando `imageUrl` existe, descarta toda a galeria (`p.images`) e retorna apenas 1 imagem.  
**Fix:** `images: Array.isArray(p.images) && p.images.length > 0 ? p.images : imageUrl ? [imageUrl] : []`

### BUG-09 · `useProductsManager.ts` — `handleBulkToggleActive` usa `Promise.all`
**Problema:** `Promise.all` falha-imediato — se um update falha, os outros são abandonados sem feedback granular.  
**Fix:** `Promise.allSettled` + toast com contagem de sucessos/falhas.

### BUG-10 · `useProductsManager.ts` — `handleFiltersChange` sem `fetchProducts` nas deps
**Problema:** useCallback com deps `[pageSize, searchTerm]` mas usa `fetchProducts`. Stale closure: `fetchProducts` pode ter `advancedFilters` desatualizado.  
**Fix:** Adicionar `fetchProducts` às deps.

### BUG-11 · `useProductsManager.ts` — `useEffect` de search sem `fetchProducts` nas deps
**Problema:** `useEffect(() => { ... fetchProducts(...) }, [searchTerm])` — stale closure de `fetchProducts`.  
**Fix:** Adicionar eslint-disable comment + incluir deps relevantes sem criar double-fetch.

### BUG-12 · `useSuppliersManager.ts` — `fetchSuppliers` limita a 200 sem paginação
**Problema:** `limit: 200` sem loop de paginação. Empresas com >200 fornecedores perdem registros silenciosamente.  
**Fix:** Loop de paginação (200/página, cap 2000) com `offset`.

### BUG-13 · `useSuppliersManager.ts` + `useNewSupplierForm.ts` — `minimum_order_value` duplicado
**Problema:** Payload envia tanto `min_order_value` quanto `minimum_order_value` (coluna deprecada). Pode causar erro se migration de drop foi executada.  
**Fix:** Remover `minimum_order_value` do payload.

---

## 🟡 MÉDIOS (10)

### BUG-14 · `useNewSupplierForm.ts` — `minimum_order_value` duplicado (mesmo que BUG-13)

### BUG-15 · `useProductsManager.ts` — `video_url` extração insegura
**Problema:** `(pRec.videos as unknown[])?.[0] as string` — `videos[0]` pode ser `{url: string}`, não string.  
**Fix:** Verificar tipo antes de retornar.

### BUG-16 · `useSuppliersManager.ts` — `JSON.parse(supplier.contacts)` falha com JSONB
**Problema:** Se o DB retorna `contacts` já como objeto (JSONB), `JSON.parse(objeto)` lança erro silenciado → contatos são perdidos ao editar.  
**Fix:** `typeof contacts === 'string' ? JSON.parse(contacts) : contacts`

### BUG-17 · `useSuppliersManager.ts` — `handleCnpjLookup` sobrescreve campos preenchidos
**Problema:** `updateField('name', data.razao_social)` sobrescreve `name` mesmo se já preenchido.  
**Fix:** Só preencher campos vazios.

### BUG-18 · `useProductsManager.ts` — `stats` calculados na página, não no total
**Problema:** `active/inactive/noStock` calculados sobre `products` (página atual, max 100). Label indica que são stats do catálogo inteiro.  
**Fix:** Adicionar flag `isPageLevel: true` e ajustar rótulos da UI.

### BUG-19 · `useNewSupplierForm.ts` — Social media não incluído no payload de criação
**Mesmo que BUG-07 mas para o formulário novo.**

### BUG-20 · `useNewSupplierForm.ts` — Logo salva com path `new-{timestamp}` permanente
**Problema:** Path `suppliers/new-123456789.png` nunca é renomeado para `suppliers/{id}.png`.  
**Nota:** Fix completo requer rename pós-criação — adicionado TODO no código.

### BUG-21 · `useSuppliersManager.ts` — Dup check de nome case-sensitive
**Problema:** Filtro exato case-sensitive: "ACME" ≠ "Acme".  
**Fix:** Usar `__ilike_` prefix para comparação case-insensitive (padrão já usado em outros filtros).

### BUG-22 · `useNewSupplierForm.ts` — Campos fiscais em `notes` mas não em colunas dedicadas
**Problema:** `inscricaoEstadual`, `regimeTributario`, `estadoFaturamento` coletados mas `handleCreate` só os passa para `buildNotesField`, não para colunas `inscricao_estadual`, `tax_regime`, `state_uf`.  
**Fix:** Incluir no payload.

### BUG-23 · `useSuppliersManager.ts` — `carrierSearchTimeout` sem cleanup de unmount
**Problema:** `useRef<ReturnType<typeof setTimeout>>()` sem `useEffect` de cleanup → `setState` em componente desmontado.  
**Fix:** Adicionar `useEffect(() => () => clearTimeout(carrierSearchTimeout.current), [])`.

---

## 🟢 BAIXOS (7)

### BUG-24 · `useNewSupplierForm.ts` — Carrier timeout sem cleanup (igual BUG-23)

### BUG-25 · `useSuppliersManager.ts` — `address_details`/`social_details` — dead code
**Problema:** `handleEdit` tenta `JSON.parse(supplierRecord.address_details)` mas esses campos não existem no schema real.  
**Fix:** Remover os blocos try/catch de `address_details` e `social_details`.

### BUG-26 · `useProductsManager.ts` — `toggleSelectAll` seleciona apenas página atual
**Nota:** UI não comunica claramente que "selecionar todos" = apenas esta página. Adicionar label explicativo.

### BUG-27 · `useProductsManager.ts` — `handlePageChange` não passa `advancedFilters` explicitamente
**Nota:** Funciona via closure, mas confuso e frágil. Documentado.

### BUG-28 · `useEngravingWizard.ts` — Área com `technique_name: '—'` sem alerta
**Nota:** Quando técnica é deletada do banco, área exibe '—' sem aviso. Documentado.

### BUG-29 · `useProductsManager.ts` — `useEffect` inicial com `[]` pode ter race condition
**Nota:** Se `pageSize` mudar antes do primeiro render, o estado inicial pode ser inconsistente. Documentado.

### BUG-30 · `useSuppliersManager.ts` — Social media fields na interface mas nunca lidos/escritos do DB
**Problema:** `instagram`, `facebook` etc. existem na interface `Supplier` mas `handleEdit` nunca os lê do DB para o estado local.  
**Fix:** Adicionar leitura em `handleEdit` (via `updateField`) + escrita no payload.

---

## Status por arquivo

| Arquivo | Bugs | Críticos | Altos | Médios | Baixos |
|---------|------|----------|-------|--------|--------|
| `useProductsManager.ts` | 8 | 0 | 4 | 2 | 2 |
| `useSuppliersManager.ts` | 12 | 2 | 4 | 4 | 2 |
| `SuppliersManager.tsx` | 1 | 1 | 0 | 0 | 0 |
| `useNewSupplierForm.ts` | 7 | 1 | 2 | 3 | 1 |
| `useEngravingWizard.ts` | 4 | 3 | 1 | 0 | 0 |
| **TOTAL** | **30** | **5** | **8** | **10** | **7** |

---

## Pendências pós-fix

- **BUG-03:** Fix completo requer alteração no `AdminProductFormPage` para chamar `flushLocalAreas(productId)` após criação do produto — escopo Sprint 3.
- **BUG-20:** Rename de logo pós-criação — requer lógica adicional no `handleCreate`.
- **BUG-26:** Adicionar label UX "X selecionados desta página" no `ProductsManager`.
