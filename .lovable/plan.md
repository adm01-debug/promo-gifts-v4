## Objetivo
Trocar o ícone do badge de aprovações de desconto (escudo amarelo no header, ao lado dos sinos) por `CircleDollarSign` do lucide-react.

## Mudança (2 linhas em 1 arquivo)

`src/components/admin/DiscountApprovalHeaderBadge.tsx`:

```diff
- import { Shield } from 'lucide-react';
+ import { CircleDollarSign } from 'lucide-react';
...
-          <Shield className="h-4 w-4 text-amber-500" />
+          <CircleDollarSign className="h-4 w-4 text-amber-500" />
```

## Fora de escopo
- Cor (mantém `text-amber-500`), tamanho, posicionamento, tooltip, lógica de contagem.
- Outros usos de `Shield*` (RLS, auth, segurança) — não confundir com aprovação de desconto.

## Validação
Visual: badge no header deve mostrar `$` dentro de círculo no lugar do escudo.
