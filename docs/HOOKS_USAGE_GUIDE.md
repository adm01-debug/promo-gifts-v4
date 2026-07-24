# 📚 Guia de Uso dos Hooks

## 🎯 useCRUD - Hook Reutilizável

### Exemplo: Produtos

```typescript
import { useCRUD } from '@/hooks/useCRUD';
import type { Product, ProductInput } from '@/types/database';

function useProductCRUD() {
  return useCRUD<Product, ProductInput>({
    tableName: 'products',
    queryKey: ['products'],
    entityName: 'Produto',
    validate: (input) => {
      if (!input.name || input.name.trim().length < 3) {
        throw new Error('Nome deve ter no mínimo 3 caracteres');
      }
      if (input.price <= 0) {
        throw new Error('Preço deve ser maior que zero');
      }
    },
    successMessages: {
      create: 'Produto adicionado ao catálogo!',
      update: 'Produto atualizado com sucesso!',
      delete: 'Produto removido do catálogo!',
    },
  });
}

// Uso no componente
function ProductForm() {
  const { create, update, remove } = useProductCRUD();

  const handleCreate = () => {
    create.mutate({
      name: 'Caneta',
      price: 2.50,
      category_id: '123',
    });
  };

  return (
    <button onClick={handleCreate} disabled={create.isLoading}>
      {create.isLoading ? 'Criando...' : 'Criar Produto'}
    </button>
  );
}
```

### Exemplo: Clientes

```typescript
function useClientCRUD() {
  return useCRUD<Client, ClientInput>({
    tableName: 'clients',
    queryKey: ['clients'],
    entityName: 'Cliente',
    validate: (input) => {
      if (!input.name || input.name.trim().length < 2) {
        throw new Error('Nome deve ter no mínimo 2 caracteres');
      }
      if (input.email && !input.email.includes('@')) {
        throw new Error('Email inválido');
      }
    },
  });
}
```

## 🚀 Optimistic Updates

Todos os hooks CRUD têm optimistic updates automático:

1. **UI atualiza instantaneamente** (antes da resposta do servidor)
2. **Rollback automático** em caso de erro
3. **Race condition prevention** (cancela queries duplicadas)

## ✅ Benefícios

- ✅ **DRY**: Sem duplicação de código
- ✅ **Type-Safe**: Generics para type inference
- ✅ **Optimistic Updates**: UX 10x melhor
- ✅ **Validação**: Customizável por entidade
- ✅ **Mensagens**: Customizáveis
- ✅ **Error Handling**: Completo e consistente

## 🎨 Componentes Melhorados

### LoadingSkeleton

```typescript
<ProductListSkeleton count={9} columns={3} />
<TableSkeleton rows={10} />
```

### ErrorMessage

```typescript
<ErrorMessage 
  error={error}
  severity="error" // ou "warning" ou "info"
  retryLabel="Tentar novamente"
  onRetry={refetch}
/>
```

### EmptyState

```typescript
<EmptyState
  size="lg"
  title="Nenhum produto encontrado"
  description="Adicione seu primeiro produto ao catálogo"
  image="/empty-box.svg"
  action={<Button>Adicionar Produto</Button>}
  secondaryAction={<Link>Ver tutorial</Link>}
  IconComponent={PackageOpen}
/>
```

---

## Padrões Aprendidos no Round 5 (2026-05-27)

### 1. Callbacks de Pai → Sempre via Ref

**Problema:** Callbacks passados como props ou argumentos a hooks (ex: `onResult`, `onSearch`, `onError`) quase nunca são memoizados pelo consumidor. Colocá-los nas deps de `useEffect` que criam recursos caros (SpeechRecognition, WebSocket, setInterval) destrói e recria esses recursos a cada render.

```typescript
// ❌ ERRADO
useEffect(() => {
  const recognition = new SpeechRecognition();
  recognition.onresult = (e) => onResult(e); // onResult nas deps
}, [onResult]); // recria instância toda vez que o pai re-renderiza!

// ✅ CORRETO
const onResultRef = useRef(onResult);
onResultRef.current = onResult; // atualiza síncrono, sem useEffect

useEffect(() => {
  const recognition = new SpeechRecognition();
  recognition.onresult = (e) => onResultRef.current?.(e); // lê via ref
}, []); // deps estáveis — instância criada uma única vez
```

**Regra:** qualquer `onXxx` externo → `useRef`. Atualizar o ref **fora de useEffect** (diretamente no corpo do hook) para garantir que o valor está disponível no mesmo render.

---

### 2. mountedRef vs isMounted Local — Quando Usar Cada Um

**`isMounted` local (dentro do useEffect):**
```typescript
useEffect(() => {
  let isMounted = true;
  fetchData().then((d) => { if (isMounted) setData(d); });
  return () => { isMounted = false; };
}, []);
```
✅ Simples, escopo restrito ao effect. Use quando o fetch é **exclusivo** ao effect.

**`mountedRef` (useRef no nível do hook):**
```typescript
const mountedRef = useRef(true);
useEffect(() => {
  mountedRef.current = true;
  return () => { mountedRef.current = false; };
}, []);

const fetchData = useCallback(async () => {
  if (!mountedRef.current) return;
  const result = await query();
  if (!mountedRef.current) return;
  setData(result);
}, []); // mountedRef estável — sem precisar nas deps
```
✅ Use quando o fetch está num `useCallback` compartilhado (chamado de múltiplos effects ou handlers).

**Regra prática:** se o async está dentro do `useEffect` → use `isMounted` local. Se está em um `useCallback` → use `mountedRef`.

---

### 3. AbortController para Fetches Externos (ipify, ipapi, etc.)

```typescript
// ❌ ERRADO — sem abort
const fetchIP = useCallback(async () => {
  const r = await fetch('https://api.ipify.org?format=json'); // sem signal
  setIP((await r.json()).ip); // pode chamar após unmount
}, []);

// ✅ CORRETO
const fetchIP = useCallback(async (signal?: AbortSignal) => {
  try {
    const r = await fetch('https://api.ipify.org?format=json', { signal });
    if (mountedRef.current) setIP((await r.json()).ip);
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return; // silenciar
    console.error(e);
  }
}, []);

useEffect(() => {
  mountedRef.current = true;
  const ctrl = new AbortController();
  fetchIP(ctrl.signal);
  return () => { mountedRef.current = false; ctrl.abort(); };
}, [fetchIP]);
```

**Regra:** todo `fetch()` a URL externa → parâmetro `signal?: AbortSignal` + silenciar `AbortError`.

---

### 4. Timing State → useRef por Instância, Nunca Module-Level

```typescript
// ❌ ERRADO — singleton compartilhado entre instâncias e entre testes
let lastActionAt = 0; // escopo de módulo

function useMyHook() {
  // lastActionAt é o mesmo para todas as instâncias!
}

// ✅ CORRETO — isolado por instância
function useMyHook() {
  const lastActionAtRef = useRef(0);
  // cada mount tem seu próprio contador
}
```

**Regra:** qualquer variável de estado mutable (contadores, timestamps, flags de debounce/throttle) que o hook precisa entre renders → `useRef`. Nunca em escopo de módulo.

---

### 5. finally { setLoading(false) } — Deve Ser Condicional

```typescript
// ❌ ERRADO — dispara mesmo após unmount
finally {
  setIsLoading(false); // setState em componente desmontado!
}

// ✅ CORRETO
finally {
  if (mountedRef.current) setIsLoading(false);
}
```

**Regra:** todo `finally` com `setState` deve checar `mountedRef.current`.
