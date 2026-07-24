# Módulo de Customização (personalização/gravação)

Componentes e utilitários para configurar gravações em produtos B2B
(dimensões, cores, preço reativo, cabeçalho da gravação confirmada).

Arquivos principais:

- `ConfigurationPanelV6.tsx` — painel de configuração + cabeçalho da
  gravação confirmada. Aceita a prop `confirmedIcon?: ReactNode` para
  trocar o ícone padrão (`<Check />`) ou ocultá-lo com `null`.
- `LocationPanel.tsx` — orquestra múltiplas técnicas por local.
- `TechniqueCard.tsx`, `VariationSelector.tsx` — seleção da técnica.
- `@/lib/customization/format-engraving-title.ts` — SSOT de formatação
  do nome da gravação (documentado abaixo).

---

## `formatEngravingTitle`

SSOT usado por `ConfigurationPanelV6` e pelo resumo do orçamento
(`QuoteBuilderSummaryColumn`, `QuoteItemsTable`, `QuoteItemDetailSheet`)
para exibir o nome da gravação de forma consistente.

### Assinatura

```ts
formatEngravingTitle({
  nomeTabela?: string | null;   // 1º fallback — vindo do preço (RPC v6)
  techniqueName?: string | null;// 2º fallback — nome da técnica
  groupName?: string | null;    // 3º fallback — grupo (ex.: "Laser")
  fallback?: string;            // 4º fallback — default "Gravação confirmada"
}): string
```

### Regras

1. **Fallback encadeado**: primeiro valor não-vazio de
   `nomeTabela → techniqueName → groupName → fallback`.
2. **Separadores normalizados**: `|`, `/`, `-`, `–`, `—` viram `" | "`.
3. **Espaços múltiplos** são colapsados e `trim` aplicado.
4. **Capitalização por palavra**, preservando:
   - Siglas conhecidas: `UV`, `DTF`, `DTG`, `CNC`, `LED`, `PVC`,
     `ABS`, `PU`, `2D`, `3D`, `4D`.
   - Tokens já em CAIXA ALTA (2–4 letras).
   - Tokens numéricos compostos (`10ml → 10ML`).

### Exemplos

| Entrada                                   | Saída                              |
| ----------------------------------------- | ---------------------------------- |
| `{ nomeTabela: 'FIBER LASER \| PLANA' }`  | `Fiber Laser \| Plana`             |
| `{ nomeTabela: 'fiber laser/plana' }`     | `Fiber Laser \| Plana`             |
| `{ nomeTabela: 'DTF\|uv' }`               | `DTF \| UV`                        |
| `{ nomeTabela: '3D-uv' }`                 | `3D \| UV`                         |
| `{ nomeTabela: 'tampografia 10ml' }`      | `Tampografia 10ML`                 |
| `{ nomeTabela: '   ', techniqueName: 'serigrafia' }` | `Serigrafia`            |
| `{ groupName: 'laser' }`                  | `Laser`                            |
| `{}`                                      | `Gravação confirmada`              |
| `{ fallback: 'Sem gravação' }`            | `Sem gravação`                     |

### Cabeçalho da gravação confirmada — estados

`ConfigurationPanelV6` renderiza o cabeçalho em três estados:

1. **Preço carregado** (`price.nome_tabela` presente): exibe o nome
   formatado com o ícone `<Check />`.
2. **Preço carregando** (`loading && !price.nome_tabela`): exibe um
   **skeleton `animate-pulse`** com largura fixa (`w-24`) para evitar
   flicker/CLS enquanto a RPC responde.
3. **Preço indisponível** (sem `nome_tabela`, sem loading): cai para
   `technique.name` → `grupo_tecnica` → `"Gravação confirmada"`.

### Personalizando o ícone

```tsx
<ConfigurationPanelV6
  {...props}
  confirmedIcon={<Sparkles className="h-3.5 w-3.5 text-primary" />}
/>

{/* ou oculto */}
<ConfigurationPanelV6 {...props} confirmedIcon={null} />
```

---

## Testes

- `src/lib/customization/__tests__/format-engraving-title.test.ts`
  — 15 casos cobrindo fallbacks, separadores incomuns, siglas e
  capitalização.
- `src/components/products/customization/__tests__/ConfigurationPanelV6.confirmed-title.test.tsx`
  — cabeçalho da gravação confirmada, skeleton, ícone customizado,
  transição `loading → loaded` (sem piscadas).
- `src/components/products/customization/__tests__/ConfigurationPanelV6.collapse.test.tsx`
  — toggle de colapso e persistência via localStorage.
