/**
 * Harness dev-only para E2E do fluxo CNPJ:
 *   digitar mascarado → estado guarda somente dígitos → renderização
 *   mascarada é idêntica em "input", "card selecionado" e "histórico do dropdown".
 *
 * Rota: /__test/cnpj-form
 * Sem auth, sem side-effects (não faz requisição ao BD).
 */
import { useState } from 'react';
import { maskCnpj, normalizeCnpj, isNormalizedCnpj } from '@/utils/masks';
import { assertPersistableCnpj } from '@/utils/cnpj-schema';

interface SavedShape {
  cnpj: string | null;
  maskedForDisplay: string;
  digitsOnly: boolean;
}

// Expõe último payload salvo para o Playwright inspecionar via window.
declare global {
  interface Window {
    __lastCnpjPayload?: SavedShape;
  }
}

/**
 * Lê `?initial=<valor mascarado ou não>` para simular abertura do
 * formulário em modo "Editar" com um CNPJ já persistido (possivelmente
 * mascarado). Normalizamos para dígitos-only ao carregar — o display
 * continua via maskCnpj.
 */
function readInitialFromQuery(): string {
  if (typeof window === 'undefined') return '';
  const raw = new URLSearchParams(window.location.search).get('initial') ?? '';
  return normalizeCnpj(raw);
}

export default function CnpjFormHarness() {
  const [cnpj, setCnpj] = useState<string>(() => readInitialFromQuery());
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<SavedShape | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const persistable = assertPersistableCnpj(cnpj);
      const payload: SavedShape = {
        cnpj: persistable,
        maskedForDisplay: maskCnpj(persistable ?? ''),
        digitsOnly: persistable === null || /^\d+$/.test(persistable),
      };
      setSaved(payload);
      window.__lastCnpjPayload = payload;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  };

  return (
    <div
      className="min-h-dvh w-full bg-background p-6"
      data-testid="cnpj-harness-ready"
    >
      <form
        onSubmit={handleSubmit}
        className="mx-auto flex max-w-md flex-col gap-3"
      >
        <label className="text-sm font-medium" htmlFor="cnpj">
          CNPJ
        </label>
        <input
          id="cnpj"
          data-testid="cnpj-input"
          className="rounded border border-border bg-background px-3 py-2 font-mono"
          value={maskCnpj(cnpj)}
          onChange={(e) => setCnpj(normalizeCnpj(e.target.value))}
          placeholder="00.000.000/0000-00"
          maxLength={18}
          inputMode="numeric"
        />
        <div
          data-testid="cnpj-state-raw"
          data-cnpj-raw={cnpj}
          data-cnpj-is-normalized={String(isNormalizedCnpj(cnpj))}
          className="text-xs text-muted-foreground"
        >
          Estado bruto: <span className="font-mono">{cnpj || '(vazio)'}</span>
        </div>
        <button
          type="submit"
          data-testid="cnpj-submit"
          className="rounded bg-primary px-4 py-2 text-primary-foreground"
        >
          Salvar
        </button>
        {error && (
          <p data-testid="cnpj-error" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </form>

      {saved && (
        <div className="mx-auto mt-6 max-w-md space-y-2">
          <div
            data-testid="cnpj-saved-payload"
            data-cnpj-persisted={saved.cnpj ?? ''}
            data-cnpj-digits-only={String(saved.digitsOnly)}
            className="rounded border border-border p-3 font-mono text-xs"
          >
            Persistido: {saved.cnpj ?? '(null)'}
          </div>
          {/* Espelha exatamente a formatação usada no card selecionado */}
          <div
            data-testid="cnpj-selected-card"
            className="rounded border border-border p-3"
          >
            <span className="font-mono text-xs text-muted-foreground">
              {saved.maskedForDisplay}
            </span>
          </div>
          {/* Espelha exatamente a formatação usada no histórico do dropdown */}
          <div
            data-testid="cnpj-dropdown-history"
            className="rounded border border-border p-3"
          >
            <span className="font-mono text-[11px] text-muted-foreground/70">
              {saved.maskedForDisplay}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
