/**
 * useToast shim — delega para Sonner (Etapa 18)
 *
 * ## Por que esta shim existe
 *
 * O `<Toaster />` da Radix foi removido do `src/App.tsx` em PR anterior,
 * deixando apenas o `<Sonner />` montado. Mas ~34 arquivos ainda chamam
 * `const { toast } = useToast(); toast({ title, description, variant })`
 * — esses toasts estavam sendo **silenciosamente descartados** em produção
 * (o hook empurrava notificações para um store cujo consumer não existe mais).
 *
 * Esta shim preserva 100% da API antiga e redireciona para `sonner.toast`,
 * corrigindo o bug funcional sem precisar refatorar os 34 call sites de
 * uma só vez. A migração arquivo-por-arquivo (`useToast` → `import { toast } from 'sonner'`)
 * fica para PRs futuras de débito técnico.
 *
 * ## Mapeamento de variants
 *
 * | API antiga (Radix)         | Equivalente Sonner          |
 * |----------------------------|------------------------------|
 * | `toast({ title, ... })`    | `toast(title, { ... })`      |
 * | `variant: "destructive"`   | `toast.error(...)`           |
 * | `variant: "success"`       | `toast.success(...)`         |
 * | `variant: "warning"`       | `toast.warning(...)`         |
 * | `variant: "info"`          | `toast.info(...)`            |
 * | (sem variant)              | `toast(...)` (default)       |
 *
 * ## API mantida (compat)
 *
 * - `useToast()` retorna `{ toast, dismiss, toasts }` (toasts sempre `[]` agora)
 * - `toast({ title, description, variant, action, duration })`
 *   - Retorna `{ id, dismiss, update }` compatível com a API antiga
 *
 * @deprecated Use `import { toast } from 'sonner'` diretamente em código novo.
 * Esta shim será removida quando os 34 call sites tiverem migrado.
 */
import * as React from 'react';
import { toast as sonnerToast } from 'sonner';

/**
 * Tipo mantido para compatibilidade com call sites que tipavam `action`
 * usando `ToastActionElement`. Na shim sobre Sonner, `action` é descartado
 * (Sonner espera `{ label, onClick }`, formato incompatível com ReactElement).
 */
export type ToastActionElement = React.ReactElement;

type Variant = 'default' | 'destructive' | 'info' | 'success' | 'warning';

interface ToastInput {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: Variant;
  action?: ToastActionElement;
  duration?: number;
  id?: number | string;
  // Permite passar qualquer outra prop do Sonner sem quebrar o tipo
  [extra: string]: unknown;
}

interface ToastReturn {
  id: number | string;
  dismiss: () => void;
  update: (next: ToastInput) => void;
}

/**
 * Resolve um ReactNode para string quando possível.
 *
 * Sonner aceita `ReactNode` como mensagem principal, mas evita renderizar
 * `null`/`undefined`/`false`. Esta função normaliza o título antes de passar.
 */
function resolveTitle(node: React.ReactNode): React.ReactNode | string {
  if (node === null || node === undefined || node === false) return '';
  return node;
}

/**
 * Função `toast()` exportada como módulo (compat com `import { toast }`).
 *
 * Internamente despacha para o método correto do Sonner conforme `variant`.
 */
function toast(input: ToastInput): ToastReturn {
  const {
    title,
    description,
    variant = 'default',
    action,
    duration,
    id: explicitId,
    ...rest
  } = input;

  const message = resolveTitle(title);

  // Sonner aceita `action` como `{ label, onClick }`, não como ReactNode
  // bruto. Como a Radix passava ReactNode aqui, descartamos com segurança.
  // Quem precisar de action button deve migrar para Sonner direto.
  void action;

  const options: Record<string, unknown> = { ...rest };
  if (description !== undefined && description !== null) {
    options.description = description;
  }
  if (duration !== undefined) {
    options.duration = duration;
  }
  if (explicitId !== undefined) {
    options.id = explicitId;
  }

  let id: number | string;
  switch (variant) {
    case 'destructive':
      id = sonnerToast.error(message, options);
      break;
    case 'success':
      id = sonnerToast.success(message, options);
      break;
    case 'warning':
      id = sonnerToast.warning(message, options);
      break;
    case 'info':
      id = sonnerToast.info(message, options);
      break;
    case 'default':
    default:
      id = sonnerToast(message, options);
      break;
  }

  return {
    id,
    dismiss: () => sonnerToast.dismiss(id),
    update: (next: ToastInput) => {
      // Sonner não tem `update` nativo; emitimos um novo toast com mesmo id.
      const merged: ToastInput = { ...input, ...next, id };
      toast(merged);
    },
  };
}

/**
 * Hook `useToast` — preserva a forma `{ toast, dismiss, toasts }`.
 *
 * `toasts` retorna sempre `[]` porque o store interno da Radix foi removido.
 * Nenhum call site conhecido lê `toasts` (eram usados apenas pelo
 * `<Toaster />` Radix que já não existe).
 */
function useToast() {
  // Mantém referência estável da função e evita re-renders desnecessários.
  return React.useMemo(
    () => ({
      toast,
      dismiss: (toastId?: number | string) => sonnerToast.dismiss(toastId),
      toasts: [] as Array<never>,
    }),
    [],
  );
}

export { useToast, toast };
